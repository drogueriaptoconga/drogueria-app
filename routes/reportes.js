// backend/routes/reportes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { denyIfAsesor } = require('../middleware/roles');

function calculateProfitMargin(gananciaBruta, totalIngresos) {
    if (!Number.isFinite(gananciaBruta) || !Number.isFinite(totalIngresos) || totalIngresos <= 0) {
        return 0;
    }
    return Number(((gananciaBruta / totalIngresos) * 100).toFixed(2));
}

function buildFinancialSummary({
    totalIngresos = 0,
    totalGastos = 0,
    totalGanancia = 0,
    totalInversionEntradas = 0,
    totalCapitalInvertido = 0,
}) {
    const totalGananciaBruta = Number(totalGanancia) || 0;
    const gananciaNeta = Number(totalGananciaBruta - totalGastos) || 0;
    const porcentajeGananciaBruta = calculateProfitMargin(totalGananciaBruta, totalIngresos);
    const porcentajeGananciaNeta = calculateProfitMargin(gananciaNeta, totalIngresos);

    return {
        totalIngresos: Number(totalIngresos) || 0,
        totalGastos: Number(totalGastos) || 0,
        totalGanancia: totalGananciaBruta,
        totalGananciaBruta: totalGananciaBruta,
        totalInversionEntradas: Number(totalInversionEntradas) || 0,
        totalCapitalInvertido: Number(totalCapitalInvertido) || 0,
        gananciaNeta,
        porcentajeGananciaBruta,
        porcentajeGananciaNeta,
    };
}

router.buildFinancialSummary = buildFinancialSummary;

// Ruta para obtener el reporte de ventas del día
router.get('/ventas_diarias', denyIfAsesor, async (req, res) => {
    const query = `
        SELECT
            COALESCE(SUM(monto_total), 0) AS ventas_diarias,
            COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN monto_total ELSE 0 END), 0) AS ventas_efectivo,
            COALESCE(SUM(CASE WHEN metodo_pago = 'Transferencia' THEN monto_total ELSE 0 END), 0) AS ventas_transferencia
        FROM ventas
        WHERE fecha_venta >= DATE_TRUNC('day', NOW())
          AND fecha_venta < DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
          AND COALESCE(anulado, false) = false
    `;
    try {
        const result = await db.query(query);
        const row = result.rows[0] || {};
        const ventas_diarias = Math.round(parseFloat(row.ventas_diarias) || 0);
        const ventas_efectivo = Math.round(parseFloat(row.ventas_efectivo) || 0);
        const ventas_transferencia = Math.round(parseFloat(row.ventas_transferencia) || 0);
        res.json({ ventas_diarias, ventas_efectivo, ventas_transferencia });
    } catch (err) {
        console.error('Error al generar el reporte de ventas diarias:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener el reporte de capital invertido
router.get('/capital_invertido', denyIfAsesor, async (req, res) => {
    const query = 'SELECT SUM(stock_total * costo_unidad) AS capital_invertido FROM productos';
    try {
        const result = await db.query(query);
        const capital_invertido = Math.round(parseFloat(result.rows[0]?.capital_invertido) || 0);
        res.json({ capital_invertido });
    } catch (err) {
        console.error('Error al generar el reporte de capital invertido:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener el reporte de ganancia potencial
router.get('/ganancia_potencial', denyIfAsesor, async (req, res) => {
    const query = 'SELECT SUM((precio_unidad - costo_unidad) * stock_total) AS ganancia_potencial FROM productos';
    try {
        const result = await db.query(query);
        const ganancia_potencial = Math.round(parseFloat(result.rows[0]?.ganancia_potencial) || 0);
        res.json({ ganancia_potencial });
    } catch (err) {
        console.error('Error al generar el reporte de ganancia potencial:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener la ganancia del día y los costos asociados
router.get('/ganancia_diaria', denyIfAsesor, async (req, res) => {
    try {
        const gananciaQuery = `
            SELECT 
                SUM( (dv.precio_venta - (
                    CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END
                )) * dv.cantidad_vendida) AS ganancia_bruta_diaria
            FROM detalle_venta AS dv
            JOIN ventas AS v ON dv.venta_id = v.id
            JOIN productos AS p ON dv.producto_id = p.id
            WHERE DATE(v.fecha_venta) = CURRENT_DATE
              AND COALESCE(v.anulado, false) = false;
        `;

        const ventasQuery = `
            SELECT COALESCE(SUM(monto_total), 0) AS total_ventas_diarias
            FROM ventas
            WHERE DATE(fecha_venta) = CURRENT_DATE
              AND COALESCE(anulado, false) = false;
        `;

        const gastosQuery = `
            SELECT SUM(monto) AS gastos_diarios
            FROM gastos
            WHERE DATE(fecha_gasto) = CURRENT_DATE;
        `;

        const inversionQuery = `
            SELECT SUM(cantidad_entrada * costo_unidad_entrada) AS inversion_diaria
            FROM entradas_stock
            WHERE fecha_entrada >= DATE_TRUNC('day', NOW())
              AND fecha_entrada < DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
              AND COALESCE(anulado, false) = false;
        `;

        const [gananciaResult, ventasResult, gastosResult, inversionResult] = await Promise.all([
            db.query(gananciaQuery),
            db.query(ventasQuery),
            db.query(gastosQuery),
            db.query(inversionQuery)
        ]);

        const gananciaBrutaDiaria = Math.round(parseFloat(gananciaResult.rows[0]?.ganancia_bruta_diaria) || 0);
        const totalVentasDiarias = Math.round(parseFloat(ventasResult.rows[0]?.total_ventas_diarias) || 0);
        const gastosDiarios = Math.round(parseFloat(gastosResult.rows[0]?.gastos_diarios) || 0);
        const inversionDiaria = Math.round(parseFloat(inversionResult.rows[0]?.inversion_diaria) || 0);
        const gananciaNetaDiaria = gananciaBrutaDiaria - gastosDiarios;

        const porcentajeGananciaBruta = totalVentasDiarias > 0
            ? parseFloat(((gananciaBrutaDiaria / totalVentasDiarias) * 100).toFixed(2))
            : 0;
        const porcentajeGananciaNeta = totalVentasDiarias > 0
            ? parseFloat(((gananciaNetaDiaria / totalVentasDiarias) * 100).toFixed(2))
            : 0;

        res.json({
            ganancia_diaria: gananciaBrutaDiaria,
            ganancia_bruta_diaria: gananciaBrutaDiaria,
            gastos_diarios: gastosDiarios,
            inversion_diaria: inversionDiaria,
            ganancia_neta_diaria: gananciaNetaDiaria,
            total_ventas_diarias: totalVentasDiarias,
            porcentaje_ganancia_bruta: porcentajeGananciaBruta,
            porcentaje_ganancia_neta: porcentajeGananciaNeta
        });
    } catch (err) {
        console.error('Error al generar el reporte de ganancia diaria:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para las ventas de la semana para el gráfico
router.get('/ventas_semana', denyIfAsesor, async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(fecha_venta) AS dia,
                SUM(monto_total) AS ventas_diarias
            FROM ventas
            WHERE fecha_venta >= CURRENT_DATE - INTERVAL '6 days'
              AND COALESCE(anulado, false) = false
            GROUP BY dia
            ORDER BY dia ASC;
        `;
        const result = await db.query(query);
        const ventasSemana = result.rows.map(row => ({
            dia: new Date(row.dia).toLocaleDateString('es-CO', { weekday: 'short' }),
            ventas: Math.round(parseFloat(row.ventas_diarias) || 0)
        }));
        res.json(ventasSemana);
    } catch (err) {
        console.error('Error al obtener las ventas de la semana:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/resumen', denyIfAsesor, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || null;
        const end = endDate || null;

        const whereClause = [];
        const params = [];

        if (start) {
            whereClause.push('v.fecha_venta >= $' + (params.length + 1));
            params.push(`${start} 00:00:00`);
        }
        if (end) {
            whereClause.push('v.fecha_venta <= $' + (params.length + 1));
            params.push(`${end} 23:59:59`);
        }

        const whereSql = whereClause.length ? `AND ${whereClause.join(' AND ')}` : '';

        const ingresosQuery = `
            SELECT COALESCE(SUM(v.monto_total), 0) AS total_ingresos
            FROM ventas v
            WHERE COALESCE(v.anulado, false) = false ${whereSql}
        `;

        const gastosQuery = `
            SELECT COALESCE(SUM(g.monto), 0) AS total_gastos
            FROM gastos g
            WHERE 1 = 1 ${start && end ? `AND g.fecha_gasto >= $1 AND g.fecha_gasto <= $2` : ''}
        `;

        const inversionQuery = `
            SELECT COALESCE(SUM(e.cantidad_entrada * e.costo_unidad_entrada), 0) AS total_inversion_entradas
            FROM entradas_stock e
            WHERE COALESCE(e.anulado, false) = false ${start && end ? `AND e.fecha_entrada >= $1 AND e.fecha_entrada <= $2` : ''}
        `;

        const capitalResult = await db.query('SELECT SUM(stock_total * costo_unidad) AS capital_invertido FROM productos');
        const totalCapitalInvertido = parseFloat(capitalResult.rows[0]?.capital_invertido) || 0;

        const gananciaQuery = `
            SELECT COALESCE(SUM((dv.precio_venta - (
                CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END
            )) * dv.cantidad_vendida), 0) AS total_ganancia
            FROM ventas v
            JOIN detalle_venta dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE COALESCE(v.anulado, false) = false ${whereSql}
        `;

        const ingresosParams = [...params];
        const gastosParams = start && end ? [start + ' 00:00:00', end + ' 23:59:59'] : [];
        const inversionParams = start && end ? [start + ' 00:00:00', end + ' 23:59:59'] : [];

        const [ingresosResult, gastosResult, inversionResult, gananciaResult] = await Promise.all([
            db.query(ingresosQuery, ingresosParams),
            db.query(gastosQuery, gastosParams),
            db.query(inversionQuery, inversionParams),
            db.query(gananciaQuery, params)
        ]);

        const totalIngresos = parseFloat(ingresosResult.rows[0]?.total_ingresos) || 0;
        const totalGastos = parseFloat(gastosResult.rows[0]?.total_gastos) || 0;
        const totalInversionEntradas = parseFloat(inversionResult.rows[0]?.total_inversion_entradas) || 0;
        const totalGanancia = parseFloat(gananciaResult.rows[0]?.total_ganancia) || 0;

        const summary = buildFinancialSummary({
            totalIngresos,
            totalGastos,
            totalGanancia,
            totalInversionEntradas,
            totalCapitalInvertido,
        });

        res.json(summary);
    } catch (err) {
        console.error('Error al generar el reporte financiero:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;