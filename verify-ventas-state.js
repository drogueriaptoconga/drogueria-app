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
  try {
    await pool.query("SELECT setval(pg_get_serial_sequence('ventas', 'id'), COALESCE((SELECT MAX(id) FROM ventas), 0), true)");
    const last = await pool.query('SELECT last_value FROM ventas_id_seq');
    const max = await pool.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM ventas');
    console.log('ventas_max_id=' + max.rows[0].max_id);
    console.log('ventas_last_value=' + last.rows[0].last_value);
    console.log('status=' + (Number(last.rows[0].last_value) >= Number(max.rows[0].max_id) ? 'OK' : 'DESFASE'));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
