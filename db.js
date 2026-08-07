// =============================================
// db.js - CORRECTO PARA POSTGRESQL
// =============================================

const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión a PostgreSQL (preferir DATABASE_URL si está presente)
const poolConfig = {};

if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
    // Habilitar SSL si se solicita (útil para Supabase u otros remotos)
    if (process.env.DB_SSL === 'true') {
        poolConfig.ssl = { rejectUnauthorized: false };
    }
} else {
    poolConfig.host = process.env.DB_HOST || 'localhost';
    poolConfig.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
    poolConfig.user = process.env.DB_USER || 'postgres';
    poolConfig.password = process.env.DB_PASSWORD || undefined;
    poolConfig.database = process.env.DB_NAME || 'drogueria_db';
    if (process.env.DB_SSL === 'true') {
        poolConfig.ssl = { rejectUnauthorized: false };
    }
}

const pool = new Pool({
    ...poolConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Función para ejecutar consultas
const query = async (text, params) => {
    try {
        const start = Date.now();
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`✅ Query ejecutada en ${duration}ms`);
        return res;
    } catch (error) {
        console.error('❌ Error en query:', error.message);
        throw error;
    }
};

// Probar conexión
(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Conectado a PostgreSQL');
        client.release();
    } catch (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
    }
})();

// Exportar correctamente
module.exports = {
    pool,    // ← IMPORTANTE: exportar pool
    query    // ← IMPORTANTE: exportar query
};