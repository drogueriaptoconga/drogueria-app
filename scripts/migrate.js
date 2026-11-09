const fs = require('fs');
const path = require('path');

const {
    buildLocalConfig,
    createConnectedClient,
    createSupabaseClient,
} = require('./sync-to-supabase');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function main() {
    const target = String(process.argv[2] || '').toLowerCase();

    if (!['local', 'supabase'].includes(target)) {
        console.error('Uso: node scripts/migrate.js local|supabase');
        process.exitCode = 1;
        return;
    }

    const client = target === 'supabase'
        ? await createSupabaseClient()
        : await createConnectedClient(buildLocalConfig, 'PostgreSQL local');

    try {
        await client.query(
            `CREATE TABLE IF NOT EXISTS public.schema_migrations (
                filename text PRIMARY KEY,
                applied_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
        );

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter((file) => file.toLowerCase().endsWith('.sql'))
            .sort();

        if (!files.length) {
            console.log('No hay archivos de migracion.');
            return;
        }

        for (const file of files) {
            const exists = await client.query(
                'SELECT 1 FROM public.schema_migrations WHERE filename = $1',
                [file]
            );

            if (exists.rowCount) {
                console.log(`SKIP ${file}`);
                continue;
            }

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`OK   ${file}`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw new Error(`${file}: ${error.message}`);
            }
        }

        console.log(`Migraciones aplicadas en ${target}.`);
    } finally {
        await client.end().catch(() => {});
    }
}

main().catch((error) => {
    console.error('ERROR DE MIGRACION:', error.message);
    process.exitCode = 1;
});
