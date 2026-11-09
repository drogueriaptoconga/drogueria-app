const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createSupabaseClient } = require('./sync-to-supabase');
const { hashPassword } = require('../utils/passwords');

const TARGET_SCHEMA = (process.env.PUERTO_MILLO_SCHEMA || 'puerto_millo').trim();
const SOURCE_SCHEMA = 'public';
const ADMIN_PASSWORD = process.env.PUERTO_MILLO_ADMIN_PASSWORD || '';
const BASELINE_MIGRATION = '20261108_users_security.sql';
const TABLES = ['usuarios', 'productos', 'ventas', 'detalle_venta', 'entradas_stock', 'gastos'];

function validateSchema(name) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error('El nombre del esquema no es valido.');
    }
    return name;
}

async function countRows(client, schema, table) {
    const { rows } = await client.query(
        `SELECT count(*)::int AS total FROM "${schema}"."${table}"`
    );
    return rows[0].total;
}

async function main() {
    validateSchema(TARGET_SCHEMA);

    const client = await createSupabaseClient();
    console.log('Conectado a Supabase.');

    try {
        const existing = await client.query(
            `SELECT to_regclass($1) AS tabla`,
            [`${TARGET_SCHEMA}.productos`]
        );
        if (existing.rows[0].tabla) {
            throw new Error(
                `El esquema ${TARGET_SCHEMA} ya tiene la tabla productos. No se vuelve a crear.`
            );
        }

        let ddl = fs.readFileSync(
            path.join(__dirname, '..', 'supabase', 'schema.sql'),
            'utf8'
        );
        ddl = ddl.replace(
            /CREATE SCHEMA IF NOT EXISTS public;/g,
            `CREATE SCHEMA IF NOT EXISTS ${TARGET_SCHEMA};`
        );
        ddl = ddl.replace(/\bpublic\./g, `${TARGET_SCHEMA}.`);

        await client.query('BEGIN');
        try {
            await client.query(ddl);

            await client.query(
                `CREATE TABLE IF NOT EXISTS "${TARGET_SCHEMA}".schema_migrations (
                    filename text PRIMARY KEY,
                    applied_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await client.query(
                `INSERT INTO "${TARGET_SCHEMA}".schema_migrations (filename)
                 VALUES ($1)
                 ON CONFLICT DO NOTHING`,
                [BASELINE_MIGRATION]
            );

            const sourceColumns = await client.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = 'productos'
                 ORDER BY ordinal_position`,
                [SOURCE_SCHEMA]
            );
            const targetColumns = await client.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = 'productos'
                 ORDER BY ordinal_position`,
                [TARGET_SCHEMA]
            );

            const sourceNames = sourceColumns.rows.map((row) => row.column_name);
            const targetNames = targetColumns.rows.map((row) => row.column_name);
            if (JSON.stringify(sourceNames) !== JSON.stringify(targetNames)) {
                throw new Error(
                    'Las columnas de productos no coinciden entre public y el esquema nuevo. No se copia el catalogo.'
                );
            }

            await client.query(
                `INSERT INTO "${TARGET_SCHEMA}".productos
                 SELECT * FROM "${SOURCE_SCHEMA}".productos`
            );
            await client.query(
                `UPDATE "${TARGET_SCHEMA}".productos
                 SET stock_total = 0,
                     fecha_ultima_entrada = NULL,
                     fecha_vencimiento = NULL`
            );
            await client.query(
                `SELECT setval(
                    pg_get_serial_sequence('${TARGET_SCHEMA}.productos', 'id'),
                    COALESCE((SELECT MAX(id) FROM "${TARGET_SCHEMA}".productos), 1),
                    (SELECT COUNT(*) > 0 FROM "${TARGET_SCHEMA}".productos)
                )`
            );

            if (ADMIN_PASSWORD) {
                if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 128) {
                    throw new Error('PUERTO_MILLO_ADMIN_PASSWORD debe tener entre 12 y 128 caracteres.');
                }

                const admins = await client.query(
                    `SELECT id FROM "${TARGET_SCHEMA}".usuarios WHERE LOWER(rol) = 'admin' LIMIT 1`
                );

                if (!admins.rowCount) {
                    await client.query(
                        `INSERT INTO "${TARGET_SCHEMA}".usuarios
                            (nombre_usuario, contrasena_hash, rol, activo, debe_cambiar_contrasena)
                         VALUES ('Admin', $1, 'admin', TRUE, TRUE)`,
                        [hashPassword(ADMIN_PASSWORD)]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }

        const counts = {};
        for (const table of TABLES) {
            counts[table] = await countRows(client, TARGET_SCHEMA, table);
        }

        console.log(`Esquema ${TARGET_SCHEMA} creado en Supabase.`);
        console.log('Conteos:', counts);
        console.log(`Catalogo de productos copiado desde ${SOURCE_SCHEMA} con stock 0.`);
        if (ADMIN_PASSWORD) {
            console.log('Admin creado con cambio obligatorio de clave en el primer ingreso.');
        } else {
            console.log('No se creo Admin. Define PUERTO_MILLO_ADMIN_PASSWORD si quieres crearlo.');
        }
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
});
