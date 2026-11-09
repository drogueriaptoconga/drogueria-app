const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { requireAdmin } = require('../middleware/roles');

const router = express.Router();
const PROJECT_ROOT = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'sync-to-supabase.js');
const TIMEOUT_MS = 5 * 60 * 1000;

let isSyncing = false;

router.post('/sync', requireAdmin, (req, res) => {
    if (isSyncing) {
        return res.status(409).json({ error: 'Ya hay una sincronización en curso. Espera a que termine.' });
    }

    isSyncing = true;

    let finished = false;
    let clientGone = false;
    let timeout;

    const finish = (status, payload) => {
        if (finished) return;
        finished = true;
        isSyncing = false;
        if (timeout) clearTimeout(timeout);
        if (clientGone || res.headersSent || res.writableEnded) return;
        res.status(status).json(payload);
    };

    const child = spawn(process.execPath, [SCRIPT_PATH], {
        cwd: PROJECT_ROOT,
        env: process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const append = (current, chunk) => {
        const next = current + chunk.toString();
        return next.length > 20000 ? next.slice(-20000) : next;
    };

    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });

    child.on('error', (error) => {
        finish(500, { error: `No se pudo iniciar la sincronización: ${error.message}` });
    });

    child.on('close', (code) => {
        if (code === 0) {
            finish(200, {
                message: 'Sincronización con Supabase completada.',
                detalle: stdout.trim().split('\n').filter(Boolean).slice(-12),
            });
        } else {
            finish(500, {
                error: 'La sincronización falló. Revisa el detalle.',
                detalle: (stderr || stdout).trim().split('\n').filter(Boolean).slice(-20),
            });
        }
    });

    timeout = setTimeout(() => {
        if (finished) return;
        child.kill('SIGKILL');
        finish(500, { error: 'La sincronización excedió el tiempo máximo (5 minutos) y se canceló.' });
    }, TIMEOUT_MS);

    res.on('close', () => { clientGone = true; });
});

module.exports = router;
