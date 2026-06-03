const express = require('express');
const path = require('path');
require('dotenv').config();

const exportarRouter = require('./routes/exportar');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', exportarRouter);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
