const express = require('express');
const router = express.Router();
const db = require('../db');
const { denyIfAsesor } = require('../middleware/roles');

function getAuditUser(req) {
    const userId = req.user.id;
    const userName = req.user.nombre;
    return { userId, userName };
}

function buildTrasladoObservacion(puntoOrigen, puntoDestino, observacion) {
    const obs = (observacion || '').trim();
    const parts = [];
    parts.push(`Origen:${puntoOrigen || 'Sin especificar'}`);
    parts.push(`Destino:${puntoDestino || 'Sin especificar'}`);
    if (obs) {
        parts.push(`Observación:${obs}`);
    }
    return `TRASLADO|${parts.join('|')}`;
}

function parseTrasladoObservacion(observaciones) {
    if (!observaciones || typeof observaciones !== 'string') {
        return { punto_origen: null, punto_destino: null, observacion: null };
    }
    const fields = observaciones.split('|').reduce((acc, part) => {
        const idx = part.indexOf(':');
        if (idx > -1) {
            const key = part.substring(0, idx).toLowerCase();
            const val = part.substring(idx + 1);
            acc[key] = val;
        }
        return acc;
    }, {});
    return {
        punto_origen: fields.origen || null,
        punto_destino: fields.destino || null,
        observacion: fields.observación || null,
    };
}

async function syncEntradasSequence(client) {
    try {
        const seqResult = await client.query(
            "SELECT pg_get_serial_sequence('entradas_stock', 'id') AS seq_name"
        );
        const seqName = seqResult.rows[0]?.seq_name;
        if (!seqName) return;
        const maxResult = await client.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM entradas_stock');
        const maxId = parseInt(maxResult.rows[0]?.max_id || '0', 10);
        await client.query('SELECT setval($1, $2, true)', [seqName, maxId + 1]);
    } catch (error) {
        console.warn('⚠️ No se pudo sincronizar la secuencia de entradas_stock:', error.message);
    }
}

// =============================
// POST /api/traslados
// Registrar un traslado de productos de un punto a otro
// =============================
router.post('/', denyIfAsesor, async (req, res) => {
    const { producto_id, cantidad, punto_origen, punto_destino, observacion } = req.body;
    const auditUser = getAuditUser(req);

    if (!producto_id || !cantidad || !punto_origen || !punto_destino) {
        return res.status(400).json({
            error: 'Faltan campos obligatorios: producto_id, cantidad, punto_origen, punto_destino',
        });
    }

    const cantidadNum = parseInt(cantidad, 10);
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser un número entero positivo' });
    }

    if (punto_origen.trim() === punto_destino.trim()) {
        return res.status(400).json({ error: 'El punto de origen y destino no pueden ser iguales' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const productResult = await client.query(
            'SELECT * FROM productos WHERE id = $1 FOR UPDATE',
            [parseInt(producto_id, 10)]
        );

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const producto = productResult.rows[0];
        const stockActual = parseInt(producto.stock_total, 10) || 0;

        if (stockActual < cantidadNum) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Stock insuficiente. Stock actual: ${stockActual} unidades, se requieren ${cantidadNum}.`,
            });
        }

        const costoAnterior = parseFloat(producto.costo_unidad) || 0;
        const nuevoStock = stockActual - cantidadNum;

        await client.query(
            'UPDATE productos SET stock_total = $1, fecha_modificacion = NOW(), modificado_por = $2 WHERE id = $3',
            [nuevoStock, auditUser.userName, producto.id]
        );

        const observacionesEstructuradas = buildTrasladoObservacion(punto_origen, punto_destino, observacion);
        const costoEntrada = costoAnterior;
        const valorTraslado = cantidadNum * costoEntrada;

        await syncEntradasSequence(client);

        const entradaQuery =
            'INSERT INTO entradas_stock ' +
            '(producto_id, cantidad_entrada, fecha_entrada, costo_unidad_entrada, ' +
            'proveedor, numero_factura, observaciones, usuario_id, ' +
            'costo_anterior, costo_nuevo) ' +
            'VALUES ($1, $2, NOW(), $3, NULL, NULL, $4, $5, $6, $7) RETURNING id';

        const entradaResult = await client.query(entradaQuery, [
            producto.id,
            -cantidadNum,
            costoEntrada,
            observacionesEstructuradas,
            auditUser.userId,
            costoAnterior,
            costoAnterior,
        ]);

        await client.query('COMMIT');

        const traslado = {
            id: entradaResult.rows[0].id,
            producto_id: producto.id,
            codigo_producto: producto.codigo_producto,
            nombre_producto: producto.nombre,
            cantidad: cantidadNum,
            costo_unidad: costoAnterior,
            valor_traslado: valorTraslado,
            punto_origen,
            punto_destino,
            observacion: observacion || null,
            stock_anterior: stockActual,
            stock_actual: nuevoStock,
            usuario_id: auditUser.userId,
            usuario_nombre: auditUser.userName,
            fecha_entrada: new Date(),
        };

        res.status(201).json({
            message: 'Traslado registrado exitosamente',
            traslado,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error registrando traslado:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    } finally {
        client.release();
    }
});

// =============================
// GET /api/traslados
// Listar todos los traslados con filtros
// =============================
router.get('/', denyIfAsesor, async (req, res) => {
    const { fecha_desde, fecha_hasta, producto_id, page = 1, limit = 20 } = req.query;

    const params = [];
    const conditions = ["es.observaciones ILIKE 'TRASLADO%'"];
    let paramCount = 1;

    if (fecha_desde) {
        conditions.push(`es.fecha_entrada >= $${paramCount}`);
        params.push(`${fecha_desde} 00:00:00`);
        paramCount++;
    }

    if (fecha_hasta) {
        conditions.push(`es.fecha_entrada <= $${paramCount}`);
        params.push(`${fecha_hasta} 23:59:59`);
        paramCount++;
    }

    if (producto_id) {
        conditions.push(`es.producto_id = $${paramCount}`);
        params.push(parseInt(producto_id, 10));
        paramCount++;
    }

    const countQuery =
        `SELECT COUNT(*) as total FROM entradas_stock es WHERE ${conditions.join(' AND ')}`;

    const query =
        `SELECT es.*, ` +
        `p.codigo_producto, p.nombre AS producto_nombre, ` +
        `u.nombre_usuario AS usuario_nombre ` +
        `FROM entradas_stock es ` +
        `LEFT JOIN productos p ON es.producto_id = p.id ` +
        `LEFT JOIN usuarios u ON es.usuario_id = u.id ` +
        `WHERE ${conditions.join(' AND ')} ` +
        `ORDER BY es.fecha_entrada DESC, es.id DESC ` +
        `LIMIT $${paramCount} OFFSET $${paramCount + 1}`;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const queryParams = [...params, parseInt(limit, 10), offset];

    try {
        const countResult = await db.query(countQuery, params);
        const result = await db.query(query, queryParams);

        const traslados = result.rows.map((row) => {
            const parsed = parseTrasladoObservacion(row.observaciones);
            return {
                id: row.id,
                producto_id: row.producto_id,
                codigo_producto: row.codigo_producto,
                nombre_producto: row.producto_nombre,
                cantidad: Math.abs(parseInt(row.cantidad_entrada, 10) || 0),
                costo_unidad: parseFloat(row.costo_unidad_entrada) || 0,
                valor_traslado: Math.abs(
                    (parseInt(row.cantidad_entrada, 10) || 0) *
                    (parseFloat(row.costo_unidad_entrada) || 0)
                ),
                punto_origen: parsed.punto_origen || row.proveedor || null,
                punto_destino: parsed.punto_destino || null,
                observacion: parsed.observacion,
                anulado: row.anulado || false,
                motivo_anulacion: row.motivo_anulacion || null,
                fecha_anulacion: row.fecha_anulacion || null,
                usuario_id: row.usuario_id,
                usuario_nombre: row.usuario_nombre || 'Sistema',
                fecha_entrada: row.fecha_entrada,
            };
        });

        const total = parseInt(countResult.rows[0]?.total || '0', 10);
        const totalPages = Math.ceil(total / parseInt(limit, 10));

        res.json({
            traslados,
            paginacion: {
                pagina_actual: parseInt(page, 10),
                total_paginas: totalPages,
                total_registros: total,
                por_pagina: parseInt(limit, 10),
            },
        });
    } catch (err) {
        console.error('Error al listar traslados:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================
// GET /api/traslados/estadisticas
// Estadísticas de traslados
// =============================
router.get('/estadisticas', denyIfAsesor, async (req, res) => {
    const { fecha_desde, fecha_hasta } = req.query;

    const params = [];
    const conditions = ["observaciones ILIKE 'TRASLADO%'"];
    let paramCount = 1;

    if (fecha_desde) {
        conditions.push(`fecha_entrada >= $${paramCount}`);
        params.push(`${fecha_desde} 00:00:00`);
        paramCount++;
    }

    if (fecha_hasta) {
        conditions.push(`fecha_entrada <= $${paramCount}`);
        params.push(`${fecha_hasta} 23:59:59`);
        paramCount++;
    }

    const query =
        `SELECT ` +
        `COUNT(*) AS total_traslados, ` +
        `SUM(ABS(cantidad_entrada)) AS total_unidades, ` +
        `SUM(ABS(cantidad_entrada * costo_unidad_entrada)) AS total_valor_trasladado, ` +
        `COUNT(DISTINCT producto_id) AS productos_diferentes ` +
        `FROM entradas_stock ` +
        `WHERE ${conditions.join(' AND ')}`;

    try {
        const result = await db.query(query, params);
        const row = result.rows[0] || {};

        res.json({
            total_traslados: parseInt(row.total_traslados) || 0,
            total_unidades: parseInt(row.total_unidades) || 0,
            total_valor_trasladado: parseFloat(row.total_valor_trasladado) || 0,
            productos_diferentes: parseInt(row.productos_diferentes) || 0,
        });
    } catch (err) {
        console.error('Error al obtener estadísticas de traslados:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// =============================
// PATCH /api/traslados/:id/anular
// Anular (revertir) un traslado
// =============================
router.patch('/:id/anular', denyIfAsesor, async (req, res) => {
    const trasladoId = parseInt(req.params.id, 10);
    const { motivo_anulacion } = req.body;
    const auditUser = getAuditUser(req);

    if (!motivo_anulacion || !motivo_anulacion.trim()) {
        return res.status(400).json({ error: 'Se requiere un motivo de anulación.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const trasladoResult = await client.query(
            'SELECT * FROM entradas_stock WHERE id = $1 FOR UPDATE',
            [trasladoId]
        );

        if (trasladoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Traslado no encontrado.' });
        }

        const traslado = trasladoResult.rows[0];

        if (!(traslado.observaciones || '').includes('TRASLADO')) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El registro no es un traslado.' });
        }

        if (traslado.anulado) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El traslado ya fue anulado previamente.' });
        }

        const cantidadOriginal = Math.abs(parseInt(traslado.cantidad_entrada, 10) || 0);

        await client.query(
            'UPDATE productos SET stock_total = stock_total + $1, fecha_modificacion = NOW(), modificado_por = $2 WHERE id = $3',
            [cantidadOriginal, auditUser.userName, traslado.producto_id]
        );

        await client.query(
            'UPDATE entradas_stock SET anulado = true, motivo_anulacion = $1, fecha_anulacion = NOW() WHERE id = $2',
            [motivo_anulacion.trim(), trasladoId]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Traslado anulado correctamente. Stock restaurado.',
            cantidad_restaurada: cantidadOriginal,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error anulando traslado:', error);
        res.status(500).json({ error: 'Error interno al anular el traslado.' });
    } finally {
        client.release();
    }
});

module.exports = router;
module.exports.buildTrasladoObservacion = buildTrasladoObservacion;
module.exports.parseTrasladoObservacion = parseTrasladoObservacion;
