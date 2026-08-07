// routes/gastos.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { denyIfAsesor } = require('../middleware/roles');

// Ruta para registrar un nuevo gasto
router.post('/', denyIfAsesor, async (req, res) => {
    const { concepto, monto } = req.body;
    const query = 'INSERT INTO gastos (fecha_gasto, concepto, monto) VALUES (CURRENT_DATE, $1, $2) RETURNING id';
    try {
        const result = await db.query(query, [concepto, monto]);
        res.status(201).json({ message: 'Gasto registrado exitosamente', id: result.rows[0].id });
    } catch (err) {
        console.error('Error al registrar el gasto:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener todos los gastos
router.get('/', denyIfAsesor, async (req, res) => {
    const query = 'SELECT * FROM gastos ORDER BY fecha_gasto DESC';
    try {
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener los gastos:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para actualizar un gasto
router.put('/:id', denyIfAsesor, async (req, res) => {
    const { id } = req.params;
    const { concepto, monto } = req.body;

    if (!concepto || concepto.trim() === '' || monto === undefined || isNaN(monto) || parseFloat(monto) <= 0) {
        return res.status(400).json({ error: 'Concepto y monto válidos son requeridos.' });
    }

    const query = 'UPDATE gastos SET concepto = $1, monto = $2 WHERE id = $3';
    try {
        const result = await db.query(query, [concepto.trim(), parseFloat(monto), id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Gasto no encontrado.' });
        }
        res.json({ message: 'Gasto actualizado exitosamente' });
    } catch (err) {
        console.error('Error al actualizar el gasto:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para eliminar un gasto
router.delete('/:id', denyIfAsesor, async (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM gastos WHERE id = $1';
    try {
        await db.query(query, [id]);
        res.json({ message: 'Gasto eliminado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar el gasto:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;