const express = require('express');
const path = require('path');
require('dotenv').config();

const exportarRouter = require('./routes/exportar');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', exportarRouter);

// Solo levantar el listener en local — Vercel maneja esto automáticamente
if (process.env.VERCEL !== '1') {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
        console.log('Presiona Ctrl+C para detener el servidor');
    });

    process.on('SIGINT', () => {
        console.log('\nCerrando servidor...');
        server.close(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
        server.close(() => process.exit(0));
    });
}

module.exports = app;
