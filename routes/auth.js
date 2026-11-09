const express = require('express');
const db = require('../db');
const { authenticate, createSession, revokeSession } = require('../middleware/authentication');
const { hashPassword, verifyPassword } = require('../utils/passwords');

const router = express.Router();

function publicUser(user) {
    return {
        id: user.id,
        username: user.nombre_usuario,
        nombre: user.nombre_usuario,
        role: String(user.rol || '').toLowerCase(),
        debeCambiarContrasena: Boolean(user.debe_cambiar_contrasena)
    };
}

router.post('/login', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = req.body?.password;
    if (!username || typeof password !== 'string') {
        return res.status(400).json({ error: 'Escribe el usuario y la contraseña.' });
    }

    try {
        const result = await db.query(
            `SELECT id, nombre_usuario, contrasena_hash, rol, debe_cambiar_contrasena
             FROM usuarios
             WHERE LOWER(nombre_usuario) = LOWER($1) AND activo = TRUE`,
            [username]
        );
        const user = result.rows[0];
        if (!user || !verifyPassword(password, user.contrasena_hash)) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }

        const token = createSession(user.id);
        res.json({ token, user: publicUser(user) });
    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);
        res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
});

router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

router.post('/logout', authenticate, (req, res) => {
    revokeSession(req.authToken);
    res.status(204).end();
});

router.post('/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'Escribe la contraseña actual.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 12) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 12 caracteres.' });
    }

    try {
        const result = await db.query('SELECT contrasena_hash FROM usuarios WHERE id = $1 AND activo = TRUE', [req.user.id]);
        if (!result.rows[0] || !verifyPassword(currentPassword, result.rows[0].contrasena_hash)) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }

        await db.query(
            'UPDATE usuarios SET contrasena_hash = $1, debe_cambiar_contrasena = FALSE WHERE id = $2',
            [hashPassword(newPassword), req.user.id]
        );
        res.json({ message: 'Contraseña actualizada.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error.message);
        res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
    }
});

module.exports = router;