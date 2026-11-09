const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'drogueria_app',
});

async function diagnostico() {
    try {
        console.log('=== DIAGNÓSTICO: VENTAS CON GANANCIA CERO ===\n');

        // 1. Buscar líneas de venta con ganancia 0
        const query = `
            SELECT 
                dv.id AS detalle_id,
                dv.venta_id,
                dv.producto_id,
                p.nombre AS producto_nombre,
                p.codigo_producto,
                p.costo_unidad,
                p.unidades_por_sobre,
                p.unidades_por_caja,
                p.cantidad_solo_sobre,
                p.cantidad_solo_caja,
                p.precio_unidad,
                p.precio_sobre,
                p.precio_caja,
                p.precio_solo_sobre,
                p.precio_solo_caja,
                p.venta_exclusiva,
                p.margen_unidad,
                p.margen_sobre,
                p.margen_caja,
                p.margen_solo_sobre,
                p.margen_solo_caja,
                p.venta_exclusiva_unidad,
                p.venta_exclusiva_sobre,
                p.venta_exclusiva_caja,
                p.venta_exclusiva_solo_sobre,
                p.venta_exclusiva_solo_caja,
                dv.cantidad_vendida,
                dv.precio_venta,
                dv.tipo_venta,
                v.fecha_venta,
                v.metodo_pago,
                v.monto_total,
                COALESCE(v.anulado, false) AS venta_anulada,
                -- Calcular costo por unidad según tipo
                CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END AS costo_calculado_por_unidad_venta,
                -- Ganancia bruta por línea
                (dv.precio_venta - CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END) * dv.cantidad_vendida AS ganancia_bruta_real,
                -- Ganancia que reporta el sistema (con GREATEST(0,))
                GREATEST(0, (dv.precio_venta - CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END) * dv.cantidad_vendida) AS ganancia_sistema
            FROM detalle_venta dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            WHERE COALESCE(v.anulado, false) = false
              AND dv.tipo_venta IN ('Sobre', 'Solo Sobre', 'Caja', 'Solo Caja')
            ORDER BY v.fecha_venta DESC
            LIMIT 50
        `;

        const result = await pool.query(query);
        
        console.log('LÍNEAS DE VENTA CON TIPO "SOBRE" O "CAJA" (últimas 50):');
        console.log('==========================================================\n');
        
        result.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. Venta #${row.venta_id} | ${new Date(row.fecha_venta).toLocaleDateString()}`);
            console.log(`   Producto: ${row.producto_nombre} (ID: ${row.producto_id})`);
            console.log(`   Código: ${row.codigo_producto}`);
            console.log(`   Tipo de venta: ${row.tipo_venta}`);
            console.log(`   Cantidad vendida: ${row.cantidad_vendida}`);
            console.log(`   Precio de venta unitario: ${row.precio_venta}`);
            console.log(`   Costo_unidad del producto: ${row.costo_unidad}`);
            console.log(`   Unidades por sobre: ${row.unidades_por_sobre}`);
            console.log(`   Cantidad solo sobre: ${row.cantidad_solo_sobre}`);
            console.log(`   Unidades por caja: ${row.unidades_por_caja}`);
            console.log(`   Cantidad solo caja: ${row.cantidad_solo_caja}`);
            console.log(`   Precio sobre: ${row.precio_sobre}`);
            console.log(`   Precio caja: ${row.precio_caja}`);
            console.log(`   Precio solo sobre: ${row.precio_solo_sobre}`);
            console.log(`   Precio solo caja: ${row.precio_solo_caja}`);
            console.log(`   Venta exclusiva: ${row.venta_exclusiva}`);
            console.log(`   Venta exclusiva unidad: ${row.venta_exclusiva_unidad}`);
            console.log(`   Venta exclusiva sobre: ${row.venta_exclusiva_sobre}`);
            console.log(`   Venta exclusiva caja: ${row.venta_exclusiva_caja}`);
            console.log(`   Venta exclusiva solo sobre: ${row.venta_exclusiva_solo_sobre}`);
            console.log(`   Venta exclusiva solo caja: ${row.venta_exclusiva_solo_caja}`);
            console.log(`   Margen unidad: ${row.margen_unidad}`);
            console.log(`   Margen sobre: ${row.margen_sobre}`);
            console.log(`   Margen caja: ${row.margen_caja}`);
            console.log(`   Margen solo sobre: ${row.margen_solo_sobre}`);
            console.log(`   Margen solo caja: ${row.margen_solo_caja}`);
            console.log(`   Costo calculado por unidad de venta: ${row.costo_calculado_por_unidad_venta}`);
            console.log(`   Ganancia bruta REAL: ${row.ganancia_bruta_real}`);
            console.log(`   Ganancia SISTEMA: ${row.ganancia_sistema}`);
            
            // Diagnóstico específico
            if (row.ganancia_sistema === 0 && row.precio_venta > 0) {
                console.log(`   ⚠️ PROBLEMA: Ganancia 0 con precio > 0`);
                if (row.costo_calculado_por_unidad_venta > row.precio_venta) {
                    console.log(`      Razón: Costo calculado (${row.costo_calculado_por_unidad_venta}) > Precio venta (${row.precio_venta})`);
                    if (row.tipo_venta === 'Sobre' || row.tipo_venta === 'Caja') {
                        console.log(`      ⚠️ ESTO ES PROBLEMÁTICO: El cálculo multiplica costo_unidad * unidades_por_${row.tipo_venta.toLowerCase()}`);
                        console.log(`      Pero el "precio_venta" guardado en detalle_venta YA ES el precio del sobre/caja completo`);
                    }
                }
            }
            console.log('');
        });

        // Estadísticas generales
        const stats = await pool.query(`
            SELECT 
                dv.tipo_venta,
                COUNT(*) AS total_lineas,
                COUNT(CASE WHEN 
                    CASE dv.tipo_venta
                        WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                        WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                        WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                        WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                        WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                        ELSE COALESCE(p.costo_unidad, 0)
                    END > dv.precio_venta THEN 1 END) AS lineas_con_problema,
                AVG(dv.precio_venta) AS precio_promedio,
                AVG(CASE dv.tipo_venta
                    WHEN 'Unidad' THEN COALESCE(p.costo_unidad, 0)
                    WHEN 'Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_sobre, 0)
                    WHEN 'Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.unidades_por_caja, 0)
                    WHEN 'Solo Sobre' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_sobre, 0)
                    WHEN 'Solo Caja' THEN COALESCE(p.costo_unidad, 0) * COALESCE(p.cantidad_solo_caja, 0)
                    ELSE COALESCE(p.costo_unidad, 0)
                END) AS costo_promedio
            FROM detalle_venta dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            WHERE COALESCE(v.anulado, false) = false
            GROUP BY dv.tipo_venta
            ORDER BY dv.tipo_venta
        `);

        console.log('\n\nESTADÍSTICAS POR TIPO DE VENTA:');
        console.log('==========================================================');
        stats.rows.forEach(stat => {
            console.log(`\n${stat.tipo_venta}:`);
            console.log(`  Total líneas: ${stat.total_lineas}`);
            console.log(`  Líneas con costo > precio: ${stat.lineas_con_problema}`);
            console.log(`  Precio promedio: ${stat.precio_promedio}`);
            console.log(`  Costo promedio: ${stat.costo_promedio}`);
        });

        // Verificar estructura de tabla productos
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'productos'
              AND (column_name LIKE '%precio%' OR column_name LIKE '%costo%' OR column_name LIKE '%margen%' OR column_name LIKE '%venta_exclusiva%' OR column_name LIKE '%unidad%')
            ORDER BY ordinal_position
        `);

        console.log('\n\nESTRUCTURA DE COLUMNAS RELEVANTES EN PRODUCTOS:');
        console.log('==========================================================');
        structure.rows.forEach(col => {
            console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

diagnostico();