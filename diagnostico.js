const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'drogueria_app',
});

async function runDiagnostico() {
    console.log('=== DIAGNÓSTICO DE PRODUCTOS CON COSTO > PRECIO ===\n');

    try {
        // 1. Contar productos con costo > precio
        const countResult = await pool.query(`
            SELECT COUNT(*) AS total
            FROM productos
            WHERE costo_unidad > precio_unidad
        `);
        console.log(`1. PRODUCTOS CON COSTO > PRECIO: ${countResult.rows[0].total}\n`);

        // 2. Listar productos con detalles
        const productosResult = await pool.query(`
            SELECT 
                id,
                codigo_producto,
                nombre,
                costo_unidad,
                precio_unidad,
                (precio_unidad - costo_unidad) AS diferencia,
                CASE 
                    WHEN precio_unidad > 0 THEN ROUND(((precio_unidad - costo_unidad) / precio_unidad) * 100, 2)
                    ELSE NULL
                END AS margen_porcentaje
            FROM productos
            WHERE costo_unidad > precio_unidad
            ORDER BY id
        `);
        
        console.log('2. DETALLE DE PRODUCTOS:');
        console.log('------------------------------------------------------------');
        productosResult.rows.forEach((p, i) => {
            console.log(`${i+1}. ID: ${p.id} | ${p.codigo_producto} | ${p.nombre}`);
            console.log(`   Costo: ${p.costo_unidad} | Precio: ${p.precio_unidad} | Diff: ${p.diferencia} | Margen: ${p.margen_porcentaje}%`);
        });
        console.log('');

        // 3. Verificar si han tenido ventas
        const ids = productosResult.rows.map(p => p.id);
        if (ids.length > 0) {
            const placeholders = ids.map((_, i) => `$${i+1}`).join(',');
            
            const ventasResult = await pool.query(`
                SELECT 
                    dv.producto_id,
                    p.nombre AS producto_nombre,
                    COUNT(DISTINCT dv.venta_id) AS num_ventas,
                    SUM(dv.cantidad_vendida) AS total_unidades_vendidas,
                    SUM(dv.precio_venta * dv.cantidad_vendida) AS total_ingresos,
                    SUM(CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END * dv.cantidad_vendida) AS total_costo,
                    SUM((dv.precio_venta - CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END) * dv.cantidad_vendida) AS ganancia_real
                FROM detalle_venta dv
                JOIN productos p ON dv.producto_id = p.id
                JOIN ventas v ON dv.venta_id = v.id
                WHERE dv.producto_id IN (${placeholders})
                  AND COALESCE(v.anulado, false) = false
                GROUP BY dv.producto_id, p.nombre
                ORDER BY dv.producto_id
            `, ids);

            console.log('3. VENTAS DE ESTOS PRODUCTOS (solo ventas no anuladas):');
            console.log('------------------------------------------------------------');
            ventasResult.rows.forEach(v => {
                console.log(`   ID: ${v.producto_id} | ${v.producto_nombre}`);
                console.log(`   Ventas: ${v.num_ventas} | Unidades: ${v.total_unidades_vendidas}`);
                console.log(`   Ingresos: ${v.total_ingresos} | Costo: ${v.total_costo} | Ganancia REAL: ${v.ganancia_real}`);
                console.log(`   Pérdida por venta: ${Number(v.total_ingresos) - Number(v.total_costo)}`);
            });

            // 4. Contar ventas donde precio_venta < costo (por línea)
            const ventasLineaResult = await pool.query(`
                SELECT COUNT(*) AS total_lineas_perdida
                FROM detalle_venta dv
                JOIN ventas v ON dv.venta_id = v.id
                JOIN productos p ON dv.producto_id = p.id
                WHERE dv.producto_id IN (${placeholders})
                  AND COALESCE(v.anulado, false) = false
                  AND dv.precio_venta < (
                    CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END
                  )
            `, ids);

            console.log(`\n4. LÍNEAS DE VENTA CON PRECIO < COSTO: ${ventasLineaResult.rows[0].total_lineas_perdida}`);

            // 5. Pérdida real acumulada
            const perdidaResult = await pool.query(`
                SELECT SUM(
                    (dv.precio_venta - CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END) * dv.cantidad_vendida
                ) AS perdida_total
                FROM detalle_venta dv
                JOIN ventas v ON dv.venta_id = v.id
                JOIN productos p ON dv.producto_id = p.id
                WHERE dv.producto_id IN (${placeholders})
                  AND COALESCE(v.anulado, false) = false
                  AND dv.precio_venta < (
                    CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END
                  )
            `, ids);

            console.log(`\n5. PÉRDIDA REAL ACUMULADA (solo líneas con pérdida): ${perdidaResult.rows[0].perdida_total || 0}`);

            // 6. Qué reporta el sistema (ganancia 0 por la regla)
            const sistemaResult = await pool.query(`
                SELECT SUM(GREATEST(0, 
                    (dv.precio_venta - CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END) * dv.cantidad_vendida
                )) AS ganancia_sistema
                FROM detalle_venta dv
                JOIN ventas v ON dv.venta_id = v.id
                JOIN productos p ON dv.producto_id = p.id
                WHERE dv.producto_id IN (${placeholders})
                  AND COALESCE(v.anulado, false) = false
            `, ids);

            console.log(`\n6. GANANCIA QUE REPORTA EL SISTEMA (con regla GREATEST(0,...)): ${sistemaResult.rows[0].ganancia_sistema || 0}`);

            // 7. Análisis de origen: ¿costos cambiaron después del precio?
            const historialCostos = await pool.query(`
                SELECT 
                    e.producto_id,
                    p.nombre,
                    e.costo_unidad_entrada,
                    e.fecha_entrada,
                    e.cantidad_entrada
                FROM entradas_stock e
                JOIN productos p ON e.producto_id = p.id
                WHERE e.producto_id IN (${placeholders})
                  AND e.costo_unidad_entrada != p.costo_unidad
                ORDER BY e.producto_id, e.fecha_entrada DESC
            `, ids);

            console.log('\n7. ENTRADAS CON COSTO DIFERENTE AL ACTUAL (posible cambio de costo posterior):');
            if (historialCostos.rows.length > 0) {
                historialCostos.rows.forEach(h => {
                    console.log(`   ID: ${h.producto_id} | ${h.nombre} | Costo entrada: ${h.costo_unidad_entrada} | Costo actual: ${productosResult.rows.find(p => p.id === h.producto_id)?.costo_unidad} | Fecha: ${h.fecha_entrada} | Cant: ${h.cantidad_entrada}`);
                });
            } else {
                console.log('   No se detectaron cambios de costo en entradas_stock');
            }

            // 8. Verificar si hay productos con precio_venta = 0 o muy bajo
            const preciosCero = await pool.query(`
                SELECT id, nombre, precio_unidad, costo_unidad
                FROM productos
                WHERE precio_unidad <= 0 AND costo_unidad > 0
            `);

            console.log('\n8. PRODUCTOS CON PRECIO <= 0:');
            if (preciosCero.rows.length > 0) {
                preciosCero.rows.forEach(p => {
                    console.log(`   ID: ${p.id} | ${p.nombre} | Precio: ${p.precio_unidad} | Costo: ${p.costo_unidad}`);
                });
            } else {
                console.log('   Ninguno');
            }

        } else {
            console.log('3. No hay productos con costo > precio');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

runDiagnostico();