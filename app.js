// ============================================
// IMPORTAR SUPABASE Y VARIABLES GLOBALES
// ============================================
import supabase from './supabaseClient.js';

// Variables globales
let patrocinadores = [];
let contactos_patrocinador = [];
let currentFilter = 'all';
let filteredPatrocinadores = [];
let debounceTimer = null;

// ============================================
// INICIALIZAR LA APLICACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación...');
    await cargarPatrocinadores();
    await cargarContactos();
    await cargarCategorias();
    actualizarEstadisticas();
    renderFilteredPatrocinadores();
});

// ============================================
// CARGAR PATROCINADORES DESDE LA BD
// ============================================
async function cargarPatrocinadores() {
    try {
        const { data, error } = await supabase
            .from('patrocinadores_2025')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        patrocinadores = data || [];
        filteredPatrocinadores = [...patrocinadores];
        console.log('Patrocinadores cargados:', patrocinadores.length);
    } catch (error) {
        console.error('Error cargando patrocinadores:', error);
        mostrarToast('Error al cargar patrocinadores', 'error');
    }
}

// ============================================
// CARGAR CONTACTOS DESDE LA BD
// ============================================
async function cargarContactos() {
    try {
        const { data, error } = await supabase
            .from('contactos_patrocinador')
            .select('*')
            .order('patrocinador_id', { ascending: true });

        if (error) throw error;

        contactos_patrocinador = data || [];
        console.log('Contactos cargados:', contactos_patrocinador.length);

        // 🔥 SOLUCIÓN CLAVE
        renderFilteredPatrocinadores();

    } catch (error) {
        console.error('Error cargando contactos_patrocinador:', error);
    }
}
// ============================================
// CARGAR CATEGORÍAS DINÁMICAS DESDE LA BD
// ============================================
async function cargarCategorias() {
    try {
        // Obtener categorías únicas de la base de datos
        const { data, error } = await supabase
            .from('patrocinadores_2025')
            .select('categoria');

        if (error) throw error;

        // Extraer categorías únicas y filtrar nulos
        const categoriasUnicas = [...new Set(data.map(p => p.categoria))]
            .filter(cat => cat !== null && cat !== '')
            .sort();

        // Generar botones dinámicamente
        const filterButtons = document.getElementById('filterButtons');
        
        // Calcular total de PATROCINADORES para el botón "Todos"
        const totalPatrocinadores = patrocinadores.length;
        
        // Botón "Todos" (siempre primero) con contador de PATROCINADORES
        filterButtons.innerHTML = `
            <button class="filter-btn active" data-category="all" onclick="filtrarCategoria(event)">
                Todos
                <span class="category-contact-count" style="background: #2563eb; color: white; border-radius: 50%; padding: 2px 8px; font-size: 0.75rem; margin-left: 8px; font-weight: 600;">${totalPatrocinadores}</span>
            </button>
        `;

        // Botones por cada categoría
        categoriasUnicas.forEach(categoria => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = categoria;
            btn.setAttribute('data-category', categoria);
            btn.onclick = (e) => filtrarCategoria(e);
            filterButtons.appendChild(btn);
        });

        // NUEVO: Cargar opciones del select dinámicamente
        cargarOpcionesCategoria(categoriasUnicas);

        console.log('Categorías cargadas:', categoriasUnicas);
    } catch (error) {
        console.error('Error cargando categorías:', error);
        // Si falla, mostrar al menos el botón "Todos"
        const totalPatrocinadores = patrocinadores.length;
        document.getElementById('filterButtons').innerHTML = `
            <button class="filter-btn active" data-category="all" onclick="filtrarCategoria(event)">
                Todos
                <span class="category-contact-count" style="background: #2563eb; color: white; border-radius: 50%; padding: 2px 8px; font-size: 0.75rem; margin-left: 8px; font-weight: 600;">${totalPatrocinadores}</span>
            </button>
        `;
    }
}

// ============================================
// CARGAR OPCIONES DE CATEGORÍA EN EL SELECT
// ============================================
function cargarOpcionesCategoria(categorias) {
    const selectCategoria = document.getElementById('categoria');
    if (!selectCategoria) return;

    // Mantener la opción por defecto
    const defaultOption = selectCategoria.querySelector('option[value=""]');
    selectCategoria.innerHTML = '';
    
    if (defaultOption) {
        selectCategoria.appendChild(defaultOption);
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Seleccionar categoría';
        selectCategoria.appendChild(option);
    }

    // Agregar opciones de categorías existentes
    categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectCategoria.appendChild(option);
    });

    // Agregar opción para nueva categoría
    const optionNueva = document.createElement('option');
    optionNueva.value = '__nueva__';
    optionNueva.textContent = '➕ Crear nueva categoría';
    selectCategoria.appendChild(optionNueva);
}

// ============================================
// BÚSQUEDA Y FILTROS
// ============================================
function filtrarCategoria(event) {
    const button = event.currentTarget || event.target;
    const categoria = button.getAttribute('data-category') || 'all';
    
    currentFilter = categoria;
    
    // Filtrar los patrocinadores
    if (currentFilter !== 'all') {
        filteredPatrocinadores = patrocinadores.filter(p => p.categoria === currentFilter);
    } else {
        filteredPatrocinadores = [...patrocinadores];
    }
    
    // Actualizar la clase active de los botones
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Aplicar búsqueda si hay texto
    const searchTerm = document.getElementById('searchInput').value;
    if (searchTerm && searchTerm.trim()) {
        aplicarFiltroYBusqueda();
    } else {
        renderFilteredPatrocinadores();
    }
}

function aplicarFiltroYBusqueda() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Aplicar filtro de categoría
    if (currentFilter !== 'all') {
        filteredPatrocinadores = patrocinadores.filter(p => p.categoria === currentFilter);
    } else {
        filteredPatrocinadores = [...patrocinadores];
    }
    
    // Aplicar búsqueda por texto
    if (searchTerm) {
        filteredPatrocinadores = filteredPatrocinadores.filter(p => 
            p.patrocinador.toLowerCase().includes(searchTerm) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm)) ||
            contactos_patrocinador.some(c => 
                c.patrocinador_id === p.id && (
                    (c.nombre && c.nombre.toLowerCase().includes(searchTerm)) ||
                    (c.email && c.email.toLowerCase().includes(searchTerm)) ||
                    (c.telefono && c.telefono.toString().toLowerCase().includes(searchTerm))
                )
            )
        );
    }
    
    renderFilteredPatrocinadores();
}

function renderFilteredPatrocinadores() {
    const tabla = document.getElementById("patrocinadoresBody");
    
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
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Pre-calcular contactos_patrocinador
    const contactosCount = {};
    const contactosByPatrocinador = {};
    
    contactos_patrocinador.forEach(c => {
        const patId = c.patrocinador_id;
        contactosCount[patId] = (contactosCount[patId] || 0) + 1;
        
        if (!contactosByPatrocinador[patId]) {
            contactosByPatrocinador[patId] = [];
        }
        contactosByPatrocinador[patId].push(c);
    });
    
    // Pre-calcular contactos_patrocinador que coinciden con la búsqueda
    const matchingContactsByPatrocinador = {};
    if (searchTerm) {
        Object.keys(contactosByPatrocinador).forEach(patId => {
            const matchedContact = contactosByPatrocinador[patId].find(c => 
                (c.nombre && c.nombre.toLowerCase().includes(searchTerm)) ||
                (c.email && c.email.toLowerCase().includes(searchTerm)) ||
                (c.telefono && c.telefono.toString().toLowerCase().includes(searchTerm))
            );
            if (matchedContact) {
                matchingContactsByPatrocinador[patId] = matchedContact;
            }
        });
    }
    
    const rows = filteredPatrocinadores.map(p => {
        const count = contactosCount[p.id] || 0;
        
        let foundByContact = false;
        let matchingContact = '';
        
        if (searchTerm && matchingContactsByPatrocinador[p.id]) {
            const matchesPatrocinador = 
                p.patrocinador.toLowerCase().includes(searchTerm) ||
                (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm));
            
            if (!matchesPatrocinador) {
                foundByContact = true;
                const mc = matchingContactsByPatrocinador[p.id];
                matchingContact = mc.nombre || mc.email || mc.telefono;
            }
        }
        
        const categoriaClass = (p.categoria || '')
            .toLowerCase()
            .replace(/\./g, '')
            .replace(/\s+/g, '-');
        
        const contactIndicator = foundByContact ? 
            `<br><small style="color: #2563eb; font-weight: 500;">📞 Encontrado por contacto: ${escapeHtml(matchingContact)}</small>` : '';
        
        return `
            <tr>
                <td>${p.id}</td>
                <td><strong>${p.patrocinador}</strong>${contactIndicator}</td>
                <td><span class="badge badge-${categoriaClass}">${p.categoria || '-'}</span></td>
                <td>${formatCurrency(p.monto_transferencia)}</td>
                <td>${formatCurrency(p.nota_credito)}</td>
                <td>${formatCurrency(p.monto_especie)}</td>
                <td><strong>${formatCurrency(p.monto_pagado_total)}</strong></td>
                <td class="${p.falta_transferir > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(p.falta_transferir)}</td>
                <td>${p.descripcion ? p.descripcion.substring(0, 50) + '...' : '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-contactos_patrocinador" onclick="abrirContactosModal(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Ver contactos_patrocinador">
                            📞 <span class="badge-count">${count}</span>
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
    
    tabla.innerHTML = rows.join('');
}

function buscarPatrocinadoresDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (currentFilter !== 'all') {
            aplicarFiltroYBusqueda();
        } else {
            buscarPatrocinadores();
        }
    }, 300);
}

function buscarPatrocinadores() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Aplicar filtro de categoría si está activo
    if (currentFilter !== 'all') {
        filteredPatrocinadores = patrocinadores.filter(p => p.categoria === currentFilter);
    } else {
        filteredPatrocinadores = [...patrocinadores];
    }
    
    // Aplicar búsqueda por texto
    if (searchTerm) {
        filteredPatrocinadores = filteredPatrocinadores.filter(p => 
            p.patrocinador.toLowerCase().includes(searchTerm) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm)) ||
            contactos_patrocinador.some(c => 
                c.patrocinador_id === p.id && (
                    (c.nombre && c.nombre.toLowerCase().includes(searchTerm)) ||
                    (c.email && c.email.toLowerCase().includes(searchTerm)) ||
                    (c.telefono && c.telefono.toString().toLowerCase().includes(searchTerm))
                )
            )
        );
    }
    
    renderFilteredPatrocinadores();
}

// ============================================
// CRUD: PATROCINADORES
// ============================================
function abrirModalPatrocinador() {
    document.getElementById('patrocinadorId').value = '';
    document.getElementById('formPatrocinador').reset();
    document.getElementById('modalPatrocinadorTitle').textContent = 'Nuevo Patrocinador';
    document.getElementById('nuevaCategoriaGroup').style.display = 'none';
    document.getElementById('modalPatrocinador').style.display = 'flex';
}

function cerrarModalPatrocinador() {
    document.getElementById('modalPatrocinador').style.display = 'none';
}

function manejarCambioCategoria() {
    const selectCategoria = document.getElementById('categoria');
    const nuevaCategoriaGroup = document.getElementById('nuevaCategoriaGroup');
    
    if (selectCategoria.value === '__nueva__') {
        nuevaCategoriaGroup.style.display = 'block';
    } else {
        nuevaCategoriaGroup.style.display = 'none';
    }
}

async function guardarPatrocinador(event) {
    event.preventDefault();

    const id = document.getElementById('patrocinadorId').value;
    const patrocinador = document.getElementById('patrocinador').value;
    const categoria = document.getElementById('categoria').value === '__nueva__' 
        ? document.getElementById('nuevaCategoria').value 
        : document.getElementById('categoria').value;
    const montoTransferencia = parseFloat(document.getElementById('montoTransferencia').value) || 0;
    const notaCredito = parseFloat(document.getElementById('notaCredito').value) || 0;
    const montoEspecie = parseFloat(document.getElementById('montoEspecie').value) || 0;
    const montoPagadoTotal = parseFloat(document.getElementById('montoPagadoTotal').value) || 0;
    const faltaTransferir = parseFloat(document.getElementById('faltaTransferir').value) || 0;
    const descripcion = document.getElementById('descripcion').value;

    if (!patrocinador.trim()) {
        mostrarToast('El nombre del patrocinador es requerido', 'error');
        return;
    }

    if (!categoria || categoria === '__nueva__') {
        mostrarToast('Selecciona o crea una categoría', 'error');
        return;
    }

    try {
        const datos = {
            patrocinador,
            categoria,
            monto_transferencia: montoTransferencia,
            nota_credito: notaCredito,
            monto_especie: montoEspecie,
            monto_pagado_total: montoPagadoTotal,
            falta_transferir: faltaTransferir,
            descripcion
        };

        if (id) {
            // Actualizar
            const { error } = await supabase
                .from('patrocinadores_2025')
                .update(datos)
                .eq('id', id);

            if (error) throw error;
            mostrarToast('Patrocinador actualizado correctamente', 'success');
        } else {
            // Crear
            const { error } = await supabase
                .from('patrocinadores_2025')
                .insert([datos]);

            if (error) throw error;
            mostrarToast('Patrocinador creado correctamente', 'success');
        }

        cerrarModalPatrocinador();
        await cargarPatrocinadores();
        await cargarCategorias();
        actualizarEstadisticas();
        renderFilteredPatrocinadores();
    } catch (error) {
        console.error('Error guardando patrocinador:', error);
        mostrarToast('Error al guardar patrocinador', 'error');
    }
}

async function editarPatrocinador(id) {
    const patrocinador = patrocinadores.find(p => p.id === id);
    if (!patrocinador) return;

    document.getElementById('patrocinadorId').value = patrocinador.id;
    document.getElementById('patrocinador').value = patrocinador.patrocinador;
    document.getElementById('categoria').value = patrocinador.categoria;
    document.getElementById('montoTransferencia').value = patrocinador.monto_transferencia || 0;
    document.getElementById('notaCredito').value = patrocinador.nota_credito || 0;
    document.getElementById('montoEspecie').value = patrocinador.monto_especie || 0;
    document.getElementById('montoPagadoTotal').value = patrocinador.monto_pagado_total || 0;
    document.getElementById('faltaTransferir').value = patrocinador.falta_transferir || 0;
    document.getElementById('descripcion').value = patrocinador.descripcion || '';
    document.getElementById('nuevaCategoriaGroup').style.display = 'none';

    document.getElementById('modalPatrocinadorTitle').textContent = 'Editar Patrocinador';
    document.getElementById('modalPatrocinador').style.display = 'flex';
}

async function eliminarPatrocinador(id, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar a "${nombre}"?`)) return;

    try {
        // Primero eliminar contactos_patrocinador asociados
        await supabase
            .from('contactos_patrocinador')
            .delete()
            .eq('patrocinador_id', id);

        // Luego eliminar patrocinador
        const { error } = await supabase
            .from('patrocinadores_2025')
            .delete()
            .eq('id', id);

        if (error) throw error;
        mostrarToast('Patrocinador eliminado correctamente', 'success');
        await cargarPatrocinadores();
        await cargarContactos();
        await cargarCategorias();
        actualizarEstadisticas();
        renderFilteredPatrocinadores();
    } catch (error) {
        console.error('Error eliminando patrocinador:', error);
        mostrarToast('Error al eliminar patrocinador', 'error');
    }
}

// ============================================
// CRUD: CONTACTOS
// ============================================
async function abrirContactosModal(patrocinadorId, patrocinadorNombre) {
    document.getElementById('contactoPatrocinadorId').value = patrocinadorId;
    document.getElementById('modalContactosTitle').textContent = `Contactos - ${patrocinadorNombre}`;
    document.getElementById('formContacto').reset();
    document.getElementById('contactoId').value = '';
    document.getElementById('btnGuardarContacto').textContent = '➕ Agregar Contacto';

    await cargarContactosPatrocinador(patrocinadorId);
    document.getElementById('modalContactos').style.display = 'flex';
}

function cerrarContactosModal() {
    document.getElementById('modalContactos').style.display = 'none';
}

async function cargarContactosPatrocinador(patrocinadorId) {
    const listaContactos = document.getElementById('listaContactos');
    const contactosPatrocinador = contactos_patrocinador.filter(c => c.patrocinador_id === patrocinadorId);

    if (contactosPatrocinador.length === 0) {
        listaContactos.innerHTML = '<p style="color: #999; text-align: center;">No hay contactos_patrocinador registrados</p>';
        return;
    }

    listaContactos.innerHTML = contactosPatrocinador.map(c => `
        <div class="contacto-card">
            <div class="contacto-info">
                <strong>${c.nombre}</strong>
                ${c.email ? `<br>📧 ${c.email}` : ''}
                ${c.telefono ? `<br>📱 ${c.telefono}` : ''}
            </div>
            <div class="contacto-actions">
                <button class="btn-action btn-edit" onclick="editarContacto(${c.id})" title="Editar">✏️</button>
                <button class="btn-action btn-delete" onclick="eliminarContacto(${c.id})" title="Eliminar">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function guardarContacto(event) {
    event.preventDefault();

    const contactoId = document.getElementById('contactoId').value;
    const patrocinadorId = parseInt(document.getElementById('contactoPatrocinadorId').value);
    const nombre = document.getElementById('contactoNombre').value;
    const email = document.getElementById('contactoEmail').value;
    const telefono = document.getElementById('contactoTelefono').value;

    try {
        const datos = {
            patrocinador_id: patrocinadorId,
            nombre,
            email: email || null,
            telefono: telefono || null
        };

        if (contactoId) {
            // ✏️ EDITAR (UPDATE)
            const { error } = await supabase
                .from('contactos_patrocinador')
                .update(datos)
                .eq('id', contactoId);

            if (error) throw error;

        } else {
            // ➕ NUEVO (INSERT)
            const { error } = await supabase
                .from('contactos_patrocinador')
                .insert([datos]);

            if (error) throw error;
        }

        // 🔄 Recargar datos
        await cargarContactos();
        await cargarContactosPatrocinador(patrocinadorId);
        renderFilteredPatrocinadores();

        // 🧼 Limpiar formulario
        document.getElementById('formContacto').reset();
        document.getElementById('contactoId').value = '';
        document.getElementById('btnGuardarContacto').textContent = '➕ Agregar Contacto';
    } catch (error) {
        console.error('Error guardando contacto:', error);
    }
}

async function editarContacto(contactoId) {
    const contacto = contactos_patrocinador.find(c => c.id === contactoId);
    if (!contacto) return;

    document.getElementById('contactoId').value = contacto.id;
    document.getElementById('contactoNombre').value = contacto.nombre;
    document.getElementById('contactoEmail').value = contacto.email || '';
    document.getElementById('contactoTelefono').value = contacto.telefono || '';

    //boton actualizar
    document.getElementById('btnGuardarContacto').textContent = 'Actualizar Contacto';
    
    // Scroll al formulario
    document.querySelector('.contacto-form-section').scrollIntoView({ behavior: 'smooth' });
    
}

async function eliminarContacto(contactoId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este contacto?')) return;

    try {
        const { error } = await supabase
            .from('contactos_patrocinador')
            .delete()
            .eq('id', contactoId);

        if (error) throw error;
        mostrarToast('Contacto eliminado correctamente', 'success');
        
        const patrocinadorId = document.getElementById('contactoPatrocinadorId').value;
        await cargarContactos();
        await cargarContactosPatrocinador(parseInt(patrocinadorId));
        actualizarEstadisticas();
        renderFilteredPatrocinadores();
    } catch (error) {
        console.error('Error eliminando contacto:', error);
        mostrarToast('Error al eliminar contacto', 'error');
    }
}

// ============================================
// ESTADÍSTICAS
// ============================================
function actualizarEstadisticas() {
    const totalPatrocinadores = patrocinadores.length;
    const totalMonto = patrocinadores.reduce((sum, p) => sum + (p.monto_pagado_total || 0), 0);
    const totalNotaCredito = patrocinadores.reduce((sum, p) => sum + (p.nota_credito || 0), 0);
    const totalEspecie = patrocinadores.reduce((sum, p) => sum + (p.monto_especie || 0), 0);
    const totalFaltaTransferir = patrocinadores.reduce((sum, p) => sum + (p.falta_transferir || 0), 0);
    const totalContactos = contactos_patrocinador.length;

    document.getElementById('totalPatrocinadores').textContent = totalPatrocinadores;
    document.getElementById('totalMonto').textContent = formatCurrency(totalMonto);
    document.getElementById('totalNotaCredito').textContent = formatCurrency(totalNotaCredito);
    document.getElementById('totalEspecie').textContent = formatCurrency(totalEspecie);
    document.getElementById('totalFaltaTransferir').textContent = formatCurrency(totalFaltaTransferir);
    document.getElementById('totalContactos').textContent = totalContactos;
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(value || 0);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast toast-${tipo} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
// Hacer funciones globales para HTML
window.abrirModalPatrocinador = abrirModalPatrocinador;
window.cerrarModalPatrocinador = cerrarModalPatrocinador;
window.guardarPatrocinador = guardarPatrocinador;
window.manejarCambioCategoria = manejarCambioCategoria;
window.editarPatrocinador = editarPatrocinador;
window.eliminarPatrocinador = eliminarPatrocinador;

window.abrirContactosModal = abrirContactosModal;
window.cerrarContactosModal = cerrarContactosModal;
window.guardarContacto = guardarContacto;
window.editarContacto = editarContacto;
window.eliminarContacto = eliminarContacto;

window.filtrarCategoria = filtrarCategoria;
window.buscarPatrocinadoresDebounced = buscarPatrocinadoresDebounced;