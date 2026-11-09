// backend/routes/reportes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { denyIfAsesor } = require('../middleware/roles');
const BUSINESS_TIMEZONE = 'America/Bogota';
const BUSINESS_DATE_SQL = `(NOW() AT TIME ZONE '${BUSINESS_TIMEZONE}')::date`;
const VENTA_DATE_SQL = `(fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::date`;
const ENTRADA_DATE_SQL = `(fecha_entrada AT TIME ZONE '${BUSINESS_TIMEZONE}')::date`;

function calculateProfitMargin(gananciaBruta, totalIngresos) {
    if (!Number.isFinite(gananciaBruta) || !Number.isFinite(totalIngresos) || totalIngresos <= 0) {
        return 0;
    }
    return Number(((gananciaBruta / totalIngresos) * 100).toFixed(2));
}

function calculateMonthlyAverages(ventasMes, diasTranscurridos, diasConVentas) {
    const total = Number(ventasMes) || 0;
    const dias = Math.max(Number(diasTranscurridos) || 0, 1);
    const diasActivos = Math.max(Number(diasConVentas) || 0, 0);

    return {
        promedioMensual: Math.round(total / dias),
        promedioDiaConVenta: diasActivos > 0 ? Math.round(total / diasActivos) : 0,
    };
}

function buildFinancialSummary({
    totalIngresos = 0,
    ventasEfectivo = 0,
    ventasTransferencia = 0,
    ventasMixto = 0,
    totalGastos = 0,
    totalGanancia = 0,
    totalInversionEntradas = 0,
    totalCapitalInvertido = 0,
    totalTraslados = 0,
}) {
    const totalGananciaBruta = Number(totalGanancia) || 0;
    const gananciaNeta = Number(totalGananciaBruta - totalGastos) || 0;
    const porcentajeGananciaBruta = calculateProfitMargin(totalGananciaBruta, totalIngresos);
    const porcentajeGananciaNeta = calculateProfitMargin(gananciaNeta, totalIngresos);

    return {
        totalIngresos: Number(totalIngresos) || 0,
        ventasEfectivo: Number(ventasEfectivo) || 0,
        ventasTransferencia: Number(ventasTransferencia) || 0,
        ventasMixto: Number(ventasMixto) || 0,
        totalGastos: Number(totalGastos) || 0,
        totalGanancia: totalGananciaBruta,
        totalGananciaBruta: totalGananciaBruta,
        totalInversionEntradas: Number(totalInversionEntradas) || 0,
        totalCapitalInvertido: Number(totalCapitalInvertido) || 0,
        totalTraslados: Number(totalTraslados) || 0,
        gananciaNeta,
        porcentajeGananciaBruta,
        porcentajeGananciaNeta,
    };
}

function buildEntrySummary({ totalProductos = 0, totalUnidades = 0, totalInversion = 0 }) {
    return {
        totalProductos: Number(totalProductos) || 0,
        totalUnidades: Number(totalUnidades) || 0,
        totalInversion: Number(totalInversion) || 0,
    };
}

router.buildFinancialSummary = buildFinancialSummary;
router.buildEntrySummary = buildEntrySummary;
router.calculateMonthlyAverages = calculateMonthlyAverages;

// Ruta para obtener el reporte de ventas del día
router.get('/ventas_diarias', denyIfAsesor, async (req, res) => {
    const { fecha, metodo_pago: metodoPago } = req.query;
    const params = [];
    const filters = [];
    if (fecha) {
        params.push(fecha);
        filters.push(`${VENTA_DATE_SQL} = $${params.length}::date`);
    } else {
        filters.push(`${VENTA_DATE_SQL} = ${BUSINESS_DATE_SQL}`);
    }
    if (metodoPago && ['Efectivo', 'Transferencia', 'Mixto'].includes(metodoPago)) {
        params.push(metodoPago);
        filters.push(`metodo_pago = $${params.length}`);
    }
    const query = `
        SELECT
            COALESCE(SUM(monto_total), 0) AS ventas_diarias,
            COALESCE(SUM(CASE
                WHEN COALESCE(monto_efectivo, 0) > 0 THEN monto_efectivo
                WHEN metodo_pago = 'Efectivo' THEN monto_total
                ELSE 0
            END), 0) AS ventas_efectivo,
            COALESCE(SUM(CASE
                WHEN COALESCE(monto_transferencia, 0) > 0 THEN monto_transferencia
                WHEN metodo_pago = 'Transferencia' THEN monto_total
                ELSE 0
            END), 0) AS ventas_transferencia
            , COALESCE(SUM(CASE WHEN metodo_pago = 'Mixto' THEN monto_total ELSE 0 END), 0) AS ventas_mixto
        FROM ventas
                WHERE ${filters.join(' AND ')}
          AND COALESCE(anulado, false) = false
    `;
    try {
                const result = await db.query(query, params);
        const row = result.rows[0] || {};
        const ventas_diarias = Math.round(parseFloat(row.ventas_diarias) || 0);
        const ventas_efectivo = Math.round(parseFloat(row.ventas_efectivo) || 0);
        const ventas_transferencia = Math.round(parseFloat(row.ventas_transferencia) || 0);
        const ventas_mixto = Math.round(parseFloat(row.ventas_mixto) || 0);
        const porcentaje_transferencia = ventas_diarias > 0
            ? Number(((ventas_transferencia / ventas_diarias) * 100).toFixed(2))
            : 0;
        res.json({ ventas_diarias, ventas_efectivo, ventas_transferencia, ventas_mixto, porcentaje_transferencia });
    } catch (err) {
        console.error('Error al generar el reporte de ventas diarias:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/promedio_mensual', denyIfAsesor, async (req, res) => {
    const query = `
        WITH periodo AS (
            SELECT
                DATE_TRUNC('month', NOW() AT TIME ZONE '${BUSINESS_TIMEZONE}')::date AS inicio,
                ${BUSINESS_DATE_SQL} AS hoy
        )
        SELECT
            COALESCE(SUM(v.monto_total), 0) AS ventas_mes,
            (p.hoy - p.inicio + 1) AS dias_transcurridos,
            COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN (v.fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::date END) AS dias_con_ventas
        FROM periodo p
        LEFT JOIN ventas v
            ON (v.fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::date BETWEEN p.inicio AND p.hoy
           AND COALESCE(v.anulado, false) = false
        GROUP BY p.inicio, p.hoy
    `;
    try {
        const result = await db.query(query);
        const row = result.rows[0] || {};
        const ventasMes = Number(row.ventas_mes) || 0;
        const diasTranscurridos = Number(row.dias_transcurridos) || 1;
        const diasConVentas = Number(row.dias_con_ventas) || 0;
        const promedios = calculateMonthlyAverages(ventasMes, diasTranscurridos, diasConVentas);
        res.json({
            ventas_mes: Math.round(ventasMes),
            dias_transcurridos: diasTranscurridos,
            dias_con_ventas: diasConVentas,
            promedio_mensual: promedios.promedioMensual,
            promedio_dia_con_venta: promedios.promedioDiaConVenta,
        });
    } catch (err) {
        console.error('Error al obtener el promedio mensual:', err);
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
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END
                )) * dv.cantidad_vendida) AS ganancia_bruta_diaria
            FROM detalle_venta AS dv
            JOIN ventas AS v ON dv.venta_id = v.id
            JOIN productos AS p ON dv.producto_id = p.id
            WHERE ${VENTA_DATE_SQL} = ${BUSINESS_DATE_SQL}
              AND COALESCE(v.anulado, false) = false
        `;

        const ventasQuery = `
            SELECT COALESCE(SUM(monto_total), 0) AS total_ventas_diarias
            FROM ventas
            WHERE ${VENTA_DATE_SQL} = ${BUSINESS_DATE_SQL}
              AND COALESCE(anulado, false) = false;
        `;

        const gastosQuery = `
            SELECT SUM(monto) AS gastos_diarios
            FROM gastos
            WHERE (fecha_gasto AT TIME ZONE '${BUSINESS_TIMEZONE}')::date = ${BUSINESS_DATE_SQL};
        `;

        const inversionQuery = `
            SELECT SUM(cantidad_entrada * costo_unidad_entrada) AS inversion_diaria
            FROM entradas_stock
                        WHERE ${ENTRADA_DATE_SQL} = ${BUSINESS_DATE_SQL}
              AND COALESCE(anulado, false) = false
              AND (observaciones IS NULL OR observaciones NOT ILIKE 'TRASLADO%');
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
                ${VENTA_DATE_SQL} AS dia,
                SUM(monto_total) AS ventas_diarias
            FROM ventas
            WHERE ${VENTA_DATE_SQL} >= ${BUSINESS_DATE_SQL} - INTERVAL '6 days'
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
            whereClause.push(`(v.fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::date >= $${params.length + 1}::date`);
            params.push(start);
        }
        if (end) {
            whereClause.push(`(v.fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::date <= $${params.length + 1}::date`);
            params.push(end);
        }

        const whereSql = whereClause.length ? `AND ${whereClause.join(' AND ')}` : '';

        const ingresosQuery = `
            SELECT
                COALESCE(SUM(v.monto_total), 0) AS total_ingresos,
                COALESCE(SUM(CASE
                    WHEN COALESCE(v.monto_efectivo, 0) > 0 THEN v.monto_efectivo
                    WHEN v.metodo_pago = 'Efectivo' THEN v.monto_total
                    ELSE 0
                END), 0) AS ventas_efectivo,
                COALESCE(SUM(CASE
                    WHEN COALESCE(v.monto_transferencia, 0) > 0 THEN v.monto_transferencia
                    WHEN v.metodo_pago = 'Transferencia' THEN v.monto_total
                    ELSE 0
                END), 0) AS ventas_transferencia,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'Mixto' THEN v.monto_total ELSE 0 END), 0) AS ventas_mixto
            FROM ventas v
            WHERE COALESCE(v.anulado, false) = false ${whereSql}
        `;

        const gastosQuery = `
            SELECT COALESCE(SUM(g.monto), 0) AS total_gastos
            FROM gastos g
            WHERE 1 = 1 ${start && end ? `AND (g.fecha_gasto AT TIME ZONE '${BUSINESS_TIMEZONE}')::date BETWEEN $1::date AND $2::date` : ''}
        `;

        const inversionQuery = `
            SELECT COALESCE(SUM(e.cantidad_entrada * e.costo_unidad_entrada), 0) AS total_inversion_entradas
            FROM entradas_stock e
            WHERE COALESCE(e.anulado, false) = false
              AND (e.observaciones IS NULL OR e.observaciones NOT ILIKE 'TRASLADO%') ${start && end ? `AND ${ENTRADA_DATE_SQL} BETWEEN $1::date AND $2::date` : ''}
        `;

        const capitalResult = await db.query('SELECT SUM(stock_total * costo_unidad) AS capital_invertido FROM productos');
        const totalCapitalInvertido = parseFloat(capitalResult.rows[0]?.capital_invertido) || 0;

        const gananciaQuery = `
            SELECT COALESCE(SUM((dv.precio_venta - (
                CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END
            )) * dv.cantidad_vendida), 0) AS total_ganancia
            FROM ventas v
            JOIN detalle_venta dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE COALESCE(v.anulado, false) = false ${whereSql}
        `;

        const ingresosParams = [...params];
        const gastosParams = start && end ? [start, end] : [];
        const inversionParams = start && end ? [start, end] : [];

        const trasladosQuery = `
            SELECT COALESCE(SUM(ABS(e.cantidad_entrada * e.costo_unidad_entrada)), 0) AS total_traslados
            FROM entradas_stock e
                        WHERE e.observaciones ILIKE 'TRASLADO%'
                            AND COALESCE(e.anulado, false) = false ${start && end ? `AND ${ENTRADA_DATE_SQL} BETWEEN $1::date AND $2::date` : ''}
        `;
        const trasladosParams = start && end ? [start + ' 00:00:00', end + ' 23:59:59'] : [];
        const trasladosResult = await db.query(trasladosQuery, trasladosParams);

        const [ingresosResult, gastosResult, inversionResult, gananciaResult] = await Promise.all([
            db.query(ingresosQuery, ingresosParams),
            db.query(gastosQuery, gastosParams),
            db.query(inversionQuery, inversionParams),
            db.query(gananciaQuery, params)
        ]);

        const totalIngresos = parseFloat(ingresosResult.rows[0]?.total_ingresos) || 0;
        const ventasEfectivo = parseFloat(ingresosResult.rows[0]?.ventas_efectivo) || 0;
        const ventasTransferencia = parseFloat(ingresosResult.rows[0]?.ventas_transferencia) || 0;
        const ventasMixto = parseFloat(ingresosResult.rows[0]?.ventas_mixto) || 0;
        const totalGastos = parseFloat(gastosResult.rows[0]?.total_gastos) || 0;
        const totalInversionEntradas = parseFloat(inversionResult.rows[0]?.total_inversion_entradas) || 0;
        const totalGanancia = parseFloat(gananciaResult.rows[0]?.total_ganancia) || 0;
        const totalTraslados = parseFloat(trasladosResult.rows[0]?.total_traslados) || 0;

        const summary = buildFinancialSummary({
            totalIngresos,
            ventasEfectivo,
            ventasTransferencia,
            ventasMixto,
            totalGastos,
            totalGanancia,
            totalInversionEntradas,
            totalCapitalInvertido,
            totalTraslados,
        });

        res.json(summary);
    } catch (err) {
        console.error('Error al generar el reporte financiero:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/entradas', denyIfAsesor, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate || null;
        const end = endDate || null;

        if (!start || !end) {
            return res.status(400).json({
                error: 'Debe enviar startDate y endDate para consultar el reporte de entradas.'
            });
        }

        const query = `
            SELECT
                COUNT(DISTINCT e.producto_id) AS total_productos,
                SUM(e.cantidad_entrada) AS total_unidades,
                SUM(e.cantidad_entrada * e.costo_unidad_entrada) AS total_inversion
            FROM entradas_stock e
                        WHERE ${ENTRADA_DATE_SQL} BETWEEN $1::date AND $2::date
              AND COALESCE(e.anulado, false) = false
              AND (e.observaciones IS NULL OR e.observaciones NOT ILIKE 'TRASLADO%');
        `;

        const result = await db.query(query, [start, end]);
        const row = result.rows[0] || {};

        const summary = buildEntrySummary({
            totalProductos: row.total_productos,
            totalUnidades: row.total_unidades,
            totalInversion: row.total_inversion,
        });

        res.json(summary);
    } catch (err) {
        console.error('Error al generar el reporte de entradas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/entradas-detalle', denyIfAsesor, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Debe enviar startDate y endDate para consultar el detalle de entradas.'
            });
        }

        const query = `
            SELECT
                e.id,
                e.producto_id,
                p.codigo_producto,
                p.nombre AS nombre_producto,
                e.cantidad_entrada,
                e.costo_unidad_entrada,
                e.fecha_entrada,
                u.nombre_usuario AS usuario_nombre,
                e.usuario_id
            FROM entradas_stock e
            LEFT JOIN productos p ON p.id = e.producto_id
            LEFT JOIN usuarios u ON u.id = e.usuario_id
                        WHERE ${ENTRADA_DATE_SQL} BETWEEN $1::date AND $2::date
              AND COALESCE(e.anulado, false) = false
              AND (e.observaciones IS NULL OR e.observaciones NOT ILIKE 'TRASLADO%')
            ORDER BY e.fecha_entrada DESC, e.id DESC;
        `;

        const result = await db.query(query, [startDate, endDate]);

        const detalle = result.rows.map((row) => ({
            id: row.id,
            producto_id: row.producto_id,
            codigo_producto: row.codigo_producto,
            nombre_producto: row.nombre_producto,
            cantidad_entrada: Number(row.cantidad_entrada) || 0,
            costo_unidad_entrada: Number(row.costo_unidad_entrada) || 0,
            fecha_entrada: row.fecha_entrada,
            usuario_nombre: row.usuario_nombre || 'Sistema',
            usuario_id: row.usuario_id || null,
            inversion_total: (Number(row.cantidad_entrada) || 0) * (Number(row.costo_unidad_entrada) || 0),
        }));

        res.json(detalle);
    } catch (err) {
        console.error('Error al generar el detalle de entradas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/traslados', denyIfAsesor, async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({
            error: 'Debe enviar startDate y endDate para consultar el reporte de traslados.'
        });
    }

    const query = `
        SELECT
            COUNT(DISTINCT e.producto_id) AS total_productos,
            SUM(ABS(e.cantidad_entrada)) AS total_unidades,
            SUM(ABS(e.cantidad_entrada * e.costo_unidad_entrada)) AS total_valor_trasladado
        FROM entradas_stock e
        WHERE e.observaciones ILIKE 'TRASLADO%'
          AND ${ENTRADA_DATE_SQL} BETWEEN $1::date AND $2::date
          AND COALESCE(e.anulado, false) = false;
    `;

    try {
        const result = await db.query(query, [startDate, endDate]);
        const row = result.rows[0] || {};

        res.json({
            total_productos: parseInt(row.total_productos) || 0,
            total_unidades: parseInt(row.total_unidades) || 0,
            total_valor_trasladado: parseFloat(row.total_valor_trasladado) || 0,
        });
    } catch (err) {
        console.error('Error al generar el reporte de traslados:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/traslados-detalle', denyIfAsesor, async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({
            error: 'Debe enviar startDate y endDate para consultar el detalle de traslados.'
        });
    }

    const query = `
        SELECT
            e.id,
            e.producto_id,
            p.codigo_producto,
            p.nombre AS nombre_producto,
            e.cantidad_entrada,
            e.costo_unidad_entrada,
            e.fecha_entrada,
            u.nombre_usuario AS usuario_nombre,
            e.usuario_id,
            e.observaciones,
            e.anulado,
            e.motivo_anulacion,
            e.fecha_anulacion
        FROM entradas_stock e
        LEFT JOIN productos p ON p.id = e.producto_id
        LEFT JOIN usuarios u ON u.id = e.usuario_id
                WHERE e.observaciones ILIKE 'TRASLADO%'
                    AND ${ENTRADA_DATE_SQL} BETWEEN $1::date AND $2::date
          AND COALESCE(e.anulado, false) = false
        ORDER BY e.fecha_entrada DESC, e.id DESC;
    `;

    try {
        const result = await db.query(query, [startDate, endDate]);

        const detalle = result.rows.map((row) => {
            const obs = (row.observaciones || '').split('|').reduce((acc, part) => {
                const idx = part.indexOf(':');
                if (idx > -1) {
                    acc[part.substring(0, idx).toLowerCase()] = part.substring(idx + 1);
                }
                return acc;
            }, {});

            const cantidad = Math.abs(parseInt(row.cantidad_entrada, 10) || 0);
            const costo = parseFloat(row.costo_unidad_entrada) || 0;

            return {
                id: row.id,
                producto_id: row.producto_id,
                codigo_producto: row.codigo_producto,
                nombre_producto: row.nombre_producto,
                cantidad,
                costo_unidad: costo,
                inversion_total: cantidad * costo,
                punto_origen: obs.origen || null,
                punto_destino: obs.destino || null,
                observacion: obs.observación || null,
                anulado: row.anulado || false,
                motivo_anulacion: row.motivo_anulacion || null,
                fecha_anulacion: row.fecha_anulacion || null,
                usuario_nombre: row.usuario_nombre || 'Sistema',
                usuario_id: row.usuario_id || null,
                fecha_entrada: row.fecha_entrada,
            };
        });

        res.json(detalle);
    } catch (err) {
        console.error('Error al generar el detalle de traslados:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener el resumen de ventas por vendedor en un rango de fecha/hora
router.get('/ventas_por_vendedor', denyIfAsesor, async (req, res) => {
    let { startDate, endDate, hora_inicio: horaInicio, hora_fin: horaFin, usuario_id: usuarioId, metodo_pago: metodoPago } = req.query;

    if (!startDate || !endDate) {
        const today = (new Date()).toISOString().slice(0, 10);
        startDate = startDate || today;
        endDate = endDate || today;
    }

    const normalizeTime = (value) => {
        if (!value) return null;
        const trimmed = String(value).trim();
        if (/^\\d{2}:\\d{2}$/.test(trimmed)) return `${trimmed}:00`;
        if (/^\\d{2}:\\d{2}:\\d{2}$/.test(trimmed)) return trimmed;
        return null;
    };
    horaInicio = normalizeTime(horaInicio);
    horaFin = normalizeTime(horaFin);

    const conditions = [
        `(v.fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::date BETWEEN $1::date AND $2::date`,
        `COALESCE(v.anulado, false) = false`
    ];
    const params = [startDate, endDate];

    if (['Efectivo', 'Transferencia', 'Mixto'].includes(metodoPago)) {
        conditions.push(`v.metodo_pago = $${params.length + 1}`);
        params.push(metodoPago);
    }
    if (usuarioId) {
        conditions.push(`v.usuario_id = $${params.length + 1}`);
        params.push(parseInt(usuarioId, 10));
    }

    const timeExpr = `(v.fecha_venta AT TIME ZONE '${BUSINESS_TIMEZONE}')::time`;
    if (horaInicio && horaFin) {
        if (horaInicio <= horaFin) {
            conditions.push(`${timeExpr} BETWEEN $${params.length + 1}::time AND $${params.length + 2}::time`);
            params.push(horaInicio, horaFin);
        } else {
            conditions.push(`(${timeExpr} >= $${params.length + 1}::time OR ${timeExpr} <= $${params.length + 2}::time)`);
            params.push(horaInicio, horaFin);
        }
    } else if (horaInicio) {
        conditions.push(`${timeExpr} >= $${params.length + 1}::time`);
        params.push(horaInicio);
    } else if (horaFin) {
        conditions.push(`${timeExpr} <= $${params.length + 1}::time`);
        params.push(horaFin);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
        WITH ventas_filtradas AS (
            SELECT v.id, v.usuario_id, v.monto_total
            FROM ventas v
            WHERE ${whereClause}
        ),
        ganancia_por_venta AS (
            SELECT dv.venta_id,
                   SUM(GREATEST(0, (dv.precio_venta - (
                       CASE dv.tipo_venta
                           WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                           WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                           WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                           WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0)
                           WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0)
                           ELSE COALESCE(p.costo_unidad, 0)
                       END
                   )) * dv.cantidad_vendida)) AS ganancia
            FROM detalle_venta dv
            JOIN productos p ON p.id = dv.producto_id
            WHERE dv.venta_id IN (SELECT id FROM ventas_filtradas)
            GROUP BY dv.venta_id
        )
        SELECT
            u.id AS usuario_id,
            COALESCE(u.nombre_usuario, 'Sistema') AS usuario_nombre,
            u.rol,
            COUNT(vf.id) AS cantidad_ventas,
            COALESCE(SUM(vf.monto_total), 0) AS monto_total,
            COALESCE(SUM(gpv.ganancia), 0) AS ganancia_total
        FROM ventas_filtradas vf
        LEFT JOIN usuarios u ON u.id = vf.usuario_id
        LEFT JOIN ganancia_por_venta gpv ON gpv.venta_id = vf.id
        GROUP BY u.id, u.nombre_usuario, u.rol
        ORDER BY monto_total DESC, usuario_nombre ASC;
    `;

    try {
        const result = await db.query(query, params);
        const rows = result.rows.map((r) => ({
            usuario_id: r.usuario_id,
            usuario_nombre: r.usuario_nombre,
            rol: r.rol,
            cantidad_ventas: parseInt(r.cantidad_ventas, 10) || 0,
            monto_total: Math.round(parseFloat(r.monto_total) || 0),
            ganancia_total: Math.round(parseFloat(r.ganancia_total) || 0)
        }));

        const totales = rows.reduce((acc, r) => {
            acc.cantidad_ventas += r.cantidad_ventas;
            acc.monto_total += r.monto_total;
            acc.ganancia_total += r.ganancia_total;
            return acc;
        }, { cantidad_ventas: 0, monto_total: 0, ganancia_total: 0 });

        res.json({ vendedores: rows, totales });
    } catch (err) {
        console.error('Error al generar el reporte de ventas por vendedor:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;