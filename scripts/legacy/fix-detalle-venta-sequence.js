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
    const sql = `SELECT setval(pg_get_serial_sequence('detalle_venta', 'id'), COALESCE((SELECT MAX(id) FROM detalle_venta), 0), true)`;
    await client.query(sql);
    const seq = await client.query('SELECT last_value FROM detalle_venta_id_seq');
    const max = await client.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM detalle_venta');
    console.log('detalle_max_id:', max.rows[0].max_id);
    console.log('detalle_last_value:', seq.rows[0].last_value);
    console.log('✅ Secuencia de detalle_venta sincronizada');
  } catch (error) {
    console.error('Error al sincronizar detalle_venta:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
