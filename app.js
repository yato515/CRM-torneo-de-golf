// app.js
let sponsors = []; // array de objetos
const STORAGE_KEY = 'crm_patrocinadores_v1';

// helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function normalizeRow(row, idx) {
  // row: objeto desde XLSX.utils.sheet_to_json
  // intentamos mapear campos comunes (case-insensitive)
  const mapKey = (obj, names) => {
    const keys = Object.keys(obj);
    for (let n of names) {
      const k = keys.find(x => x.toLowerCase().trim() === n);
      if (k) return obj[k];
    }
    return undefined;
  };

  const id = row.id ?? row.ID ?? ('id' in row ? row.id : `r${idx+1}`);
  const nombre = mapKey(row, ['nombre','name','company','empresa']) || '';
  const nivel = mapKey(row, ['nivel','level']) || '';
  const contacto = mapKey(row, ['contacto','contact','persona','contact_name']) || '';
  const email = mapKey(row, ['email','correo','correo electronico','correo_electronico']) || '';
  const telefono = mapKey(row, ['telefono','phone','cel']) || '';
  const monto = mapKey(row, ['monto','amount','valor']) || '';
  const en_especie = (mapKey(row, ['en_especie','in_kind','especie']) || '').toString();
  const estado = mapKey(row, ['estado','status']) || '';
  const notas = mapKey(row, ['notas','notes','observaciones']) || '';
  const ultimo_contacto = mapKey(row, ['ultimo_contacto','last_contact']) || '';
  const fecha_siguiente_accion = mapKey(row, ['fecha_siguiente_accion','next_action_date']) || '';

  return {
    id: String(id),
    nombre, nivel, contacto, email, telefono,
    monto, en_especie, estado, notas,
    ultimo_contacto, fecha_siguiente_accion
  };
}

// I/O Excel
function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, {type: 'array'});
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const raw = XLSX.utils.sheet_to_json(sheet, {defval: ''});
    sponsors = raw.map((r,i) => normalizeRow(r,i));
    saveLocal();
    renderAll();
  };
  reader.readAsArrayBuffer(file);
}

function exportExcel() {
  // convierte sponsors a hoja y descarga
  const ws = XLSX.utils.json_to_sheet(sponsors);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Patrocinadores');
  XLSX.writeFile(wb, 'patrocinadores_export.xlsx');
}

// persistence
function saveLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sponsors));
}
function loadLocal(){
  const txt = localStorage.getItem(STORAGE_KEY);
  if (txt) {
    try {
      sponsors = JSON.parse(txt);
    } catch(e) { sponsors = []; }
  } else sponsors = [];
}

// render
function renderDashboard() {
  const dashboard = $('#dashboard');
  dashboard.innerHTML = '';
  const totals = {
    total: sponsors.length,
    platino: sponsors.filter(s=>s.nivel && s.nivel.toLowerCase().includes('plat')).length,
    diamante: sponsors.filter(s=>s.nivel && s.nivel.toLowerCase().includes('diam')).length,
    oro: sponsors.filter(s=>s.nivel && s.nivel.toLowerCase().includes('oro')).length,
    menor: sponsors.filter(s=>s.nivel && s.nivel.toLowerCase().includes('menor')).length,
    pendientes: sponsors.filter(s=> (s.estado||'').toLowerCase().includes('pend')).length,
    en_especie: sponsors.filter(s=> (s.en_especie||'').toLowerCase().startsWith('s')).length
  };
  const buildCard = (label, num) => {
    const d = document.createElement('div'); d.className='counter';
    d.innerHTML = `<div class="num">${num}</div><div class="lbl">${label}</div>`;
    return d;
  };
  dashboard.appendChild(buildCard('Total patrocinadores', totals.total));
  dashboard.appendChild(buildCard('Platino', totals.platino));
  dashboard.appendChild(buildCard('Diamante', totals.diamante));
  dashboard.appendChild(buildCard('Oro', totals.oro));
  dashboard.appendChild(buildCard('Menor', totals.menor));
  dashboard.appendChild(buildCard('Pendientes', totals.pendientes));
  dashboard.appendChild(buildCard('En especie', totals.en_especie));
}

function renderTable() {
  const tbody = $('#sponsors-table tbody');
  tbody.innerHTML = '';
  const search = ($('#search').value || '').toLowerCase();
  const levelFilter = ($('#filter-level').value || '').toLowerCase();

  const filtered = sponsors.filter(s => {
    const hay = `${s.nombre} ${s.contacto} ${s.email}`.toLowerCase();
    if (search && !hay.includes(search)) return false;
    if (levelFilter && !(s.nivel || '').toLowerCase().includes(levelFilter)) return false;
    return true;
  });

  filtered.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(s.nombre)}</td>
      <td>${escapeHtml(s.nivel)}</td>
      <td>${escapeHtml(s.contacto)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.telefono)}</td>
      <td>${escapeHtml(s.monto)}</td>
      <td>${escapeHtml(s.estado)}</td>
      <td>
        <button class="action" data-idx="${idx}" onclick="openDetailByFilteredIndex(${idx})">Ver/Editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// escape
function escapeHtml(s){ return (s===undefined||s===null)?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

// modal detail
let currentFilteredIndex = null; // index within filtered list (for the open function)
function openDetailByFilteredIndex(filteredIdx) {
  // compute actual index in sponsors array by applying current filters
  const search = ($('#search').value || '').toLowerCase();
  const levelFilter = ($('#filter-level').value || '').toLowerCase();
  const filtered = sponsors.filter(s => {
    const hay = `${s.nombre} ${s.contacto} ${s.email}`.toLowerCase();
    if (search && !hay.includes(search)) return false;
    if (levelFilter && !(s.nivel || '').toLowerCase().includes(levelFilter)) return false;
    return true;
  });
  const item = filtered[filteredIdx];
  if (!item) return;
  // find real index in sponsors
  const realIndex = sponsors.findIndex(s => s.id === item.id);
  openDetail(realIndex);
}

function openDetail(index) {
  const s = sponsors[index];
  if (!s) return;
  $('#detail-id').value = index;
  $('#detail-nombre').value = s.nombre || '';
  $('#detail-nivel').value = s.nivel || '';
  $('#detail-contacto').value = s.contacto || '';
  $('#detail-email').value = s.email || '';
  $('#detail-telefono').value = s.telefono || '';
  $('#detail-monto').value = s.monto || '';
  $('#detail-en_especie').value = s.en_especie || 'no';
  $('#detail-estado').value = s.estado || '';
  $('#detail-notas').value = s.notas || '';
  $('#detail-ultimo_contacto').value = s.ultimo_contacto || '';
  $('#detail-fecha_siguiente_accion').value = s.fecha_siguiente_accion || '';
  showModal(true);
}

function showModal(show) {
  const modal = $('#modal');
  modal.className = show ? 'modal-visible' : 'modal-hidden';
}

function saveDetail() {
  const idx = Number($('#detail-id').value);
  if (Number.isNaN(idx) || !sponsors[idx]) { alert('Error: índice inválido'); return; }
  const s = sponsors[idx];
  s.nombre = $('#detail-nombre').value;
  s.nivel = $('#detail-nivel').value;
  s.contacto = $('#detail-contacto').value;
  s.email = $('#detail-email').value;
  s.telefono = $('#detail-telefono').value;
  s.monto = $('#detail-monto').value;
  s.en_especie = $('#detail-en_especie').value;
  s.estado = $('#detail-estado').value;
  s.notas = $('#detail-notas').value;
  s.ultimo_contacto = $('#detail-ultimo_contacto').value;
  s.fecha_siguiente_accion = $('#detail-fecha_siguiente_accion').value;
  sponsors[idx] = s;
  saveLocal();
  renderAll();
  showModal(false);
}

// global render
function renderAll() {
  renderDashboard();
  renderTable();
}

// init
function init() {
  loadLocal();
  renderAll();

  // file input
  $('#file-input').addEventListener('change', (ev)=>{
    const f = ev.target.files[0];
    if (!f) return;
    handleFile(f);
  });

  // export
  $('#btn-export').addEventListener('click', exportExcel);

  // clear local
  $('#btn-clear').addEventListener('click', ()=>{
    if (!confirm('Borrar datos guardados localmente?')) return;
    localStorage.removeItem(STORAGE_KEY);
    sponsors = [];
    renderAll();
  });

  // search & filter
  $('#search').addEventListener('input', renderTable);
  $('#filter-level').addEventListener('change', renderTable);

  // modal events
  $('#close-modal').addEventListener('click', ()=>showModal(false));
  $('#save-detail').addEventListener('click', saveDetail);

  // close modal by clicking background
  document.getElementById('modal').addEventListener('click', (e)=>{
    if (e.target.id === 'modal') showModal(false);
  });
}

// start
window.addEventListener('load', init);

// expose for inline onclick
window.openDetailByFilteredIndex = openDetailByFilteredIndex;