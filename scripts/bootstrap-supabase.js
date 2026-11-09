const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');

const TABLES = ['usuarios', 'productos', 'ventas', 'detalle_venta', 'entradas_stock', 'gastos'];

function buildSupabaseConfig() {
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    if (!connectionString) {
        throw new Error('Falta SUPABASE_DATABASE_URL en .env. Usa la cadena del Session Pooler de Supabase.');
    }
    return {
        connectionString,
        ssl: process.env.SUPABASE_DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
        application_name: 'drogueria-bootstrap',
    };
}

async function main() {
    const client = new Client(buildSupabaseConfig());
    await client.connect();

    try {
        const { rows } = await client.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
            [TABLES]
        );

        if (rows.length) {
            console.log('Ya existen tablas de la drogueria en Supabase:', rows.map((row) => row.table_name).join(', '));
            console.log('No se vuelve a crear el esquema. Para actualizar datos ejecuta: npm run db:supabase:sync');
            return;
        }

        const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');

        await client.query('BEGIN');
        try {
            await client.query(schema);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }

        console.log('Esquema creado en Supabase (6 tablas + sync_control).');
        console.log('Siguiente paso: npm run db:supabase:sync');
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('ERROR AL CREAR EL ESQUEMA:', error.message);
    process.exitCode = 1;
});
