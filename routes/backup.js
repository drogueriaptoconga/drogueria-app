const express = require('express');
const { spawn } = require('child_process');
const { requireAdmin } = require('../middleware/roles');

const router = express.Router();

function getDatabaseConfig() {
    if (process.env.DATABASE_URL) {
        const connection = new URL(process.env.DATABASE_URL);
        return {
            host: connection.hostname,
            port: connection.port || '5432',
            user: decodeURIComponent(connection.username),
            password: decodeURIComponent(connection.password),
            database: decodeURIComponent(connection.pathname.replace(/^\//, '')),
            sslMode: connection.searchParams.get('sslmode') || (process.env.DB_SSL === 'true' ? 'require' : undefined)
        };
    }

    return {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'drogueria_app',
        sslMode: process.env.DB_SSL === 'true' ? 'require' : undefined
    };
}

router.get('/', requireAdmin, (req, res) => {
    let database;
    try {
        database = getDatabaseConfig();
    } catch (error) {
        return res.status(500).json({ error: 'La configuración de conexión de la base de datos no es válida.' });
    }

    const env = { ...process.env };
    env.PGHOST = database.host;
    env.PGPORT = database.port;
    env.PGUSER = database.user;
    env.PGDATABASE = database.database;
    if (database.password) env.PGPASSWORD = database.password;
    else delete env.PGPASSWORD;
    if (database.sslMode) env.PGSSLMODE = database.sslMode;
    else delete env.PGSSLMODE;

    const filename = `drogueria_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
    const dump = spawn(process.env.PG_DUMP_PATH || 'pg_dump', [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--host', database.host,
        '--port', database.port,
        '--username', database.user,
        '--dbname', database.database
    ], { env });
    let stderr = '';
    let failedToStart = false;

    dump.stderr.on('data', (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-8000);
    });
    dump.on('error', (error) => {
        failedToStart = true;
        if (!res.headersSent) {
            res.status(500).json({ error: `No se pudo iniciar pg_dump: ${error.message}` });
        } else {
            res.destroy(error);
        }
    });
    dump.on('close', (code) => {
        if (code !== 0 && !failedToStart) {
            if (!res.headersSent) {
                res.status(500).json({ error: `Falló la creación del respaldo. ${stderr.trim()}` });
            } else if (!res.destroyed && !res.writableEnded) {
                res.destroy(new Error('Falló la creación del respaldo.'));
            }
        }
    });

    req.on('aborted', () => dump.kill());
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    dump.stdout.pipe(res);
});

module.exports = router;