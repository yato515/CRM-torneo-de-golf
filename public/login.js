import supabase from './supabaseClient.js';

// Si ya hay sesión activa, redirigir directamente al CRM
const { data: { session } } = await supabase.auth.getSession();
if (session) {
    window.location.href = '/index.html';
}

const form      = document.getElementById('loginForm');
const emailInp  = document.getElementById('email');
const passInp   = document.getElementById('password');
const btn       = document.getElementById('loginBtn');
const errorBox  = document.getElementById('loginError');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const email    = emailInp.value.trim();
    const password = passInp.value;
    const recordar = document.getElementById('remember').checked;

    if (!email || !password) {
        mostrarError('Por favor completa todos los campos');
        return;
    }

    if (password.length < 8) {
        mostrarError('La contraseña debe tener al menos 8 caracteres');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Iniciando sesión...';

    // IMPORTANTE: setear el flag ANTES del login para que Supabase
    // guarde la sesión en el storage correcto
    localStorage.setItem('cf_remember_me', recordar ? '1' : '0');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Login exitoso → al CRM
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Error de login:', error);
        const mensaje = error.message?.includes('Invalid login credentials')
            ? 'Correo o contraseña incorrectos'
            : 'No se pudo iniciar sesión. Inténtalo de nuevo.';
        mostrarError(mensaje);
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
});

function mostrarError(mensaje) {
    errorBox.textContent = mensaje;
    errorBox.style.display = 'block';
}
