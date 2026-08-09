const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/roles');

function calcularDetalleVenta(producto, item) {
    const cantidadVendida = Number(item.cantidad_vendida) || 0;
    const tipoVenta = item.tipo_venta;

    let precioVentaPorItem = 0;
    let unidadesADescontar = 0;

    switch (tipoVenta) {
        case 'Unidad':
            precioVentaPorItem = Number(producto.precio_unidad) || 0;
            unidadesADescontar = cantidadVendida;
            break;
        case 'Sobre':
            precioVentaPorItem = Number(producto.precio_por_sobre) || 0;
            unidadesADescontar = cantidadVendida * (Number(producto.unidades_por_sobre) || 0);
            break;
        case 'Caja':
            precioVentaPorItem = Number(producto.precio_por_caja) || 0;
            unidadesADescontar = cantidadVendida * (Number(producto.unidades_por_caja) || 0);
            break;
        case 'Solo Sobre':
            precioVentaPorItem = Number(producto.precio_solo_sobre) || 0;
            // En modo exclusivo por sobre, el stock se maneja en sobres, no en unidades internas.
            unidadesADescontar = cantidadVendida;
            break;
        case 'Solo Caja':
            precioVentaPorItem = Number(producto.precio_solo_caja) || 0;
            // En modo exclusivo por caja, el stock se maneja en cajas.
            unidadesADescontar = cantidadVendida;
            break;
        default:
            throw new Error('Tipo de venta no válido');
    }

    return { precioVentaPorItem, unidadesADescontar };
}

// Ruta para crear una nueva venta
router.post('/', async (req, res) => {
    const { usuario_id, metodo_pago, monto_efectivo, monto_transferencia, productos } = req.body;

    // Obtener un cliente de la conexión para la transacción
    const client = await db.pool.connect();

    try {
        // Iniciar la transacción
        await client.query('BEGIN');

        // 1. Calcular el monto total de la venta
        const productIds = productos.map(p => p.producto_id);
        const productosResult = await client.query(
            'SELECT * FROM productos WHERE id = ANY($1::int[])',
            [productIds]
        );
        const productos_db = productosResult.rows;
        
        let monto_total = 0;
        for (const item of productos) {
            const producto = productos_db.find(p => p.id === item.producto_id);
            if (!producto) {
                throw new Error(`Producto con ID ${item.producto_id} no encontrado.`);
            }

            const { precioVentaPorItem, unidadesADescontar } = calcularDetalleVenta(producto, item);
            monto_total += precioVentaPorItem * Number(item.cantidad_vendida || 0);
            
            // Verificar stock suficiente
            const stockDisponible = Number(producto.stock_total) || 0;
            if (stockDisponible < unidadesADescontar) {
                throw new Error(`Stock insuficiente para el producto: ${producto.nombre}. Se requieren ${unidadesADescontar} unidades y hay ${stockDisponible} disponibles.`);
            }
        }
        monto_total = Math.round(monto_total);
        
        // 2. Insertar la venta en la tabla `ventas`
        const ventaResult = await client.query(
            `INSERT INTO ventas (usuario_id, fecha_venta, metodo_pago, monto_total, monto_efectivo, monto_transferencia) 
             VALUES ($1, NOW(), $2, $3, $4, $5) 
             RETURNING id`,
            [usuario_id, metodo_pago, monto_total, monto_efectivo, monto_transferencia]
        );
        const ventaId = ventaResult.rows[0].id;

        // 3. Insertar cada producto vendido en `detalle_venta` y actualizar el stock
        for (const item of productos) {
            const producto = productos_db.find(p => p.id === item.producto_id);

            const { precioVentaPorItem, unidadesADescontar } = calcularDetalleVenta(producto, item);

            await client.query(
                `INSERT INTO detalle_venta (venta_id, producto_id, cantidad_vendida, precio_venta, tipo_venta) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [ventaId, item.producto_id, item.cantidad_vendida, precioVentaPorItem, item.tipo_venta]
            );

            await client.query(
                `UPDATE productos SET stock_total = stock_total - $1 WHERE id = $2`,
                [unidadesADescontar, item.producto_id]
            );
        }

        // 4. Confirmar la transacción
        await client.query('COMMIT');
        res.status(201).json({ message: 'Venta procesada exitosamente', venta_id: ventaId });

    } catch (error) {
        // 5. Revertir la transacción si hay un error
        await client.query('ROLLBACK');
        console.error('Error en la transacción de venta:', error);
        res.status(400).json({ error: error.message });
    } finally {
        // 6. Liberar la conexión
        client.release();
    }
});

// Ruta para anular una venta con rollback de stock y auditoría
router.put('/:id/anular', requireAdmin, async (req, res) => {
    const ventaId = req.params.id;
    const motivoAnulacion = (req.body.motivo_anulacion || '').trim();
    const usuarioAnulacionId = parseInt(req.get('x-user-id')) || null;

    if (!motivoAnulacion) {
        return res.status(400).json({ error: 'Se requiere un motivo de anulación.' });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const ventaResult = await client.query(
            'SELECT id, COALESCE(anulado, false) AS anulado FROM ventas WHERE id = $1 FOR UPDATE',
            [ventaId]
        );

        if (ventaResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Venta no encontrada.' });
        }

        const venta = ventaResult.rows[0];
        if (venta.anulado === true) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La venta ya fue anulada previamente.' });
        }

        const detalleResult = await client.query(
            `SELECT dv.producto_id, dv.cantidad_vendida, dv.tipo_venta,
                    p.unidades_por_sobre,
                    p.unidades_por_caja,
                    p.cantidad_solo_sobre,
                    p.cantidad_solo_caja
             FROM detalle_venta dv
             JOIN productos p ON dv.producto_id = p.id
             WHERE dv.venta_id = $1`,
            [ventaId]
        );

        for (const item of detalleResult.rows) {
            let unidadesAReponer = 0;
            if (item.tipo_venta === 'Unidad') {
                unidadesAReponer = item.cantidad_vendida;
            } else if (item.tipo_venta === 'Sobre') {
                unidadesAReponer = item.cantidad_vendida * (item.unidades_por_sobre || 0);
            } else if (item.tipo_venta === 'Caja') {
                unidadesAReponer = item.cantidad_vendida * (item.unidades_por_caja || 0);
            } else if (item.tipo_venta === 'Solo Sobre') {
                // Reponer por sobres cuando la venta fue exclusiva por sobre
                unidadesAReponer = item.cantidad_vendida;
            } else if (item.tipo_venta === 'Solo Caja') {
                // Reponer por cajas cuando la venta fue exclusiva por caja
                unidadesAReponer = item.cantidad_vendida;
            }

            if (unidadesAReponer > 0) {
                await client.query(
                    'UPDATE productos SET stock_total = stock_total + $1 WHERE id = $2',
                    [unidadesAReponer, item.producto_id]
                );
            }
        }

        await client.query(
            `UPDATE ventas
             SET anulado = true,
                 estado = 'ANULADA',
                 motivo_anulacion = $1,
                 fecha_anulacion = NOW(),
                 usuario_anulacion_id = $2
             WHERE id = $3`,
            [motivoAnulacion, usuarioAnulacionId, ventaId]
        );

        await client.query('COMMIT');
        res.json({ message: 'Venta anulada correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al anular venta:', error);
        res.status(500).json({ error: 'Error interno al anular la venta.' });
    } finally {
        client.release();
    }
});

module.exports = router;