const express = require('express');
const router = express.Router();
const db = require('../db');
const { denyIfAsesor } = require('../middleware/roles');

function getBusinessDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function getCostoPorUnidadVenta(producto, tipoVenta) {
    const costoUnidad = Number(producto?.costo_unidad) || 0;

    switch (tipoVenta) {
        case 'Unidad':
            return costoUnidad;
        case 'Sobre':
            return costoUnidad * (Number(producto?.unidades_por_sobre) || 0);
        case 'Caja':
            return costoUnidad * (Number(producto?.unidades_por_caja) || 0);
        case 'Solo Sobre':
            return costoUnidad;
        case 'Solo Caja':
            return costoUnidad;
        default:
            return costoUnidad;
    }
}

function calcularGananciaLinea(producto, precioVenta, tipoVenta, cantidadVendida) {
    const precio = Number(precioVenta) || 0;
    const cantidad = Number(cantidadVendida) || 0;
    const costoPorUnidad = getCostoPorUnidadVenta(producto, tipoVenta);

    if (!Number.isFinite(precio) || !Number.isFinite(costoPorUnidad) || precio <= 0 || cantidad <= 0) {
        return 0;
    }

    const ganancia = (precio - costoPorUnidad) * cantidad;
    return Number.isFinite(ganancia) ? Math.max(0, ganancia) : 0;
}

// Endpoint para el historial de ventas detallado
router.get('/ventas_detallado', denyIfAsesor, async (req, res) => {
    let { startDate, endDate, metodo_pago: metodoPago } = req.query;

    if (!startDate || !endDate) {
        startDate = getBusinessDate();
        endDate = startDate;
    }

    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;
    const queryParams = [startDate, endDate];
    const paymentFilter = ['Efectivo', 'Transferencia', 'Mixto'].includes(metodoPago)
        ? ` AND v.metodo_pago = $3`
        : '';
    if (paymentFilter) queryParams.push(metodoPago);

    const query = `
        SELECT 
            v.id AS id_venta,
            v.fecha_venta,
            v.metodo_pago,
            v.monto_total,
            COALESCE(v.monto_efectivo, 0) AS monto_efectivo,
            COALESCE(v.monto_transferencia, 0) AS monto_transferencia,
            COALESCE(v.anulado, false) AS anulado,
            v.estado,
            v.motivo_anulacion,
            v.fecha_anulacion,
            dv.producto_id,
            p.codigo_producto,
            p.nombre AS nombre_producto,
            p.costo_unidad,
            dv.cantidad_vendida,
            dv.precio_venta,
            dv.tipo_venta,
            -- calcular costo por unidad de venta según tipo
            CASE dv.tipo_venta
                WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0)
                WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0)
                ELSE COALESCE(p.costo_unidad, 0)
            END AS costo_por_unidad_venta,
            -- ganancia por línea: nunca debe quedar negativa; si el costo supera el precio, se reporta en cero
            GREATEST(0, (dv.precio_venta - (
                CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END
            )) * dv.cantidad_vendida) AS ganancia_linea
        FROM ventas AS v
        JOIN detalle_venta AS dv ON v.id = dv.venta_id 
        JOIN productos AS p ON dv.producto_id = p.id
                WHERE (v.fecha_venta AT TIME ZONE 'America/Bogota')::date BETWEEN $1::date AND $2::date
                    AND COALESCE(v.anulado, false) = false${paymentFilter}
        ORDER BY v.fecha_venta DESC;
    `;

    const totalQuery = `
        SELECT SUM(monto_total) AS total_ventas 
        FROM ventas v
            WHERE (v.fecha_venta AT TIME ZONE 'America/Bogota')::date BETWEEN $1::date AND $2::date
                AND COALESCE(v.anulado, false) = false${paymentFilter};
    `;

    const totalProfitQuery = `
        SELECT SUM(GREATEST(0, (dv.precio_venta - (
            CASE dv.tipo_venta
                WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0)
                WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0)
                ELSE COALESCE(p.costo_unidad, 0)
            END
        )) * dv.cantidad_vendida)) AS total_ganancia
        FROM ventas v
        JOIN detalle_venta dv ON v.id = dv.venta_id
        JOIN productos p ON dv.producto_id = p.id
                WHERE (v.fecha_venta AT TIME ZONE 'America/Bogota')::date BETWEEN $1::date AND $2::date
                    AND COALESCE(v.anulado, false) = false${paymentFilter};
    `;

    try {
        const salesResult = await db.query(query, queryParams);
        const salesRows = salesResult.rows;
        
        const totalResult = await db.query(totalQuery, queryParams);
        const totalRows = totalResult.rows;
        
        const salesMap = new Map();
        salesRows.forEach(row => {
            if (!salesMap.has(row.id_venta)) {
                salesMap.set(row.id_venta, {
                    id: row.id_venta,
                    fecha_venta: row.fecha_venta,
                    metodo_pago: row.metodo_pago,
                    monto_total: row.monto_total,
                    monto_efectivo: row.monto_efectivo,
                    monto_transferencia: row.monto_transferencia,
                    anulado: row.anulado,
                    estado: row.estado,
                    motivo_anulacion: row.motivo_anulacion,
                    fecha_anulacion: row.fecha_anulacion,
                    productos: []
                });
            }
            salesMap.get(row.id_venta).productos.push({
                id_producto: row.producto_id,
                codigo_producto: row.codigo_producto,
                nombre_producto: row.nombre_producto,
                cantidad: row.cantidad_vendida,
                precio_unitario: row.precio_venta,
                costo_unidad: row.costo_unidad,
                tipo_venta: row.tipo_venta,
                costo_por_unidad_venta: row.costo_por_unidad_venta,
                ganancia_linea: Math.max(0, parseFloat(row.ganancia_linea) || 0)
            });
        });
        const sales = Array.from(salesMap.values()).map(sale => {
            const ganancia_por_venta = (sale.productos || []).reduce((acc, p) => acc + Math.max(0, p.ganancia_linea || 0), 0);
            return { ...sale, ganancia_por_venta };
        });

        const total = parseFloat(totalRows[0]?.total_ventas) || 0;
        
        const profitResult = await db.query(totalProfitQuery, queryParams);
        const profitRows = profitResult.rows;
        const totalProfit = Math.max(0, parseFloat(profitRows[0]?.total_ganancia) || 0);

        res.json({ sales, total, totalProfit });
    } catch (error) {
        console.error('Error al obtener historial de ventas detallado:', error);
        res.status(500).json({ error: 'Error del servidor al obtener el historial de ventas.' });
    }
});

module.exports = router;
module.exports.calcularGananciaLinea = calcularGananciaLinea;

// Endpoint para el historial de traslados detallado
router.get('/traslados_detallado', denyIfAsesor, async (req, res) => {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        startDate = getBusinessDate();
        endDate = startDate;
    }

    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    const query = `
        SELECT
            es.id AS id_entrada,
            es.producto_id,
            p.codigo_producto,
            p.nombre AS nombre_producto,
            p.costo_unidad,
            es.cantidad_entrada,
            es.costo_unidad_entrada,
            es.fecha_entrada,
            u.nombre_usuario AS usuario_nombre,
            es.usuario_id,
            es.observaciones,
            es.anulado,
            es.motivo_anulacion,
            es.fecha_anulacion
        FROM entradas_stock es
        LEFT JOIN productos p ON es.producto_id = p.id
        LEFT JOIN usuarios u ON es.usuario_id = u.id
        WHERE es.observaciones ILIKE 'TRASLADO%'
          AND es.fecha_entrada >= $1
          AND es.fecha_entrada <= $2
        ORDER BY es.fecha_entrada DESC, es.id DESC
    `;

    const countQuery = `
        SELECT COUNT(*) as total
        FROM entradas_stock es
        WHERE es.observaciones ILIKE 'TRASLADO%'
          AND es.fecha_entrada >= $1
          AND es.fecha_entrada <= $2
    `;

    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginatedQuery = query + ` LIMIT $${3} OFFSET $${4}`;

    try {
        const totalResult = await db.query(countQuery, [startOfDay, endOfDay]);
        const rowsResult = await db.query(paginatedQuery, [startOfDay, endOfDay, parseInt(limit, 10), offset]);

        const total = parseInt(totalResult.rows[0]?.total || '0', 10);
        const totalPages = Math.ceil(total / parseInt(limit, 10));

        const traslados = rowsResult.rows.map((row) => {
            const obs = (row.observaciones || '').split('|').reduce((acc, part) => {
                const idx = part.indexOf(':');
                if (idx > -1) {
                    acc[part.substring(0, idx).toLowerCase()] = part.substring(idx + 1);
                }
                return acc;
            }, {});

            const cantidad = Math.abs(parseInt(row.cantidad_entrada, 10) || 0);
            const costoUnit = parseFloat(row.costo_unidad_entrada) || 0;

            return {
                id: row.id_entrada,
                producto_id: row.producto_id,
                codigo_producto: row.codigo_producto,
                nombre_producto: row.nombre_producto,
                cantidad,
                costo_unidad: costoUnit,
                valor_traslado: cantidad * costoUnit,
                punto_origen: obs.origen || null,
                punto_destino: obs.destino || null,
                observacion: obs.observación || null,
                anulado: row.anulado || false,
                motivo_anulacion: row.motivo_anulacion,
                fecha_anulacion: row.fecha_anulacion,
                usuario_id: row.usuario_id,
                usuario_nombre: row.usuario_nombre || 'Sistema',
                fecha_entrada: row.fecha_entrada,
            };
        });

        res.json({
            traslados,
            paginacion: {
                pagina_actual: parseInt(page, 10),
                total_paginas: totalPages,
                total_registros: total,
                por_pagina: parseInt(limit, 10),
            },
        });
    } catch (error) {
        console.error('Error al obtener historial de traslados:', error);
        res.status(500).json({ error: 'Error del servidor al obtener el historial de traslados.' });
    }
});