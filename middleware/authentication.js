const crypto = require('crypto');
const db = require('../db');

const sessions = new Map();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días: sin tope de 8 horas (solicitud del cliente)

function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
}

function revokeSession(token) {
    sessions.delete(token);
}

async function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
    if (!match) {
        return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }

    const token = match[1];
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
    }

    try {
        const result = await db.query(
            'SELECT id, nombre_usuario, rol, debe_cambiar_contrasena FROM usuarios WHERE id = $1 AND activo = TRUE',
            [session.userId]
        );
        if (!result.rows.length) {
            sessions.delete(token);
            return res.status(401).json({ error: 'La cuenta está inactiva.' });
        }

        const user = result.rows[0];
        req.user = {
            id: user.id,
            username: user.nombre_usuario,
            nombre: user.nombre_usuario,
            role: String(user.rol || '').toLowerCase(),
            debeCambiarContrasena: Boolean(user.debe_cambiar_contrasena)
        };
        req.authToken = token;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = { authenticate, createSession, revokeSession };