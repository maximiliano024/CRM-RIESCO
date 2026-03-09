/* ============================================================
   RIESCO & ASOCIADOS — CRM APP  v2
   Auth + Categories + Admin Panel
   ============================================================ */
'use strict';

console.log('CRM Riesco y Asociados - app.js v1.4.6 loaded (Speed Update)');

// ── STATE ────────────────────────────────────────────────────
const APP = {
  currentView: 'dashboard',
  currentCategory: null,
  currentProjectId: null,
  currentClientId: null,
  editingProjectId: null,
  editingGastoId: null,
  editingUserId: null,
  editingClientId: null,
  changingPassUserId: null,
  gastoModalCategory: null,
  receiptDataUrl: null,
  coverDataUrl: null,
  map: null,
  locationMap: null,
  locationMapMarker: null,
  tempLatLng: null,
  chart: null,
  taskViewMode: 'table', // 'table' | 'calendar'
  calendarDate: new Date(),
  booted: false,  // evita doble bootApp() por onAuthStateChange doble disparo
};


const STAGES = {
  legal: [
    { id: 'en-contacto', label: 'En Contacto', color: '#3b82f6' },
    { id: 'evaluacion', label: 'Evaluación', color: '#8b5cf6' },
    { id: 'en-negociacion', label: 'En Negociación', color: '#f59e0b' },
    { id: 'cierre', label: 'Cierre', color: '#10b981' },
  ],
  inmobiliario: [
    { id: 'en-contacto', label: 'En Contacto', color: '#3b82f6' },
    { id: 'evaluacion', label: 'Evaluación', color: '#8b5cf6' },
    { id: 'en-negociacion', label: 'En Negociación', color: '#f59e0b' },
    { id: 'cierre', label: 'Cierre', color: '#10b981' },
  ]
};

const CATEGORIES = {
  legal: { label: 'Legal', icon: '⚖️', color: '#ea580c' },
  inmobiliario: { label: 'Inmobiliario', icon: '🏢', color: '#0891b2' },
};

// ── STORAGE: funciones async en supabase-storage.js ─────────

// ── UTILITIES ────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function formatCLP(n) {
  if (!n) return '—';
  return `$${Number(n).toLocaleString('es-CL')}`;
}
function formatDate(d) {
  if (!d) return '—';
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d; }
}
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const m = { pdf: { icon: '📄', bg: 'rgba(239,68,68,0.15)' }, doc: { icon: '📝', bg: 'rgba(59,130,246,0.15)' }, docx: { icon: '📝', bg: 'rgba(59,130,246,0.15)' }, xls: { icon: '📊', bg: 'rgba(16,185,129,0.15)' }, xlsx: { icon: '📊', bg: 'rgba(16,185,129,0.15)' }, csv: { icon: '📊', bg: 'rgba(16,185,129,0.15)' }, jpg: { icon: '🖼️', bg: 'rgba(245,158,11,0.15)' }, jpeg: { icon: '🖼️', bg: 'rgba(245,158,11,0.15)' }, png: { icon: '🖼️', bg: 'rgba(245,158,11,0.15)' }, ppt: { icon: '📽️', bg: 'rgba(245,158,11,0.15)' }, pptx: { icon: '📽️', bg: 'rgba(245,158,11,0.15)' }, zip: { icon: '🗜️', bg: 'rgba(139,92,246,0.15)' }, rar: { icon: '🗜️', bg: 'rgba(139,92,246,0.15)' } };
  return m[ext] || { icon: '📎', bg: 'rgba(156,163,175,0.15)' };
}
function getStageInfo(id, category = 'legal') {
  const list = STAGES[category] || STAGES.legal;
  return list.find(s => s.id === id) || list[0];
}
function today() { return new Date().toISOString().slice(0, 10); }
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function formatDatetime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ── PASSWORD HASHING (SHA-256 via Web Crypto) ─────────────────
async function hashPassword(plain) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── AUTH ──────────────────────────────────────────────────────
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('crm_session')); } catch { return null; }
}
function setCurrentUser(user) {
  sessionStorage.setItem('crm_session', JSON.stringify(user));
}
function clearSession() {
  sessionStorage.removeItem('crm_session');
}

// Seed default admin on first run (Supabase)
async function seedAdmin() {
  const users = await getUsers();
  if (users.length > 0) return;
  const hash = await hashPassword('admin1234');
  await upsertUser({
    id: 'admin-default',
    name: 'Administrador',
    username: 'admin',
    password: hash,
    role: 'admin',
    access: ['legal', 'inmobiliario'],
    createdAt: new Date().toISOString(),
  });
}

async function doLoginMicrosoft() {
  const err = $('#login-error');
  if (err) err.classList.add('hidden');

  const { data, error } = await _supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email openid profile offline_access Calendars.ReadWrite User.Read',
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    if (err) {
      err.textContent = 'Error conectando con Microsoft: ' + error.message;
      err.classList.remove('hidden');
    }
    console.error('Error OAuth:', error);
  }
}

async function doLogout() {
  clearSession();
  localStorage.removeItem('ms_graph_token'); // Limpiar token de Microsoft
  await _supabase.auth.signOut();
  location.reload();
}

// ── BOOT ──────────────────────────────────────────────────────
function bootApp(user) {
  $('#login-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');

  // Apply read-only class if visualizador
  if (user.role === 'visualizador') {
    document.body.classList.add('read-only');
  }

  // Hide admin nav item if not admin
  if (user.role !== 'admin') {
    $$('.nav-admin-only').forEach(el => el.style.display = 'none');
    const navCobranza = $('#nav-cobranza');
    if (navCobranza) navCobranza.style.display = 'none';
  }

  // Hide category groups user has no access to
  if (!user.access.includes('legal')) {
    const g = $('#nav-group-legal');
    if (g) g.style.display = 'none';
  }
  if (!user.access.includes('inmobiliario')) {
    const g = $('#nav-group-inmobiliario');
    if (g) g.style.display = 'none';
  }

  // Update sidebar user info
  let roleName = 'Visualizador';
  if (user.role === 'admin') roleName = 'Administrador';
  else if (user.role === 'normal') roleName = 'Normal';

  $('#sidebar-user-name').textContent = escHtml(user.name);
  $('#sidebar-user-role').textContent = roleName;
  $('#sidebar-avatar').textContent = user.name.slice(0, 2).toUpperCase();

  showView('dashboard', 'Dashboard', null);
}

// ── ROUTING ──────────────────────────────────────────────────
async function showView(viewId, title, category) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  const view = $(`#view-${viewId}`);
  if (view) view.classList.remove('hidden');

  $('#page-title').textContent = title || viewId;
  const catLabel = $('#page-category-label');
  if (category && CATEGORIES[category]) {
    catLabel.textContent = `${CATEGORIES[category].icon} ${CATEGORIES[category].label}`;
  } else {
    catLabel.textContent = '';
  }

  APP.currentView = viewId;
  APP.currentCategory = category || null;
  APP.currentSubcategory = null; // Removed subnav usage

  // Highlight active nav
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  if (viewId === 'dashboard') {
    $('#nav-dashboard')?.classList.add('active');
  } else if (viewId === 'admin') {
    $('#nav-admin')?.classList.add('active');
  } else if (viewId === 'clientes' || viewId === 'client-detail') {
    $('#nav-clientes')?.classList.add('active');
  } else if (viewId === 'cobranza') {
    $('#nav-cobranza')?.classList.add('active');
  } else if (viewId === 'gastos-global' && !category) {
    $('#nav-gastos')?.classList.add('active');
  } else if (viewId === 'gastos-review') {
    $('#nav-gastos-review')?.classList.add('active');
  } else if (viewId === 'pipeline' && category === 'legal') {
    $('#nav-legal-pipeline')?.classList.add('active');
  } else if (viewId === 'projects' && category === 'legal') {
    $('#nav-legal-projects')?.classList.add('active');
  } else if (viewId === 'gastos-global' && category === 'legal') {
    $('#nav-legal-gastos')?.classList.add('active');
  } else if (viewId === 'pipeline' && category === 'inmobiliario') {
    $('#nav-inmo-pipeline')?.classList.add('active');
  } else if (viewId === 'projects' && category === 'inmobiliario') {
    $('#nav-inmo-projects')?.classList.add('active');
  } else if (viewId === 'gastos-global' && category === 'inmobiliario') {
    $('#nav-inmo-gastos')?.classList.add('active');
  } else if (viewId === 'tareas' && category === 'inmobiliario') {
    $('#nav-inmo-tareas')?.classList.add('active');
  } else if (viewId === 'tareas' && category === 'legal') {
    $('#nav-legal-tareas')?.classList.add('active');
  } else if (viewId === 'ideas' && category === 'inmobiliario') {
    $('#nav-inmo-ideas')?.classList.add('active');
  } else if (viewId === 'project-detail') {
    // keep whichever was previously active
  }

  if (viewId === 'dashboard') await renderDashboard();
  if (viewId === 'pipeline') await renderPipeline(category);
  if (viewId === 'projects') {
    if ($('#filter-project-category')) $('#filter-project-category').value = category || '';
    if ($('#filter-project-stage')) $('#filter-project-stage').value = '';
    if ($('#filter-project-client')) $('#filter-project-client').value = '';
    await renderProjectsTable(category);
  }
  if (viewId === 'gastos-global') await renderGastosGlobal(category);
  if (viewId === 'gastos-review') await renderGastosReview();
  if (viewId === 'cobranza') await renderCobranza();
  if (viewId === 'clientes') await renderClientes();
  if (viewId === 'admin') await renderAdminPanel();
  if (viewId === 'tareas') await renderTareas(category);
  if (viewId === 'ideas') await renderIdeasTable();
}

// ── SIDEBAR COLLAPSIBLE GROUPS ────────────────────────────────
function toggleNavGroup(groupId) {
  const g = document.querySelector(`[data-group="${groupId}"]`)?.closest('.nav-group');
  if (g) g.classList.toggle('collapsed');
}

// ── BILLING MODAL ──────────────────────────────────────────────
async function openSendBillingModal(projectId) {
  const projects = await getProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;

  APP.billingProjectId = projectId;
  $('#billing-project-name').value = p.name;
  $('#billing-end-date').value = today();
  $('#billing-amount').value = p.value || 0;
  $('#billing-sent-by').value = APP.currentUser?.name || '';

  $('#modal-send-billing').classList.remove('hidden');
}

function closeSendBillingModal() {
  $('#modal-send-billing').classList.add('hidden');
  APP.billingProjectId = null;
}

async function saveBillingForm() {
  const amount = parseFloat($('#billing-amount').value) || 0;
  const concept = `Cobro final: ${$('#billing-project-name').value}`;
  const dueDate = $('#billing-end-date').value;
  const sentBy = $('#billing-sent-by').value;

  const cobro = {
    id: uuidv4(),
    projectId: APP.billingProjectId,
    concept: concept,
    amount: amount,
    dueDate: dueDate,
    status: 'pendiente',
    notes: `Enviado a pagar por: ${sentBy}`
  };

  try {
    await upsertCobro(cobro);

    // Create notification for admins
    await createNotification({
      id: uuidv4(),
      title: 'Nuevo cobro enviado',
      message: `El proyecto "${$('#billing-project-name').value}" ha sido enviado a cobro por ${sentBy} por un monto de ${formatCLP(amount)}.`
    });

    showToast('Proyecto enviado a cobranza exitosamente', 'success');
    closeSendBillingModal();

    // Refresh views if necessary
    if ($('#view-cobranza') && !$('#view-cobranza').classList.contains('hidden')) {
      const cobros = await getCobros(true);
      const projects = await getProjects();
      renderCobranzaCobros(cobros, projects);
    }
  } catch (err) {
    showToast('Error al procesar el cobro', 'error');
    console.error(err);
  }
}

// ── PROJECT MODAL ─────────────────────────────────────────────
function resetCoverUI() {
  const ph = $('#cover-placeholder');
  const pv = $('#cover-preview-container');
  if (ph) ph.classList.remove('hidden');
  if (pv) pv.classList.add('hidden');
  const ri = $('#cover-preview-img'); if (ri) ri.src = '';
}

function showCoverPreview(dataUrl) {
  const ph = $('#cover-placeholder');
  if (ph) ph.classList.add('hidden');
  const ri = $('#cover-preview-img'); if (ri) ri.src = dataUrl;
  const pv = $('#cover-preview-container');
  if (pv) pv.classList.remove('hidden');
}

async function handleCoverUpload(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Selecciona una imagen', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    APP.coverDataUrl = e.target.result;
    showCoverPreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

// Attach event listeners for cover upload
document.addEventListener('DOMContentLoaded', () => {
  const coverInput = $('#cover-file-input');
  const btnSelectCover = $('#btn-select-cover');
  const uploadArea = $('#cover-upload-area');
  const btnRemoveCover = $('#btn-remove-cover');

  if (uploadArea && coverInput) {
    // Click opens file selector
    uploadArea.onclick = () => coverInput.click();
    coverInput.onchange = (e) => handleCoverUpload(e.target.files[0]);

    uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent)'; };
    uploadArea.ondragleave = () => { uploadArea.style.borderColor = 'var(--border)'; };
    uploadArea.ondrop = (e) => {
      e.preventDefault(); uploadArea.style.borderColor = 'var(--border)';
      if (e.dataTransfer.files?.length) handleCoverUpload(e.dataTransfer.files[0]);
    };
  }
  if (btnRemoveCover) {
    btnRemoveCover.onclick = () => {
      APP.coverDataUrl = null;
      resetCoverUI();
      if (coverInput) coverInput.value = '';
    }
  }
});

async function openProjectModal(projectId = null, defaultStage = null) {
  APP.editingProjectId = projectId;
  APP.coverDataUrl = null;
  resetCoverUI();

  // Populate client dropdown
  const [clients, users] = await Promise.all([getClients(), getUsers()]);
  const sel = $('#input-client');
  sel.innerHTML = '<option value="">— Seleccionar empresa —</option>' +
    clients.map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');

  // Populate responsible dropdown with registered users
  const respSel = $('#input-responsible');
  respSel.innerHTML = '<option value="">— Seleccionar responsable —</option>' +
    users.map(u => `<option value="${escHtml(u.name)}">${escHtml(u.name)}</option>`).join('');

  if (projectId) {
    const projects = await getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p) return;
    $('#modal-project-title').textContent = 'Editar Proyecto';
    $('#input-name').value = p.name || '';
    // If stored client name not in list (legacy data), add it as option
    if (p.client && !clients.find(c => c.name === p.client)) {
      sel.innerHTML += `<option value="${escHtml(p.client)}">${escHtml(p.client)} (legado)</option>`;
    }
    sel.value = p.client || '';
    $('#input-category').value = p.category || 'legal';
    $('#input-subcategory').value = p.subcategory || '';

    // Dynamic stages
    const cat = p.category || 'legal';
    const stages = STAGES[cat] || STAGES.legal;
    $('#input-stage').innerHTML = stages.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    $('#input-stage').value = p.stage || stages[0].id;

    $('#input-value').value = p.value || '';
    $('#input-date').value = p.date || '';
    // If the stored responsible name isn't in the users list, add it as a legacy option
    if (p.responsible && !users.find(u => u.name === p.responsible)) {
      respSel.innerHTML += `<option value="${escHtml(p.responsible)}">${escHtml(p.responsible)} (legado)</option>`;
    }
    $('#input-responsible').value = p.responsible || '';
    $('#input-address').value = p.address || '';
    $('#input-description').value = p.description || '';
    if (p.coverDataUrl) {
      APP.coverDataUrl = p.coverDataUrl;
      showCoverPreview(p.coverDataUrl);
    }
  } else {
    $('#modal-project-title').textContent = 'Nuevo Proyecto';
    $('#input-name').value = '';
    sel.value = '';
    const cat = APP.currentCategory || 'legal';
    $('#input-category').value = cat;
    $('#input-subcategory').value = APP.currentSubcategory || '';

    // Dynamic stages
    const stages = STAGES[cat] || STAGES.legal;
    $('#input-stage').innerHTML = stages.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    $('#input-stage').value = defaultStage || stages[0].id;

    $('#input-value').value = '';
    $('#input-date').value = today();
    $('#input-responsible').value = '';
    $('#input-address').value = '';
    $('#input-description').value = '';
  }

  const onCategoryChange = () => {
    const cat = $('#input-category').value;
    $('#group-subcategory').classList.toggle('hidden', cat !== 'inmobiliario');
    const stages = STAGES[cat] || STAGES.legal;
    const currentStage = $('#input-stage').value;
    $('#input-stage').innerHTML = stages.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    if (stages.some(s => s.id === currentStage)) $('#input-stage').value = currentStage;
  };

  $('#input-category').removeEventListener('change', onCategoryChange);
  $('#input-category').addEventListener('change', onCategoryChange);
  onCategoryChange();

  $('#modal-project').classList.remove('hidden');
  setTimeout(() => $('#input-name').focus(), 100);
}

async function openIdeaModal(id = null) {
  const modal = $('#modal-idea');
  const title = $('#modal-idea-title');
  const inputTitle = $('#idea-input-title');
  const inputCategory = $('#idea-input-category');
  const inputContact = $('#idea-input-contact');
  const inputDescription = $('#idea-input-description');

  APP.editingIdeaId = id;

  if (id) {
    title.textContent = 'Editar Idea';
    const ideas = await getIdeas();
    const idea = ideas.find(x => x.id === id);
    if (idea) {
      inputTitle.value = idea.title;
      inputCategory.value = idea.category || 'inmobiliario';
      inputContact.value = idea.contact || '';
      inputDescription.value = idea.description || '';
    }
  } else {
    title.textContent = 'Nueva Idea';
    inputTitle.value = '';
    inputCategory.value = 'inmobiliario';
    inputContact.value = '';
    inputDescription.value = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => inputTitle.focus(), 100);
}

function closeIdeaModal() {
  $('#modal-idea').classList.add('hidden');
  APP.editingIdeaId = null;
}

async function saveIdea() {
  const title = $('#idea-input-title').value.trim();
  const category = $('#idea-input-category').value;
  const contact = $('#idea-input-contact').value.trim();
  const description = $('#idea-input-description').value.trim();

  if (!title) {
    showToast('El título es obligatorio', 'error');
    return;
  }

  const idea = {
    id: APP.editingIdeaId || crypto.randomUUID(),
    title,
    category,
    contact,
    description,
    createdAt: new Date().toISOString()
  };

  showToast('Guardando idea...');
  const res = await upsertIdea(idea);
  if (res === true) {
    showToast('Idea guardada correctamente');
    closeIdeaModal();
    if (APP.currentView === 'ideas') renderIdeasTable($('#ideas-search')?.value || '');
  } else {
    showToast('Error al guardar idea', 'error');
  }
}

async function deleteIdea(id) {
  if (!confirm('¿Estás seguro de eliminar esta idea?')) return;
  showToast('Eliminando...');
  const res = await deleteIdeaById(id);
  if (res) {
    showToast('Idea eliminada');
    renderIdeasTable($('#ideas-search')?.value || '');
  } else {
    showToast('Error al eliminar', 'error');
  }
}

function closeProjectModal() {
  $('#modal-project').classList.add('hidden');
  APP.editingProjectId = null;
  APP.coverDataUrl = null;
  resetCoverUI();
}

async function saveProject() {
  const name = $('#input-name').value.trim();
  const client = $('#input-client').value.trim();
  if (!name) { showToast('El nombre del proyecto es obligatorio', 'error'); return; }

  const category = $('#input-category').value;
  const subcategory = $('#input-subcategory').value;
  if (category === 'inmobiliario' && !subcategory) { showToast('Selecciona un área inmobiliaria', 'error'); return; }

  const data = {
    name, client,
    category,
    subcategory: category === 'inmobiliario' ? subcategory : null,
    stage: $('#input-stage').value,
    value: Number($('#input-value').value) || 0,
    date: $('#input-date').value,
    responsible: $('#input-responsible').value.trim(),
    address: $('#input-address').value.trim(),
    description: $('#input-description').value.trim(),
    coverDataUrl: APP.coverDataUrl || null,
  };

  try {
    let ok;
    if (APP.editingProjectId) {
      const projects = await getProjects();
      const old = projects.find(p => p.id === APP.editingProjectId) || {};
      data.id = APP.editingProjectId;
      data.lat = (data.address !== old.address) ? null : old.lat;
      data.lng = (data.address !== old.address) ? null : old.lng;
      ok = await upsertProject(data);
      if (ok !== true) { showToast('Error Editando: ' + (ok?.message || 'Revisa consola'), 'error'); return; }
      showToast('Proyecto actualizado', 'success');
    } else {
      data.id = uid();
      data.createdAt = new Date().toISOString();
      data.lat = null; data.lng = null;
      ok = await upsertProject(data);
      if (ok !== true) { showToast('Error Creando: ' + (ok?.message || 'Revisa consola'), 'error'); return; }
      showToast('Proyecto creado', 'success');
    }
    closeProjectModal();
    refreshCurrentView();
  } catch (err) {
    console.error('saveProject exception:', err);
    showToast('Error inesperado al guardar. Intenta de nuevo.', 'error');
  }
}

async function deleteProject(id) {
  if (!confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return;
  await deleteProjectById(id);
  showToast('Proyecto eliminado', 'info');
  showView(APP.currentCategory ? 'projects' : 'dashboard', APP.currentCategory ? 'Proyectos' : 'Dashboard', APP.currentCategory);
}

function refreshCurrentView() {
  const v = APP.currentView;
  const c = APP.currentCategory;
  if (v === 'dashboard') renderDashboard();
  else if (v === 'pipeline') renderPipeline(c);
  else if (v === 'projects') renderProjectsTable(c);
  else if (v === 'project-detail') openProjectDetail(APP.currentProjectId);
  else if (v === 'admin') renderAdminPanel();
}

// ── DASHBOARD ─────────────────────────────────────────────────
async function renderDashboard() {
  const projects = await getProjects();
  const user = getCurrentUser();
  const accessible = user?.access || ['legal', 'inmobiliario'];

  ['legal', 'inmobiliario'].forEach(cat => {
    if (!accessible.includes(cat)) return;
    const catProjects = projects.filter(p => p.category === cat);
    const prefix = cat === 'legal' ? 'leg' : 'inmo';
    const totalEl = $(`#stat-${prefix}-total`);
    if (totalEl) totalEl.textContent = `${catProjects.length} proyecto${catProjects.length !== 1 ? 's' : ''}`;

    (STAGES[cat] || []).forEach(s => {
      const el = $(`#stat-${prefix}-${s.id}`);
      if (el) el.textContent = catProjects.filter(p => p.stage === s.id).length;
    });
  });

  // Recent projects (filtered by user access)
  const list = $('#recent-projects-list');
  const recent = [...projects]
    .filter(p => accessible.includes(p.category))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 8);

  if (recent.length === 0) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><p>No hay proyectos aún.</p></div>`;
  } else {
    list.innerHTML = recent.map(p => {
      const stage = getStageInfo(p.stage);
      const cat = CATEGORIES[p.category] || CATEGORIES.legal;
      return `<div class="recent-project-item" onclick="openProjectDetail('${p.id}')">
        <div class="rpi-info">
          <div class="rpi-name">${escHtml(p.name)}</div>
          <div class="rpi-client">${escHtml(p.client)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="cat-badge ${p.category}">${cat.icon}</span>
          <span class="stage-badge ${p.stage}">${stage.label}</span>
        </div>
      </div>`;
    }).join('');
  }

  renderPipelineChart(projects.filter(p => accessible.includes(p.category)));
}

function renderPipelineChart(projects) {
  const ctx = document.getElementById('pipeline-chart');
  if (!ctx) return;
  if (APP.chart) { APP.chart.destroy(); APP.chart = null; }

  // For the dashboard doughnut, we use a unified set of stages (since labels are the same for now)
  const unifiedStages = STAGES.legal;
  const data = unifiedStages.map(s => projects.filter(p => p.stage === s.id).length);
  const total = data.reduce((a, b) => a + b, 0);

  if (total === 0) {
    const container = ctx.parentNode;
    container.innerHTML = `<canvas id="pipeline-chart"></canvas><div class="empty-state" style="position:absolute;inset:0;pointer-events:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:0.3"><circle cx="12" cy="12" r="10"/></svg><p>Sin datos aún</p></div>`;
    return;
  }

  APP.chart = new Chart(document.getElementById('pipeline-chart'), {
    type: 'doughnut',
    data: {
      labels: unifiedStages.map(s => s.label),
      datasets: [{ data, backgroundColor: unifiedStages.map(s => s.color + 'cc'), borderColor: unifiedStages.map(s => s.color), borderWidth: 2, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#4b5563', padding: 14, font: { family: 'Inter', size: 12 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} proyecto(s)` } }
      }
    }
  });
}

async function renderPipeline(category) {
  const [allProjects, allTasks] = await Promise.all([getProjects(), getTareas()]);
  let projects = allProjects.filter(p => p.category === category);
  const user = getCurrentUser();
  const isReadOnly = !(user?.role === 'admin' || user?.role === 'normal');
  const stages = STAGES[category] || STAGES.legal;

  const board = $('#pipeline-board');
  if (!board) return;

  // Re-build board dynamically to allow independent stages per category
  board.innerHTML = stages.map(s => `
    <div class="pipeline-col" data-stage="${s.id}">
      <div class="pipeline-col-header">
        <span class="stage-dot" style="--c:${s.color}"></span>
        <span class="stage-name">${s.label}</span>
        <span class="stage-count" id="count-${s.id}">0</span>
      </div>
      <div class="pipeline-cards" id="col-${s.id}" data-stage="${s.id}"></div>
      ${!isReadOnly ? `<button class="add-card-btn can-edit" onclick="openProjectModal(null, '${s.id}')">+ Agregar Proyecto</button>` : ''}
    </div>
  `).join('');

  stages.forEach(s => {
    const col = $(`#col-${s.id}`);
    const count = $(`#count-${s.id}`);
    if (!col) return;

    const staged = projects.filter(p => p.stage === s.id);
    count.textContent = staged.length;

    if (staged.length === 0) {
      col.innerHTML = `<div class="empty-state" style="padding:24px 12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:0.3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><p style="font-size:12px">Sin proyectos</p></div>`;
    } else {
      col.innerHTML = staged.map(p => buildProjectCard(p, s.color, allTasks)).join('');
    }

    if (!isReadOnly) {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add('drag-over'); };
      col.ondragleave = () => col.classList.remove('drag-over');
      col.ondrop = async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('projectId');
        if (!id) return;
        // Primero re-renderizamos la UI optimistamente para que se vea el cambio de inmediato
        const ps = await getProjects();
        const p = ps.find(pr => pr.id === id);
        if (p && p.stage !== s.id) {
          const oldStage = p.stage;
          p.stage = s.id;
          renderPipeline(category);

          updateProjectStage(id, s.id).then(success => {
            if (success) {
              showToast(`Movido a "${s.label}"`, 'success');
            } else {
              p.stage = oldStage;
              renderPipeline(category);
              showToast('Error al cambiar etapa. Intenta de nuevo.', 'error');
            }
          });
        }
      };
    }
  });
}


function buildProjectCard(p, color, allTasks = []) {
  const cat = CATEGORIES[p.category] || CATEGORIES.legal;
  const coverHtml = p.coverDataUrl ? `<div class="project-card-cover" style="background-image:url('${p.coverDataUrl}')"></div>` : '';

  // Calculate Task Warnings
  const projectTasks = allTasks.filter(t => t.projectId === p.id);
  const overdueTasks = projectTasks.filter(t => t.status !== 'completada' && t.dueDate && new Date(t.dueDate) < new Date(today()));

  let warningsHtml = '';
  if (projectTasks.length === 0) {
    warningsHtml = `<div class="pc-warning pc-warning-empty">⚠️ Sin tareas asignadas</div>`;
  } else if (overdueTasks.length > 0) {
    warningsHtml = `<div class="pc-warning pc-warning-overdue">🚨 ${overdueTasks.length} tarea(s) vencida(s)</div>`;
  }

  return `<div class="project-card" draggable="true" data-id="${p.id}" style="--stage-color:${color}"
    ondragstart="onDragStart(event,'${p.id}')" ondragend="onDragEnd(event)"
    onclick="openProjectDetail('${p.id}')">
    ${coverHtml}
    <div class="pc-name">${escHtml(p.name)}${p.subcategory ? `<span class="subcategory-badge">${escHtml(p.subcategory)}</span>` : ''}</div>
    ${warningsHtml}
    <div class="pc-client"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escHtml(p.client)}</div>
    ${p.description ? `<div style="font-size:12px;color:var(--text-muted);line-height:1.4;margin-bottom:6px">${escHtml(p.description.slice(0, 80))}${p.description.length > 80 ? '…' : ''}</div>` : ''}
    <div class="pc-footer">
      <span class="pc-value">${p.value ? formatCLP(p.value) : '—'}</span>
      <span class="pc-date">${p.date ? formatDate(p.date) : ''}</span>
    </div>
  </div>`;
}

function onDragStart(e, id) { e.dataTransfer.setData('projectId', id); e.currentTarget.classList.add('dragging'); }
function onDragEnd(e) { e.currentTarget.classList.remove('dragging'); }

// ── PROJECTS TABLE ────────────────────────────────────────────
async function renderProjectsTable(category, filter = '') {
  const [allProjects, allTasks] = await Promise.all([getProjects(), getTareas()]);

  // Aplicar nuevos filtros
  const catFilter = $('#filter-project-category')?.value || '';
  const subcatFilter = $('#filter-project-subcategory')?.value || '';
  const stageFilter = $('#filter-project-stage')?.value;
  const clientFilter = $('#filter-project-client')?.value;

  // Show/hide subcategory filter based on category
  const subcatSelect = $('#filter-project-subcategory');
  if (subcatSelect) {
    if (catFilter === 'inmobiliario') {
      subcatSelect.classList.remove('hidden');
    } else {
      subcatSelect.classList.add('hidden');
      subcatSelect.value = ''; // Reset if hidden
    }
  }

  let projects = allProjects;
  if (catFilter) projects = projects.filter(p => p.category === catFilter);
  if (catFilter === 'inmobiliario' && subcatFilter) {
    projects = projects.filter(p => p.subcategory === subcatFilter);
  }
  if (stageFilter) projects = projects.filter(p => p.stage === stageFilter);
  if (clientFilter) projects = projects.filter(p => p.client === clientFilter);

  if (filter) {
    const q = filter.toLowerCase();
    projects = projects.filter(p => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q));
  }

  // Populate options dynamically based on all Projects (ignoring current stage/client filter)
  const allCatProjects = catFilter ? allProjects.filter(p => p.category === catFilter) : allProjects;

  const stageSelect = $('#filter-project-stage');
  if (stageSelect) {
    const currentStage = stageSelect.value;
    let stages = [];
    if (catFilter) {
      stages = STAGES[catFilter] || STAGES.legal;
    } else {
      const map = new Map();
      [...STAGES.legal, ...STAGES.inmobiliario].forEach(s => map.set(s.id, s));
      stages = Array.from(map.values());
    }
    stageSelect.innerHTML = '<option value="">Todas las etapas</option>' +
      stages.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    stageSelect.value = currentStage;
  }

  const clientSelect = $('#filter-project-client');
  if (clientSelect) {
    const currentClient = clientSelect.value;
    const uniqueClients = [...new Set(allCatProjects.map(p => p.client))].filter(Boolean).sort();
    clientSelect.innerHTML = '<option value="">Todos los clientes</option>' +
      uniqueClients.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
    clientSelect.value = currentClient;
  }

  const tbody = $('#projects-table-body');
  const empty = $('#projects-empty');

  if (projects.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const user = getCurrentUser();
  const canEdit = user?.role === 'admin' || user?.role === 'normal';

  tbody.innerHTML = projects.map(p => {
    const s = getStageInfo(p.stage, p.category);
    const cat = CATEGORIES[p.category] || CATEGORIES.legal;

    const projectTasks = allTasks.filter(t => t.projectId === p.id);
    const overdueTasks = projectTasks.filter(t => t.status !== 'completada' && t.dueDate && new Date(t.dueDate) < new Date(today()));

    let warningBadge = '';
    if (projectTasks.length === 0) {
      warningBadge = `<span class="table-warning table-warning-empty" title="Sin tareas asignadas">⚠️ Sin tareas</span>`;
    } else if (overdueTasks.length > 0) {
      warningBadge = `<span class="table-warning table-warning-overdue" title="${overdueTasks.length} tarea(s) vencida(s)">🚨 ${overdueTasks.length} vencida(s)</span>`;
    }

    return `<tr>
      <td style="font-weight:600;color:var(--text-primary);cursor:pointer" onclick="openProjectDetail('${p.id}')">
        <div style="display:flex;align-items:center;gap:8px">
          <span>${escHtml(p.name)}</span>
          ${p.subcategory ? `<span class="subcategory-badge">${escHtml(p.subcategory)}</span>` : ''}
          ${warningBadge}
        </div>
      </td>
      <td>${escHtml(p.client)}</td>
      <td><span class="cat-badge ${p.category}">${cat.icon} ${cat.label}</span></td>
      <td><span class="stage-badge ${p.stage}">${s.label}</span></td>
      <td style="font-weight:600;color:var(--success)">${formatCLP(p.value)}</td>
      <td>${formatDate(p.date)}</td>
      <td><div class="td-actions">
        <button class="btn btn-sm btn-secondary" onclick="openProjectDetail('${p.id}')">Ver</button>
        ${canEdit ? `<button class="btn btn-sm btn-ghost" onclick="openProjectModal('${p.id}')">Editar</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

// ── IDEAS TABLE ───────────────────────────────────────────────
async function renderIdeasTable(filter = '') {
  const ideas = await getIdeas();
  let filtered = [...ideas];

  if (filter) {
    const q = filter.toLowerCase();
    filtered = filtered.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.contact && i.contact.toLowerCase().includes(q))
    );
  }

  const tbody = $('#ideas-table-body');
  const empty = $('#ideas-empty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const user = getCurrentUser();
  const canEdit = user?.role === 'admin' || user?.role === 'normal';

  tbody.innerHTML = filtered.map(i => {
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">
        ${escHtml(i.title)}
      </td>
      <td>${escHtml(i.contact || 'N/A')}</td>
      <td><span class="cat-badge ${i.category}">${i.category === 'inmobiliario' ? '🏢 Inmobiliario' : i.category === 'legal' ? '⚖️ Legal' : '💡 Idea'}</span></td>
      <td>${formatDate(i.createdAt)}</td>
      <td><div class="td-actions">
        ${canEdit ? `
          <button class="btn btn-sm btn-ghost" onclick="openIdeaModal('${i.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost btn-delete" onclick="deleteIdea('${i.id}')">Eliminar</button>
        ` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

// ── PROJECT DETAIL ────────────────────────────────────────────
async function openProjectDetail(id) {
  const projects = await getProjects();
  const p = projects.find(pr => pr.id === id);
  if (!p) return;

  // Check access
  const user = getCurrentUser();
  if (user?.access && !user.access.includes(p.category)) {
    showToast('No tienes acceso a esta categoría', 'error');
    return;
  }

  APP.currentProjectId = id;
  const cat = CATEGORIES[p.category] || CATEGORIES.legal;
  const stage = getStageInfo(p.stage, p.category);

  showView('project-detail', p.name, p.category);

  const badge = $('#detail-stage-badge');
  badge.textContent = stage.label;
  badge.className = `stage-badge ${p.stage}`;

  const catBadge = $('#detail-cat-badge');
  catBadge.textContent = `${cat.icon} ${cat.label}`;
  catBadge.className = `cat-badge ${p.category}`;

  // Cover photo logic
  const hero = $('.project-hero');
  const existingCover = hero.querySelector('.project-hero-cover');
  if (existingCover) existingCover.remove();

  if (p.coverDataUrl) {
    const coverDiv = document.createElement('div');
    coverDiv.className = 'project-hero-cover';
    coverDiv.style.backgroundImage = `url('${p.coverDataUrl}')`;
    hero.insertBefore(coverDiv, hero.firstChild);
  }

  $('#detail-project-name').textContent = p.name;
  $('#detail-project-client').textContent = p.client;
  $('#detail-project-value').textContent = p.value ? `💰 ${formatCLP(p.value)}` : '';
  $('#detail-project-date').textContent = p.date ? `📅 ${formatDate(p.date)}` : '';

  $('#detail-info-list').innerHTML = [
    { label: 'Cliente', value: p.client },
    { label: 'Categoría', value: `${cat.icon} ${cat.label}` },
    { label: 'Etapa', value: stage.label },
    { label: 'Responsable', value: p.responsible || '—' },
    { label: 'Fecha de inicio', value: p.date ? formatDate(p.date) : '—' },
    { label: 'Valor', value: p.value ? formatCLP(p.value) : '—' },
    { label: 'Dirección', value: p.address || '—' },
    { label: 'Descripción', value: p.description || '—' },
  ].map(i => `<div class="info-item"><span class="info-label">${i.label}</span><span class="info-value">${escHtml(String(i.value))}</span></div>`).join('');

  $('#tab-btn-tareas').style.display = p.category === 'inmobiliario' ? '' : 'none';

  activateTab('tab-resumen');
  setTimeout(() => initProjectMap(p), 120);
  renderFiles(id);
  renderComments(id);
  renderGastos(id);
  if (p.category === 'inmobiliario') {
    renderProjectTareas(id);
  }
}

// ── MAP ───────────────────────────────────────────────────────
function initProjectMap(project) {
  const el = document.getElementById('project-map');
  if (!el) return;
  if (APP.map) { APP.map.remove(); APP.map = null; }

  const lat = project.lat || -33.4489;
  const lng = project.lng || -70.6693;

  APP.map = L.map('project-map').setView([lat, lng], project.lat ? 15 : 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(APP.map);

  if (project.lat) {
    L.marker([lat, lng]).addTo(APP.map)
      .bindPopup(`<b>${project.name}</b><br>${project.address || ''}`)
      .openPopup();
  }
}

async function openLocationModal() {
  const projects = await getProjects();
  const p = projects.find(pr => pr.id === APP.currentProjectId);
  if (!p) return;
  $('#modal-location').classList.remove('hidden');

  setTimeout(() => {
    if (APP.locationMap) { APP.locationMap.remove(); APP.locationMap = null; APP.locationMapMarker = null; }
    const lat = p.lat || -33.4489;
    const lng = p.lng || -70.6693;
    APP.locationMap = L.map('location-map').setView([lat, lng], p.lat ? 15 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(APP.locationMap);
    if (p.lat) {
      APP.locationMapMarker = L.marker([lat, lng]).addTo(APP.locationMap);
      APP.tempLatLng = { lat, lng };
    }
    APP.locationMap.on('click', (e) => {
      APP.tempLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (APP.locationMapMarker) APP.locationMapMarker.setLatLng([e.latlng.lat, e.latlng.lng]);
      else APP.locationMapMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(APP.locationMap);
    });
  }, 150);
}

async function searchLocation() {
  const q = $('#location-search-input').value.trim();
  if (!q) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
    const data = await res.json();
    if (!data.length) { showToast('Dirección no encontrada', 'error'); return; }
    const { lat, lon } = data[0];
    APP.tempLatLng = { lat: parseFloat(lat), lng: parseFloat(lon) };
    APP.locationMap.setView([lat, lon], 16);
    if (APP.locationMapMarker) APP.locationMapMarker.setLatLng([lat, lon]);
    else APP.locationMapMarker = L.marker([lat, lon]).addTo(APP.locationMap);
    showToast('Ubicación encontrada', 'success');
  } catch { showToast('Error al buscar dirección', 'error'); }
}

async function saveLocation() {
  if (!APP.tempLatLng) { showToast('Selecciona una ubicación', 'error'); return; }
  const projects = await getProjects();
  const p = projects.find(p => p.id === APP.currentProjectId);
  if (!p) return;
  p.lat = APP.tempLatLng.lat;
  p.lng = APP.tempLatLng.lng;
  await upsertProject(p);
  closeLocationModal();
  initProjectMap(p);
  showToast('Ubicación guardada', 'success');
}

function closeLocationModal() {
  $('#modal-location').classList.add('hidden');
  APP.tempLatLng = null;
  if (APP.locationMap) { APP.locationMap.remove(); APP.locationMap = null; APP.locationMapMarker = null; }
}

// ── COMMENTS ─────────────────────────────────────────────────
async function renderComments(projectId) {
  const all = await getComments();
  const comments = all.filter(c => c.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const list = $('#comments-list');
  const empty = $('#comments-empty');

  if (comments.length === 0) {
    list.innerHTML = ''; list.appendChild(empty); empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    list.innerHTML = comments.map(c => `<div class="comment-item" id="comment-${c.id}">
      <div class="comment-avatar">${(c.author || 'RY').slice(0, 2).toUpperCase()}</div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author">${escHtml(c.author || 'Riesco & Asoc.')}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span class="comment-date">${formatDatetime(c.createdAt)}</span>
            <button class="comment-delete" onclick="deleteComment('${c.id}')" title="Eliminar">×</button>
          </span>
        </div>
        <div class="comment-text">${escHtml(c.text)}</div>
      </div>
    </div>`).join('');
  }
}

async function addComment() {
  const input = $('#comment-input');
  const text = input.value.trim();
  if (!text) return;
  const user = getCurrentUser();
  const comment = { id: uid(), projectId: APP.currentProjectId, author: user?.name || 'Riesco & Asoc.', text, createdAt: new Date().toISOString() };
  await upsertComment(comment);
  input.value = '';
  renderComments(APP.currentProjectId);
  showToast('Comentario agregado', 'success');
}

async function deleteComment(id) {
  await deleteCommentById(id);
  renderComments(APP.currentProjectId);
}

// ── TAREAS (PROJECT DETAIL) ──────────────────────────────────
async function renderProjectTareas(projectId) {
  const mode = APP.taskViewMode || 'table';
  $('#project-tareas-table-container')?.classList.toggle('hidden', mode !== 'table');
  $('#project-tareas-calendar-container')?.classList.toggle('hidden', mode !== 'calendar');

  // Sync UI buttons appearance
  $$('#project-tasks-view-toggle .btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

  if (mode === 'calendar') {
    return renderTaskCalendar(null, projectId);
  }

  let [tareas, users] = await Promise.all([getTareas(), getUsers()]);
  tareas = tareas.filter(t => t.projectId === projectId);

  // Sort: pending first, completed last. Then by due date
  tareas.sort((a, b) => {
    if (a.status === 'completada' && b.status !== 'completada') return 1;
    if (a.status !== 'completada' && b.status === 'completada') return -1;
    return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
  });

  const tbody = $('#project-tareas-table-body');
  const empty = $('#project-tareas-empty');

  const pendingCount = tareas.filter(t => t.status !== 'completada').length;
  $('#project-tareas-count').textContent = pendingCount;

  if (tareas.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  tbody.innerHTML = tareas.map(t => {
    const u = users.find(usr => usr.id === t.userId);
    const uName = u ? u.name : 'Usuario Eliminado';

    // Check if task is overdue
    let isOverdue = false;
    if (t.status !== 'completada' && t.dueDate) {
      if (new Date(t.dueDate) < new Date(today())) isOverdue = true;
    }

    const badgeClass = t.status === 'completada' ? 'success' : isOverdue ? 'danger' : 'warning';
    const rowClass = t.status === 'completada' ? 'opacity: 0.6;' : '';

    return `<tr style="${rowClass}">
      <td><span class="badge ${badgeClass}">${t.status}</span></td>
      <td>${escHtml(t.description)}</td>
      <td>${escHtml(uName)}</td>
      <td>${formatDate(t.dueDate)}</td>
      <td>
        <div class="td-actions">
          ${t.status !== 'completada' ? `<button class="btn btn-sm btn-ghost can-edit" onclick="completeProjectTarea('${t.id}')">✓ Completar</button>` : `<button class="btn btn-sm btn-ghost can-edit" onclick="reopenProjectTarea('${t.id}')">↻ Reabrir</button>`}
          <button class="btn btn-sm btn-secondary can-edit" onclick="openTareaModal('${t.id}')">Editar</button>
          <button class="btn btn-sm btn-danger can-edit" onclick="deleteProjectTarea('${t.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}


async function deleteProjectTarea(id) {
  if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
  await deleteTareaById(id);
  showToast('Tarea eliminada', 'info');
  renderProjectTareas(APP.currentProjectId);
  if (APP.currentView === 'tareas') renderTareas(APP.currentCategory);
}

async function completeProjectTarea(id) {
  const all = await getTareas();
  const t = all.find(ta => ta.id === id);
  if (t) {
    t.status = 'completada';
    await upsertTarea(t);
    showToast('Tarea completada 🎉', 'success');
    renderProjectTareas(APP.currentProjectId);
    if (APP.currentView === 'tareas') renderTareas(APP.currentCategory);
  }
}

async function reopenProjectTarea(id) {
  const all = await getTareas();
  const t = all.find(ta => ta.id === id);
  if (t) {
    t.status = 'pendiente';
    await upsertTarea(t);
    showToast('Tarea reabierta', 'info');
    renderProjectTareas(APP.currentProjectId);
    if (APP.currentView === 'tareas') renderTareas(APP.currentCategory);
  }
}

// ── FILES ─────────────────────────────────────────────────────
async function renderFiles(projectId) {
  const all = await getFiles();
  const files = all.filter(f => f.projectId === projectId);
  const grid = $('#files-grid');
  const empty = $('#files-empty');

  if (files.length === 0) {
    grid.innerHTML = '';
    if (empty) grid.appendChild(empty);
    if (empty) empty.classList.remove('hidden');
  } else {
    if (empty) empty.classList.add('hidden');
    const cardsHtml = files.map(f => {
      const { icon, bg } = getFileIcon(f.name);
      return `<div class="file-card" title="${escHtml(f.name)}" onclick="openLightboxFile('${f.id}')" style="cursor:pointer;">
        <div class="file-icon" style="background:${bg}">${icon}</div>
        <div class="file-name">${escHtml(f.name)}</div>
        <div class="file-size">${formatSize(f.size)}</div>
        <button class="file-delete can-edit" onclick="event.stopPropagation(); deleteFile('${f.id}')" title="Eliminar">×</button>
      </div>`;
    }).join('');
    grid.innerHTML = '';
    if (empty) grid.appendChild(empty);
    grid.insertAdjacentHTML('beforeend', cardsHtml);
  }
}

async function handleFileUpload(input) {
  const fileList = Array.from(input.files);
  if (!fileList.length) return;

  const grid = $('#files-grid');
  const empty = $('#files-empty');
  if (empty) empty.classList.add('hidden');

  const readers = fileList.map(async (file, i) => {
    const { icon, bg } = getFileIcon(file.name);
    const tempFileId = uid();
    const tempId = `temp-upload-${tempFileId}-${i}`;

    const cardHtml = `<div class="file-card uploading-card" id="${tempId}" style="opacity:0.7">
        <div class="file-icon" style="background:${bg}">${icon}</div>
        <div class="file-name" style="flex:1;">
          <div style="margin-bottom:4px;">${escHtml(file.name)}</div>
          <div style="width:100%;background:var(--border);height:4px;border-radius:2px;overflow:hidden;">
            <div class="upload-progress-bar" style="height:100%;width:0%;background:var(--accent);transition:width 0.2s;"></div>
          </div>
        </div>
      </div>`;

    // Solo anexamos la tarjeta, ya ocultamos el texto de empty, asi que no rompemos el DOM
    grid.insertAdjacentHTML('beforeend', cardHtml);
    const progressBar = $('#' + tempId + ' .upload-progress-bar');

    if (progressBar) progressBar.style.width = '30%'; // Inicio de carga

    try {
      // Usar Supabase Storage nativo en lugar de Base64
      const publicUrl = await uploadFileToStorage(APP.currentProjectId, tempFileId, file);

      if (progressBar) progressBar.style.width = '80%'; // Ya subió a storage

      if (publicUrl) {
        // Guardar registro en base de datos apuntando a la URL pública final
        await upsertFile({
          id: tempFileId,
          projectId: APP.currentProjectId,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: publicUrl,
          createdAt: new Date().toISOString()
        });

        if (progressBar) progressBar.style.width = '100%';
      } else {
        showToast('Error al procesar archivo: ' + file.name + ' (Tal vez necesitas ejecutar setup-storage.sql)', 'error');
        if (progressBar) progressBar.parentElement.style.background = 'var(--danger)';
      }
    } catch (e) {
      console.error(e);
      showToast('Error al subir: ' + file.name, 'error');
    }

    // Actualizamos esta tarjeta final llamando a renderFiles
    await renderFiles(APP.currentProjectId);
  });

  await Promise.all(readers);
  input.value = '';
}

async function deleteFile(id) {
  await deleteFileById(id);
  renderFiles(APP.currentProjectId);
  showToast('Archivo eliminado', 'info');
}

async function openLightboxFile(fileId) {
  const all = await getFiles();
  const f = all.find(file => file.id === fileId);
  if (!f) return;
  openLightboxData(f.dataUrl, f.type, f.name);
}

// ── CLIENTES ─────────────────────────────────────────────────
async function renderClientes(filter = '') {
  let clients = await getClients();
  const user = getCurrentUser();
  const canEdit = user?.role === 'admin' || user?.role === 'normal';
  const projects = await getProjects();

  const grid = $('#clientes-grid');
  const empty = $('#clientes-empty');
  const stats = $('#clientes-stats');

  // Stats bar
  const totalClients = clients.length;
  const totalProjects = projects.length;
  stats.innerHTML = `
    <div class="stat-mini"><span class="stat-mini-val">${totalClients}</span><span class="stat-mini-lbl">Clientes</span></div>
    <div class="stat-mini"><span class="stat-mini-val">${totalProjects}</span><span class="stat-mini-lbl">Proyectos</span></div>`;

  if (clients.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = clients.map(c => {
    const initials = (c.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const projCount = projects.filter(p => p.client === c.name || p.clientId === c.id).length;
    const catLabel = c.category ? (CATEGORIES[c.category]?.icon + ' ' + CATEGORIES[c.category]?.label) : 'Ambas';
    const metaLines = [
      c.email ? `<span>✉️ ${escHtml(c.email)}</span>` : '',
      c.phone ? `<span>📞 ${escHtml(c.phone)}</span>` : '',
      c.rut ? `<span>🪪 ${escHtml(c.rut)}</span>` : '',
    ].filter(Boolean).join('');
    return `<div class="client-card" onclick="openClientDetail('${c.id}')">
      <div class="client-card-header">
        <div class="client-avatar">${escHtml(initials)}</div>
        <div><div class="client-card-name">${escHtml(c.name)}</div>${c.rut ? `<div class="client-card-rut">${escHtml(c.rut)}</div>` : ''}</div>
      </div>
      <div class="client-card-meta">${metaLines}</div>
      <div class="client-card-footer">
        <span class="client-proj-count">📁 ${projCount} proyecto${projCount !== 1 ? 's' : ''}</span>
        <div class="client-card-actions">
          ${canEdit ? `<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openClientModal('${c.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteClient('${c.id}')">Eliminar</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function openClientDetail(clientId) {
  APP.currentClientId = clientId;
  const clients = await getClients();
  const c = clients.find(c => c.id === clientId);
  if (!c) { showView('clientes', 'Clientes', null); return; }

  // Navigate to detail view
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#view-client-detail')?.classList.remove('hidden');
  APP.currentView = 'client-detail';
  $('#page-title').textContent = c.name;
  $('#page-category-label').textContent = '';
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $('#nav-clientes')?.classList.add('active');

  // Hero
  const initials = (c.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  $('#client-hero-avatar').textContent = initials;
  $('#client-hero-name').textContent = c.name;

  const metaParts = [
    c.rut ? `<span>🪪 ${escHtml(c.rut)}</span>` : '',
    c.email ? `<span>✉️ ${escHtml(c.email)}</span>` : '',
    c.phone ? `<span>📞 ${escHtml(c.phone)}</span>` : '',
    c.address ? `<span>📍 ${escHtml(c.address)}</span>` : '',
  ].filter(Boolean).join('');
  $('#client-hero-meta').innerHTML = metaParts;

  // Edit / Delete buttons
  const user = getCurrentUser();
  const canEdit = user?.role === 'admin' || user?.role === 'normal';
  if (canEdit) {
    $('#btn-edit-client').onclick = () => openClientModal(c.id);
    $('#btn-delete-client').onclick = () => deleteClient(c.id);
    $('#btn-edit-client').classList.remove('hidden');
    $('#btn-delete-client').classList.remove('hidden');
  } else {
    $('#btn-edit-client').classList.add('hidden');
    $('#btn-delete-client').classList.add('hidden');
  }
  $('#btn-client-back').onclick = () => showView('clientes', 'Clientes', null);

  // Projects
  const projects = await getProjects();
  const tbody = $('#client-projects-body');
  const empty = $('#client-projects-empty');

  if (projects.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    const clientProjects = projects.filter(p => p.client === c.name || p.clientId === c.id);
    tbody.innerHTML = clientProjects.map(p => {
      const stage = getStageInfo(p.stage);
      const catInfo = CATEGORIES[p.category] || {};
      return `<tr>
        <td style="font-weight:600;cursor:pointer;color:var(--text-primary)" onclick="openProjectDetail('${p.id}')">${escHtml(p.name)}</td>
        <td>${catInfo.icon || ''} ${catInfo.label || p.category || '—'}</td>
        <td><span class="stage-badge" style="background:${stage.color}22;color:${stage.color}">${stage.label}</span></td>
        <td style="font-weight:600;color:var(--success)">${formatCLP(p.value)}</td>
        <td>${formatDate(p.date)}</td>
        <td><div class="td-actions">
          <button class="btn btn-sm btn-ghost" onclick="openProjectDetail('${p.id}')">Ver</button>
          ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="openProjectModal('${p.id}')">Editar</button>` : ''}
        </div></td>
      </tr>`;
    }).join('');
  }

  // "New Project" button for this client
  $('#btn-client-new-project').onclick = () => {
    openProjectModal(null, null);
    setTimeout(() => {
      const ci = $('#input-client');
      if (ci) { ci.value = c.name; ci.readOnly = true; }
    }, 100);
  };
}

async function openClientModal(clientId = null) {
  APP.editingClientId = clientId;
  if (clientId) {
    const clients = await getClients();
    const c = clients.find(c => c.id === clientId);
    if (!c) return;
    $('#modal-client-title').textContent = 'Editar Cliente';
    $('#client-name').value = c.name || '';
    $('#client-rut').value = c.rut || '';
    $('#client-email').value = c.email || '';
    $('#client-phone').value = c.phone || '';
    $('#client-category').value = c.category || '';
    $('#client-address').value = c.address || '';
    $('#client-notes').value = c.notes || '';
  } else {
    $('#modal-client-title').textContent = 'Nuevo Cliente';
    $('#client-name').value = $('#client-rut').value = $('#client-email').value =
      $('#client-phone').value = $('#client-address').value = $('#client-notes').value = '';
    $('#client-category').value = '';
  }
  $('#modal-client').classList.remove('hidden');
  setTimeout(() => $('#client-name').focus(), 80);
}

function closeClientModal() {
  $('#modal-client').classList.add('hidden');
  APP.editingClientId = null;
}

async function saveClient() {
  const name = $('#client-name').value.trim();
  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
  const data = {
    name,
    rut: $('#client-rut').value.trim(),
    email: $('#client-email').value.trim(),
    phone: $('#client-phone').value.trim(),
    category: $('#client-category').value,
    address: $('#client-address').value.trim(),
    notes: $('#client-notes').value.trim(),
  };
  if (APP.editingClientId) {
    data.id = APP.editingClientId;
    await upsertClient(data);
    showToast('Cliente actualizado', 'success');
  } else {
    data.id = uid(); data.createdAt = new Date().toISOString();
    await upsertClient(data);
    showToast('Cliente registrado', 'success');
  }
  closeClientModal();
  if (APP.currentView === 'client-detail') openClientDetail(APP.currentClientId);
  else renderClientes();
}

async function deleteClient(id) {
  if (!confirm('¿Eliminar este cliente? Los proyectos asociados se conservarán.')) return;
  await deleteClientById(id);
  showToast('Cliente eliminado', 'info');
  showView('clientes', 'Clientes', null);
}

// ── GLOBAL GASTOS VIEW (Excel Style) ─────────────────────────
// State for the Excel table
APP.xlsState = {
  allGastos: [],      // full unfiltered dataset
  projectMap: {},     // id → name
  isAdmin: false,
  sortCol: 'date',
  sortAsc: false,
  filters: {},        // colKey → string value
  selectedId: null,
};

// Column definitions
function _getXlsCols(isAdmin) {
  const cols = [
    { key: 'project', label: 'Proyecto', editable: false, type: 'text' },
    ...(isAdmin ? [{ key: 'userName', label: 'Colaborador', editable: false, type: 'text' }] : []),
    { key: 'date', label: 'Fecha', editable: true, type: 'date' },
    { key: 'description', label: 'Descripción', editable: true, type: 'text' },
    {
      key: 'category', label: 'Categoría', editable: true, type: 'select',
      options: ['Transporte', 'Alimentación', 'Alojamiento', 'Materiales', 'Servicios', 'Otro']
    },
    { key: 'amount', label: 'Monto', editable: true, type: 'number' },
    { key: 'voucher', label: 'Comprobante', editable: true, type: 'text' },
    { key: 'receipt', label: 'Boleta', editable: false, type: 'receipt' },
    { key: 'actions', label: '', editable: false, type: 'actions' },
  ];
  return cols;
}

async function renderGastosGlobal(category) {
  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'normal';

  // Load data
  const allProjects = await getProjects();
  const projects = category ? allProjects.filter(p => p.category === category) : allProjects;
  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p.name; });

  let gastos = (await getGastos()).filter(g => projects.some(p => p.id === g.projectId));
  if (!isAdmin) {
    gastos = gastos.filter(g => g.userId === user?.id);
  }

  // Save state
  APP.xlsState.allGastos = gastos;
  APP.xlsState.projectMap = projectMap;
  APP.xlsState.isAdmin = isAdmin;
  APP.xlsState.canEdit = canEdit;

  // KPI cards
  const total = gastos.reduce((s, g) => s + (g.amount || 0), 0);
  $('#gg-total').textContent = formatCLP(total);
  $('#gg-count').textContent = gastos.length;
  $('#gg-proj-count').textContent = new Set(gastos.map(g => g.projectId)).size;

  // Build column headers and filter row
  const cols = _getXlsCols(isAdmin);
  const headerRow = $('#xls-header-row');
  const filterRow = $('#xls-filter-row');

  headerRow.innerHTML = cols.map(c => {
    if (!c.label) return `<th style="width:80px"></th>`;
    const isSorted = APP.xlsState.sortCol === c.key;
    const arrow = isSorted ? (APP.xlsState.sortAsc ? ' ▲' : ' ▼') : ' ⬍';
    const sortable = ['project', 'userName', 'date', 'description', 'category', 'amount', 'voucher'].includes(c.key);
    return `<th class="${sortable ? 'sortable' : ''}"
      ${sortable ? `onclick="_xlsSortBy('${c.key}')"` : ''}
      title="${sortable ? 'Clic para ordenar' : ''}"
    >${c.label}${sortable ? `<span class="xls-sort-icon">${arrow}</span>` : ''}</th>`;
  }).join('');

  filterRow.innerHTML = cols.map(c => {
    if (c.type === 'actions' || c.type === 'receipt') return '<th></th>';
    const val = APP.xlsState.filters[c.key] || '';
    if (c.type === 'select') {
      return `<th><select class="xls-col-filter" data-col="${c.key}" onchange="_xlsApplyFilters()">
        <option value="">Todas</option>
        ${c.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select></th>`;
    }
    return `<th><input type="${c.type === 'number' ? 'number' : 'text'}" class="xls-col-filter" data-col="${c.key}" value="${escHtml(val)}" placeholder="🔍" oninput="_xlsFilterDebounce(this)"/></th>`;
  }).join('');

  // Render rows
  _xlsRenderRows();

  // Receipt panel close button
  $('#xls-receipt-close').onclick = () => {
    $('#xls-receipt-panel').classList.add('hidden');
    APP.xlsState.selectedId = null;
    $$('.xls-row-selected').forEach(r => r.classList.remove('xls-row-selected'));
  };
}

// Apply column filters and re-render rows
function _xlsApplyFilters() {
  // Collect current filter values
  $$('.xls-col-filter').forEach(input => {
    APP.xlsState.filters[input.dataset.col] = input.value.trim().toLowerCase();
  });
  _xlsRenderRows();
}

// Debounce wrapper for text inputs
let _xlsDebounceTimer = null;
function _xlsFilterDebounce(el) {
  clearTimeout(_xlsDebounceTimer);
  _xlsDebounceTimer = setTimeout(() => {
    APP.xlsState.filters[el.dataset.col] = el.value.trim().toLowerCase();
    _xlsRenderRows();
  }, 280);
}

// Sort
function _xlsSortBy(col) {
  if (APP.xlsState.sortCol === col) {
    APP.xlsState.sortAsc = !APP.xlsState.sortAsc;
  } else {
    APP.xlsState.sortCol = col;
    APP.xlsState.sortAsc = true;
  }
  renderGastosGlobal(APP.currentCategory);
}

// Render filtered + sorted rows
function _xlsRenderRows() {
  const { allGastos, projectMap, isAdmin, canEdit, filters, sortCol, sortAsc } = APP.xlsState;

  // Filter
  let rows = allGastos.filter(g => {
    const proj = (projectMap[g.projectId] || '').toLowerCase();
    const checks = {
      project: val => proj.includes(val),
      userName: val => (g.userName || '').toLowerCase().includes(val),
      date: val => (g.date || '').includes(val),
      description: val => (g.description || '').toLowerCase().includes(val),
      category: val => (g.category || '').toLowerCase() === val || val === '',
      amount: val => !val || String(g.amount).includes(val),
      voucher: val => (g.voucher || '').toLowerCase().includes(val),
    };
    for (const [col, val] of Object.entries(filters)) {
      if (!val) continue;
      if (checks[col] && !checks[col](val)) return false;
    }
    return true;
  });

  // Sort
  rows.sort((a, b) => {
    let vA, vB;
    if (sortCol === 'project') { vA = projectMap[a.projectId] || ''; vB = projectMap[b.projectId] || ''; }
    else if (sortCol === 'amount') { vA = a.amount || 0; vB = b.amount || 0; return sortAsc ? vA - vB : vB - vA; }
    else { vA = (a[sortCol] || '').toString(); vB = (b[sortCol] || '').toString(); }
    return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
  });

  const tbody = $('#gg-table-body');
  const empty = $('#gg-empty');
  const cols = _getXlsCols(isAdmin);

  if (rows.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const CATS = ['Transporte', 'Alimentación', 'Alojamiento', 'Materiales', 'Servicios', 'Otro'];

  tbody.innerHTML = rows.map(g => {
    const projName = projectMap[g.projectId] || '—';
    const isSelected = APP.xlsState.selectedId === g.id;

    const cells = cols.map(c => {
      switch (c.key) {
        case 'project':
          return `<td title="${escHtml(projName)}" style="font-weight:600;color:var(--text-primary);cursor:pointer" onclick="event.stopPropagation();openProjectDetail('${g.projectId}')">${escHtml(projName)}</td>`;
        case 'userName':
          return `<td style="color:var(--text-muted);font-size:12px">${escHtml(g.userName || '—')}</td>`;
        case 'date':
          return `<td class="xls-cell-editable" ondblclick="_xlsStartEdit(this,'${g.id}','date','date','${escHtml(g.date || '')}')" title="Doble clic para editar">${formatDate(g.date)}</td>`;
        case 'description':
          return `<td class="xls-cell-editable" style="max-width:200px" ondblclick="_xlsStartEdit(this,'${g.id}','description','text','${escHtml(g.description || '')}')" title="Doble clic para editar">${escHtml(g.description)}</td>`;
        case 'category':
          return `<td class="xls-cell-editable" ondblclick="_xlsStartEdit(this,'${g.id}','category','select','${escHtml(g.category || '')}','${CATS.join('|')}')" title="Doble clic para editar"><span class="xls-has-receipt" style="background:rgba(79,126,255,0.10);color:var(--brand-primary)">${escHtml(g.category || '—')}</span></td>`;
        case 'amount':
          return `<td class="xls-cell-editable" style="font-weight:700;color:var(--success)" ondblclick="_xlsStartEdit(this,'${g.id}','amount','number','${g.amount || 0}')" title="Doble clic para editar">${formatCLP(g.amount)}</td>`;
        case 'voucher':
          return `<td class="xls-cell-editable" style="color:var(--text-muted)" ondblclick="_xlsStartEdit(this,'${g.id}','voucher','text','${escHtml(g.voucher || '')}')" title="Doble clic para editar">${escHtml(g.voucher || '—')}</td>`;
        case 'receipt':
          if (g.receiptDataUrl) {
            const isImg = !g.receiptDataUrl.startsWith('data:application/pdf');
            return `<td onclick="event.stopPropagation();_xlsShowReceipt('${g.id}')" title="Ver boleta">
              ${isImg ? `<img class="xls-thumb" src="${g.receiptDataUrl}" alt="boleta"/>` : `<span class="xls-has-receipt">📄 PDF</span>`}
            </td>`;
          }
          return `<td style="color:var(--text-muted);font-size:12px">—</td>`;
        case 'actions':
          return canEdit ? `<td onclick="event.stopPropagation()"><div class="xls-row-actions">
            <button class="btn btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" onclick="openGastoModal('${g.id}')">✏</button>
            <button class="btn btn-sm btn-danger" style="padding:3px 8px;font-size:11px" onclick="deleteGastoGlobal('${g.id}')">✕</button>
          </div></td>` : '<td></td>';
        default: return '<td>—</td>';
      }
    }).join('');

    return `<tr data-gasto-id="${g.id}" class="${isSelected ? 'xls-row-selected' : ''}" onclick="_xlsSelectRow('${g.id}')">${cells}</tr>`;
  }).join('');
}

// Select a row and show receipt in panel
function _xlsSelectRow(id) {
  APP.xlsState.selectedId = id;
  $$('#gg-table-body tr').forEach(r => r.classList.toggle('xls-row-selected', r.dataset.gastoId === id));
  const g = APP.xlsState.allGastos.find(x => x.id === id);
  if (g?.receiptDataUrl) _xlsShowReceipt(id);
}

function _xlsShowReceipt(id) {
  const g = APP.xlsState.allGastos.find(x => x.id === id);
  if (!g) return;

  const panel = $('#xls-receipt-panel');
  const body = $('#xls-receipt-body');
  const titleEl = $('#xls-receipt-title');

  panel.classList.remove('hidden');
  titleEl.textContent = g.description || 'Boleta';

  if (!g.receiptDataUrl) {
    body.innerHTML = `<div class="xls-receipt-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:0.25"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg><p>Sin boleta adjunta</p></div>`;
    return;
  }

  const isPdf = g.receiptDataUrl.startsWith('data:application/pdf') || g.receiptDataUrl.includes('.pdf');
  const metaHtml = `<div class="xls-receipt-meta">
    <strong>Proyecto:</strong> ${escHtml(APP.xlsState.projectMap[g.projectId] || '—')}<br>
    <strong>Fecha:</strong> ${formatDate(g.date)}<br>
    <strong>Descripción:</strong> ${escHtml(g.description || '—')}<br>
    <strong>Monto:</strong> ${formatCLP(g.amount)}<br>
    ${g.userName ? `<strong>Colaborador:</strong> ${escHtml(g.userName)}<br>` : ''}
  </div>`;

  if (isPdf) {
    body.innerHTML = metaHtml + `<iframe class="xls-receipt-iframe" src="${g.receiptDataUrl}" title="PDF Boleta"></iframe>`;
  } else {
    body.innerHTML = metaHtml + `<img class="xls-receipt-img" src="${g.receiptDataUrl}" alt="Boleta" onclick="openLightboxDirect('${g.id}')" title="Clic para ampliar"/>`;
  }
}

// Inline cell editing
function _xlsStartEdit(td, gastoId, field, type, currentVal, optionsStr) {
  if (td.classList.contains('editing')) return;
  td.classList.add('editing');
  const prev = td.innerHTML;

  let input;
  if (type === 'select') {
    const opts = (optionsStr || '').split('|');
    input = document.createElement('select');
    input.className = 'xls-cell-input';
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      if (o === currentVal) opt.selected = true;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = type;
    input.className = 'xls-cell-input';
    input.value = currentVal;
  }

  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  if (input.select) input.select();

  const save = async () => {
    const newVal = type === 'number' ? Number(input.value) : input.value;
    td.classList.remove('editing');

    // Update in local state immediately for responsiveness
    const g = APP.xlsState.allGastos.find(x => x.id === gastoId);
    if (g) g[field] = newVal;

    // Update display
    if (field === 'amount') td.innerHTML = `<span style="font-weight:700;color:var(--success)">${formatCLP(newVal)}</span>`;
    else if (field === 'date') td.innerHTML = formatDate(newVal);
    else if (field === 'category') td.innerHTML = `<span class="xls-has-receipt" style="background:rgba(79,126,255,0.10);color:var(--brand-primary)">${escHtml(newVal)}</span>`;
    else td.innerHTML = escHtml(newVal) || '—';

    // Save to Supabase
    const ok = await updateGastoField(gastoId, field, newVal);
    if (!ok) {
      showToast('Error al guardar, intenta de nuevo', 'error');
      td.innerHTML = prev;
    } else {
      // Update KPI totals
      const total = APP.xlsState.allGastos.reduce((s, g) => s + (g.amount || 0), 0);
      $('#gg-total').textContent = formatCLP(total);
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { td.classList.remove('editing'); td.innerHTML = prev; }
  });
}

async function deleteGastoGlobal(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await deleteGastoById(id);
  APP.xlsState.allGastos = APP.xlsState.allGastos.filter(g => g.id !== id);
  _xlsRenderRows();
  const total = APP.xlsState.allGastos.reduce((s, g) => s + (g.amount || 0), 0);
  $('#gg-total').textContent = formatCLP(total);
  $('#gg-count').textContent = APP.xlsState.allGastos.length;
  showToast('Gasto eliminado', 'info');
  if (APP.xlsState.selectedId === id) {
    $('#xls-receipt-panel').classList.add('hidden');
    APP.xlsState.selectedId = null;
  }
}

async function exportGastosGlobal() {
  const { allGastos, projectMap } = APP.xlsState;
  if (!allGastos.length) { showToast('No hay gastos para exportar', 'error'); return; }
  const rows = [
    ['Proyecto', 'Colaborador', 'Fecha', 'Descripción', 'Categoría', 'Monto', 'Comprobante'],
    ...allGastos.map(g => [
      `"${(projectMap[g.projectId] || '').replace(/"/g, '""')}"`,
      `"${(g.userName || '').replace(/"/g, '""')}"`,
      g.date || '',
      `"${(g.description || '').replace(/"/g, '""')}"`,
      g.category || '',
      g.amount || 0,
      `"${(g.voucher || '').replace(/"/g, '""')}"`
    ])
  ].map(r => r.join(','));
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const cat = CATEGORIES[APP.currentCategory]?.label || APP.currentCategory || 'todos';
  a.download = `gastos-${cat.toLowerCase()}.csv`;
  a.click();
  showToast('CSV exportado', 'success');
}

// ── LIGHTBOX ──────────────────────────────────────────────────
function openLightboxData(dataUrl, fileType, fileName) {
  $('#lightbox-img').classList.add('hidden');
  $('#lightbox-iframe').classList.add('hidden');
  $('#lightbox-fallback').classList.add('hidden');
  $('#lightbox-img').src = '';
  $('#lightbox-iframe').src = '';

  if (!dataUrl) return;

  const type = (fileType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  const isImage = type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = type === 'application/pdf' || name.match(/\.pdf$/i);

  if (isImage) {
    $('#lightbox-img').src = dataUrl;
    $('#lightbox-img').classList.remove('hidden');
  } else if (isPdf) {
    $('#lightbox-iframe').src = dataUrl;
    $('#lightbox-iframe').classList.remove('hidden');
  } else {
    $('#lightbox-download-link').href = dataUrl;
    $('#lightbox-download-link').download = name || 'archivo';
    $('#lightbox-fallback').classList.remove('hidden');
  }

  $('#lightbox').classList.remove('hidden');
}

async function openLightbox(gastoId) {
  const all = await getGastos();
  const g = all.find(g => g.id === gastoId);
  if (!g?.receiptDataUrl) return;
  openLightboxData(g.receiptDataUrl, 'image/jpeg', 'Boleta.jpg');
}

function closeLightbox() {
  $('#lightbox').classList.add('hidden');
  $('#lightbox-img').src = '';
  $('#lightbox-iframe').src = '';
}

// ── GASTOS ────────────────────────────────────────────────────
async function renderGastos(projectId, filterCat = '') {
  const all = await getGastos();
  const currentUser = getCurrentUser();

  let gastos = all.filter(g => g.projectId === projectId);
  if (currentUser?.role !== 'admin') {
    gastos = gastos.filter(g => g.userId === currentUser.id);
  }

  const allTotal = gastos.reduce((s, g) => s + (g.amount || 0), 0);
  const allCount = gastos.length;
  if (filterCat) gastos = gastos.filter(g => g.category === filterCat);

  $('#gastos-total').textContent = formatCLP(allTotal);
  $('#gastos-count').textContent = allCount;

  const tbody = $('#gastos-table-body');
  const empty = $('#gastos-empty');
  const user = getCurrentUser();
  const canEdit = user?.role === 'admin' || user?.role === 'normal';

  if (gastos.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  tbody.innerHTML = [...gastos].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(g => {
    const thumb = g.receiptDataUrl
      ? `<img class="receipt-thumb" src="${g.receiptDataUrl}" alt="Boleta" onclick="openLightbox('${g.id}')" />`
      : `<span style="color:var(--text-muted);font-size:12px">—</span>`;

    const creatorInfo = g.userName ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">👤 ${escHtml(g.userName)}</div>` : '';

    return `<tr>
    <td>${g.date ? formatDate(g.date) : '—'}</td>
    <td>
      <div style="font-weight:500">${escHtml(g.description)}</div>
      ${creatorInfo}
    </td>
    <td><span class="stage-badge" style="background:rgba(79,126,255,0.12);color:var(--accent)">${escHtml(g.category)}</span></td>
    <td style="font-weight:700;color:var(--success)">${formatCLP(g.amount)}</td>
    <td style="color:var(--text-muted)">${escHtml(g.voucher || '—')}</td>
    <td>${thumb}</td>
    <td><div class="td-actions">
      ${canEdit ? `<button class="btn btn-sm btn-ghost" onclick="openGastoModal('${g.id}')">Editar</button>
      <button class="btn btn-sm btn-danger" onclick="deleteGasto('${g.id}')">Eliminar</button>` : ''}
    </div></td>
  </tr>`;
  }).join('');
}

async function openGastoModal(gastoId = null) {
  APP.editingGastoId = gastoId;
  APP.receiptDataUrl = null;
  resetReceiptUI();

  const projSel = $('#gasto-project-id');
  const category = APP.currentCategory;
  const allProjects = await getProjects();
  const contextProjects = allProjects.filter(p => category ? p.category === category : true);
  projSel.innerHTML = contextProjects
    .map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  // Show/hide project selector based on context
  const pg = $('#gasto-project-group');
  if (APP.currentView !== 'gastos-global' && APP.currentProjectId && !gastoId) {
    pg.style.display = 'none';
    projSel.value = APP.currentProjectId;
  } else {
    pg.style.display = '';
    if (APP.currentProjectId) projSel.value = APP.currentProjectId;
  }

  if (gastoId) {
    const all = await getGastos();
    const g = all.find(g => g.id === gastoId);
    if (!g) return;
    $('#modal-gasto-title').textContent = 'Editar Gasto';
    if (g.projectId) projSel.value = g.projectId;
    $('#gasto-date').value = g.date || '';
    $('#gasto-category').value = g.category || 'Transporte';
    $('#gasto-description').value = g.description || '';
    $('#gasto-amount').value = g.amount || '';
    $('#gasto-voucher').value = g.voucher || '';
    if (g.receiptDataUrl) {
      APP.receiptDataUrl = g.receiptDataUrl;
      showReceiptPreview(g.receiptDataUrl);
    }
  } else {
    $('#modal-gasto-title').textContent = 'Agregar Gasto';
    $('#gasto-date').value = today();
    $('#gasto-category').value = 'Transporte';
    $('#gasto-description').value = '';
    $('#gasto-amount').value = '';
    $('#gasto-voucher').value = '';
  }
  $('#modal-gasto').classList.remove('hidden');
}

function closeGastoModal() {
  $('#modal-gasto').classList.add('hidden');
  APP.editingGastoId = null;
  APP.receiptDataUrl = null;
  resetReceiptUI();
}

async function saveGasto() {
  const description = $('#gasto-description').value.trim();
  const amount = Number($('#gasto-amount').value);
  const projectId = $('#gasto-project-id').value || APP.currentProjectId;
  if (!description) { showToast('La descripción es obligatoria', 'error'); return; }
  if (!amount) { showToast('El monto debe ser mayor a 0', 'error'); return; }
  if (!projectId) { showToast('Selecciona un proyecto', 'error'); return; }

  const currentUser = getCurrentUser();

  const data = {
    projectId,
    date: $('#gasto-date').value,
    category: $('#gasto-category').value,
    description,
    amount,
    voucher: $('#gasto-voucher').value.trim(),
    receiptDataUrl: APP.receiptDataUrl || null,
  };
  if (APP.editingGastoId) {
    data.id = APP.editingGastoId;
    // We do NOT overwrite the original creator in edit, just in case. 
    // Usually handled seamlessly by Supabase upsert unless we explicitly null it.
    await upsertGasto(data);
    showToast('Gasto actualizado', 'success');
  } else {
    data.id = uid();
    data.createdAt = new Date().toISOString();
    data.userId = currentUser?.id || null;
    data.userName = currentUser?.name || null;
    await upsertGasto(data);
    showToast('Gasto registrado', 'success');
  }
  closeGastoModal();
  if (APP.currentView === 'gastos-global') renderGastosGlobal(APP.currentCategory);
  else if (APP.currentView === 'project-detail') renderGastos(projectId, $('#gasto-filter-cat').value);
  else refreshCurrentView();
}

async function deleteGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await deleteGastoById(id);
  renderGastos(APP.currentProjectId, $('#gasto-filter-cat').value);
  showToast('Gasto eliminado', 'info');
}

async function exportGastosCSV() {
  const gastos = (await getGastos()).filter(g => g.projectId === APP.currentProjectId);
  if (!gastos.length) { showToast('No hay gastos para exportar', 'error'); return; }
  const projects = await getProjects();
  const project = projects.find(p => p.id === APP.currentProjectId);
  const rows = [['Fecha', 'Descripción', 'Categoría', 'Monto', 'Comprobante'], ...gastos.map(g => [g.date || '', `"${(g.description || '').replace(/"/g, '""')}"`, g.category || '', g.amount || 0, g.voucher || ''])].map(r => r.join(','));
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gastos-${(project?.name || 'proyecto').replace(/\s+/g, '-')}.csv`;
  a.click();
  showToast('CSV exportado', 'success');
}

// ── BULK UPLOAD ───────────────────────────────────────────────
APP.bulkFiles = []; // { file, dataUrl, ocrData, status: 'pending'|'processing'|'done'|'error' }

function openBulkUploadModal() {
  APP.bulkFiles = [];
  $('#bulk-file-list').innerHTML = '';
  $('#bulk-progress-area').classList.add('hidden');
  $('#bulk-drop-zone').classList.remove('hidden');
  $('#modal-bulk-upload').classList.remove('hidden');
}
function closeBulkUploadModal() { $('#modal-bulk-upload').classList.add('hidden'); APP.bulkFiles = []; }

async function processBulkFiles(files) {
  if (!files.length) return;
  const newFiles = Array.from(files).map(f => ({ file: f, dataUrl: null, ocrData: {}, status: 'pending', name: f.name }));
  APP.bulkFiles.push(...newFiles);

  $('#bulk-drop-zone').classList.add('hidden');
  $('#bulk-progress-area').classList.remove('hidden');

  const total = APP.bulkFiles.length;
  let done = 0;

  for (const item of newFiles) {
    // Read image
    item.dataUrl = await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(item.file);
    });

    item.status = 'processing';
    updateBulkList();

    // OCR (solo para imágenes, no PDF)
    try {
      const isPDF = item.file.type === 'application/pdf';
      if (!isPDF && typeof Tesseract !== 'undefined') {
        const { data: { text } } = await Tesseract.recognize(item.dataUrl, 'spa', {
          logger: m => {
            if (m.status === 'recognizing text') {
              const pct = Math.round((m.progress || 0) * 100);
              updateBulkItemProgress(item.name, pct);
            }
          }
        });
        item.ocrData = extractReceiptData(text);
      }
      item.status = 'done';
    } catch { item.status = 'done'; }

    done++;
    const pct = Math.round((done / total) * 100);
    $('#bulk-progress-bar').style.width = pct + '%';
    $('#bulk-progress-text').textContent = `Procesadas ${done} de ${total}`;
    updateBulkList();
  }
}

async function updateBulkList() {
  const el = $('#bulk-file-list');
  const projects = await getProjects();
  const projectOptions = projects.map(p => `<option value="${p.id}" ${p.id === APP.currentProjectId ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('');
  const categorias = ["Legal", "Inmobiliario", "Transporte", "Alimentacion", "Alojamiento", "Software", "Materiales", "Otros"];

  el.innerHTML = APP.bulkFiles.map((item, index) => {
    if (item.status === 'processing') {
      return `<div class="bulk-editable-item"><div class="ocr-spinner"></div><div style="padding:10px">Procesando ${escHtml(item.name)}...</div></div>`;
    }

    if (item.status === 'saved') {
      return `<div class="bulk-editable-item saved">
                <div class="bei-preview" style="background-image:url('${item.dataUrl}')"></div>
                <div class="bei-form">
                  <div class="bei-header">
                    <span class="bei-name">✅ Guardado: ${escHtml(item.name)}</span>
                  </div>
                </div>
              </div>`;
    }

    const amount = item.ocrData?.amount || '';
    const date = item.ocrData?.date || today();
    const voucher = item.ocrData?.rut || '';
    const desc = item.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Boleta escaneada';

    return `<div class="bulk-editable-item" id="bei-${index}">
      <div class="bei-preview" style="background-image:url('${item.dataUrl || ''}')" onclick="openLightbox('${item.dataUrl}')"></div>
      <div class="bei-form">
        <div class="bei-header">
          <span class="bei-name">${escHtml(item.name)}</span>
        </div>
        <div class="bei-row">
          <div class="form-group"><label class="form-label" style="font-size:10px">Proyecto *</label>
            <select class="form-input" id="bei-proj-${index}" style="padding:6px 10px;font-size:13px">${projectOptions}</select>
          </div>
          <div class="form-group"><label class="form-label" style="font-size:10px">Categoría</label>
            <select class="form-input" id="bei-cat-${index}" style="padding:6px 10px;font-size:13px">
              ${categorias.map(c => `<option value="${c}" ${c === 'Otros' ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="bei-row">
          <div class="form-group"><label class="form-label" style="font-size:10px">Monto *</label><input type="number" class="form-input" id="bei-amount-${index}" value="${amount}" style="padding:6px 10px;font-size:13px" /></div>
          <div class="form-group"><label class="form-label" style="font-size:10px">Fecha</label><input type="date" class="form-input" id="bei-date-${index}" value="${date}" style="padding:6px 10px;font-size:13px" /></div>
          <div class="form-group"><label class="form-label" style="font-size:10px">N° Comp.</label><input type="text" class="form-input" id="bei-voucher-${index}" value="${voucher}" style="padding:6px 10px;font-size:13px" /></div>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:10px">Descripción *</label>
          <input type="text" class="form-input" id="bei-desc-${index}" value="${desc}" style="padding:6px 10px;font-size:13px" />
        </div>
        <div class="bei-actions">
          <button class="btn btn-primary btn-sm" onclick="saveSingleBulkGasto(${index})">Guardar Gasto</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateBulkItemProgress(name, pct) {
  $('#bulk-progress-text').textContent = `Analizando "${name}"… ${pct}%`;
}

async function saveSingleBulkGasto(index) {
  const item = APP.bulkFiles[index];
  if (!item || item.status === 'saved') return;

  const projectId = $(`#bei-proj-${index}`).value;
  const category = $(`#bei-cat-${index}`).value;
  const amountStr = $(`#bei-amount-${index}`).value;
  const amount = parseInt(amountStr, 10);
  const date = $(`#bei-date-${index}`).value;
  const voucher = $(`#bei-voucher-${index}`).value;
  const description = $(`#bei-desc-${index}`).value.trim();

  if (!projectId) { showToast('Selecciona un proyecto', 'error'); return; }
  if (!amount || isNaN(amount) || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
  if (!description) { showToast('La descripción es obligatoria', 'error'); return; }

  const currentUser = getCurrentUser();
  const g = {
    id: uid(),
    projectId,
    date: date || today(),
    category,
    description,
    amount,
    voucher,
    receiptDataUrl: item.dataUrl,
    userId: currentUser?.id || null,
    userName: currentUser?.name || null,
    status: 'aprobado',
    createdAt: new Date().toISOString(),
  };

  try {
    const btn = event.currentTarget;
    const oldText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    await upsertGasto(g);
    item.status = 'saved';
    await updateBulkList();
    showToast('Gasto guardado correctamente', 'success');

    // If we're looking at the global expenses page, refresh it in the background
    if (APP.currentView === 'gastos-global') {
      renderGastosGlobal(APP.currentCategory);
    }
  } catch (err) {
    console.error('saveSingleBulkGasto', err);
    showToast('Error al guardar, intenta nuevamente', 'error');
    event.currentTarget.textContent = 'Guardar Gasto';
    event.currentTarget.disabled = false;
  }
}

// ── GASTO REVIEW (bandeja de aprobación) ─────────────────────
APP.reviewIndex = 0;
APP.reviewPending = [];

async function renderGastosReview() {
  APP.currentView = 'gastos-review';
  const all = await getGastos();
  APP.reviewPending = all.filter(g => g.status === 'pendiente');
  const count = APP.reviewPending.length;

  const counter = $('#review-counter');
  const cardArea = $('#review-card-area');
  const empty = $('#review-empty');

  counter.textContent = count > 0 ? `${count} gasto(s) pendiente(s) de revisión` : 'Sin pendientes';

  if (count === 0) {
    cardArea.innerHTML = '';
    empty.classList.remove('hidden');
    renderPendingBadge();
    return;
  }
  empty.classList.add('hidden');
  APP.reviewIndex = 0;
  renderReviewCard();
}

async function renderReviewCard() {
  const pending = APP.reviewPending;
  const idx = APP.reviewIndex;
  const cardArea = $('#review-card-area');

  if (idx >= pending.length) {
    cardArea.innerHTML = '';
    $('#review-empty').classList.remove('hidden');
    $('#review-counter').textContent = '¡Sin pendientes! Todos los gastos están revisados.';
    renderPendingBadge();
    return;
  }

  const g = pending[idx];
  const projects = await getProjects();
  const proj = projects.find(p => p.id === g.projectId);

  cardArea.innerHTML = `
    <div class="review-card">
      <div class="review-progress">
        <span>Revisando ${idx + 1} de ${pending.length}</span>
        <div class="review-dots">
          ${pending.map((_, i) => `<span class="review-dot ${i < idx ? 'done' : i === idx ? 'current' : ''}"></span>`).join('')}
        </div>
      </div>
      <div class="review-body">
        <div class="review-image-side">
          ${g.receiptDataUrl
      ? `<img src="${g.receiptDataUrl}" class="review-img" onclick="openLightboxDirect('${g.id}')" title="Click para ampliar" />`
      : `<div class="review-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Sin imagen</span></div>`
    }
        </div>
        <div class="review-form-side">
          <div class="review-project-tag">${escHtml(proj?.name || '—')}</div>
          <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="rv-date" value="${g.date || today()}" /></div>
          <div class="form-group"><label class="form-label">Categoría</label>
            <select class="form-input" id="rv-category">
              ${['Transporte', 'Alimentación', 'Alojamiento', 'Materiales', 'Honorarios', 'Notaría', 'Otros'].map(c => `<option value="${c}" ${g.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Descripción</label><input type="text" class="form-input" id="rv-description" value="${escHtml(g.description || '')}" /></div>
          <div class="form-group"><label class="form-label">Monto (CLP)</label><input type="number" class="form-input" id="rv-amount" value="${g.amount || ''}" /></div>
          <div class="form-group"><label class="form-label">Comprobante / N°</label><input type="text" class="form-input" id="rv-voucher" value="${escHtml(g.voucher || '')}" /></div>
        </div>
      </div>
      <div class="review-actions">
        <button class="btn btn-danger" onclick="rejectGasto('${g.id}')">❌ Rechazar</button>
        <button class="btn btn-ghost" onclick="skipReview()">⏭ Saltar</button>
        <button class="btn btn-success" onclick="approveGasto('${g.id}')">✅ Aprobar</button>
      </div>
    </div>`;
}

async function approveGasto(id) {
  // Save edits before approving
  await _patchReviewFieldsAndSetStatus(id, 'aprobado');
  showToast('Gasto aprobado ✅', 'success');
  _nextReview();
}

async function rejectGasto(id) {
  const note = prompt('Motivo del rechazo (opcional):') || '';
  await _patchReviewFieldsAndSetStatus(id, 'rechazado', note);
  showToast('Gasto rechazado ❌', 'info');
  _nextReview();
}

function skipReview() { _nextReview(); }

async function _patchReviewFieldsAndSetStatus(id, status, note = null) {
  const all = await getGastos();
  const g = all.find(g => g.id === id);
  if (!g) return;
  // Apply edits from the review form
  g.date = $('#rv-date')?.value || g.date;
  g.category = $('#rv-category')?.value || g.category;
  g.description = $('#rv-description')?.value.trim() || g.description;
  g.amount = Number($('#rv-amount')?.value) || g.amount;
  g.voucher = $('#rv-voucher')?.value.trim() || g.voucher;
  await upsertGasto(g);
  await updateGastoStatus(id, status, note);
}

function _nextReview() {
  APP.reviewIndex++;
  renderReviewCard();
  renderPendingBadge();
}

async function renderPendingBadge() {
  const all = await getGastos();
  const count = all.filter(g => g.status === 'pendiente').length;
  const badge = $('#pending-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function openLightboxDirect(gastoId) {
  const g = APP.reviewPending.find(g => g.id === gastoId);
  if (!g?.receiptDataUrl) return;
  $('#lightbox-img').src = g.receiptDataUrl;
  $('#lightbox').classList.remove('hidden');
}

// ── RECEIPT HELPERS & OCR ────────────────────────────────────
function resetReceiptUI() {
  const ph = $('#receipt-placeholder');
  const pv = $('#receipt-preview');
  if (ph) ph.classList.remove('hidden');
  if (pv) pv.classList.add('hidden');
  const ri = $('#receipt-img'); if (ri) ri.src = '';
  const os = $('#ocr-status'); if (os) os.classList.add('hidden');
  const or_ = $('#ocr-result'); if (or_) or_.classList.add('hidden');
}

function showReceiptPreview(dataUrl) {
  const ph = $('#receipt-placeholder');
  if (ph) ph.classList.add('hidden');
  const ri = $('#receipt-img'); if (ri) ri.src = dataUrl;
  const pv = $('#receipt-preview');
  if (pv) pv.classList.remove('hidden');
}

async function handleReceiptUpload(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Selecciona una imagen', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    APP.receiptDataUrl = e.target.result;
    showReceiptPreview(e.target.result);
    await runOCR(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function runOCR(dataUrl) {
  if (typeof Tesseract === 'undefined') {
    showToast('OCR no disponible (revisa tu conexión)', 'error');
    return;
  }
  const status = $('#ocr-status');
  const result = $('#ocr-result');
  status.classList.remove('hidden');
  result.classList.add('hidden');
  $('#ocr-status-text').textContent = 'Leyendo imagen…';
  try {
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'spa', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          const el = $('#ocr-status-text');
          if (el) el.textContent = `Analizando texto… ${pct}%`;
        }
      }
    });
    status.classList.add('hidden');
    const extracted = extractReceiptData(text);
    const items = [];
    if (extracted.amount) {
      items.push({ label: 'Monto', value: formatCLP(extracted.amount) });
      const amtEl = $('#gasto-amount');
      if (amtEl && !amtEl.value) amtEl.value = extracted.amount;
    }
    if (extracted.date) {
      items.push({ label: 'Fecha', value: formatDate(extracted.date) });
      const dtEl = $('#gasto-date');
      if (dtEl && (!dtEl.value || dtEl.value === today())) dtEl.value = extracted.date;
    }
    if (extracted.rut) items.push({ label: 'RUT/Doc', value: extracted.rut });
    if (extracted.total_label) items.push({ label: 'Texto', value: extracted.total_label });
    if (items.length > 0) {
      $('#ocr-result-body').innerHTML = items.map(i =>
        `<div class="ocr-detected-item"><span class="ocr-detected-label">${i.label}:</span><span>${escHtml(i.value)}</span></div>`
      ).join('');
      result.classList.remove('hidden');
    } else {
      showToast('No se detectaron datos. Completa los campos manualmente.', 'info');
    }
  } catch (err) {
    status.classList.add('hidden');
    showToast('Error al analizar la imagen', 'error');
    console.error('OCR error:', err);
  }
}

function extractReceiptData(text) {
  const result = {};
  const totalPatterns = [
    /(?:total|importe|monto|subtotal|pagar)[:\s$]*([\d]{1,3}(?:[.,]\d{3})+(?:[.,]\d{0,2})?)/gi,
    /\$\s*([\d]{1,3}(?:\.\d{3})+)/g,
    /([\d]{4,7})/g,
  ];
  for (const pat of totalPatterns) {
    const matches = [...text.matchAll(pat)];
    if (matches.length) {
      const best = matches[matches.length - 1][1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(best);
      if (num > 100 && num < 50000000) { result.amount = Math.round(num); break; }
    }
  }
  const dateMatch = text.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/) ||
    text.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
  if (dateMatch) {
    const parts = dateMatch[0].split(/[\/\-]/);
    result.date = parts[0].length === 4
      ? `${parts[0]}-${parts[1]}-${parts[2]}`
      : `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const rutMatch = text.match(/\d{1,2}\.\d{3}\.\d{3}-[\dkK]/);
  if (rutMatch) result.rut = rutMatch[0];
  const totalLineMatch = text.match(/(?:total|subtotal)[^\n]{0,40}/i);
  if (totalLineMatch) result.total_label = totalLineMatch[0].trim().slice(0, 50);
  return result;
}

// ── TABS ──────────────────────────────────────────────────────
function activateTab(tabId) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  $$('.tab-content').forEach(c => { c.classList.toggle('hidden', c.id !== tabId); c.classList.toggle('active', c.id === tabId); });
  if (tabId === 'tab-resumen' && APP.currentProjectId) {
    setTimeout(async () => {
      const projects = await getProjects();
      const p = projects.find(pr => pr.id === APP.currentProjectId);
      if (p) initProjectMap(p);
    }, 100);
  }
}

// ── ADMIN PANEL ───────────────────────────────────────────────
async function renderAdminPanel() {
  const users = await getUsers();
  const projects = await getProjects();
  const tbody = $('#users-table-body');

  if (!tbody) return;

  tbody.innerHTML = users.map(u => {
    let roleLabel = 'Visualizador';
    if (u.role === 'admin') roleLabel = 'Administrador';
    else if (u.role === 'normal') roleLabel = 'Normal';

    const accessLabels = (u.access || []).map(a => {
      const cat = CATEGORIES[a];
      return cat ? `<span class="cat-badge ${a}" style="margin-right:4px">${cat.icon} ${cat.label}</span>` : a;
    }).join('');
    const isDefault = u.id === 'admin-default';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${escHtml(u.name)}</td>
      <td style="font-family:monospace;font-size:13px">${escHtml(u.username)}</td>
      <td><span class="role-badge ${u.role}">${roleLabel}</span></td>
      <td style="font-size:13px">${accessLabels}</td>
      <td><div class="td-actions">
        <button class="btn btn-sm btn-ghost" onclick="openChangePassModal('${u.id}')">Cambiar Clave</button>
        <button class="btn btn-sm btn-secondary" onclick="openUserModal('${u.id}')">Editar</button>
        ${!isDefault ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');

  // System info
  const [allGastos, allFiles, allComments] = await Promise.all([getGastos(), getFiles(), getComments()]);
  const sysInfo = [
    { label: 'Total usuarios', value: users.length },
    { label: 'Total proyectos', value: projects.length },
    { label: 'Proyectos Legales', value: projects.filter(p => p.category === 'legal').length },
    { label: 'Proyectos Inmobi.', value: projects.filter(p => p.category === 'inmobiliario').length },
    { label: 'Gastos registrados', value: allGastos.length },
    { label: 'Archivos adjuntos', value: allFiles.length },
    { label: 'Comentarios', value: allComments.length },
  ];
  $('#admin-sys-info').innerHTML = sysInfo.map(i => `<div class="info-item"><span class="info-label">${i.label}</span><span class="info-value" style="font-weight:700">${i.value}</span></div>`).join('');
}

// ── USER MODAL ────────────────────────────────────────────────
async function openUserModal(userId = null) {
  APP.editingUserId = userId;
  const err = $('#user-form-error');
  err.classList.add('hidden');

  if (userId) {
    const users = await getUsers();
    const u = users.find(u => u.id === userId);
    if (!u) return;
    $('#modal-user-title').textContent = 'Editar Usuario';
    $('#user-name').value = u.name || '';
    $('#user-username').value = u.username || '';
    $('#user-role').value = u.role || 'visualizador';
    $('#user-access-legal').checked = (u.access || []).includes('legal');
    $('#user-access-inmobiliario').checked = (u.access || []).includes('inmobiliario');
    $('#user-password').value = '';
    $('#user-password2').value = '';
    // Password optional when editing
    $('#user-password').required = false;
    $('#user-password2').required = false;
    const lbl = document.querySelector('label[for="user-password"]');
    const lbl2 = document.querySelector('label[for="user-password2"]');
    if (lbl) lbl.textContent = 'Nueva Contraseña (dejar en blanco para no cambiar)';
    if (lbl2) lbl2.textContent = 'Confirmar nueva (si aplica)';
  } else {
    $('#modal-user-title').textContent = 'Nuevo Usuario';
    $('#user-name').value = '';
    $('#user-username').value = '';
    $('#user-role').value = 'visualizador';
    $('#user-access-legal').checked = true;
    $('#user-access-inmobiliario').checked = true;
    $('#user-password').value = '';
    $('#user-password2').value = '';
    const lbl = document.querySelector('label[for="user-password"]');
    const lbl2 = document.querySelector('label[for="user-password2"]');
    if (lbl) lbl.textContent = 'Contraseña *';
    if (lbl2) lbl2.textContent = 'Confirmar *';
  }
  $('#modal-user').classList.remove('hidden');
}

function closeUserModal() { $('#modal-user').classList.add('hidden'); APP.editingUserId = null; }

async function saveUser() {
  const name = $('#user-name').value.trim();
  const username = $('#user-username').value.trim().toLowerCase();
  const role = $('#user-role').value;
  const pass = $('#user-password').value;
  const pass2 = $('#user-password2').value;
  const access = [];
  if ($('#user-access-legal').checked) access.push('legal');
  if ($('#user-access-inmobiliario').checked) access.push('inmobiliario');

  const err = $('#user-form-error');
  const show = (msg) => { err.textContent = msg; err.classList.remove('hidden'); };

  if (!name || !username) { show('Nombre y usuario son obligatorios'); return; }
  if (!access.length) { show('Selecciona al menos un acceso de categoría'); return; }

  const users = await getUsers();

  if (APP.editingUserId) {
    if (pass && pass !== pass2) { show('Las contraseñas no coinciden'); return; }
    if (users.some(u => u.username === username && u.id !== APP.editingUserId)) { show('Ese nombre de usuario ya existe'); return; }
    const u = { ...users.find(u => u.id === APP.editingUserId), name, username, role, access };
    if (pass) u.password = await hashPassword(pass);
    await upsertUser(u);
    showToast('Usuario actualizado', 'success');
  } else {
    if (!pass) { show('La contraseña es obligatoria'); return; }
    if (pass !== pass2) { show('Las contraseñas no coinciden'); return; }
    if (users.some(u => u.username === username)) { show('Ese nombre de usuario ya existe'); return; }
    await upsertUser({ id: uid(), name, username, role, access, password: await hashPassword(pass), createdAt: new Date().toISOString() });
    showToast('Usuario creado', 'success');
  }

  err.classList.add('hidden');
  closeUserModal();
  renderAdminPanel();
}

async function deleteUser(id) {
  if (id === 'admin-default') { showToast('No se puede eliminar el admin principal', 'error'); return; }
  if (!confirm('¿Eliminar este usuario?')) return;
  await deleteUserById(id);
  showToast('Usuario eliminado', 'info');
  renderAdminPanel();
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
function openChangePassModal(userId) {
  APP.changingPassUserId = userId;
  $('#chpass-new').value = '';
  $('#chpass-confirm').value = '';
  $('#chpass-error').classList.add('hidden');
  $('#modal-change-pass').classList.remove('hidden');
}

function closeChangePassModal() { $('#modal-change-pass').classList.add('hidden'); APP.changingPassUserId = null; }

async function saveNewPassword() {
  const newPass = $('#chpass-new').value;
  const confirm2 = $('#chpass-confirm').value;
  const err = $('#chpass-error');

  if (!newPass) { err.textContent = 'Ingresa la nueva contraseña'; err.classList.remove('hidden'); return; }
  if (newPass !== confirm2) { err.textContent = 'Las contraseñas no coinciden'; err.classList.remove('hidden'); return; }
  if (newPass.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres'; err.classList.remove('hidden'); return; }

  const users = await getUsers();
  const u = users.find(u => u.id === APP.changingPassUserId);
  if (!u) return;
  u.password = await hashPassword(newPass);
  await upsertUser(u);
  err.classList.add('hidden');
  closeChangePassModal();
  showToast('Contraseña actualizada', 'success');
}

// ── COBRANZA ──────────────────────────────────────────────────
APP.cobTab = 'gastos'; // 'gastos' | 'cobros'

function switchCobTab(tab) {
  APP.cobTab = tab;
  $$('.cob-tab').forEach(t => t.classList.remove('active'));
  $(`#cob-tab-${tab}`)?.classList.add('active');
  $('#cob-panel-gastos').classList.toggle('hidden', tab !== 'gastos');
  $('#cob-panel-cobros').classList.toggle('hidden', tab !== 'cobros');
}

async function renderCobranza() {
  const user = getCurrentUser();
  if (user?.role !== 'admin') {
    showToast('Acceso denegado a Cobranza', 'error');
    showView('dashboard', 'Dashboard', null);
    return;
  }

  APP.currentView = 'cobranza';
  const currentUser = getCurrentUser();
  let [gastos, cobros, projects] = await Promise.all([getGastos(), getCobros(), getProjects()]);

  // Restrict list matching to standard logic
  if (currentUser?.role !== 'admin') {
    gastos = gastos.filter(g => g.userId === currentUser.id);
  }

  // Filter projects by current access (if the module checks access)
  const gastosTotal = gastos.reduce((s, g) => s + (g.amount || 0), 0);
  const gastosCobrado = gastos.filter(g => g.cobrado).reduce((s, g) => s + (g.amount || 0), 0);
  const gastosPending = gastosTotal - gastosCobrado;
  const cobrosPending = cobros.filter(c => c.status === 'pendiente' || c.status === 'vencido').reduce((s, c) => s + (c.amount || 0), 0);
  const cobrosPaid = cobros.filter(c => c.status === 'pagado').reduce((s, c) => s + (c.amount || 0), 0);

  $('#cob-gastos-pending').textContent = formatCLP(gastosPending);
  $('#cob-gastos-done').textContent = formatCLP(gastosCobrado);
  $('#cob-projects-pending').textContent = formatCLP(cobrosPending);
  $('#cob-projects-done').textContent = formatCLP(cobrosPaid);

  // Populate project filter in gastos tab
  const projFilter = $('#cob-filter-project');
  projFilter.innerHTML = '<option value="">Todos los proyectos</option>' +
    projects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  renderCobranzaGastos(gastos, projects);
  renderCobranzaCobros(cobros, projects);
}

function renderCobranzaGastos(gastos, projects) {
  const cobradoFilter = $('#cob-filter-cobrado').value;
  const projectFilter = $('#cob-filter-project').value;

  let items = gastos;
  if (projectFilter) items = items.filter(g => g.projectId === projectFilter);

  // Group by project + month
  const groupsTemp = {};
  items.forEach(g => {
    if (!g.date) return;
    const d = new Date(g.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const groupKey = `${g.projectId}_${monthKey}`;

    if (!groupsTemp[groupKey]) {
      const proj = projects.find(p => p.id === g.projectId);
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      groupsTemp[groupKey] = {
        projectId: g.projectId,
        projectName: proj ? proj.name : '—',
        monthStr: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        monthKey: monthKey, // raw sortable
        totalAmount: 0,
        gastosIds: [],
        allCobrados: true, // will be falsified if any is uncharged
        fechaCobro: null
      };
    }

    groupsTemp[groupKey].totalAmount += (g.amount || 0);
    groupsTemp[groupKey].gastosIds.push(g.id);
    if (!g.cobrado) groupsTemp[groupKey].allCobrados = false;
    else if (!groupsTemp[groupKey].fechaCobro && g.fechaCobro) {
      groupsTemp[groupKey].fechaCobro = g.fechaCobro; // take the first fecha cobro reported
    }
  });

  // Convert to array and filter by cobrado status
  let groups = Object.values(groupsTemp);
  if (cobradoFilter === 'true') groups = groups.filter(g => g.allCobrados);
  else if (cobradoFilter === 'false') groups = groups.filter(g => !g.allCobrados);

  // Sort by month (desc)
  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  const tbody = $('#cob-gastos-body');
  const empty = $('#cob-gastos-empty');
  const user = getCurrentUser();
  const canEdit = user?.role === 'admin' || user?.role === 'normal';

  if (!groups.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = groups.map(g => {
    const badge = g.allCobrados
      ? `<span class="cobro-badge cobro-badge-done">✓ Cobrado</span>`
      : `<span class="cobro-badge cobro-badge-pending">⏳ Por cobrar</span>`;
    const fechaCobro = g.fechaCobro ? formatDate(g.fechaCobro) : '—';
    const btnLabel = g.allCobrados ? 'Desmarcar' : 'Marcar Mes Cobrado';
    const btnClass = g.allCobrados ? 'btn-ghost' : 'btn-success';

    return `<tr class="${g.allCobrados ? 'row-cobrado' : ''}">
      <td style="font-weight:600">${escHtml(g.projectName)}</td>
      <td>${g.monthStr}</td>
      <td>${g.gastosIds.length} gasto(s)</td>
      <td><strong>${formatCLP(g.totalAmount)}</strong></td>
      <td>${badge}</td>
      <td>${fechaCobro}</td>
      <td><button class="btn btn-sm ${btnClass}" onclick='marcarMesCobrado(${JSON.stringify(g.gastosIds)}, ${!g.allCobrados})'>${btnLabel}</button></td>
    </tr>`;
  }).join('');
}

async function marcarMesCobrado(ids, cobrado) {
  const fechaCobro = cobrado ? today() : null;
  // Update all sequentially (or wait Promise.all if supported)
  await Promise.all(ids.map(id => updateGastoCobrado(id, cobrado, fechaCobro)));
  showToast(cobrado ? 'Mes cobrado ✓' : 'Mes devuelto a por cobrar', 'success');
  renderCobranza();
}

async function renderCobranzaCobros(cobros, projects) {
  const statusFilter = $('#cob-filter-status').value;
  let items = cobros;
  if (statusFilter) items = items.filter(c => c.status === statusFilter);

  // Auto-update vencidos
  const today_ = today();
  for (const c of items) {
    if (c.status === 'pendiente' && c.dueDate && c.dueDate < today_) {
      c.status = 'vencido';
      await upsertCobro(c);
    }
  }

  const tbody = $('#cob-cobros-body');
  const empty = $('#cob-cobros-empty');

  if (!items.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const statusBadge = {
    pendiente: '<span class="cobro-badge cobro-badge-pending">⏳ Pendiente</span>',
    pagado: '<span class="cobro-badge cobro-badge-done">✓ Pagado</span>',
    vencido: '<span class="cobro-badge cobro-badge-overdue">⚠ Vencido</span>',
  };

  tbody.innerHTML = items.map(c => {
    const proj = projects.find(p => p.id === c.projectId);
    const pagadoBtn = c.status !== 'pagado'
      ? `<button class="btn btn-sm btn-success" onclick="marcarCobroPagado('${c.id}')">Marcar Pagado</button>` : '';
    return `<tr>
      <td>${escHtml(proj?.name || '—')}</td>
      <td>${escHtml(c.concept)}</td>
      <td><strong>${formatCLP(c.amount)}</strong></td>
      <td>${c.dueDate ? formatDate(c.dueDate) : '—'}</td>
      <td>${statusBadge[c.status] || c.status}</td>
      <td>${c.paidDate ? formatDate(c.paidDate) : '—'}</td>
      <td><div class="td-actions">
        ${pagadoBtn}
        <button class="btn btn-sm btn-ghost" onclick="openCobroModal('${c.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCobro('${c.id}')">Eliminar</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function marcarCobroPagado(id) {
  const cobros = await getCobros();
  const c = cobros.find(c => c.id === id);
  if (!c) return;
  c.status = 'pagado';
  c.paidDate = today();
  await upsertCobro(c);
  showToast('Cobro marcado como pagado ✓', 'success');
  renderCobranza();
}

async function openCobroModal(id = null) {
  APP.editingCobroId = id;
  const projects = await getProjects();
  const sel = $('#cobro-project-id');
  sel.innerHTML = projects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  if (id) {
    const cobros = await getCobros();
    const c = cobros.find(c => c.id === id);
    if (!c) return;
    $('#modal-cobro-title').textContent = 'Editar Cobro';
    sel.value = c.projectId || '';
    $('#cobro-concept').value = c.concept || '';
    $('#cobro-amount').value = c.amount || '';
    $('#cobro-due-date').value = c.dueDate || '';
    $('#cobro-notes').value = c.notes || '';
  } else {
    $('#modal-cobro-title').textContent = 'Nuevo Cobro';
    $('#cobro-concept').value = '';
    $('#cobro-amount').value = '';
    $('#cobro-due-date').value = '';
    $('#cobro-notes').value = '';
  }
  $('#modal-cobro').classList.remove('hidden');
}

function closeCobroModal() { $('#modal-cobro').classList.add('hidden'); APP.editingCobroId = null; }

async function saveCobro() {
  const projectId = $('#cobro-project-id').value;
  const concept = $('#cobro-concept').value.trim();
  const amount = Number($('#cobro-amount').value);
  if (!concept) { showToast('El concepto es obligatorio', 'error'); return; }
  if (!amount) { showToast('El monto debe ser mayor a 0', 'error'); return; }
  if (!projectId) { showToast('Selecciona un proyecto', 'error'); return; }

  const data = {
    id: APP.editingCobroId || uid(),
    projectId, concept, amount,
    dueDate: $('#cobro-due-date').value || null,
    notes: $('#cobro-notes').value.trim() || null,
    status: APP.editingCobroId ? (await getCobros()).find(c => c.id === APP.editingCobroId)?.status || 'pendiente' : 'pendiente',
    createdAt: APP.editingCobroId ? undefined : new Date().toISOString(),
  };
  await upsertCobro(data);
  showToast(APP.editingCobroId ? 'Cobro actualizado' : 'Cobro registrado', 'success');
  closeCobroModal();
  renderCobranza();
}

async function deleteCobro(id) {
  if (!confirm('¿Eliminar este cobro?')) return;
  await deleteCobroById(id);
  showToast('Cobro eliminado', 'info');
  renderCobranza();
}

async function renderTaskCalendar(category, projectId = null) {
  const [tareas, projects] = await Promise.all([getTareas(), getProjects()]);

  // Filter tasks:
  let filtered = tareas;
  if (projectId) {
    filtered = filtered.filter(t => t.projectId === projectId);
  } else if (category) {
    const projIds = projects.filter(p => p.category === category).map(p => p.id);
    filtered = filtered.filter(t => projIds.includes(t.projectId));
  }

  const containerId = projectId ? '#project-task-calendar-grid' : '#task-calendar-grid';
  const titleId = projectId ? '#project-task-cal-title' : '#task-cal-title';
  const container = $(containerId);
  const title = $(titleId);
  if (!container || !title) return;


  const date = APP.calendarDate;
  const month = date.getMonth();
  const year = date.getFullYear();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  title.textContent = `${monthNames[month]} ${year}`;

  // Calendar logic
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay();
  if (startDay === 0) startDay = 7;
  startDay--;

  const daysInMonth = lastDay.getDate();
  const prevLastDay = new Date(year, month, 0).getDate();

  let html = '';

  for (let i = startDay; i > 0; i--) {
    const d = prevLastDay - i + 1;
    html += `<div class="calendar-day prev-month"><div class="calendar-day-num">${d}</div></div>`;
  }

  const todayStr = today();
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dStr === todayStr;
    const dayTasks = filtered.filter(t => t.dueDate === dStr);

    let taskHtml = dayTasks.map(t => {
      const p = projects.find(proj => proj.id === t.projectId);
      const catClass = p?.category || '';
      const compClass = t.status === 'completada' ? 'completada' : '';
      return `<button class="cal-task-item ${catClass} ${compClass}" onclick="event.stopPropagation();openTareaModal('${t.id}')" title="${escHtml(t.description)}">${escHtml(t.description)}</button>`;
    }).join('');

    html += `
      <div class="calendar-day ${isToday ? 'today' : ''}" onclick="APP.calendarDate = new Date('${dStr}'); openTareaModal();">
        <div class="calendar-day-num">${d}</div>
        <div class="calendar-tasks">${taskHtml}</div>
      </div>`;

  }

  const remaining = 42 - (startDay + daysInMonth);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-day next-month"><div class="calendar-day-num">${i}</div></div>`;
  }

  container.innerHTML = html;
}

// ── TAREAS (INMOBILIARIO) ───────────────────────────────────
APP.editingTareaId = null;

async function renderTareas(category) {
  const mode = APP.taskViewMode || 'table';
  $('#tareas-table-container')?.classList.toggle('hidden', mode !== 'table');
  $('#tareas-calendar-container')?.classList.toggle('hidden', mode !== 'calendar');

  // Sync UI buttons appearance
  $$('#tasks-view-toggle .btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

  if (mode === 'calendar') {
    return renderTaskCalendar(category);
  }


  let [tareas, projects, users] = await Promise.all([getTareas(), getProjects(), getUsers()]);

  if (category) {
    const projIds = projects.filter(p => p.category === category).map(p => p.id);
    tareas = tareas.filter(t => projIds.includes(t.projectId));
  }

  const tbody = $('#tareas-table-body');
  const empty = $('#tareas-empty');
  const statusFilter = $('#tareas-filter-status').value;

  if (statusFilter) {
    tareas = tareas.filter(t => t.status === statusFilter);
  }

  if (tareas.length === 0) {
    if (tbody) tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = tareas.map(t => {
    const p = projects.find(proj => proj.id === t.projectId);
    const u = users.find(usr => usr.id === t.userId);
    const pName = p ? p.name : 'Proyecto Desconocido';
    const uName = u ? u.name : 'Usuario Eliminado';

    // Check if task is overdue
    let isOverdue = false;
    if (t.status !== 'completada' && t.dueDate) {
      if (new Date(t.dueDate) < new Date(today())) isOverdue = true;
    }

    const badgeClass = t.status === 'completada' ? 'success' : isOverdue ? 'danger' : 'warning';
    const rowClass = t.status === 'completada' ? 'opacity: 0.6;' : '';

    return `<tr style="${rowClass}">
      <td><span class="badge ${badgeClass}">${t.status}</span></td>
      <td>${escHtml(t.description)}</td>
      <td onclick="openProjectDetail('${t.projectId}')" style="cursor:pointer; font-weight: 500;">${escHtml(pName)}</td>
      <td>${escHtml(uName)}</td>
      <td>${formatDate(t.dueDate)}</td>
      <td>
        <div class="td-actions">
          ${t.status !== 'completada' ? `<button class="btn btn-sm btn-ghost can-edit" onclick="completeTarea('${t.id}')">✓ Completar</button>` : `<button class="btn btn-sm btn-ghost can-edit" onclick="reopenTarea('${t.id}')">↻ Reabrir</button>`}
          <button class="btn btn-sm btn-secondary can-edit" onclick="openTareaModal('${t.id}')">Editar</button>
          <button class="btn btn-sm btn-danger can-edit" onclick="deleteTarea('${t.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function openTareaModal(id = null) {
  try {
    APP.editingTareaId = id;
    const modal = $('#modal-tarea');
    const title = $('#modal-tarea-title');
    const btn = $('#modal-tarea-save');

    const descField = $('#tarea-description');
    const dueField = $('#tarea-due-date');

    const [projects, users, tareas] = await Promise.all([getProjects(), getUsers(), getTareas()]);

    const projSelect = $('#tarea-proyecto');
    const filteredProjects = APP.currentCategory ? projects.filter(p => p.category === APP.currentCategory) : projects;
    projSelect.innerHTML = filteredProjects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

    const userSelect = $('#tarea-asignado');
    userSelect.innerHTML = users.map(u => `<option value="${u.id}">${escHtml(u.name)}</option>`).join('');

    if (id) {
      const t = tareas.find(ta => ta.id === id);
      if (!t) return;
      title.textContent = 'Editar Tarea';
      btn.textContent = 'Guardar Cambios';
      if (!filteredProjects.find(p => p.id === t.projectId)) {
        projSelect.innerHTML += `<option value="${t.projectId}" selected>${escHtml(projects.find(p => p.id === t.projectId)?.name || 'Desconocido')}</option>`;
      } else {
        projSelect.value = t.projectId;
      }
      descField.value = t.description;
      dueField.value = t.dueDate || today();
      userSelect.value = t.userId || '';
    } else {
      title.textContent = 'Nueva Tarea';
      btn.textContent = 'Crear Tarea';
      descField.value = '';
      dueField.value = today();
      userSelect.value = getCurrentUser()?.id || '';
    }

    modal.classList.remove('hidden');
    descField.focus();
  } catch (err) {
    console.error(err);
    showToast('Error al abrir: ' + err.message, 'error');
  }
}

function closeTareaModal() {
  $('#modal-tarea').classList.add('hidden');
  APP.editingTareaId = null;
}

async function saveTarea() {
  const projectId = $('#tarea-proyecto').value;
  const description = $('#tarea-description').value.trim();
  const userId = $('#tarea-asignado').value;
  const dueDate = $('#tarea-due-date').value;

  if (!projectId) { showToast('Selecciona un proyecto', 'error'); return; }
  if (!description) { showToast('Ingresa la descripción', 'error'); return; }
  if (!userId) { showToast('Debes asignar la tarea a una persona', 'error'); return; }
  if (!dueDate) { showToast('Selecciona la fecha límite', 'error'); return; }

  let status = 'pendiente';
  if (APP.editingTareaId) {
    const all = await getTareas();
    const existing = all.find(t => t.id === APP.editingTareaId);
    if (existing) status = existing.status;
  }

  const t = {
    id: APP.editingTareaId || uid(),
    projectId,
    userId,
    description,
    dueDate,
    status,
    createdAt: APP.editingTareaId ? undefined : new Date().toISOString(),
  };

  await upsertTarea(t);

  showToast(APP.editingTareaId ? 'Tarea actualizada' : 'Tarea creada', 'success');
  closeTareaModal();
  if (APP.currentView === 'project-detail') renderProjectTareas(APP.currentProjectId);
  else renderTareas(APP.currentCategory);
}

async function deleteTarea(id) {
  if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
  await deleteTareaById(id);
  showToast('Tarea eliminada', 'info');
  if (APP.currentView === 'project-detail') renderProjectTareas(APP.currentProjectId);
  else renderTareas(APP.currentCategory);
}

async function completeTarea(id) {
  const all = await getTareas();
  const t = all.find(ta => ta.id === id);
  if (t) {
    t.status = 'completada';
    await upsertTarea(t);
    showToast('Tarea completada 🎉', 'success');
    if (APP.currentView === 'project-detail') renderProjectTareas(APP.currentProjectId);
    else renderTareas(APP.currentCategory);
  }
}

async function reopenTarea(id) {
  const all = await getTareas();
  const t = all.find(ta => ta.id === id);
  if (t) {
    t.status = 'pendiente';
    await upsertTarea(t);
    showToast('Tarea reabierta', 'info');
    if (APP.currentView === 'project-detail') renderProjectTareas(APP.currentProjectId);
    else renderTareas(APP.currentCategory);
  }
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  await seedAdmin();

  // Escuchar sesión en tiempo real de Supabase (Microsoft Graph)
  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      // Evitar doble boot: onAuthStateChange puede dispararse con INITIAL_SESSION + SIGNED_IN
      if (APP.booted) return;

      const email = session.user.email;
      const name = session.user.user_metadata?.full_name || email.split('@')[0];

      let users = await getUsers();
      let dbUser = users.find(u => u.username.toLowerCase() === email.toLowerCase());

      // Auto-registrar usuario si no existe pero que haya pasado Azure
      if (!dbUser) {
        dbUser = {
          id: uid(),
          username: email,
          name: name,
          password: 'ms-oauth-user',
          role: 'normal',
          access: ['legal', 'inmobiliario']
        };
        await upsertUser(dbUser);
      }

      // Persistir provider_token (Microsoft Graph) si existe en la sesión
      if (session.provider_token) {
        APP.msToken = session.provider_token; // Cache en memoria
        localStorage.setItem('ms_graph_token', session.provider_token);
      }

      APP.booted = true;
      setCurrentUser(dbUser);
      bootApp(dbUser);
    } else {
      // No hay sesión
      APP.booted = false;
      clearSession();
      const shell = $('#app-shell');
      const login = $('#login-screen');
      if (shell) shell.classList.add('hidden');
      if (login) login.classList.remove('hidden');
    }
  });

  // Login
  const btnMs = $('#btn-login-microsoft');
  if (btnMs) btnMs.addEventListener('click', doLoginMicrosoft);

  // Logout
  $('#btn-logout')?.addEventListener('click', doLogout);

  // Sidebar toggle (mobile)
  $('#sidebar-toggle')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // Sidebar nav items (with category)
  $$('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      const cat = item.dataset.category || null;
      const titles = { dashboard: 'Dashboard', pipeline: 'Pipeline', projects: 'Proyectos', admin: 'Administrador' };
      showView(view, titles[view] || view, cat);
    });
  });

  // Nav group toggle
  $$('.nav-group-header').forEach(btn => {
    btn.addEventListener('click', () => toggleNavGroup(btn.dataset.group));
  });

  // New Project
  $('#btn-new-project')?.addEventListener('click', () => openProjectModal());

  // Project modal
  $('#modal-project-close')?.addEventListener('click', closeProjectModal);
  $('#modal-project-cancel')?.addEventListener('click', closeProjectModal);
  $('#modal-project-save')?.addEventListener('click', saveProject);
  $('#modal-project')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeProjectModal(); });


  // Back button
  $('#btn-back')?.addEventListener('click', () => {
    const cat = APP.currentCategory;
    const title = cat && CATEGORIES[cat] ? CATEGORIES[cat].label : 'Proyectos';
    showView('projects', title, cat);
  });

  // Edit/Delete project
  $('#btn-edit-project')?.addEventListener('click', () => openProjectModal(APP.currentProjectId));
  $('#btn-delete-project')?.addEventListener('click', () => deleteProject(APP.currentProjectId));

  // Tabs
  $$('.tab-btn').forEach(btn => btn?.addEventListener('click', () => activateTab(btn.dataset.tab)));

  // Location modal
  $('#btn-edit-location')?.addEventListener('click', openLocationModal);
  $('#modal-location-close')?.addEventListener('click', closeLocationModal);
  $('#modal-location-cancel')?.addEventListener('click', closeLocationModal);
  $('#modal-location-save')?.addEventListener('click', saveLocation);
  $('#btn-location-search')?.addEventListener('click', searchLocation);
  $('#location-search-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchLocation(); });
  $('#modal-location')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeLocationModal(); });

  // Comments
  $('#btn-add-comment')?.addEventListener('click', addComment);
  $('#comment-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); });

  // Files
  $('#file-upload-input')?.addEventListener('change', (e) => handleFileUpload(e.target));

  // Gastos — project detail
  $('#btn-add-gasto')?.addEventListener('click', () => openGastoModal());
  $('#modal-gasto-close')?.addEventListener('click', closeGastoModal);
  $('#modal-gasto-cancel')?.addEventListener('click', closeGastoModal);
  $('#modal-gasto-save')?.addEventListener('click', saveGasto);
  $('#modal-gasto')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGastoModal(); });
  $('#gasto-filter-cat')?.addEventListener('change', (e) => renderGastos(APP.currentProjectId, e.target.value));
  $('#btn-export-gastos')?.addEventListener('click', exportGastosCSV);

  // Gastos — global view
  $('#btn-gg-add-gasto')?.addEventListener('click', () => openGastoModal());
  $('#gg-filter-project')?.addEventListener('change', () => renderGastosGlobal(APP.currentCategory));
  $('#gg-filter-cat')?.addEventListener('change', () => renderGastosGlobal(APP.currentCategory));
  $('#btn-gg-export')?.addEventListener('click', exportGastosGlobal);

  // Receipt upload: button + drag & drop
  $('#btn-select-receipt')?.addEventListener('click', () => $('#receipt-file-input').click());
  $('#receipt-file-input')?.addEventListener('change', (e) => { if (e.target.files[0]) handleReceiptUpload(e.target.files[0]); e.target.value = ''; });
  $('#receipt-upload-area')?.addEventListener('click', (e) => { if (e.target === e.currentTarget || e.target.closest('#receipt-placeholder')) $('#receipt-file-input').click(); });
  $('#receipt-upload-area')?.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
  $('#receipt-upload-area')?.addEventListener('dragleave', (e) => { e.currentTarget.classList.remove('dragover'); });
  $('#receipt-upload-area')?.addEventListener('drop', (e) => {
    e.preventDefault(); e.currentTarget.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleReceiptUpload(f);
  });
  $('#btn-remove-receipt')?.addEventListener('click', () => { APP.receiptDataUrl = null; resetReceiptUI(); });

  // Project search & filters
  const updateProjectsFilter = () => renderProjectsTable(APP.currentCategory, $('#project-search')?.value || '');
  $('#project-search')?.addEventListener('input', updateProjectsFilter);
  $('#filter-project-category')?.addEventListener('change', updateProjectsFilter);
  $('#filter-project-subcategory')?.addEventListener('change', updateProjectsFilter);
  $('#filter-project-stage')?.addEventListener('change', updateProjectsFilter);
  $('#filter-project-client')?.addEventListener('change', updateProjectsFilter);

  // Ideas search & modal
  $('#ideas-search')?.addEventListener('input', (e) => renderIdeasTable(e.target.value));
  $('#btn-new-idea')?.addEventListener('click', () => openIdeaModal());
  $('#modal-idea-close')?.addEventListener('click', closeIdeaModal);
  $('#modal-idea-cancel')?.addEventListener('click', closeIdeaModal);
  $('#modal-idea-save')?.addEventListener('click', saveIdea);
  $('#modal-idea')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeIdeaModal(); });

  // Admin — User modal
  $('#btn-add-user').addEventListener('click', () => openUserModal());
  $('#modal-user-close').addEventListener('click', closeUserModal);
  $('#modal-user-cancel').addEventListener('click', closeUserModal);
  $('#modal-user-save').addEventListener('click', saveUser);
  $('#modal-user').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeUserModal(); });

  // Admin — Change password modal
  $('#modal-chpass-close').addEventListener('click', closeChangePassModal);
  $('#modal-chpass-cancel').addEventListener('click', closeChangePassModal);
  $('#modal-chpass-save').addEventListener('click', saveNewPassword);
  $('#modal-change-pass').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeChangePassModal(); });

  // Dashboard stat cards → navigate to that category's pipeline
  $$('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      if (cat) showView('pipeline', 'Pipeline', cat);
    });
  });

  // Clientes
  $('#btn-add-client')?.addEventListener('click', () => openClientModal());
  $('#modal-client-close')?.addEventListener('click', closeClientModal);
  $('#modal-client-cancel')?.addEventListener('click', closeClientModal);
  $('#modal-client-save')?.addEventListener('click', saveClient);
  $('#modal-client')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeClientModal(); });

  // Lightbox close
  $('#lightbox-close')?.addEventListener('click', closeLightbox);
  $('#lightbox')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeLightbox(); });

  // Bulk upload modal
  $('#btn-gg-bulk-upload')?.addEventListener('click', openBulkUploadModal);
  $('#modal-bulk-close')?.addEventListener('click', closeBulkUploadModal);
  $('#modal-bulk-cancel')?.addEventListener('click', closeBulkUploadModal);
  $('#modal-bulk-upload')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeBulkUploadModal(); });
  $('#btn-select-bulk')?.addEventListener('click', () => $('#bulk-file-input').click());
  $('#bulk-file-input')?.addEventListener('change', (e) => { if (e.target.files.length) processBulkFiles(e.target.files); e.target.value = ''; });

  // Bulk drag & drop
  const bulkDropZone = $('#bulk-drop-zone');
  if (bulkDropZone) {
    bulkDropZone.addEventListener('dragover', (e) => { e.preventDefault(); bulkDropZone.classList.add('dragover'); });
    bulkDropZone.addEventListener('dragleave', () => bulkDropZone.classList.remove('dragover'));
    bulkDropZone.addEventListener('drop', (e) => { e.preventDefault(); bulkDropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) processBulkFiles(e.dataTransfer.files); });
  }

  // Cobro modal
  $('#btn-add-cobro')?.addEventListener('click', () => openCobroModal());
  $('#modal-cobro-close')?.addEventListener('click', closeCobroModal);
  $('#modal-cobro-cancel')?.addEventListener('click', closeCobroModal);
  $('#modal-cobro-save')?.addEventListener('click', saveCobro);
  $('#modal-cobro')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeCobroModal(); });

  // Cobranza filters
  $('#cob-filter-cobrado')?.addEventListener('change', async () => {
    const [gastos, , projects] = await Promise.all([getGastos(), getCobros(), getProjects()]);
    renderCobranzaGastos(gastos, projects);
  });
  $('#cob-filter-project')?.addEventListener('change', async () => {
    const [gastos, , projects] = await Promise.all([getGastos(), getCobros(), getProjects()]);
    renderCobranzaGastos(gastos, projects);
  });
  $('#cob-filter-status')?.addEventListener('change', async () => {
    const [, cobros, projects] = await Promise.all([getGastos(), getCobros(), getProjects()]);
    renderCobranzaCobros(cobros, projects);
  });

  // Tareas
  $('#tasks-view-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    APP.taskViewMode = btn.dataset.mode;
    $$('#tasks-view-toggle .btn').forEach(b => b.classList.toggle('active', b === btn));
    renderTareas(APP.currentCategory);
  });
  $('#btn-task-cal-prev')?.addEventListener('click', () => {
    APP.calendarDate.setMonth(APP.calendarDate.getMonth() - 1);
    renderTaskCalendar(APP.currentCategory);
  });
  $('#btn-task-cal-next')?.addEventListener('click', () => {
    APP.calendarDate.setMonth(APP.calendarDate.getMonth() + 1);
    renderTaskCalendar(APP.currentCategory);
  });

  $('#btn-add-tarea')?.addEventListener('click', async () => {
    const btn = $('#btn-add-tarea');
    const originalText = btn.innerHTML;
    btn.textContent = 'Abriendo...';
    btn.style.opacity = '0.7';
    await openTareaModal();
    btn.innerHTML = originalText;
    btn.style.opacity = '1';
  });
  $('#btn-project-add-tarea')?.addEventListener('click', () => {
    openTareaModal();
    setTimeout(() => {
      const projSelect = $('#tarea-proyecto');
      if (projSelect) {
        if (!Array.from(projSelect.options).some(o => o.value === APP.currentProjectId)) {
          projSelect.innerHTML += `<option value="${APP.currentProjectId}" selected>Proyecto Actual</option>`;
        }
        projSelect.value = APP.currentProjectId;
      }
    }, 100);
  });
  $('#modal-tarea-close')?.addEventListener('click', closeTareaModal);
  $('#modal-tarea-cancel')?.addEventListener('click', closeTareaModal);
  $('#modal-tarea-save')?.addEventListener('click', saveTarea);
  $('#modal-tarea')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTareaModal(); });
  $('#tareas-filter-status')?.addEventListener('change', () => renderTareas(APP.currentCategory));

  // Project task view toggle
  $('#project-tasks-view-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    APP.taskViewMode = btn.dataset.mode;
    renderProjectTareas(APP.currentProjectId);
  });
  $('#btn-project-task-cal-prev')?.addEventListener('click', () => {
    APP.calendarDate.setMonth(APP.calendarDate.getMonth() - 1);
    renderProjectTareas(APP.currentProjectId);
  });
  $('#btn-project-task-cal-next')?.addEventListener('click', () => {
    APP.calendarDate.setMonth(APP.calendarDate.getMonth() + 1);
    renderProjectTareas(APP.currentProjectId);
  });

  // Billing Modal
  $('#modal-send-billing-close')?.addEventListener('click', closeSendBillingModal);
  $('#modal-send-billing-cancel')?.addEventListener('click', closeSendBillingModal);
  $('#modal-send-billing-confirm')?.addEventListener('click', saveBillingForm);
  $('#modal-send-billing')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSendBillingModal(); });

  $('#btn-send-billing-detail')?.addEventListener('click', () => {
    if (APP.currentProjectId) openSendBillingModal(APP.currentProjectId);
  });
}


document.addEventListener('DOMContentLoaded', init);
