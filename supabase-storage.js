/* ============================================================
   SUPABASE STORAGE LAYER
   Reemplaza el localStorage anterior con llamadas async a Supabase.
   Todas las funciones devuelven Promises.
   ============================================================ */
'use strict';

// ── HELPERS ──────────────────────────────────────────────────
// Convierte snake_case de Postgres → camelCase de la app
function rowToProject(r) {
    return {
        id: r.id, name: r.name, client: r.client,
        category: r.category, stage: r.stage,
        subcategory: r.subcategory || null,
        value: r.value, date: r.date,
        responsible: r.responsible, address: r.address,
        description: r.description, lat: r.lat, lng: r.lng,
        coverDataUrl: r.cover_data_url || null,
        createdAt: r.created_at,
    };
}
function projectToRow(p) {
    return {
        id: p.id, name: p.name, client: p.client,
        category: p.category, stage: p.stage,
        subcategory: p.subcategory || null,
        value: p.value || 0, date: p.date || null,
        responsible: p.responsible || null, address: p.address || null,
        description: p.description || null, lat: p.lat || null, lng: p.lng || null,
        cover_data_url: p.coverDataUrl || null,
    };
}
function rowToClient(r) {
    return {
        id: r.id, name: r.name, rut: r.rut, email: r.email,
        phone: r.phone, category: r.category, address: r.address,
        notes: r.notes, createdAt: r.created_at,
    };
}
function clientToRow(c) {
    return {
        id: c.id, name: c.name, rut: c.rut || null,
        email: c.email || null, phone: c.phone || null,
        category: c.category || null, address: c.address || null,
        notes: c.notes || null,
    };
}
function rowToGasto(r) {
    return {
        id: r.id, projectId: r.project_id, date: r.date,
        category: r.category, description: r.description,
        amount: r.amount, voucher: r.voucher,
        receiptDataUrl: r.receipt_data_url,
        userId: r.user_id || null,
        userName: r.user_name || null,
        status: r.status || 'aprobado',
        reviewNote: r.review_note || null,
        cobrado: r.cobrado || false,
        fechaCobro: r.fecha_cobro || null,
        createdAt: r.created_at,
    };
}
function gastoToRow(g) {
    const row = {
        id: g.id, project_id: g.projectId, date: g.date || null,
        category: g.category || null, description: g.description,
        amount: g.amount, voucher: g.voucher || null,
        receipt_data_url: g.receiptDataUrl || null,
        user_id: g.userId || null,
        user_name: g.userName || null,
        status: g.status || 'aprobado',
        review_note: g.reviewNote || null,
    };
    // cobrado / fecha_cobro se omiten del upsert general.
    // Se actualizan independientemente con updateGastoCobrado()
    // una vez que el SQL de la tabla gastos esté ejecutado en Supabase.
    return row;
}
function rowToComment(r) {
    return {
        id: r.id, projectId: r.project_id, author: r.author,
        text: r.text, createdAt: r.created_at,
    };
}
function commentToRow(c) {
    return {
        id: c.id, project_id: c.projectId, author: c.author || null,
        text: c.text,
    };
}
function rowToFile(r) {
    return {
        id: r.id, projectId: r.project_id, name: r.name,
        size: r.size, type: r.type, dataUrl: r.data_url,
        createdAt: r.created_at,
    };
}
function fileToRow(f) {
    return {
        id: f.id, project_id: f.projectId, name: f.name,
        size: f.size || null, type: f.type || null, data_url: f.dataUrl || null,
    };
}
function rowToUser(r) {
    return {
        id: r.id, name: r.name, username: r.username,
        password: r.password, role: r.role,
        access: r.access || ['legal', 'inmobiliario'],
        createdAt: r.created_at,
    };
}
function userToRow(u) {
    return {
        id: u.id, name: u.name, username: u.username,
        password: u.password, role: u.role,
        access: u.access || ['legal', 'inmobiliario'],
    };
}

// ── PROJECTS ──────────────────────────────────────────────────
async function getProjects() {
    const { data, error } = await _supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getProjects:', error); return []; }
    return (data || []).map(rowToProject);
}

async function saveProjects(projects) {
    // Upsert full list — más sencillo para mantener sincronía
    if (!projects.length) return;
    const { error } = await _supabase.from('projects').upsert(projects.map(projectToRow), { onConflict: 'id' });
    if (error) console.error('saveProjects:', error);
}

async function upsertProject(p) {
    const { error } = await _supabase.from('projects').upsert(projectToRow(p), { onConflict: 'id' });
    if (error) console.error('upsertProject:', error);
}

async function deleteProjectById(id) {
    // Cascade deletes gastos, comments, files via FK
    const { error } = await _supabase.from('projects').delete().eq('id', id);
    if (error) console.error('deleteProjectById:', error);
}

// ── CLIENTS ───────────────────────────────────────────────────
async function getClients() {
    const { data, error } = await _supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getClients:', error); return []; }
    return (data || []).map(rowToClient);
}

async function upsertClient(c) {
    const { error } = await _supabase.from('clients').upsert(clientToRow(c), { onConflict: 'id' });
    if (error) console.error('upsertClient:', error);
}

async function deleteClientById(id) {
    const { error } = await _supabase.from('clients').delete().eq('id', id);
    if (error) console.error('deleteClientById:', error);
}

// ── GASTOS ────────────────────────────────────────────────────
async function getGastos() {
    const { data, error } = await _supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getGastos:', error); return []; }
    return (data || []).map(rowToGasto);
}

async function upsertGasto(g) {
    const { error } = await _supabase.from('gastos').upsert(gastoToRow(g), { onConflict: 'id' });
    if (error) console.error('upsertGasto:', error);
}

async function deleteGastoById(id) {
    const { error } = await _supabase.from('gastos').delete().eq('id', id);
    if (error) console.error('deleteGastoById:', error);
}

async function updateGastoStatus(id, status, reviewNote = null) {
    const { error } = await _supabase.from('gastos')
        .update({ status, review_note: reviewNote })
        .eq('id', id);
    if (error) console.error('updateGastoStatus:', error);
}

async function updateGastoCobrado(id, cobrado, fechaCobro = null) {
    const { error } = await _supabase.from('gastos')
        .update({ cobrado, fecha_cobro: fechaCobro })
        .eq('id', id);
    if (error) console.error('updateGastoCobrado:', error);
}

// ── COBROS ──────────────────────────────────────────────
function rowToCobro(r) {
    return {
        id: r.id, projectId: r.project_id,
        concept: r.concept, amount: r.amount,
        dueDate: r.due_date, paidDate: r.paid_date,
        status: r.status || 'pendiente',
        notes: r.notes || null,
        createdAt: r.created_at,
    };
}
function cobroToRow(c) {
    return {
        id: c.id, project_id: c.projectId,
        concept: c.concept, amount: c.amount,
        due_date: c.dueDate || null, paid_date: c.paidDate || null,
        status: c.status || 'pendiente',
        notes: c.notes || null,
    };
}
async function getCobros() {
    const { data, error } = await _supabase.from('cobros').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getCobros:', error); return []; }
    return (data || []).map(rowToCobro);
}
async function upsertCobro(c) {
    const { error } = await _supabase.from('cobros').upsert(cobroToRow(c), { onConflict: 'id' });
    if (error) console.error('upsertCobro:', error);
}
async function deleteCobroById(id) {
    const { error } = await _supabase.from('cobros').delete().eq('id', id);
    if (error) console.error('deleteCobroById:', error);
}

// ── COMMENTS ─────────────────────────────────────────────────
async function getComments() {
    const { data, error } = await _supabase.from('comments').select('*').order('created_at', { ascending: true });
    if (error) { console.error('getComments:', error); return []; }
    return (data || []).map(rowToComment);
}

async function upsertComment(c) {
    const { error } = await _supabase.from('comments').upsert(commentToRow(c), { onConflict: 'id' });
    if (error) console.error('upsertComment:', error);
}

async function deleteCommentById(id) {
    const { error } = await _supabase.from('comments').delete().eq('id', id);
    if (error) console.error('deleteCommentById:', error);
}

// ── FILES ─────────────────────────────────────────────────────
async function getFiles() {
    const { data, error } = await _supabase.from('files').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getFiles:', error); return []; }
    return (data || []).map(rowToFile);
}

async function upsertFile(f) {
    const { error } = await _supabase.from('files').upsert(fileToRow(f), { onConflict: 'id' });
    if (error) console.error('upsertFile:', error);
}

async function deleteFileById(id) {
    const { error } = await _supabase.from('files').delete().eq('id', id);
    if (error) console.error('deleteFileById:', error);
}

// ── TAREAS ──────────────────────────────────────────────────
function rowToTarea(r) {
    return {
        id: r.id, projectId: r.project_id, userId: r.user_id,
        description: r.description, dueDate: r.due_date,
        status: r.status || 'pendiente', createdAt: r.created_at,
    };
}
function tareaToRow(t) {
    return {
        id: t.id, project_id: t.projectId, user_id: t.userId,
        description: t.description, due_date: t.dueDate,
        status: t.status || 'pendiente',
    };
}
async function getTareas() {
    const { data, error } = await _supabase.from('tareas').select('*').order('due_date', { ascending: true });
    if (error) { console.error('getTareas:', error); return []; }
    return (data || []).map(rowToTarea);
}
async function upsertTarea(t) {
    const { error } = await _supabase.from('tareas').upsert(tareaToRow(t), { onConflict: 'id' });
    if (error) console.error('upsertTarea:', error);
}
async function deleteTareaById(id) {
    const { error } = await _supabase.from('tareas').delete().eq('id', id);
    if (error) console.error('deleteTareaById:', error);
}

// ── USERS ─────────────────────────────────────────────────────
async function getUsers() {
    const { data, error } = await _supabase.from('users').select('*').order('created_at', { ascending: true });
    if (error) { console.error('getUsers:', error); return []; }
    return (data || []).map(rowToUser);
}

async function upsertUser(u) {
    const { error } = await _supabase.from('users').upsert(userToRow(u), { onConflict: 'id' });
    if (error) console.error('upsertUser:', error);
}

async function deleteUserById(id) {
    const { error } = await _supabase.from('users').delete().eq('id', id);
    if (error) console.error('deleteUserById:', error);
}
