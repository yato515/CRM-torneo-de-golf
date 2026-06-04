// ============================================
// IMPORTAR SUPABASE Y VARIABLES GLOBALES
// ============================================
import supabase from './supabaseClient.js';

// ============================================
// VERIFICAR SESIÓN — si no hay, redirigir al login
// ============================================
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
    window.location.href = '/login.html';
    throw new Error('No autenticado');
}

// Escuchar cambios de sesión (ej: logout en otra pestaña)
supabase.auth.onAuthStateChange((event, sess) => {
    if (event === 'SIGNED_OUT' || !sess) {
        window.location.href = '/login.html';
    }
});

async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
}
window.cerrarSesion = cerrarSesion;

// Exportar Excel pasando el token de la sesión
async function exportarExcel() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) return alert('Sesión expirada, vuelve a iniciar sesión');
    window.location.href = `/api/exportar/patrocinadores?token=${encodeURIComponent(s.access_token)}`;
}
window.exportarExcel = exportarExcel;

let patrocinadores = [];
let contactos_patrocinador = [];
let categorias = [];
let finanzas = [];
let currentFilter = 'all'; // 'all' o categoria.id (número)
let filteredPatrocinadores = [];
let debounceTimer = null;
let sortColumn = null;     // columna activa de ordenamiento
let sortDirection = 'asc'; // 'asc' o 'desc'

// ============================================
// INICIALIZAR LA APLICACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar datos en paralelo (4 fetches simultáneos en vez de uno tras otro)
    await Promise.all([
        cargarPatrocinadores(),
        cargarCategorias(),
        cargarContactos(),
        cargarFinanzas(),
    ]);

    // Render final único después de tener toda la data
    renderBotonesCategorias();
    actualizarEstadisticas();
    renderFilteredPatrocinadores();

    // Aplicar formateo de moneda a los campos del modal
    const camposMoneda = [
        'montoTransferencia',
        'notaCredito',
        'montoEspecie',
        'montoPagadoTotal',
        'faltaTransferir'
    ];

    camposMoneda.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        // Formato mientras escribe
        input.addEventListener('input', () => formatearInputMoneda(input));

        // Al salir del campo: formato completo con 2 decimales
        input.addEventListener('blur', () => {
            const num = parsearMoneda(input.value);
            input.value = num === 0 ? '' : formatearMonedaCompleta(num);
        });

        // Al entrar al campo: mostrar solo el número para facilitar edición
        input.addEventListener('focus', () => {
            const num = parsearMoneda(input.value);
            input.value = num === 0 ? '' : num.toString();
        });
    });
});

// ============================================
// CARGAR CATEGORÍAS DESDE LA TABLA categorias
// ============================================
async function cargarCategorias() {
    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        categorias = data || [];
        cargarOpcionesCategoria();
        // renderBotonesCategorias() lo llama quien necesite refrescar contadores

        console.log('Categorías cargadas:', categorias.length);
    } catch (error) {
        console.error('Error cargando categorías:', error);
        mostrarToast('Error al cargar categorías', 'error');
    }
}

function cargarOpcionesCategoria() {
    const select = document.getElementById('categoria');
    if (!select) return;

    select.innerHTML = `<option value="">Seleccionar categoría</option>`;

    categorias.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;          // FK numérico
        option.textContent = c.nombre;
        select.appendChild(option);
    });
}

function renderBotonesCategorias() {
    const container = document.getElementById('filterButtons');

    // total general
    const total = patrocinadores.length;

    container.innerHTML = `
        <button class="filter-btn active" onclick="filtrarCategoria('all')">
            Todos <span class="badge-count">${total}</span>
        </button>
    `;

    categorias.forEach(c => {
        // contar patrocinadores por categoria
        const count = patrocinadores.filter(p => p.categoria_id === c.id).length;

        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.innerHTML = `
            ${c.nombre}
            <span class="badge-count">${count}</span>
        `;
        btn.onclick = () => filtrarCategoria(c.id);

        container.appendChild(btn);
    });
}
// ============================================
// CARGAR PATROCINADORES CON JOIN A categorias
// ============================================
async function cargarPatrocinadores() {
    try {
        const { data, error } = await supabase
            .from('patrocinadores_2025')
            .select(`
                *,
                categorias ( id, nombre )
            `)
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
// CARGAR CONTACTOS
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
    } catch (error) {
        console.error('Error cargando contactos:', error);
    }
}

// ============================================
// BÚSQUEDA Y FILTROS
// ============================================
function filtrarCategoria(categoriaId) {
    currentFilter = categoriaId;

    if (categoriaId === 'all') {
        filteredPatrocinadores = [...patrocinadores];
    } else {
        filteredPatrocinadores = patrocinadores.filter(p => 
            Number(p.categoria_id) === Number(categoriaId)
        );
    }

    // actualizar botones activos (visual)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // marcar el activo
    const botones = document.querySelectorAll('.filter-btn');
    botones.forEach(btn => {
        if (
            (categoriaId === 'all' && btn.textContent.includes('Todos')) ||
            btn.onclick?.toString().includes(categoriaId)
        ) {
            btn.classList.add('active');
        }
    });

    renderFilteredPatrocinadores();
}

function aplicarFiltroYBusqueda() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    if (currentFilter !== 'all') {
        filteredPatrocinadores = patrocinadores.filter(p => p.categoria_id === currentFilter);
    } else {
        filteredPatrocinadores = [...patrocinadores];
    }

    if (searchTerm) {
        filteredPatrocinadores = filteredPatrocinadores.filter(p =>
            p.patrocinador.toLowerCase().includes(searchTerm) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm)) ||
            (p.categorias?.nombre && p.categorias.nombre.toLowerCase().includes(searchTerm)) ||
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
// ORDENAMIENTO DE TABLA
// ============================================
function ordenarPor(columna) {
    // Ciclo: ninguno → asc → desc → ninguno (resetear)
    if (sortColumn === columna) {
        if (sortDirection === 'asc') {
            sortDirection = 'desc';
        } else {
            // Tercer click: quitar ordenamiento
            sortColumn = null;
            sortDirection = 'asc';
            // Restaurar orden original aplicando filtros vigentes
            aplicarFiltroYBusqueda();
            document.querySelectorAll('th.sortable').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
            });
            return;
        }
    } else {
        sortColumn = columna;
        sortDirection = 'asc';
    }

    filteredPatrocinadores.sort((a, b) => {
        let valA, valB;

        if (columna === 'categoria') {
            valA = (a.categorias?.nombre || '').toLowerCase();
            valB = (b.categorias?.nombre || '').toLowerCase();
        } else if (columna === 'patrocinador') {
            valA = (a.patrocinador || '').toLowerCase();
            valB = (b.patrocinador || '').toLowerCase();
        } else {
            // Numérico (id, montos)
            valA = a[columna] || 0;
            valB = b[columna] || 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Actualizar indicadores visuales en los th
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    const thActivo = document.querySelector(`th.sortable[onclick="ordenarPor('${columna}')"]`);
    if (thActivo) {
        thActivo.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    renderFilteredPatrocinadores();
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

    filteredPatrocinadores = currentFilter !== 'all'
        ? patrocinadores.filter(p => p.categoria_id === currentFilter)
        : [...patrocinadores];

    if (searchTerm) {
        filteredPatrocinadores = filteredPatrocinadores.filter(p =>
            p.patrocinador.toLowerCase().includes(searchTerm) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm)) ||
            (p.categorias?.nombre && p.categorias.nombre.toLowerCase().includes(searchTerm)) ||
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
// RENDER DE LA TABLA
// ============================================
function renderFilteredPatrocinadores() {
    const tabla = document.getElementById('patrocinadoresBody');

    if (filteredPatrocinadores.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:2rem;color:#64748b;">
                    No se encontraron resultados
                </td>
            </tr>`;
        return;
    }

    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    const contactosCount = {};
    const contactosByPatrocinador = {};
    contactos_patrocinador.forEach(c => {
        const pid = c.patrocinador_id;
        contactosCount[pid] = (contactosCount[pid] || 0) + 1;
        if (!contactosByPatrocinador[pid]) contactosByPatrocinador[pid] = [];
        contactosByPatrocinador[pid].push(c);
    });

    const matchingContactsByPatrocinador = {};
    if (searchTerm) {
        Object.keys(contactosByPatrocinador).forEach(patId => {
            const match = contactosByPatrocinador[patId].find(c =>
                (c.nombre && c.nombre.toLowerCase().includes(searchTerm)) ||
                (c.email && c.email.toLowerCase().includes(searchTerm)) ||
                (c.telefono && c.telefono.toString().toLowerCase().includes(searchTerm))
            );
            if (match) matchingContactsByPatrocinador[patId] = match;
        });
    }

    const rows = filteredPatrocinadores.map(p => {
        const count = contactosCount[p.id] || 0;
        const nombreCategoria = p.categorias?.nombre || '-';

        // Clase CSS del badge basada en el nombre de la categoría
        const categoriaClass = nombreCategoria
            .toLowerCase()
            .replace(/\./g, '')
            .replace(/\s+/g, '-');

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

        const contactIndicator = foundByContact
            ? `<br><small style="color:#2563eb;font-weight:500;">📞 Encontrado por contacto: ${escapeHtml(matchingContact)}</small>`
            : '';

        const especieMonto = p.monto_especie || 0;
        const celdaEspecie = p.descripcion_especie
            ? `<span
                    class="celda-clicable"
                    title="Ver descripción de especie"
                    onclick="abrirModalEspecie('${escapeHtml(p.descripcion_especie).replace(/'/g, '&#39;')}', '${escapeHtml(p.patrocinador)}')"
               >${especieMonto > 0 ? formatCurrency(especieMonto) : '<span class="monto-cero">—</span>'} 📦</span>`
            : formatCurrencyMuted(especieMonto);

        const faltaTransferir = p.falta_transferir || 0;
        const celdaFalta = faltaTransferir > 0
            ? `<span class="estatus-pendiente">${formatCurrency(faltaTransferir)}</span>`
            : `<span class="estatus-corriente" title="Al corriente">✅ Al corriente</span>`;

        const celdaDescripcion = p.descripcion
            ? `<button
                    class="btn-descripcion"
                    title="Ver descripción completa"
                    onclick="abrirModalEspecie('${escapeHtml(p.descripcion).replace(/'/g, '&#39;')}', '${escapeHtml(p.patrocinador)} — Descripción')"
               >📝 Ver</button>`
            : `<span class="monto-cero">—</span>`;

        return `
            <tr>
                <td class="col-id">${p.id}</td>
                <td><strong class="nombre-patrocinador">${escapeHtml(p.patrocinador)}</strong>${contactIndicator}</td>
                <td><span class="badge badge-${categoriaClass}">${escapeHtml(nombreCategoria)}</span></td>
                <td>${formatCurrencyMuted(p.monto_transferencia)}</td>
                <td>${formatCurrencyMuted(p.nota_credito)}</td>
                <td>${celdaEspecie}</td>
                <td><strong class="monto-total">${formatCurrencyMuted(p.monto_pagado_total)}</strong></td>
                <td>${celdaFalta}</td>
                <td>${celdaDescripcion}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-contactos_patrocinador" onclick="abrirContactosModal(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Ver contactos">
                            📞 <span class="badge-count">${count}</span>
                        </button>
                        <button class="btn-action btn-edit" onclick="editarPatrocinador(${p.id})" title="Editar">✏️</button>
                        <button class="btn-action btn-delete" onclick="eliminarPatrocinador(${p.id}, '${escapeHtml(p.patrocinador)}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>`;
    });

    tabla.innerHTML = rows.join('');
}

// ============================================
// CRUD: PATROCINADORES
// ============================================
function abrirModalPatrocinador() {
    document.getElementById('patrocinadorId').value = '';
    document.getElementById('formPatrocinador').reset();
    document.getElementById('modalPatrocinadorTitle').textContent = 'Nuevo Patrocinador';
    // Resetear toggle descripción especie
    document.getElementById('toggleEspecie').checked = false;
    document.getElementById('descripcionEspecieWrapper').style.display = 'none';
    document.getElementById('descripcionEspecie').value = '';
    // ✅ Resetear toggle copiar especie
    document.getElementById('toggleCopiarEspecie').checked = false;
    toggleCopiarMontoEspecie();
    document.getElementById('modalPatrocinador').style.display = 'flex';
}

function cerrarModalPatrocinador() {
    document.getElementById('modalPatrocinador').style.display = 'none';
}

async function guardarPatrocinador(event) {
    event.preventDefault();

    const id = document.getElementById('patrocinadorId').value;
    const patrocinador = document.getElementById('patrocinador').value.trim();
    const categoriaId = parseInt(document.getElementById('categoria').value);

    if (!patrocinador) {
        mostrarToast('El nombre del patrocinador es requerido', 'error');
        return;
    }

    if (isNaN(categoriaId)) { // 🔥 cambio aquí
        mostrarToast('Selecciona una categoría', 'error');
        return;
    }

    const datos = {
        patrocinador,
        categoria_id: Number(categoriaId), // 🔥 más robusto
        monto_transferencia: parsearMoneda(document.getElementById('montoTransferencia').value),
        nota_credito:        parsearMoneda(document.getElementById('notaCredito').value),
        monto_especie:       parsearMoneda(document.getElementById('montoEspecie').value),
        monto_pagado_total:  parsearMoneda(document.getElementById('montoPagadoTotal').value),
        falta_transferir:    parsearMoneda(document.getElementById('faltaTransferir').value),
        descripcion:         document.getElementById('descripcion').value || null,
        descripcion_especie: document.getElementById('toggleEspecie').checked
            ? document.getElementById('descripcionEspecie').value || null
            : null,
    };

    try {
        if (id) {
            const { error } = await supabase
                .from('patrocinadores_2025')
                .update(datos)
                .eq('id', id);
            if (error) throw error;
            mostrarToast('Patrocinador actualizado correctamente', 'success');
        } else {
            const { error } = await supabase
                .from('patrocinadores_2025')
                .insert([datos]);
            if (error) throw error;
            mostrarToast('Patrocinador creado correctamente', 'success');
        }

        cerrarModalPatrocinador();

        await cargarPatrocinadores();
        renderBotonesCategorias(); // recalcula contadores sin tocar la DB
        actualizarEstadisticas();
        renderFilteredPatrocinadores();

    } catch (error) {
        console.error('Error guardando patrocinador:', error);
        mostrarToast('Error al guardar patrocinador', 'error');
    }
}

async function editarPatrocinador(id) {
    const p = patrocinadores.find(p => p.id === id);
    if (!p) return;

    document.getElementById('patrocinadorId').value = p.id;
    document.getElementById('patrocinador').value = p.patrocinador;
    document.getElementById('categoria').value = p.categoria_id;     // ← FK
    document.getElementById('montoTransferencia').value = p.monto_transferencia ? formatearMonedaCompleta(p.monto_transferencia) : '';
    document.getElementById('notaCredito').value        = p.nota_credito        ? formatearMonedaCompleta(p.nota_credito)        : '';
    document.getElementById('montoEspecie').value       = p.monto_especie       ? formatearMonedaCompleta(p.monto_especie)       : '';
    document.getElementById('montoPagadoTotal').value   = p.monto_pagado_total  ? formatearMonedaCompleta(p.monto_pagado_total)  : '';
    document.getElementById('faltaTransferir').value    = p.falta_transferir    ? formatearMonedaCompleta(p.falta_transferir)    : '';
    document.getElementById('descripcion').value = p.descripcion || '';

    // Cargar toggle y descripción de especie
    const tieneDescEspecie = !!p.descripcion_especie;
    document.getElementById('toggleEspecie').checked = tieneDescEspecie;
    document.getElementById('descripcionEspecieWrapper').style.display = tieneDescEspecie ? 'block' : 'none';
    document.getElementById('descripcionEspecie').value = p.descripcion_especie || '';

    // ✅ Resetear toggle copiar especie al editar
    document.getElementById('toggleCopiarEspecie').checked = false;
    toggleCopiarMontoEspecie();

    document.getElementById('modalPatrocinadorTitle').textContent = 'Editar Patrocinador';
    document.getElementById('modalPatrocinador').style.display = 'flex';
}

async function eliminarPatrocinador(id, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar a "${nombre}"?`)) return;

    try {
        await supabase.from('contactos_patrocinador').delete().eq('patrocinador_id', id);

        const { error } = await supabase
            .from('patrocinadores_2025')
            .delete()
            .eq('id', id);
        if (error) throw error;

        mostrarToast('Patrocinador eliminado correctamente', 'success');
        // Quitar contactos del patrocinador eliminado en memoria (evita un fetch a la DB)
        contactos_patrocinador = contactos_patrocinador.filter(c => c.patrocinador_id !== id);
        await cargarPatrocinadores();
        renderBotonesCategorias();
        actualizarEstadisticas();
        renderFilteredPatrocinadores();
    } catch (error) {
        console.error('Error eliminando patrocinador:', error);
        mostrarToast('Error al eliminar patrocinador', 'error');
    }
}

// ============================================
// CRUD: CATEGORÍAS (modal opcional)
// ============================================
function abrirModalCategorias() {
    renderListaCategorias();
    document.getElementById('modalCategorias').style.display = 'flex';
}

function cerrarModalCategorias() {
    document.getElementById('modalCategorias').style.display = 'none';
    document.getElementById('nuevaCategoriaInput').value = '';
}

function renderListaCategorias() {
    const lista = document.getElementById('listaCategorias');
    if (categorias.length === 0) {
        lista.innerHTML = '<p style="color:#999;text-align:center;">Sin categorías registradas</p>';
        return;
    }
    lista.innerHTML = categorias.map(c => `
        <div class="contacto-card">
            <div class="contacto-info"><strong>${escapeHtml(c.nombre)}</strong></div>
            <div class="contacto-actions">
                <button class="btn-action btn-delete" onclick="eliminarCategoria(${c.id})" title="Eliminar">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function crearCategoria() {
    const input = document.getElementById('nuevaCategoriaInput');
    const nombre = input.value.trim();
    if (!nombre) { mostrarToast('Escribe un nombre de categoría', 'error'); return; }

    try {
        const { error } = await supabase.from('categorias').insert([{ nombre }]);
        if (error) throw error;

        mostrarToast('Categoría creada', 'success');
        input.value = '';
        await cargarCategorias();
        renderListaCategorias();
    } catch (error) {
        console.error('Error creando categoría:', error);
        mostrarToast('Error al crear categoría', 'error');
    }
}

async function eliminarCategoria(id) {
    const enUso = patrocinadores.some(p => p.categoria_id === id);
    if (enUso) {
        mostrarToast('No puedes eliminar una categoría en uso', 'error');
        return;
    }
    if (!confirm('¿Eliminar esta categoría?')) return;

    try {
        const { error } = await supabase.from('categorias').delete().eq('id', id);
        if (error) throw error;

        mostrarToast('Categoría eliminada', 'success');
        await cargarCategorias();
        renderListaCategorias();
    } catch (error) {
        console.error('Error eliminando categoría:', error);
        mostrarToast('Error al eliminar categoría', 'error');
    }
}

// ============================================
// CRUD: CONTACTOS (sin cambios)
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
    const lista = document.getElementById('listaContactos');
    const contactos = contactos_patrocinador.filter(c => c.patrocinador_id === patrocinadorId);

    if (contactos.length === 0) {
        lista.innerHTML = '<p style="color:#999;text-align:center;">No hay contactos registrados</p>';
        return;
    }

    lista.innerHTML = contactos.map(c => `
        <div class="contacto-card">
            <div class="contacto-info">
                <strong>${escapeHtml(c.nombre)}</strong>
                ${c.email    ? `<br>📧 ${escapeHtml(c.email)}`    : ''}
                ${c.telefono ? `<br>📱 ${escapeHtml(c.telefono)}` : ''}
            </div>
            <div class="contacto-actions">
                <button class="btn-action btn-edit"   onclick="editarContacto(${c.id})"   title="Editar">✏️</button>
                <button class="btn-action btn-delete" onclick="eliminarContacto(${c.id})" title="Eliminar">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function guardarContacto(event) {
    event.preventDefault();

    const contactoId    = document.getElementById('contactoId').value;
    const patrocinadorId = parseInt(document.getElementById('contactoPatrocinadorId').value);
    const datos = {
        patrocinador_id: patrocinadorId,
        nombre:   document.getElementById('contactoNombre').value,
        email:    document.getElementById('contactoEmail').value    || null,
        telefono: document.getElementById('contactoTelefono').value || null,
    };

    try {
        if (contactoId) {
            const { error } = await supabase.from('contactos_patrocinador').update(datos).eq('id', contactoId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('contactos_patrocinador').insert([datos]);
            if (error) throw error;
        }

        await cargarContactos();
        await cargarContactosPatrocinador(patrocinadorId);
        renderFilteredPatrocinadores();

        document.getElementById('formContacto').reset();
        document.getElementById('contactoId').value = '';
        document.getElementById('btnGuardarContacto').textContent = '➕ Agregar Contacto';
    } catch (error) {
        console.error('Error guardando contacto:', error);
        mostrarToast('Error al guardar contacto', 'error');
    }
}

async function editarContacto(contactoId) {
    const c = contactos_patrocinador.find(c => c.id === contactoId);
    if (!c) return;

    document.getElementById('contactoId').value    = c.id;
    document.getElementById('contactoNombre').value  = c.nombre;
    document.getElementById('contactoEmail').value   = c.email    || '';
    document.getElementById('contactoTelefono').value = c.telefono || '';
    document.getElementById('btnGuardarContacto').textContent = 'Actualizar Contacto';
    document.querySelector('.contacto-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function eliminarContacto(contactoId) {
    if (!confirm('¿Eliminar este contacto?')) return;

    try {
        const { error } = await supabase.from('contactos_patrocinador').delete().eq('id', contactoId);
        if (error) throw error;

        mostrarToast('Contacto eliminado', 'success');
        const patrocinadorId = parseInt(document.getElementById('contactoPatrocinadorId').value);
        await cargarContactos();
        await cargarContactosPatrocinador(patrocinadorId);
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
    document.getElementById('totalPatrocinadores').textContent  = patrocinadores.length;
    document.getElementById('totalMonto').textContent           = formatCurrency(patrocinadores.reduce((s, p) => s + (p.monto_pagado_total  || 0), 0));
    document.getElementById('totalNotaCredito').textContent     = formatCurrency(patrocinadores.reduce((s, p) => s + (p.nota_credito        || 0), 0));
    document.getElementById('totalEspecie').textContent         = formatCurrency(patrocinadores.reduce((s, p) => s + (p.monto_especie       || 0), 0));
    document.getElementById('totalFaltaTransferir').textContent = formatCurrency(patrocinadores.reduce((s, p) => s + (p.falta_transferir    || 0), 0));
    document.getElementById('totalTransferencia').textContent   = formatCurrency(patrocinadores.reduce((s, p) => s + (p.monto_transferencia || 0), 0));
}

// ============================================
// AUXILIARES
// ============================================
function formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
}

// Atenúa $0.00 a gris claro o muestra un guion para reducir ruido visual
function formatCurrencyMuted(value) {
    if (!value || value === 0) {
        return `<span class="monto-cero">—</span>`;
    }
    return formatCurrency(value);
}

// Formatea mientras el usuario escribe (ej: "$ 1,234.5")
function formatearInputMoneda(input) {
    let raw = input.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');

    if (!raw || raw === '.') { input.value = raw ? '$ 0.' : ''; return; }

    const [intPart, decPart] = raw.split('.');
    const intFormateado = parseInt(intPart || '0', 10)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    input.value = '$ ' + intFormateado + (decPart !== undefined ? '.' + decPart : '');
}

// Formato completo al salir del campo (ej: "$ 1,234.50")
function formatearMonedaCompleta(num) {
    return '$ ' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Convierte "$ 1,234.50" → 1234.50
function parsearMoneda(str) {
    return parseFloat(String(str).replace(/[^0-9.]/g, '')) || 0;
}

// Modal descripción de especie (solo lectura)
function abrirModalEspecie(descripcion, nombrePatrocinador) {
    document.getElementById('modalEspecieTitulo').textContent = `Especie — ${nombrePatrocinador}`;
    document.getElementById('modalEspecieTexto').textContent = descripcion || 'Sin descripción.';
    document.getElementById('modalEspecie').style.display = 'flex';
}

function cerrarModalEspecie() {
    document.getElementById('modalEspecie').style.display = 'none';
}

// Toggle descripción de especie
function toggleDescripcionEspecie() {
    const activo = document.getElementById('toggleEspecie').checked;
    document.getElementById('descripcionEspecieWrapper').style.display = activo ? 'block' : 'none';
    if (!activo) document.getElementById('descripcionEspecie').value = '';
}

// ✅ Toggle: copiar monto especie → monto pagado total
function toggleCopiarMontoEspecie() {
    const activo       = document.getElementById('toggleCopiarEspecie').checked;
    const inputEspecie = document.getElementById('montoEspecie');
    const inputPagado  = document.getElementById('montoPagadoTotal');

    if (activo) {
        // Copiar valor actual de especie
        const num = parsearMoneda(inputEspecie.value);
        inputPagado.value = num === 0 ? '' : formatearMonedaCompleta(num);

        // Bloquear edición manual mientras el toggle está activo
        inputPagado.readOnly = true;
        inputPagado.style.opacity = '0.6';
        inputPagado.style.cursor  = 'not-allowed';

        // Sincronizar en tiempo real si cambia el monto especie
        inputEspecie._syncListener = () => {
            const n = parsearMoneda(inputEspecie.value);
            inputPagado.value = n === 0 ? '' : formatearMonedaCompleta(n);
        };
        inputEspecie.addEventListener('input', inputEspecie._syncListener);
    } else {
        // Restaurar campo a editable
        inputPagado.readOnly = false;
        inputPagado.style.opacity = '1';
        inputPagado.style.cursor  = '';

        // Remover listener de sincronización
        if (inputEspecie._syncListener) {
            inputEspecie.removeEventListener('input', inputEspecie._syncListener);
            delete inputEspecie._syncListener;
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast toast-${tipo} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// NAVEGACIÓN POR PESTAÑAS
// ============================================
function cambiarTab(tab) {
    // Mostrar/ocultar contenido
    document.getElementById('tab-crm').style.display      = tab === 'crm'      ? 'block' : 'none';
    document.getElementById('tab-finanzas').style.display = tab === 'finanzas'  ? 'block' : 'none';

    // Actualizar estilos de botones
    document.getElementById('tab-btn-crm').classList.toggle('active',      tab === 'crm');
    document.getElementById('tab-btn-finanzas').classList.toggle('active',  tab === 'finanzas');

    // Mostrar/ocultar botones del header según pestaña
    document.getElementById('headerAcciones').style.display = tab === 'crm' ? 'flex' : 'none';
}

// ============================================
// MÓDULO FINANZAS
// ============================================

// Campos editables (todos menos los calculados)
const FINANZAS_EDITABLES = [
    { clave: 'total_nc_transferencias', etiqueta: 'Total NC + Transferencias', icono: '🏦' },
    { clave: 'jugadores_inscripciones', etiqueta: 'Jugadores Inscripciones Portal', icono: '⛳' },
    { clave: 'pago_previo_cenas',       etiqueta: 'Pago Previo de Acceso Cenas', icono: '🍽️' },
    { clave: 'ingresos_cena_jugadores', etiqueta: 'Ingresos Día de Cena Jugadores', icono: '🎟️' },
    { clave: 'ingresos_cena_quizz',     etiqueta: 'Ingresos Cena Quizz It', icono: '🧠' },
    { clave: 'ingresos_activaciones',   etiqueta: 'Ingresos Activaciones', icono: '🎪' },
];

async function cargarFinanzas() {
    try {
        const { data, error } = await supabase
            .from('finanzas_2025')
            .select('*')
            .order('orden', { ascending: true });

        if (error) throw error;
        finanzas = data || [];
        renderFinanzas();
    } catch (error) {
        console.error('Error cargando finanzas:', error);
        mostrarToast('Error al cargar finanzas', 'error');
    }
}

function getFinanzaValor(clave) {
    const f = finanzas.find(f => f.clave === clave);
    return f ? (f.valor || 0) : 0;
}

function renderFinanzas() {
    // Calcular totales
    const meta = getFinanzaValor('meta_recaudacion');
    const totalPrometido = FINANZAS_EDITABLES.reduce((sum, f) => sum + getFinanzaValor(f.clave), 0);
    const diferencia = totalPrometido - meta;

    // Tarjeta meta
    document.getElementById('fin-meta_recaudacion').textContent = formatCurrency(meta);

    // Tarjeta total prometido
    document.getElementById('fin-total_prometido').textContent = formatCurrency(totalPrometido);

    // Tarjeta resultado
    const resultCard  = document.getElementById('fin-resultado-card');
    const resultIcon  = document.getElementById('fin-resultado-icon');
    const resultLabel = document.getElementById('fin-resultado-label');
    const resultValor = document.getElementById('fin-resultado-valor');

    resultCard.className = 'finanza-card ' + (diferencia >= 0 ? 'finanza-superada' : 'finanza-faltante');
    resultIcon.textContent  = diferencia >= 0 ? '🏆' : '⚠️';
    resultLabel.textContent = diferencia >= 0 ? '¡¡Meta Superada!!' : 'Falta para la Meta';
    resultValor.textContent = formatCurrency(Math.abs(diferencia));
    resultValor.style.color = diferencia >= 0 ? '#15803d' : '#dc2626';

    // Grid de ingresos individuales
    const grid = document.getElementById('finanzasGrid');
    grid.innerHTML = FINANZAS_EDITABLES.map(f => {
        const valor = getFinanzaValor(f.clave);
        return `
            <div class="finanza-ingreso-card">
                <div class="finanza-icon">${f.icono}</div>
                <div class="finanza-body">
                    <div class="finanza-label">${f.etiqueta}</div>
                    <div class="finanza-value">${formatCurrency(valor)}</div>
                </div>
                <button class="finanza-edit-btn" onclick="editarFinanza('${f.clave}')" title="Editar">✏️</button>
            </div>`;
    }).join('');
}

function editarFinanza(clave) {
    // Buscar etiqueta
    let etiqueta = clave === 'meta_recaudacion' ? 'Meta Recaudación'
        : (FINANZAS_EDITABLES.find(f => f.clave === clave)?.etiqueta || clave);

    const valorActual = getFinanzaValor(clave);

    document.getElementById('finanzaClave').value = clave;
    document.getElementById('modalFinanzaTitulo').textContent = `Editar: ${etiqueta}`;
    document.getElementById('finanzaEtiquetaLabel').textContent = etiqueta;
    document.getElementById('finanzaValorInput').value = valorActual ? formatearMonedaCompleta(valorActual) : '';
    document.getElementById('modalFinanza').style.display = 'flex';

    // Aplicar formateo al input
    const input = document.getElementById('finanzaValorInput');
    input.oninput = () => formatearInputMoneda(input);
    input.onblur  = () => { const n = parsearMoneda(input.value); input.value = n === 0 ? '' : formatearMonedaCompleta(n); };
    input.onfocus = () => { const n = parsearMoneda(input.value); input.value = n === 0 ? '' : n.toString(); };
}

function cerrarModalFinanza() {
    document.getElementById('modalFinanza').style.display = 'none';
}

async function guardarFinanza(event) {
    event.preventDefault();
    const clave = document.getElementById('finanzaClave').value;
    const valor = parsearMoneda(document.getElementById('finanzaValorInput').value);

    try {
        // Upsert: actualiza si existe, inserta si no
        const { error } = await supabase
            .from('finanzas_2025')
            .upsert({ clave, valor }, { onConflict: 'clave' });

        if (error) throw error;

        mostrarToast('Valor actualizado correctamente', 'success');
        cerrarModalFinanza();
        await cargarFinanzas();
    } catch (error) {
        console.error('Error guardando finanza:', error);
        mostrarToast('Error al guardar', 'error');
    }
}

// ============================================
// EXPONER FUNCIONES AL HTML
// ============================================
window.abrirModalPatrocinador    = abrirModalPatrocinador;
window.cerrarModalPatrocinador   = cerrarModalPatrocinador;
window.guardarPatrocinador       = guardarPatrocinador;
window.editarPatrocinador        = editarPatrocinador;
window.eliminarPatrocinador      = eliminarPatrocinador;

window.abrirModalCategorias      = abrirModalCategorias;
window.cerrarModalCategorias     = cerrarModalCategorias;
window.crearCategoria            = crearCategoria;
window.eliminarCategoria         = eliminarCategoria;

window.abrirContactosModal       = abrirContactosModal;
window.cerrarContactosModal      = cerrarContactosModal;
window.guardarContacto           = guardarContacto;
window.editarContacto            = editarContacto;
window.eliminarContacto          = eliminarContacto;

window.filtrarCategoria          = filtrarCategoria;
window.buscarPatrocinadoresDebounced = buscarPatrocinadoresDebounced;
window.ordenarPor                = ordenarPor;
window.toggleDescripcionEspecie  = toggleDescripcionEspecie;
window.toggleCopiarMontoEspecie  = toggleCopiarMontoEspecie;
window.abrirModalEspecie         = abrirModalEspecie;
window.cerrarModalEspecie        = cerrarModalEspecie;

window.editarFinanza             = editarFinanza;
window.cerrarModalFinanza        = cerrarModalFinanza;
window.guardarFinanza            = guardarFinanza;

window.cambiarTab                = cambiarTab;