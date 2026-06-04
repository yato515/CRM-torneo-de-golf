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

    if (!email || !password) {
        mostrarError('Por favor completa todos los campos');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Iniciando sesión...';

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
