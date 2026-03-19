// ============================================
// CONFIGURACIÓN SUPABASE (Tus credenciales)
// ============================================
const supabaseUrl = "https://remcmfnbofyeuowwhqcx.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbWNtZm5ib2Z5ZXVvd3docWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzExNjgsImV4cCI6MjA4OTM0NzE2OH0.Bq9ZUn3tCHms6RHuOg__S0Ys9WFIux1tNEGJ0AnLkdw"

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

// ============================================
// ESTADO GLOBAL
// ============================================
let patrocinadores = [];
let contactos = [];
let filteredPatrocinadores = [];
let currentFilter = 'all';
let currentPatrocinadorId = null;

// ============================================
// TU FUNCIÓN ORIGINAL: cargarPatrocinadores (MEJORADA)
// ============================================
async function cargarPatrocinadores() {
    try {
        const { data, error } = await supabaseClient
            .from("patrocinadores_2025")
            .select("*")
            .order('patrocinador', { ascending: true});

        if (error) throw error;

        patrocinadores = data || [];
        filteredPatrocinadores = [...patrocinadores];
        
        const tabla = document.getElementById("patrocinadoresBody");
        tabla.innerHTML = "";

        if (data.length === 0) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 2rem; color: #64748b;">
                        No hay patrocinadores registrados. ¡Agrega el primero!
                    </td>
                </tr>
            `;
            updateStats();
            return;
        }

        data.forEach(p => {
            const contactosCount = contactos.filter(c => c.patrocinador_id === p.id).length;
            
            tabla.innerHTML += `
                <tr>
                    <td>${p.id}</td>
                    <td><strong>${p.patrocinador}</strong></td>
                    <td><span class="badge badge-${(p.categoria || '').toLowerCase()}">${p.categoria || '-'}</span></td>
                    <td>${formatCurrency(p.monto_transferencia)}</td>
                    <td>${formatCurrency(p.nota_credito)}</td>
                    <td>${formatCurrency(p.monto_especie)}</td>
                    <td><strong>${formatCurrency(p.monto_pagado_total)}</strong></td>
                    <td class="${p.falta_transferir > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(p.falta_transferir)}</td>
                    <td>${p.descripcion ? p.descripcion.substring(0, 50) + '...' : '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-contactos" onclick="abrirContactosModal(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Ver contactos">
                                📞 <span class="badge-count">${contactosCount}</span>
                            </button>
                            <button class="btn-action btn-edit" onclick="editarPatrocinador(${p.id})" title="Editar">
                                ✏️
                            </button>
                            <button class="btn-action btn-delete" onclick="eliminarPatrocinador(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Eliminar">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        updateStats();
    } catch (error) {
        console.error('Error cargando patrocinadores:', error);
        showToast('Error al cargar patrocinadores', 'error');
    }
}

// ============================================
// TU FUNCIÓN ORIGINAL: cargarContactos (MEJORADA)
// ============================================
async function cargarContactos() {
    try {
        const { data, error } = await supabaseClient
            .from("contactos_patrocinador")
            .select("*")
            .order('nombre', { ascending: true });

        if (error) throw error;

        contactos = data || [];
        
        const tabla = document.getElementById("contactosBody");
        tabla.innerHTML = "";

        if (data.length === 0) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">
                        No hay contactos registrados
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(c => {
            const patrocinador = patrocinadores.find(p => p.id === c.patrocinador_id);
            
            tabla.innerHTML += `
                <tr>
                    <td>${c.id}</td>
                    <td><strong>${patrocinador ? patrocinador.patrocinador : `ID: ${c.patrocinador_id}`}</strong></td>
                    <td>${c.nombre}</td>
                    <td>${c.email || '-'}</td>
                    <td>${c.telefono || '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-edit" onclick="editarContactoTabla(${c.id})" title="Editar">
                                ✏️
                            </button>
                            <button class="btn-action btn-delete" onclick="eliminarContacto(${c.id}, '${escapeHtml(c.nombre)}')" title="Eliminar">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error cargando contactos:', error);
        showToast('Error al cargar contactos', 'error');
    }
}

// ============================================
// NUEVAS FUNCIONES: CRUD PATROCINADORES
// ============================================
function abrirModalPatrocinador(id = null) {
    const modal = document.getElementById('modalPatrocinador');
    const form = document.getElementById('formPatrocinador');
    const title = document.getElementById('modalPatrocinadorTitle');
    
    form.reset();
    
    if (id) {
        const p = patrocinadores.find(pat => pat.id === id);
        if (p) {
            title.textContent = 'Editar Patrocinador';
            document.getElementById('patrocinadorId').value = p.id;
            document.getElementById('patrocinador').value = p.patrocinador || '';
            document.getElementById('categoria').value = p.categoria || '';
            document.getElementById('montoTransferencia').value = p.monto_transferencia || 0;
            document.getElementById('notaCredito').value = p.nota_credito || 0;
            document.getElementById('montoEspecie').value = p.monto_especie || 0;
            document.getElementById('montoPagadoTotal').value = p.monto_pagado_total || 0;
            document.getElementById('faltaTransferir').value = p.falta_transferir || 0;
            document.getElementById('descripcion').value = p.descripcion || '';
        }
    } else {
        title.textContent = 'Nuevo Patrocinador';
        document.getElementById('patrocinadorId').value = '';
    }
    
    modal.style.display = 'flex';
}

function cerrarModalPatrocinador() {
    document.getElementById('modalPatrocinador').style.display = 'none';
}

async function guardarPatrocinador(event) {
    event.preventDefault();
    
    const id = document.getElementById('patrocinadorId').value;
    const data = {
        patrocinador: document.getElementById('patrocinador').value,
        categoria: document.getElementById('categoria').value,
        monto_transferencia: parseFloat(document.getElementById('montoTransferencia').value) || 0,
        nota_credito: parseFloat(document.getElementById('notaCredito').value) || 0,
        monto_especie: parseFloat(document.getElementById('montoEspecie').value) || 0,
        monto_pagado_total: parseFloat(document.getElementById('montoPagadoTotal').value) || 0,
        falta_transferir: parseFloat(document.getElementById('faltaTransferir').value) || 0,
        descripcion: document.getElementById('descripcion').value
    };
    
    try {
        if (id) {
            const { error } = await supabaseClient
                .from('patrocinadores_2025')
                .update(data)
                .eq('id', id);
            
            if (error) throw error;
            showToast('✅ Patrocinador actualizado correctamente', 'success');
        } else {
            const { error } = await supabaseClient
                .from('patrocinadores_2025')
                .insert([data]);
            
            if (error) throw error;
            showToast('✅ Patrocinador creado correctamente', 'success');
        }
        
        cerrarModalPatrocinador();
        await cargarPatrocinadores();
    } catch (error) {
        console.error('Error guardando patrocinador:', error);
        showToast('❌ Error al guardar el patrocinador', 'error');
    }
}

function editarPatrocinador(id) {
    abrirModalPatrocinador(id);
}

async function eliminarPatrocinador(id, nombre) {
    if (!confirm(`¿Eliminar el patrocinador "${nombre}"?\n\nEsto también eliminará todos sus contactos.`)) {
        return;
    }
    
    try {
        const { error: contactosError } = await supabaseClient
            .from('contactos_patrocinador')
            .delete()
            .eq('patrocinador_id', id);
        
        if (contactosError) throw contactosError;
        
        const { error } = await supabaseClient
            .from('patrocinadores_2025')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('✅ Patrocinador eliminado correctamente', 'success');
        await cargarPatrocinadores();
        await cargarContactos();
    } catch (error) {
        console.error('Error eliminando patrocinador:', error);
        showToast('❌ Error al eliminar el patrocinador', 'error');
    }
}

// ============================================
// NUEVAS FUNCIONES: CRUD CONTACTOS
// ============================================
function abrirContactosModal(patrocinadorId, patrocinadorNombre) {
    currentPatrocinadorId = patrocinadorId;
    
    const modal = document.getElementById('modalContactos');
    const title = document.getElementById('modalContactosTitle');
    
    title.textContent = `Contactos - ${patrocinadorNombre}`;
    document.getElementById('contactoPatrocinadorId').value = patrocinadorId;
    document.getElementById('formContacto').reset();
    document.getElementById('contactoId').value = '';
    
    renderContactosModal(patrocinadorId);
    modal.style.display = 'flex';
}

function cerrarContactosModal() {
    document.getElementById('modalContactos').style.display = 'none';
    currentPatrocinadorId = null;
}

function renderContactosModal(patrocinadorId) {
    const lista = document.getElementById('listaContactos');
    const patrocinadorContactos = contactos.filter(c => c.patrocinador_id === patrocinadorId);
    
    if (patrocinadorContactos.length === 0) {
        lista.innerHTML = `
            <div class="empty-contactos">
                <p>📭 No hay contactos registrados</p>
                <p style="font-size: 0.875rem;">Agrega el primer contacto usando el formulario</p>
            </div>
        `;
        return;
    }
    
    lista.innerHTML = patrocinadorContactos.map(c => `
        <div class="contacto-item">
            <div class="contacto-info">
                <h4>${escapeHtml(c.nombre)}</h4>
                <div class="contacto-details">
                    ${c.email ? `<div class="detail">📧 ${escapeHtml(c.email)}</div>` : ''}
                    ${c.telefono ? `<div class="detail">📱 ${escapeHtml(c.telefono)}</div>` : ''}
                </div>
            </div>
            <div class="contacto-actions">
                <button class="btn-action btn-edit" onclick="editarContactoModal(${c.id})">✏️</button>
                <button class="btn-action btn-delete" onclick="eliminarContacto(${c.id}, '${escapeHtml(c.nombre)}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function guardarContacto(event) {
    event.preventDefault();
    
    const id = document.getElementById('contactoId').value;
    const data = {
        patrocinador_id: parseInt(document.getElementById('contactoPatrocinadorId').value),
        nombre: document.getElementById('contactoNombre').value,
        email: document.getElementById('contactoEmail').value || null,
        telefono: document.getElementById('contactoTelefono').value || null
    };
    
    try {
        if (id) {
            const { error } = await supabaseClient
                .from('contactos_patrocinador')
                .update(data)
                .eq('id', id);
            
            if (error) throw error;
            showToast('✅ Contacto actualizado correctamente', 'success');
        } else {
            const { error } = await supabaseClient
                .from('contactos_patrocinador')
                .insert([data]);
            
            if (error) throw error;
            showToast('✅ Contacto agregado correctamente', 'success');
        }
        
        document.getElementById('formContacto').reset();
        document.getElementById('contactoId').value = '';
        
        await cargarContactos();
        await cargarPatrocinadores();
        renderContactosModal(currentPatrocinadorId);
    } catch (error) {
        console.error('Error guardando contacto:', error);
        showToast('❌ Error al guardar el contacto', 'error');
    }
}

function editarContactoModal(id) {
    const contacto = contactos.find(c => c.id === id);
    if (!contacto) return;
    
    document.getElementById('contactoId').value = contacto.id;
    document.getElementById('contactoNombre').value = contacto.nombre || '';
    document.getElementById('contactoEmail').value = contacto.email || '';
    document.getElementById('contactoTelefono').value = contacto.telefono || '';
}

function editarContactoTabla(id) {
    const contacto = contactos.find(c => c.id === id);
    if (!contacto) return;
    
    const patrocinador = patrocinadores.find(p => p.id === contacto.patrocinador_id);
    if (!patrocinador) return;
    
    abrirContactosModal(contacto.patrocinador_id, patrocinador.patrocinador);
    setTimeout(() => editarContactoModal(id), 300);
}

async function eliminarContacto(id, nombre) {
    if (!confirm(`¿Eliminar el contacto "${nombre}"?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('contactos_patrocinador')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('✅ Contacto eliminado correctamente', 'success');
        await cargarContactos();
        await cargarPatrocinadores();
        
        if (currentPatrocinadorId) {
            renderContactosModal(currentPatrocinadorId);
        }
    } catch (error) {
        console.error('Error eliminando contacto:', error);
        showToast('❌ Error al eliminar el contacto', 'error');
    }
}

// ============================================
// BÚSQUEDA Y FILTROS
// ============================================
function buscarPatrocinadores() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredPatrocinadores = patrocinadores.filter(p => {
        const matchesSearch = 
            p.patrocinador.toLowerCase().includes(searchTerm) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm));
        
        const matchesCategory = 
            currentFilter === 'all' || 
            (p.categoria && p.categoria.toLowerCase() === currentFilter.toLowerCase());
        
        return matchesSearch && matchesCategory;
    });
    
    renderBusqueda();
}

function filtrarCategoria(categoria) {
    currentFilter = categoria;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    buscarPatrocinadores();
}

function renderBusqueda() {
    const tabla = document.getElementById("patrocinadoresBody");
    tabla.innerHTML = "";
    
    if (filteredPatrocinadores.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 2rem; color: #64748b;">
                    No se encontraron resultados
                </td>
            </tr>
        `;
        return;
    }
    
    filteredPatrocinadores.forEach(p => {
        const contactosCount = contactos.filter(c => c.patrocinador_id === p.id).length;
        
        tabla.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td><strong>${p.patrocinador}</strong></td>
                <td><span class="badge badge-${(p.categoria || '').toLowerCase()}">${p.categoria || '-'}</span></td>
                <td>${formatCurrency(p.monto_transferencia)}</td>
                <td>${formatCurrency(p.nota_credito)}</td>
                <td>${formatCurrency(p.monto_especie)}</td>
                <td><strong>${formatCurrency(p.monto_pagado_total)}</strong></td>
                <td class="${p.falta_transferir > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(p.falta_transferir)}</td>
                <td>${p.descripcion ? p.descripcion.substring(0, 50) + '...' : '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-contactos" onclick="abrirContactosModal(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Ver contactos">
                            📞 <span class="badge-count">${contactosCount}</span>
                        </button>
                        <button class="btn-action btn-edit" onclick="editarPatrocinador(${p.id})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-action btn-delete" onclick="eliminarPatrocinador(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Eliminar">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// ============================================
// ESTADÍSTICAS
// ============================================
function updateStats() {
    document.getElementById('totalPatrocinadores').textContent = patrocinadores.length;
    
    const totalMonto = patrocinadores.reduce((sum, p) => sum + (parseFloat(p.monto_pagado_total) || 0), 0);
    document.getElementById('totalMonto').textContent = formatCurrency(totalMonto);
    
    document.getElementById('totalContactos').textContent = contactos.length;
}

// ============================================
// UTILIDADES
// ============================================
function formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================
// CERRAR MODALES AL HACER CLICK FUERA
// ============================================
window.onclick = function(event) {
    const modalPatrocinador = document.getElementById('modalPatrocinador');
    const modalContactos = document.getElementById('modalContactos');
    
    if (event.target === modalPatrocinador) {
        cerrarModalPatrocinador();
    }
    if (event.target === modalContactos) {
        cerrarContactosModal();
    }
}

// ============================================
// INICIALIZACIÓN (TUS FUNCIONES ORIGINALES)
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarPatrocinadores();
    await cargarContactos();
});