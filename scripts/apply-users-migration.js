const fs = require('fs');
const path = require('path');
const db = require('../db');

async function applyMigration() {
    const migrationPath = path.join(__dirname, '..', 'migrations', '20261108_users_security.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migración de usuarios aplicada.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await db.pool.end();
    }
}

applyMigration().catch((error) => {
    console.error('No se pudo aplicar la migración:', error.message);
    process.exitCode = 1;
});