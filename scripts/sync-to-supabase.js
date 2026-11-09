const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Resolver } = require('dns').promises;
const { Client, types } = require('pg');

// Mantener timestamps sin zona y fechas como texto para una copia exacta.
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1082, (value) => value);

const TABLES = ['usuarios', 'productos', 'ventas', 'detalle_venta', 'entradas_stock', 'gastos'];
const BATCH_SIZE = 500;

function buildLocalConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        };
    }
    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'drogueria_app',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
}

function buildSupabaseConfig() {
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    if (!connectionString) {
        throw new Error('Falta SUPABASE_DATABASE_URL en .env. Usa la cadena del Session Pooler de Supabase.');
    }
    return {
        connectionString,
        ssl: process.env.SUPABASE_DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
        application_name: 'drogueria-sync',
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createConnectedClient(configFactory, label, attempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const client = new Client(configFactory());
        try {
            await client.connect();
            return client;
        } catch (error) {
            lastError = error;
            await client.end().catch(() => {});
            if (attempt < attempts) {
                console.log(
                    `No se pudo conectar a ${label} (intento ${attempt}/${attempts}): ${error.message}. Reintentando en 5 s...`
                );
                await sleep(5000);
            }
        }
    }

    throw lastError;
}

async function resolveWithPublicDns(connectionString) {
    const url = new URL(connectionString);
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);

    const addresses = await resolver.resolve4(url.hostname);
    if (!addresses.length) {
        throw new Error(`El DNS publico no devolvio direcciones para ${url.hostname}`);
    }

    return {
        host: addresses[0],
        port: Number(url.port || 5432),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, '')),
        ssl: process.env.SUPABASE_DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
        application_name: 'drogueria-sync',
    };
}

async function createSupabaseClient(attempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const client = new Client(buildSupabaseConfig());
        try {
            await client.connect();
            return client;
        } catch (error) {
            lastError = error;
            await client.end().catch(() => {});

            if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                let fallbackClient;
                try {
                    console.log('El DNS local fallo; intentando resolver con DNS publico (8.8.8.8)...');
                    fallbackClient = new Client(await resolveWithPublicDns(process.env.SUPABASE_DATABASE_URL));
                    await fallbackClient.connect();
                    console.log('Conectado a Supabase por DNS publico.');
                    return fallbackClient;
                } catch (fallbackError) {
                    lastError = fallbackError;
                    if (fallbackClient) await fallbackClient.end().catch(() => {});
                }
            }

            if (attempt < attempts) {
                console.log(
                    `No se pudo conectar a Supabase (intento ${attempt}/${attempts}): ${lastError.message}. Reintentando en 5 s...`
                );
                await sleep(5000);
            }
        }
    }

    throw lastError;
}

async function getColumns(client, table) {
    const { rows } = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
    );
    if (!rows.length) throw new Error(`No existe public.${table} en la base local.`);
    return rows.map((row) => row.column_name);
}

async function countRows(client, table) {
    const { rows } = await client.query(`SELECT count(*)::int AS total FROM public."${table}"`);
    return rows[0].total;
}

function buildInsert(table, columns, rows) {
    const params = [];
    let position = 1;
    const groups = rows.map(() => {
        const placeholders = columns.map(() => `$${position++}`);
        return `(${placeholders.join(', ')})`;
    });
    for (const row of rows) params.push(...row);

    return {
        sql: `INSERT INTO public."${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES ${groups.join(', ')}`,
        params,
    };
}

async function main() {
    let source;
    let destination;

    try {
        if (process.env.SUPABASE_SYNC_ENABLED !== 'true') {
            throw new Error(
                'Sincronizacion deshabilitada en esta maquina. Define SUPABASE_SYNC_ENABLED=true solo en la maquina de produccion.'
            );
        }

        if (!process.env.SUPABASE_DATABASE_URL) {
            throw new Error('Falta SUPABASE_DATABASE_URL en .env. Usa la cadena del Session Pooler de Supabase.');
        }

        source = await createConnectedClient(buildLocalConfig, 'PostgreSQL local');
        console.log('Conectado a PostgreSQL local.');
        destination = await createSupabaseClient();
        console.log('Conectado a Supabase.');

        const { rows: destinationTables } = await destination.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );
        const existing = new Set(destinationTables.map((row) => row.table_name));
        const missing = TABLES.filter((table) => !existing.has(table));
        if (missing.length) {
            throw new Error(
                `Faltan tablas en Supabase: ${missing.join(', ')}. Ejecuta primero: npm run db:supabase:schema`
            );
        }

        const counts = {};
        const payload = {};

        for (const table of TABLES) {
            const columns = await getColumns(source, table);
            const { rows } = await source.query({
                text: `SELECT * FROM public."${table}"`,
                rowMode: 'array',
            });
            payload[table] = { columns, rows };
            counts[table] = rows.length;
            console.log(`Origen ${table}: ${rows.length} filas.`);
        }

        await destination.query('BEGIN');
        try {
            await destination.query('SET LOCAL statement_timeout = 0');
            await destination.query("SET LOCAL lock_timeout = '20s'");
            await destination.query("SELECT pg_advisory_xact_lock(hashtext('drogueria_app_sync')::bigint)");

            await destination.query(
                `TRUNCATE TABLE
                    public.detalle_venta,
                    public.entradas_stock,
                    public.gastos,
                    public.productos,
                    public.ventas,
                    public.usuarios
                 RESTART IDENTITY CASCADE`
            );

            for (const table of TABLES) {
                const { columns, rows } = payload[table];
                for (let index = 0; index < rows.length; index += BATCH_SIZE) {
                    const batch = rows.slice(index, index + BATCH_SIZE);
                    const { sql, params } = buildInsert(table, columns, batch);
                    await destination.query(sql, params);
                }
                console.log(`Copiado ${table}: ${rows.length} filas.`);
            }

            for (const table of TABLES) {
                await destination.query(
                    `SELECT setval(
                        pg_get_serial_sequence('public.${table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM public.${table}), 1),
                        (SELECT COUNT(*) > 0 FROM public.${table})
                    )`
                );
            }

            for (const table of TABLES) {
                const destinationCount = await countRows(destination, table);
                if (destinationCount !== counts[table]) {
                    throw new Error(
                        `Conteo distinto en ${table}: local ${counts[table]}, Supabase ${destinationCount}`
                    );
                }
            }

            await destination.query(
                `INSERT INTO public.sync_control (origen, estado, detalle, filas)
                 VALUES ($1, 'OK', $2, $3::jsonb)`,
                [
                    `${process.env.DB_NAME || 'drogueria_app'}@local`,
                    'Sincronizacion completa',
                    JSON.stringify(counts),
                ]
            );

            await destination.query('COMMIT');
            console.log('Sincronizacion completada y confirmada.');
            console.log('Filas copiadas:', counts);
        } catch (error) {
            await destination.query('ROLLBACK').catch(() => {});
            try {
                await destination.query(
                    `INSERT INTO public.sync_control (origen, estado, detalle)
                     VALUES ($1, 'ERROR', $2)`,
                    [`${process.env.DB_NAME || 'drogueria_app'}@local`, String(error.message).slice(0, 2000)]
                );
            } catch (_) {
                // Si ni siquiera se puede registrar el error, se reporta por consola.
            }
            throw error;
        }
    } finally {
        if (source) await source.end().catch(() => {});
        if (destination) await destination.end().catch(() => {});
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('ERROR DE SINCRONIZACION:', error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildLocalConfig,
    createConnectedClient,
    createSupabaseClient,
    TABLES,
};
