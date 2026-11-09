const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'drogueria_app'
  });

  const client = await pool.connect();

  try {
    const maxRes = await client.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM ventas');
    const seqRes = await client.query("SELECT pg_get_serial_sequence('ventas', 'id') AS seq_name");
    const seqName = seqRes.rows[0]?.seq_name;

    if (!seqName) {
      throw new Error('No existe secuencia para ventas.id');
    }

    const lastRes = await client.query(`SELECT last_value FROM ${seqName.replace(/^public\./, '')}`);
    const lastValue = Number(lastRes.rows[0]?.last_value ?? 0);
    const maxId = Number(maxRes.rows[0]?.max_id ?? 0);

    console.log('ventas max_id:', maxId);
    console.log('ventas sequence last_value:', lastValue);

    if (lastValue < maxId) {
      throw new Error(`La secuencia de ventas está desfasada: last_value=${lastValue}, max_id=${maxId}`);
    }

    console.log('OK: la secuencia de ventas está sincronizada');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
