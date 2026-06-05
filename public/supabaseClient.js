import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://remcmfnbofyeuowwhqcx.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbWNtZm5ib2Z5ZXVvd3docWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzExNjgsImV4cCI6MjA4OTM0NzE2OH0.Bq9ZUn3tCHms6RHuOg__S0Ys9WFIux1tNEGJ0AnLkdw"

// Storage adaptativo:
// - Si "Recordarme" está marcado → localStorage (sobrevive cierre de navegador)
// - Si NO → sessionStorage (se borra al cerrar la pestaña)
const REMEMBER_FLAG = 'cf_remember_me';

const adaptiveStorage = {
    getItem(key) {
        // Lee de donde haya sesión guardada
        return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    },
    setItem(key, value) {
        const recordar = localStorage.getItem(REMEMBER_FLAG) === '1';
        if (recordar) {
            localStorage.setItem(key, value);
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, value);
            localStorage.removeItem(key);
        }
    },
    removeItem(key) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    }
};

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: adaptiveStorage,
        persistSession: true,
        autoRefreshToken: true,
    }
})

export default supabase