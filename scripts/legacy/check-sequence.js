const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || 'drogueria_app'
});

(async () => {
  const client = await pool.connect();
  try {
    const seqRes = await client.query(`
      SELECT pg_get_serial_sequence('productos','id') AS seq_name
    `);
    console.log('seq_name:', seqRes.rows[0].seq_name);

    const maxRes = await client.query(`
      SELECT COALESCE(MAX(id), 0) AS max_id FROM productos
    `);
    console.log('max_id:', maxRes.rows[0].max_id);

    if (seqRes.rows[0].seq_name) {
      const nextRes = await client.query(`SELECT setval('${seqRes.rows[0].seq_name}', ${maxRes.rows[0].max_id}, true);`);
      console.log('setval result:', nextRes.rows[0]);
    }
  } finally {
    client.release();
    await pool.end();
  }
})();
