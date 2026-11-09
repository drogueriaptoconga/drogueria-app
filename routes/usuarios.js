const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/roles');
const { hashPassword } = require('../utils/passwords');

const router = express.Router();
router.use(requireAdmin);

function validatePassword(password) {
    return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,40}$/;

function validateUsername(username) {
    return typeof username === 'string' && USERNAME_PATTERN.test(username);
}

router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, nombre_usuario, rol, activo FROM usuarios ORDER BY LOWER(nombre_usuario)'
        );
        res.json(result.rows.map(user => ({ ...user, rol: String(user.rol).toLowerCase() })));
    } catch (error) {
        console.error('Error al listar usuarios:', error.message);
        res.status(500).json({ error: 'No se pudieron cargar los usuarios.' });
    }
});

router.post('/', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = req.body?.password;
    if (!validateUsername(username)) {
        return res.status(400).json({ error: 'El usuario debe tener entre 3 y 40 caracteres (letras, números, punto, guion o guion bajo).' });
    }
    if (!validatePassword(password)) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 12 y 128 caracteres.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO usuarios (nombre_usuario, contrasena_hash, rol, activo, debe_cambiar_contrasena)
             VALUES ($1, $2, 'vendedor', TRUE, TRUE)
             RETURNING id, nombre_usuario, rol, activo`,
            [username, hashPassword(password)]
        );
        res.status(201).json({ ...result.rows[0], rol: 'vendedor' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
        }
        console.error('Error al crear vendedor:', error.message);
        res.status(500).json({ error: 'No se pudo crear el usuario.' });
    }
});

router.patch('/:id/active', async (req, res) => {
    const userId = Number(req.params.id);
    const active = req.body?.active;
    if (!Number.isInteger(userId) || typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Solicitud de estado no válida.' });
    }
    if (userId === req.user.id && !active) {
        return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
    }

    try {
        const result = await db.query(
            `UPDATE usuarios SET activo = $1
             WHERE id = $2 AND (LOWER(rol) <> 'admin' OR $1 = TRUE)
             RETURNING id, nombre_usuario, rol, activo`,
            [active, userId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Usuario no encontrado o no se puede desactivar.' });
        }
        res.json({ ...result.rows[0], rol: String(result.rows[0].rol).toLowerCase() });
    } catch (error) {
        console.error('Error al actualizar usuario:', error.message);
        res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
    }
});

router.patch('/:id/username', async (req, res) => {
    const userId = Number(req.params.id);
    const username = String(req.body?.username || '').trim();
    if (!Number.isInteger(userId) || !validateUsername(username)) {
        return res.status(400).json({ error: 'El usuario debe tener entre 3 y 40 caracteres (letras, números, punto, guion o guion bajo).' });
    }

    try {
        const result = await db.query(
            `UPDATE usuarios SET nombre_usuario = $1
             WHERE id = $2 AND LOWER(rol) = 'vendedor'
             RETURNING id, nombre_usuario, rol, activo`,
            [username, userId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Vendedor no encontrado.' });
        }
        res.json({ ...result.rows[0], rol: String(result.rows[0].rol).toLowerCase() });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
        }
        console.error('Error al cambiar nombre de usuario:', error.message);
        res.status(500).json({ error: 'No se pudo cambiar el nombre de usuario.' });
    }
});

router.patch('/:id/password', async (req, res) => {
    const userId = Number(req.params.id);
    const password = req.body?.password;
    if (!Number.isInteger(userId) || !validatePassword(password)) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 12 y 128 caracteres.' });
    }

    try {
        const result = await db.query(
            `UPDATE usuarios SET contrasena_hash = $1, debe_cambiar_contrasena = TRUE
             WHERE id = $2 AND LOWER(rol) = 'vendedor'
             RETURNING id`,
            [hashPassword(password), userId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Vendedor no encontrado.' });
        }
        res.json({ message: 'Contraseña restablecida; deberá cambiarla al iniciar sesión.' });
    } catch (error) {
        console.error('Error al restablecer contraseña:', error.message);
        res.status(500).json({ error: 'No se pudo restablecer la contraseña.' });
    }
});

module.exports = router;