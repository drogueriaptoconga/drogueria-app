const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper para calcular margen
function calcMargin(costo, precio) {
    if (!costo || !precio || precio <= 0) return null;
    const c = parseFloat(costo);
    const p = parseFloat(precio);
    if (!isNaN(c) && !isNaN(p) && p > 0) {
        return parseFloat((((p - c) / p) * 100).toFixed(2));
    }
    return null;
}

async function sincronizarSecuenciaId(client, tabla, columna = 'id') {
    try {
        const seqResult = await client.query(
            'SELECT pg_get_serial_sequence($1, $2) AS seq_name',
            [tabla, columna]
        );

        const seqName = seqResult.rows[0]?.seq_name;
        if (!seqName) {
            return null;
        }

        const maxResult = await client.query(`SELECT COALESCE(MAX(${columna}), 0) AS max_value FROM ${tabla}`);
        const maxValue = parseInt(maxResult.rows[0]?.max_value, 10) || 0;
        const nextValue = maxValue + 1;

        await client.query('SELECT setval($1, $2, true)', [seqName, nextValue]);
        return nextValue;
    } catch (error) {
        console.warn('⚠️ No se pudo sincronizar la secuencia:', error.message);
        return null;
    }
}

// =============================
// Ruta para buscar productos (ACTUALIZADA)
// =============================
router.get('/buscar', async (req, res) => {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
        return res.status(400).json({ error: 'Se requiere un término de búsqueda de al menos 2 caracteres' });
    }

    const searchQuery = `%${query.trim()}%`;
    
    const sql = `
        SELECT 
            id, 
            codigo_producto, 
            nombre, 
            stock_total, 
            costo_unidad, 
            precio_unidad,
            margen_porcentaje,
            stock_minimo_alerta,
            venta_por_unidad_habilitada, 
            vender_por_sobre, 
            unidades_por_sobre, 
            precio_por_sobre,
            margen_sobre,
            vender_por_caja, 
            unidades_por_caja, 
            precio_por_caja,
            margen_caja,
            venta_exclusiva_sobre,
            precio_solo_sobre,
            margen_solo_sobre,
            cantidad_solo_sobre,
            venta_exclusiva_caja,
            precio_solo_caja,
            margen_solo_caja,
            cantidad_solo_caja,
            fecha_vencimiento,
            dias_alerta_vencimiento
        FROM productos 
        WHERE codigo_producto ILIKE $1 OR nombre ILIKE $2
        ORDER BY nombre ASC
        LIMIT 10
    `;

    try {
        const result = await db.query(sql, [searchQuery, searchQuery]);
        res.json(result.rows);
        
    } catch (err) {
        console.error('❌ Error en búsqueda de productos:', err);
        res.status(500).json({ 
            error: 'Error interno del servidor al buscar productos',
            detalle: err.message
        });
    }
});

// =============================
// Ruta para registrar entrada - ✅ FORMULAS CORREGIDAS
// =============================
router.post('/', async (req, res) => {
    // ✅ ELIMINAR ID DEL BODY SI VIENE (CORRECCIÓN)
    if (req.body.id !== undefined) {
        console.log('⚠️ Eliminando id del body (valor:', req.body.id, ') para evitar duplicados');
        delete req.body.id;
    }
    
    const { 
        producto_id, 
        cantidad_entrada, 
        costo_unidad_entrada, 
        precio_unidad_entrada,
        precio_por_sobre_entrada,
        precio_por_caja_entrada,
        precio_solo_sobre_entrada,
        precio_solo_caja_entrada,
        fecha_vencimiento,
        usuario_id = 1 
    } = req.body;

    if (process.env.NODE_ENV !== 'production') {
        console.log('📦 Registrando entrada:', { 
            producto_id, 
            cantidad_entrada, 
            costo_unidad_entrada, 
            precio_unidad_entrada,
            precio_por_sobre_entrada,
            precio_por_caja_entrada,
            precio_solo_sobre_entrada,
            precio_solo_caja_entrada
        });
    }

    // Validaciones básicas
    if (!producto_id || !cantidad_entrada || !costo_unidad_entrada) {
        return res.status(400).json({ 
            error: 'Faltan campos obligatorios: producto_id, cantidad_entrada, costo_unidad_entrada' 
        });
    }

    if (cantidad_entrada <= 0 || costo_unidad_entrada <= 0) {
        return res.status(400).json({ 
            error: 'La cantidad y costo deben ser mayores a 0' 
        });
    }

    // Obtener cliente de la conexión
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Validar datos numéricos recibidos
        const cantidadNueva = Number(cantidad_entrada);
        const nuevoCosto = Number(costo_unidad_entrada);
        if (!Number.isInteger(cantidadNueva) || cantidadNueva <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La cantidad de entrada debe ser un número entero positivo' });
        }
        if (!Number.isFinite(nuevoCosto) || nuevoCosto <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El costo de compra debe ser un número válido mayor a 0' });
        }

        // 2. Obtener información actual del producto con bloqueo de fila
        const productResult = await client.query(
            `SELECT * FROM productos WHERE id = $1 FOR UPDATE`, 
            [producto_id]
        );

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const producto = productResult.rows[0];
        const stockAnterior = parseInt(producto.stock_total, 10) || 0;
        const costoAnterior = producto.costo_unidad !== null ? parseFloat(producto.costo_unidad) : 0;
        const nuevoStock = stockAnterior + cantidadNueva;

        let costoPromedioFinal = nuevoCosto;
        if (stockAnterior > 0 && costoAnterior > 0) {
            costoPromedioFinal = parseFloat(((costoAnterior + nuevoCosto) / 2).toFixed(2));
        }
        
        // 3. Determinar nuevos precios según el modo de venta
        let nuevoPrecioUnidad = producto.precio_unidad;
        let nuevoPrecioSobre = producto.precio_por_sobre;
        let nuevoPrecioCaja = producto.precio_por_caja;
        let nuevoPrecioSoloSobre = producto.precio_solo_sobre;
        let nuevoPrecioSoloCaja = producto.precio_solo_caja;
        
        if (precio_unidad_entrada !== undefined && precio_unidad_entrada !== null && precio_unidad_entrada !== '') {
            nuevoPrecioUnidad = parseFloat(precio_unidad_entrada);
        }
        
        if (precio_por_sobre_entrada !== undefined && precio_por_sobre_entrada !== null && precio_por_sobre_entrada !== '') {
            nuevoPrecioSobre = parseFloat(precio_por_sobre_entrada);
        }
        
        if (precio_por_caja_entrada !== undefined && precio_por_caja_entrada !== null && precio_por_caja_entrada !== '') {
            nuevoPrecioCaja = parseFloat(precio_por_caja_entrada);
        }

        if (precio_solo_sobre_entrada !== undefined && precio_solo_sobre_entrada !== null && precio_solo_sobre_entrada !== '') {
            nuevoPrecioSoloSobre = parseFloat(precio_solo_sobre_entrada);
        }

        if (precio_solo_caja_entrada !== undefined && precio_solo_caja_entrada !== null && precio_solo_caja_entrada !== '') {
            nuevoPrecioSoloCaja = parseFloat(precio_solo_caja_entrada);
        }

        // 4. CALCULAR NUEVOS MÁRGENES
        const nuevoMargenUnidad = calcMargin(nuevoCosto, nuevoPrecioUnidad);
        
        let nuevoMargenSobre = null;
        let nuevoMargenCaja = null;
        let nuevoMargenSoloSobre = null;
        let nuevoMargenSoloCaja = null;

        if (producto.vender_por_sobre && nuevoPrecioSobre && producto.unidades_por_sobre) {
            const costoSobre = nuevoCosto * producto.unidades_por_sobre;
            nuevoMargenSobre = calcMargin(costoSobre, nuevoPrecioSobre);
        }

        if (producto.vender_por_caja && nuevoPrecioCaja && producto.unidades_por_caja) {
            const costoCaja = nuevoCosto * producto.unidades_por_caja;
            nuevoMargenCaja = calcMargin(costoCaja, nuevoPrecioCaja);
        }

        if (producto.venta_exclusiva_sobre && nuevoPrecioSoloSobre && producto.cantidad_solo_sobre) {
            const costoSoloSobre = nuevoCosto * producto.cantidad_solo_sobre;
            nuevoMargenSoloSobre = calcMargin(costoSoloSobre, nuevoPrecioSoloSobre);
        }

        if (producto.venta_exclusiva_caja && nuevoPrecioSoloCaja && producto.cantidad_solo_caja) {
            const costoSoloCaja = nuevoCosto * producto.cantidad_solo_caja;
            nuevoMargenSoloCaja = calcMargin(costoSoloCaja, nuevoPrecioSoloCaja);
        }

        if (fecha_vencimiento) {
            const fechaVenc = new Date(fecha_vencimiento);
            if (Number.isNaN(fechaVenc.getTime())) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'La fecha de vencimiento no es válida' });
            }
        }

        // 5. Registrar la entrada en el historial - ✅ SIN ID duplicado
        const siguienteId = await sincronizarSecuenciaId(client, 'entradas_stock', 'id');

        const entradaQuery = siguienteId
            ? `
                INSERT INTO entradas_stock 
                (id, producto_id, cantidad_entrada, fecha_entrada, costo_unidad_entrada, fecha_vencimiento, usuario_id, costo_anterior, costo_nuevo) 
                VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8)
                RETURNING id
            `
            : `
                INSERT INTO entradas_stock 
                (producto_id, cantidad_entrada, fecha_entrada, costo_unidad_entrada, fecha_vencimiento, usuario_id, costo_anterior, costo_nuevo) 
                VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
                RETURNING id
            `;

        const entradaParams = siguienteId
            ? [siguienteId, producto_id, cantidad_entrada, nuevoCosto, fecha_vencimiento, usuario_id, costoAnterior, costoPromedioFinal]
            : [producto_id, cantidad_entrada, nuevoCosto, fecha_vencimiento, usuario_id, costoAnterior, costoPromedioFinal];
        
        const entradaResult = await client.query(entradaQuery, entradaParams);

        // 6. Actualizar el producto con los nuevos valores
        const updateProductoQuery = `
            UPDATE productos 
            SET 
                stock_total = $1, 
                costo_unidad = $2, 
                precio_unidad = $3,
                precio_por_sobre = $4,
                precio_por_caja = $5,
                precio_solo_sobre = $6,
                precio_solo_caja = $7,
                margen_porcentaje = $8,
                margen_sobre = $9,
                margen_caja = $10,
                margen_solo_sobre = $11,
                margen_solo_caja = $12,
                fecha_ultima_entrada = NOW()
            WHERE id = $13
        `;
        
        await client.query(updateProductoQuery, [
            nuevoStock, 
            costoPromedioFinal,
            nuevoPrecioUnidad,
            nuevoPrecioSobre,
            nuevoPrecioCaja,
            nuevoPrecioSoloSobre,
            nuevoPrecioSoloCaja,
            nuevoMargenUnidad,
            nuevoMargenSobre,
            nuevoMargenCaja,
            nuevoMargenSoloSobre,
            nuevoMargenSoloCaja,
            producto_id
        ]);

        await client.query('COMMIT');

        // 7. Preparar respuesta con datos relevantes según el modo
        const responseData = {
            message: '✅ Entrada de stock registrada exitosamente',
            datos: {
                stock_anterior: stockAnterior,
                stock_nuevo: nuevoStock,
                costo_anterior: costoAnterior,
                costo_nuevo: nuevoCosto,
                inversion_total: cantidad_entrada * nuevoCosto,
                entrada_id: entradaResult.rows[0].id
            }
        };

        // Agregar precios según modos activos
        if (producto.venta_por_unidad_habilitada) {
            responseData.datos.precio_unidad_nuevo = nuevoPrecioUnidad;
            responseData.datos.margen_unidad_nuevo = nuevoMargenUnidad;
        }

        if (producto.vender_por_sobre) {
            responseData.datos.precio_sobre_nuevo = nuevoPrecioSobre;
            responseData.datos.margen_sobre_nuevo = nuevoMargenSobre;
        }

        if (producto.vender_por_caja) {
            responseData.datos.precio_caja_nuevo = nuevoPrecioCaja;
            responseData.datos.margen_caja_nuevo = nuevoMargenCaja;
        }

        if (producto.venta_exclusiva_sobre) {
            responseData.datos.precio_solo_sobre_nuevo = nuevoPrecioSoloSobre;
            responseData.datos.margen_solo_sobre_nuevo = nuevoMargenSoloSobre;
        }

        if (producto.venta_exclusiva_caja) {
            responseData.datos.precio_solo_caja_nuevo = nuevoPrecioSoloCaja;
            responseData.datos.margen_solo_caja_nuevo = nuevoMargenSoloCaja;
        }

        res.status(201).json(responseData);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la transacción:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al registrar entrada', 
            detalle: error.message
        });
    } finally {
        client.release();
    }
});

// =============================
// Rutas de historial
// =============================
router.get('/historial', async (req, res) => {
    const { fecha_desde, fecha_hasta, page = 1, limit = 10 } = req.query;
    
    let query = `
        SELECT es.*, 
               p.codigo_producto, 
               p.nombre as producto_nombre,
               u.nombre_usuario as usuario_nombre
        FROM entradas_stock es
        LEFT JOIN productos p ON es.producto_id = p.id
        LEFT JOIN usuarios u ON es.usuario_id = u.id
        WHERE es.anulado = false
    `;
    let params = [];
    let paramCount = 1;

    if (fecha_desde) {
        query += ` AND DATE(es.fecha_entrada) >= $${paramCount}`;
        params.push(fecha_desde);
        paramCount++;
    }

    if (fecha_hasta) {
        query += ` AND DATE(es.fecha_entrada) <= $${paramCount}`;
        params.push(fecha_hasta);
        paramCount++;
    }

    try {
        // Query para contar total
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM entradas_stock es
            WHERE es.anulado = false
        `;
        let countParams = [];
        let countParamCount = 1;

        if (fecha_desde) {
            countQuery += ` AND DATE(es.fecha_entrada) >= $${countParamCount}`;
            countParams.push(fecha_desde);
            countParamCount++;
        }

        if (fecha_hasta) {
            countQuery += ` AND DATE(es.fecha_entrada) <= $${countParamCount}`;
            countParams.push(fecha_hasta);
            countParamCount++;
        }

        // Query principal
        query += ' ORDER BY es.fecha_entrada DESC, es.id DESC LIMIT $' + paramCount + ' OFFSET $' + (paramCount + 1);
        const offset = (page - 1) * limit;
        params.push(parseInt(limit), offset);

        const countResult = await db.query(countQuery, countParams);
        const result = await db.query(query, params);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            entradas: result.rows,
            paginacion: {
                pagina_actual: parseInt(page),
                total_paginas: totalPages,
                total_registros: total,
                por_pagina: parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Error al obtener historial:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================
// Ruta para estadísticas de entradas
// =============================
router.get('/estadisticas', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_entradas,
                SUM(cantidad_entrada) as total_unidades,
                SUM(cantidad_entrada * costo_unidad_entrada) as total_invertido,
                COUNT(DISTINCT producto_id) as productos_diferentes
            FROM entradas_stock
            WHERE anulado = false
        `;

        const result = await db.query(query);
        
        const estadisticas = {
            total_entradas: parseInt(result.rows[0].total_entradas) || 0,
            total_unidades: parseInt(result.rows[0].total_unidades) || 0,
            total_invertido: parseFloat(result.rows[0].total_invertido) || 0,
            productos_diferentes: parseInt(result.rows[0].productos_diferentes) || 0
        };
        
        res.json(estadisticas);
    } catch (err) {
        console.error('Error al obtener estadísticas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;