// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db'); // <-- RUTA CORREGIDA AQUÍ
const productosRouter = require('./routes/productos');
const ventasRouter = require('./routes/ventas');
const entradasRouter = require('./routes/entradas');
const gastosRouter = require('./routes/gastos');
const reportesRouter = require('./routes/reportes');
const historialRouter = require('./routes/historial');
const trasladosRouter = require('./routes/traslados');
const backupRouter = require('./routes/backup');
const supabaseSyncRouter = require('./routes/supabaseSync');
const authRouter = require('./routes/auth');
const usuariosRouter = require('./routes/usuarios');
const { authenticate } = require('./middleware/authentication');

const app = express();
const port = process.env.PORT || 3001;

async function syncDatabaseSequences() {
    try {
        const client = await db.pool.connect();
        try {
            await client.query("SELECT setval('public.ventas_id_seq', COALESCE((SELECT MAX(id) FROM ventas), 0), true)");
            await client.query("SELECT setval('public.detalle_venta_id_seq', COALESCE((SELECT MAX(id) FROM detalle_venta), 0), true)");
        } finally {
            client.release();
        }
    } catch (error) {
        console.warn('⚠️ No se pudieron sincronizar las secuencias al iniciar:', error.message);
    }
}

// Middlewares
app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
    res.send('Servidor del backend de la Droguería funcionando!');
});

app.use('/api/auth', authRouter);
app.use('/api', authenticate);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/entradas', entradasRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/historial', historialRouter);
app.use('/api/traslados', trasladosRouter);
app.use('/api/backup', backupRouter);
app.use('/api/supabase', supabaseSyncRouter);

app.use((req, res) => {
    res.status(404).send('Ruta no encontrada');
});

app.listen(port, async () => {
    await syncDatabaseSequences();
    console.log(`Servidor escuchando en http://localhost:${port}`);
});