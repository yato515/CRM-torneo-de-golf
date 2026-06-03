const express = require('express');
const path = require('path');
require('dotenv').config();

const exportarRouter = require('./routes/exportar');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', exportarRouter);

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
