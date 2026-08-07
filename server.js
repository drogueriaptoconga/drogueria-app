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

const app = express();
const port = 3001;

// Middlewares
app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
    res.send('Servidor del backend de la Droguería funcionando!');
});

app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/entradas', entradasRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/historial', historialRouter);

app.use((req, res) => {
    res.status(404).send('Ruta no encontrada');
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});