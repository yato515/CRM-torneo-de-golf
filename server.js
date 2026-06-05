const express = require('express');
const path = require('path');
require('dotenv').config();

const exportarRouter = require('./routes/exportar');

const app = express();

// ============================================
// HEADERS DE SEGURIDAD
// ============================================
app.use((req, res, next) => {
    // Content Security Policy: limita qué scripts/recursos puede cargar el navegador
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",   // previene clickjacking (no se puede iframear la app)
        "form-action 'self'",        // formularios solo pueden enviar al propio dominio
        "base-uri 'self'"            // previene inyección de <base> malicioso
    ].join('; ');

    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');       // previene MIME-sniffing
    res.setHeader('X-Frame-Options', 'DENY');                  // refuerza anti-clickjacking
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

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
