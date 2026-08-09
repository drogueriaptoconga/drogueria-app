const express = require('express');
const router = express.Router();
const db = require('../db');
const { resolveProductConflict } = require('./productosConflict');

// Helper: margen en % según definición actual (porcentaje sobre el precio de venta)
// margen = ((precio - costo) / precio) * 100
function calcMargin(costo, precio) {
    const c = parseFloat(costo);
    const p = parseFloat(precio);
    if (!isNaN(c) && !isNaN(p) && p > 0) {
        return parseFloat((((p - c) / p) * 100).toFixed(2));
    }
    return null;
}

async function getNextProductId() {
    const result = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM productos');
    return parseInt(result.rows[0].next_id, 10);
}

async function syncProductSequence(nextId) {
    await db.query("SELECT setval(pg_get_serial_sequence('productos', 'id'), $1, true)", [nextId]);
}

// =============================================
// RUTA 1: Obtener todos los productos
// =============================================
router.get('/', async (req, res) => {
    const searchTerm = req.query.search;
    const showExpired = req.query.expired === 'true';
    const showWarning = req.query.warning === 'true';
    const showLowStock = req.query.lowStock === 'true';
    
    let query = `
        SELECT *, 
            (fecha_vencimiento - CURRENT_DATE) as dias_restantes,
            CASE 
                WHEN fecha_vencimiento IS NULL THEN 'sin_fecha'
                WHEN fecha_vencimiento < CURRENT_DATE THEN 'expirado'
                WHEN fecha_vencimiento <= (CURRENT_DATE + (COALESCE(dias_alerta_vencimiento, 0) || ' days')::INTERVAL) THEN 'por_vencer'
                ELSE 'vigente'
            END as estado_vencimiento
        FROM productos
    `;
    let params = [];
    let conditions = [];
    let paramCount = 1;

    if (searchTerm) {
        conditions.push(`(nombre ILIKE $${paramCount} OR codigo_producto ILIKE $${paramCount + 1})`);
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        paramCount += 2;
    }

    if (showExpired) {
        conditions.push('fecha_vencimiento < CURRENT_DATE');
    }

    if (showWarning) {
        conditions.push('fecha_vencimiento IS NOT NULL AND fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= (CURRENT_DATE + (COALESCE(dias_alerta_vencimiento, 0) || \' days\')::INTERVAL)');
    }

    if (showLowStock) {
        conditions.push('fecha_vencimiento IS NOT NULL');
        conditions.push('stock_minimo_alerta IS NOT NULL');
        conditions.push('stock_total <= stock_minimo_alerta');
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY nombre ASC';

    try {
        const result = await db.query(query, params);
        const results = result.rows;
    
        // Redondear los valores monetarios y asegurar nulos controlados
        const productosRedondeados = results.map(producto => ({
            ...producto,
            costo_unidad: producto.costo_unidad !== null ? Math.round(producto.costo_unidad * 100) / 100 : 0,
            precio_unidad: producto.precio_unidad !== null ? Math.round(producto.precio_unidad * 100) / 100 : 0,
            precio_por_sobre: producto.precio_por_sobre !== null ? Math.round(producto.precio_por_sobre * 100) / 100 : null,
            precio_por_caja: producto.precio_por_caja !== null ? Math.round(producto.precio_por_caja * 100) / 100 : null,
            precio_solo_sobre: producto.precio_solo_sobre !== null ? Math.round(producto.precio_solo_sobre * 100) / 100 : null,
            precio_solo_caja: producto.precio_solo_caja !== null ? Math.round(producto.precio_solo_caja * 100) / 100 : null,
            margen_porcentaje: producto.margen_porcentaje !== null ? Math.round(producto.margen_porcentaje * 100) / 100 : null,
            margen_sobre: producto.margen_sobre !== null ? Math.round(producto.margen_sobre * 100) / 100 : null,
            margen_caja: producto.margen_caja !== null ? Math.round(producto.margen_caja * 100) / 100 : null,
            margen_solo_sobre: producto.margen_solo_sobre !== null ? Math.round(producto.margen_solo_sobre * 100) / 100 : null,
            margen_solo_caja: producto.margen_solo_caja !== null ? Math.round(producto.margen_solo_caja * 100) / 100 : null,
            cantidad_solo_sobre: producto.cantidad_solo_sobre !== null ? producto.cantidad_solo_sobre : null,
            cantidad_solo_caja: producto.cantidad_solo_caja !== null ? producto.cantidad_solo_caja : null,
            dias_restantes: producto.dias_restantes !== null ? parseInt(producto.dias_restantes) : null,
            estado_vencimiento: producto.estado_vencimiento || 'sin_fecha',
            venta_exclusiva_sobre: !!producto.venta_exclusiva_sobre,
            venta_exclusiva_caja: !!producto.venta_exclusiva_caja
        }));
        
        res.json(productosRedondeados);
    } catch (err) {
        console.error('Error al obtener productos:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================================
// RUTA 1.1: Estadísticas de productos
// =============================================
router.get('/estadisticas', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN stock_total <= stock_minimo_alerta THEN 1 ELSE 0 END) as stock_bajo,
                SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN 1 ELSE 0 END) as vencidos,
                SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= (CURRENT_DATE + (COALESCE(dias_alerta_vencimiento, 0) || ' days')::INTERVAL) THEN 1 ELSE 0 END) as por_vencer,
                SUM(CASE WHEN venta_exclusiva_sobre = true THEN 1 ELSE 0 END) as exclusivos_sobre,
                SUM(CASE WHEN venta_exclusiva_caja = true THEN 1 ELSE 0 END) as exclusivos_caja
            FROM productos
        `;
        
        const result = await db.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener estadísticas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================================
// RUTA 1.2: Alertas de vencimiento
// =============================================
router.get('/alertas/vencimientos', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                codigo_producto,
                nombre,
                fecha_vencimiento,
                dias_alerta_vencimiento,
                (fecha_vencimiento - CURRENT_DATE) as dias_restantes
            FROM productos 
            WHERE 
                fecha_vencimiento IS NOT NULL 
                AND fecha_vencimiento >= CURRENT_DATE 
                AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '7 days')
            ORDER BY fecha_vencimiento ASC
            LIMIT 10
        `;
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener alertas de vencimiento:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================================
// RUTA 2: Obtener producto por ID
// =============================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT *, 
            (fecha_vencimiento - CURRENT_DATE) as dias_restantes,
            CASE 
                WHEN fecha_vencimiento IS NULL THEN 'sin_fecha'
                WHEN fecha_vencimiento < CURRENT_DATE THEN 'expirado'
                WHEN fecha_vencimiento <= (CURRENT_DATE + (COALESCE(dias_alerta_vencimiento, 0) || ' days')::INTERVAL) THEN 'por_vencer'
                ELSE 'vigente'
            END as estado_vencimiento
        FROM productos 
        WHERE id = $1
    `;
    
    try {
        const result = await db.query(query, [id]);
        const results = result.rows;
        
        if (results.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }
        
        const p = results[0];
        const producto = {
            ...p,
            costo_unidad: p.costo_unidad !== null ? Math.round(p.costo_unidad * 100) / 100 : 0,
            precio_unidad: p.precio_unidad !== null ? Math.round(p.precio_unidad * 100) / 100 : 0,
            precio_por_sobre: p.precio_por_sobre !== null ? Math.round(p.precio_por_sobre * 100) / 100 : null,
            precio_por_caja: p.precio_por_caja !== null ? Math.round(p.precio_por_caja * 100) / 100 : null,
            precio_solo_sobre: p.precio_solo_sobre !== null ? Math.round(p.precio_solo_sobre * 100) / 100 : null,
            precio_solo_caja: p.precio_solo_caja !== null ? Math.round(p.precio_solo_caja * 100) / 100 : null,
            margen_porcentaje: p.margen_porcentaje !== null ? Math.round(p.margen_porcentaje * 100) / 100 : null,
            margen_sobre: p.margen_sobre !== null ? Math.round(p.margen_sobre * 100) / 100 : null,
            margen_caja: p.margen_caja !== null ? Math.round(p.margen_caja * 100) / 100 : null,
            margen_solo_sobre: p.margen_solo_sobre !== null ? Math.round(p.margen_solo_sobre * 100) / 100 : null,
            margen_solo_caja: p.margen_solo_caja !== null ? Math.round(p.margen_solo_caja * 100) / 100 : null,
            venta_exclusiva_sobre: !!p.venta_exclusiva_sobre,
            venta_exclusiva_caja: !!p.venta_exclusiva_caja
        };
        
        res.json(producto);
    } catch (err) {
        console.error('Error al obtener el producto:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================================
// RUTA 3: Crear producto
// =============================================
router.post('/', async (req, res) => {
    const { 
        codigo_producto, nombre, costo_unidad, precio_unidad, stock_total,
        margen_porcentaje, stock_minimo_alerta, venta_por_unidad_habilitada,
        vender_por_sobre, unidades_por_sobre, precio_por_sobre,
        vender_por_caja, unidades_por_caja, precio_por_caja,
        fecha_vencimiento, dias_alerta_vencimiento,
        venta_exclusiva_sobre, cantidad_solo_sobre, precio_solo_sobre,
        venta_exclusiva_caja, cantidad_solo_caja, precio_solo_caja,
        allowOverwrite = false
    } = req.body;

    // Validaciones básicas
    if (!codigo_producto || !nombre || costo_unidad === undefined || stock_total === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        const existingResult = await db.query(
            'SELECT id, codigo_producto FROM productos WHERE codigo_producto = $1',
            [codigo_producto]
        );
        const existingProduct = existingResult.rows[0];
        const conflictDecision = resolveProductConflict(existingProduct, allowOverwrite);

        if (conflictDecision.action === 'reject') {
            return res.status(409).json({ error: 'El código de producto ya existe' });
        }

        // Calcular márgenes
        const m_unidad = calcMargin(costo_unidad, precio_unidad);
        
        let m_sobre = null;
        let m_caja = null;
        let m_solo_sobre = null;
        let m_solo_caja = null;

        if (vender_por_sobre && unidades_por_sobre && precio_por_sobre) {
            const costoSobre = costo_unidad * unidades_por_sobre;
            m_sobre = calcMargin(costoSobre, precio_por_sobre);
        }

        if (vender_por_caja && unidades_por_caja && precio_por_caja) {
            const costoCaja = costo_unidad * unidades_por_caja;
            m_caja = calcMargin(costoCaja, precio_por_caja);
        }

        if (venta_exclusiva_sobre && cantidad_solo_sobre && precio_solo_sobre) {
            const costoSoloSobre = costo_unidad * cantidad_solo_sobre;
            m_solo_sobre = calcMargin(costoSoloSobre, precio_solo_sobre);
        }

        if (venta_exclusiva_caja && cantidad_solo_caja && precio_solo_caja) {
            const costoSoloCaja = costo_unidad * cantidad_solo_caja;
            m_solo_caja = calcMargin(costoSoloCaja, precio_solo_caja);
        }

        const values = [
            codigo_producto, nombre, costo_unidad, precio_unidad, stock_total,
            m_unidad || null, stock_minimo_alerta || null,
            venta_por_unidad_habilitada || false,
            vender_por_sobre || false, unidades_por_sobre || null, precio_por_sobre || null,
            vender_por_caja || false, unidades_por_caja || null, precio_por_caja || null,
            fecha_vencimiento || null, dias_alerta_vencimiento || null,
            m_sobre || null, m_caja || null,
            venta_exclusiva_sobre || false, cantidad_solo_sobre || stock_total, precio_solo_sobre || null, m_solo_sobre || null,
            venta_exclusiva_caja || false, cantidad_solo_caja || stock_total, precio_solo_caja || null, m_solo_caja || null
        ];

        let result;
        let message;
        let statusCode;

        if (conflictDecision.action === 'update') {
            const updateQuery = `
                UPDATE productos SET
                    nombre = $1, costo_unidad = $2, precio_unidad = $3, stock_total = $4,
                    margen_porcentaje = $5, stock_minimo_alerta = $6, venta_por_unidad_habilitada = $7,
                    vender_por_sobre = $8, unidades_por_sobre = $9, precio_por_sobre = $10,
                    vender_por_caja = $11, unidades_por_caja = $12, precio_por_caja = $13,
                    fecha_vencimiento = $14, dias_alerta_vencimiento = $15,
                    margen_sobre = $16, margen_caja = $17,
                    venta_exclusiva_sobre = $18, cantidad_solo_sobre = $19, precio_solo_sobre = $20, margen_solo_sobre = $21,
                    venta_exclusiva_caja = $22, cantidad_solo_caja = $23, precio_solo_caja = $24, margen_solo_caja = $25
                WHERE id = $26
                RETURNING id
            `;

            result = await db.query(updateQuery, [
                nombre, costo_unidad, precio_unidad, stock_total,
                m_unidad || null, stock_minimo_alerta || null,
                venta_por_unidad_habilitada || false,
                vender_por_sobre || false, unidades_por_sobre || null, precio_por_sobre || null,
                vender_por_caja || false, unidades_por_caja || null, precio_por_caja || null,
                fecha_vencimiento || null, dias_alerta_vencimiento || null,
                m_sobre || null, m_caja || null,
                venta_exclusiva_sobre || false, cantidad_solo_sobre || stock_total, precio_solo_sobre || null, m_solo_sobre || null,
                venta_exclusiva_caja || false, cantidad_solo_caja || stock_total, precio_solo_caja || null, m_solo_caja || null,
                existingProduct.id
            ]);
            message = 'Producto actualizado sobrescribiendo el existente';
            statusCode = 200;
        } else {
            const nextId = await getNextProductId();
            await syncProductSequence(nextId);

            const insertQuery = `
                INSERT INTO productos (
                    id, codigo_producto, nombre, costo_unidad, precio_unidad, stock_total,
                    margen_porcentaje, stock_minimo_alerta, venta_por_unidad_habilitada,
                    vender_por_sobre, unidades_por_sobre, precio_por_sobre,
                    vender_por_caja, unidades_por_caja, precio_por_caja,
                    fecha_vencimiento, dias_alerta_vencimiento,
                    margen_sobre, margen_caja,
                    venta_exclusiva_sobre, cantidad_solo_sobre, precio_solo_sobre, margen_solo_sobre,
                    venta_exclusiva_caja, cantidad_solo_caja, precio_solo_caja, margen_solo_caja
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
                RETURNING id
            `;

            const insertValues = [nextId, ...values];
            result = await db.query(insertQuery, insertValues);
            message = 'Producto creado exitosamente';
            statusCode = 201;
        }

        res.status(statusCode).json({
            message,
            id: result.rows[0].id,
            overwritten: conflictDecision.action === 'update'
        });
    } catch (err) {
        console.error('Error al crear el producto:', err);
        res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
    }
});

// =============================================
// RUTA 4: Actualizar producto
// =============================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        codigo_producto, nombre, costo_unidad, precio_unidad, stock_total,
        margen_porcentaje, stock_minimo_alerta, venta_por_unidad_habilitada,
        vender_por_sobre, unidades_por_sobre, precio_por_sobre,
        vender_por_caja, unidades_por_caja, precio_por_caja,
        fecha_vencimiento, dias_alerta_vencimiento,
        venta_exclusiva_sobre, cantidad_solo_sobre, precio_solo_sobre,
        venta_exclusiva_caja, cantidad_solo_caja, precio_solo_caja
    } = req.body;
    
    if (!codigo_producto || !nombre || costo_unidad === undefined || stock_total === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        // Verificar si el código ya existe en otro producto
        const existingResult = await db.query(
            'SELECT id FROM productos WHERE codigo_producto = $1 AND id != $2', 
            [codigo_producto, id]
        );
        
        if (existingResult.rows.length > 0) {
            return res.status(409).json({ error: 'El nuevo código de producto ya existe en otro producto.' });
        }

        const m_unidad = calcMargin(costo_unidad, precio_unidad);
        
        let m_sobre = null;
        let m_caja = null;
        let m_solo_sobre = null;
        let m_solo_caja = null;

        if (vender_por_sobre && unidades_por_sobre && precio_por_sobre) {
            const costoSobre = costo_unidad * unidades_por_sobre;
            m_sobre = calcMargin(costoSobre, precio_por_sobre);
        }

        if (vender_por_caja && unidades_por_caja && precio_por_caja) {
            const costoCaja = costo_unidad * unidades_por_caja;
            m_caja = calcMargin(costoCaja, precio_por_caja);
        }

        if (venta_exclusiva_sobre && cantidad_solo_sobre && precio_solo_sobre) {
            const costoSoloSobre = costo_unidad * cantidad_solo_sobre;
            m_solo_sobre = calcMargin(costoSoloSobre, precio_solo_sobre);
        }

        if (venta_exclusiva_caja && cantidad_solo_caja && precio_solo_caja) {
            const costoSoloCaja = costo_unidad * cantidad_solo_caja;
            m_solo_caja = calcMargin(costoSoloCaja, precio_solo_caja);
        }

        const query = `
            UPDATE productos SET
                codigo_producto = $1, nombre = $2, costo_unidad = $3, precio_unidad = $4, 
                stock_total = $5, margen_porcentaje = $6, stock_minimo_alerta = $7,
                venta_por_unidad_habilitada = $8, vender_por_sobre = $9,
                unidades_por_sobre = $10, precio_por_sobre = $11, vender_por_caja = $12,
                unidades_por_caja = $13, precio_por_caja = $14,
                fecha_vencimiento = $15, dias_alerta_vencimiento = $16,
                margen_sobre = $17, margen_caja = $18,
                venta_exclusiva_sobre = $19, cantidad_solo_sobre = $20, precio_solo_sobre = $21, margen_solo_sobre = $22,
                venta_exclusiva_caja = $23, cantidad_solo_caja = $24, precio_solo_caja = $25, margen_solo_caja = $26
            WHERE id = $27
        `;

        await db.query(query, 
            [
                codigo_producto, nombre, costo_unidad, precio_unidad, stock_total,
                m_unidad || null, stock_minimo_alerta || null,
                venta_por_unidad_habilitada || false,
                vender_por_sobre || false, unidades_por_sobre || null, precio_por_sobre || null,
                vender_por_caja || false, unidades_por_caja || null, precio_por_caja || null,
                fecha_vencimiento || null, dias_alerta_vencimiento || null,
                m_sobre || null, m_caja || null,
                venta_exclusiva_sobre || false, cantidad_solo_sobre || stock_total, precio_solo_sobre || null, m_solo_sobre || null,
                venta_exclusiva_caja || false, cantidad_solo_caja || stock_total, precio_solo_caja || null, m_solo_caja || null,
                id
            ]
        );
        
        res.json({ message: 'Producto actualizado exitosamente' });
    } catch (err) {
        console.error('Error al actualizar el producto:', err);
        res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
    }
});

// =============================================
// RUTA 5: Eliminar producto
// =============================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const productResult = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        await db.query('DELETE FROM productos WHERE id = $1', [id]);
        
        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar el producto:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================================
// RUTA 6: Actualizar stock
// =============================================
router.patch('/:id/stock', async (req, res) => {
    const { id } = req.params;
    const { cantidad, operacion } = req.body;
    
    if (!cantidad || !operacion || (operacion !== 'incrementar' && operacion !== 'disminuir')) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    
    try {
        const productResult = await db.query('SELECT stock_total FROM productos WHERE id = $1', [id]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const stockActual = productResult.rows[0].stock_total;
        let nuevoStock;
        
        if (operacion === 'incrementar') {
            nuevoStock = stockActual + parseInt(cantidad);
        } else {
            nuevoStock = stockActual - parseInt(cantidad);
            if (nuevoStock < 0) {
                return res.status(400).json({ error: 'No hay suficiente stock para disminuir' });
            }
        }
        
        await db.query('UPDATE productos SET stock_total = $1 WHERE id = $2', [nuevoStock, id]);
        
        res.json({ 
            message: 'Stock actualizado exitosamente',
            stock_anterior: stockActual,
            stock_actual: nuevoStock
        });
    } catch (err) {
        console.error('Error al actualizar el stock:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================================
// RUTA 7: Productos con stock bajo
// =============================================
router.get('/alertas/stock-bajo', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                codigo_producto,
                nombre,
                stock_total,
                stock_minimo_alerta,
                (stock_total - stock_minimo_alerta) as diferencia
            FROM productos 
            WHERE stock_total <= stock_minimo_alerta 
            ORDER BY diferencia ASC
        `;
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener productos con stock bajo:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;