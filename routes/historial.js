const express = require('express');
const router = express.Router();
const db = require('../db');
const { denyIfAsesor } = require('../middleware/roles');

// Endpoint para el historial de ventas detallado
router.get('/ventas_detallado', denyIfAsesor, async (req, res) => {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        startDate = `${year}-${month}-${day}`;
        endDate = `${year}-${month}-${day}`;
    }

    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    const query = `
        SELECT 
            v.id AS id_venta,
            v.fecha_venta,
            v.metodo_pago,
            v.monto_total,
            COALESCE(v.anulado, false) AS anulado,
            v.estado,
            v.motivo_anulacion,
            v.fecha_anulacion,
            dv.producto_id,
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
                WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                ELSE COALESCE(p.costo_unidad, 0)
            END AS costo_por_unidad_venta,
            -- ganancia por línea: (precio por unidad de venta - costo_por_unidad_venta) * cantidad_vendida
            (dv.precio_venta - (
                CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END
            )) * dv.cantidad_vendida AS ganancia_linea
        FROM ventas AS v
        JOIN detalle_venta AS dv ON v.id = dv.venta_id 
        JOIN productos AS p ON dv.producto_id = p.id
        WHERE v.fecha_venta >= $1 AND v.fecha_venta <= $2
        ORDER BY v.fecha_venta DESC;
    `;

    const totalQuery = `
        SELECT SUM(monto_total) AS total_ventas 
        FROM ventas 
        WHERE fecha_venta >= $1 AND fecha_venta <= $2 AND COALESCE(anulado, false) = false;
    `;

    const totalProfitQuery = `
        SELECT SUM((dv.precio_venta - (
            CASE dv.tipo_venta
                WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                ELSE COALESCE(p.costo_unidad, 0)
            END
        )) * dv.cantidad_vendida) AS total_ganancia
        FROM ventas v
        JOIN detalle_venta dv ON v.id = dv.venta_id
        JOIN productos p ON dv.producto_id = p.id
        WHERE v.fecha_venta >= $1 AND v.fecha_venta <= $2 AND COALESCE(v.anulado, false) = false;
    `;

    try {
        const salesResult = await db.query(query, [startOfDay, endOfDay]);
        const salesRows = salesResult.rows;
        
        const totalResult = await db.query(totalQuery, [startOfDay, endOfDay]);
        const totalRows = totalResult.rows;
        
        const salesMap = new Map();
        salesRows.forEach(row => {
            if (!salesMap.has(row.id_venta)) {
                salesMap.set(row.id_venta, {
                    id: row.id_venta,
                    fecha_venta: row.fecha_venta,
                    metodo_pago: row.metodo_pago,
                    monto_total: row.monto_total,
                    anulado: row.anulado,
                    estado: row.estado,
                    motivo_anulacion: row.motivo_anulacion,
                    fecha_anulacion: row.fecha_anulacion,
                    productos: []
                });
            }
            salesMap.get(row.id_venta).productos.push({
                id_producto: row.producto_id,
                nombre_producto: row.nombre_producto,
                cantidad: row.cantidad_vendida,
                precio_unitario: row.precio_venta,
                costo_unidad: row.costo_unidad,
                tipo_venta: row.tipo_venta,
                costo_por_unidad_venta: row.costo_por_unidad_venta,
                ganancia_linea: parseFloat(row.ganancia_linea) || 0
            });
        });
        const sales = Array.from(salesMap.values()).map(sale => {
            const ganancia_por_venta = (sale.productos || []).reduce((acc, p) => acc + (p.ganancia_linea || 0), 0);
            return { ...sale, ganancia_por_venta };
        });

        const total = parseFloat(totalRows[0]?.total_ventas) || 0;
        
        const profitResult = await db.query(totalProfitQuery, [startOfDay, endOfDay]);
        const profitRows = profitResult.rows;
        const totalProfit = parseFloat(profitRows[0]?.total_ganancia) || 0;

        res.json({ sales, total, totalProfit });
    } catch (error) {
        console.error('Error al obtener historial de ventas detallado:', error);
        res.status(500).json({ error: 'Error del servidor al obtener el historial de ventas.' });
    }
});

module.exports = router;