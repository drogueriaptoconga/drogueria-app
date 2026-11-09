const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'drogueria_app',
});

const sql = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'productos' ORDER BY ordinal_position`;

pool.query(sql)
    .then(r => {
        console.log(JSON.stringify(r.rows, null, 2));
        process.exit(0);
    })
    .catch(e => {
        console.error(e.message);
        process.exit(1);
    })
    .finally(() => pool.end());