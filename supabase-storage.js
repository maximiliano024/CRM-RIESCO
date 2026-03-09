/* ============================================================
   SUPABASE STORAGE LAYER
   Reemplaza el localStorage anterior con llamadas async a Supabase.
   Todas las funciones devuelven Promises.
   ============================================================ */
'use strict';

// ── CACHE LAYER ──────────────────────────────────────────────
window.DB_CACHE = {
    projects: null, clients: null, gastos: null, cobros: null,
    comments: null, files: null, tareas: null, users: null, ideas: null
};

window.invalidateCache = (key) => {
    if (key && window.DB_CACHE[key] !== undefined) window.DB_CACHE[key] = null;
    else Object.keys(window.DB_CACHE).forEach(k => window.DB_CACHE[k] = null);
};

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
    const row = {
        id: p.id, name: p.name, client: p.client,
        category: p.category, stage: p.stage,
        subcategory: p.subcategory || null,
        value: p.value || 0, date: p.date || null,
        responsible: p.responsible || null, address: p.address || null,
        description: p.description || null, lat: p.lat || null, lng: p.lng || null,
        cover_data_url: p.coverDataUrl || null,
    };
    // Incluir created_at sólo cuando está disponible (nuevo proyecto)
    if (p.createdAt) row.created_at = p.createdAt;
    return row;
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
function rowToIdea(r) {
    return {
        id: r.id, title: r.title, category: r.category,
        contact: r.contact, description: r.description,
        createdAt: r.created_at,
    };
}
function ideaToRow(i) {
    const row = {
        id: i.id, title: i.title, category: i.category || null,
        contact: i.contact || null, description: i.description || null,
    };
    if (i.createdAt) row.created_at = i.createdAt;
    return row;
}


// ── RETRY HELPER ─────────────────────────────────────────────
// Reintenta una función async hasta `maxRetries` veces con backoff exponencial.
// Resuelve fallos intermitentes por red / timeout transitorio de Supabase.
async function fetchWithRetry(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            // Si Supabase devuelve error, lanzamos para que el catch lo capture
            if (result && result.error) {
                throw new Error(result.error.message || 'Supabase error');
            }
            return result;
        } catch (err) {
            console.warn(`fetchWithRetry attempt ${attempt}/${maxRetries} failed:`, err.message);
            if (attempt === maxRetries) throw err;
            // Espera exponencial: 1s, 2s, 4s…
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
        }
    }
}

// ── PROJECTS ──────────────────────────────────────────────────
async function getProjects(force = false) {
    if (!force && window.DB_CACHE.projects) return window.DB_CACHE.projects;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('projects').select('*').order('created_at', { ascending: false }));
        if (error) { console.error('getProjects:', error); return []; }
        window.DB_CACHE.projects = (data || []).map(rowToProject);
        return window.DB_CACHE.projects;
    } catch (err) { console.error('getProjects failed after retries:', err); return []; }
}

async function saveProjects(projects) {
    if (!projects.length) return;
    const { error } = await _supabase.from('projects').upsert(projects.map(projectToRow), { onConflict: 'id' });
    if (error) console.error('saveProjects:', error);
    window.DB_CACHE.projects = null;
}

async function upsertProject(p) {
    if (window.DB_CACHE.projects) {
        const idx = window.DB_CACHE.projects.findIndex(x => x.id === p.id);
        if (idx !== -1) window.DB_CACHE.projects[idx] = { ...window.DB_CACHE.projects[idx], ...p };
        else window.DB_CACHE.projects.unshift(p);
    }
    const { error } = await _supabase.from('projects').upsert(projectToRow(p), { onConflict: 'id' });
    if (error) { console.error('upsertProject:', error); window.DB_CACHE.projects = null; return error; }
    return true;
}

async function updateProjectStage(id, stage) {
    if (window.DB_CACHE.projects) {
        const p = window.DB_CACHE.projects.find(x => x.id === id);
        if (p) p.stage = stage;
    }
    const { error } = await _supabase.from('projects').update({ stage }).eq('id', id);
    if (error) { console.error('updateProjectStage:', error); window.DB_CACHE.projects = null; return false; }
    return true;
}

async function deleteProjectById(id) {
    if (window.DB_CACHE.projects) {
        window.DB_CACHE.projects = window.DB_CACHE.projects.filter(x => x.id !== id);
    }
    // Cascade deletes gastos, comments, files via FK
    const { error } = await _supabase.from('projects').delete().eq('id', id);
    if (error) console.error('deleteProjectById:', error);
    window.DB_CACHE.gastos = null; window.DB_CACHE.comments = null; window.DB_CACHE.files = null;
}

// ── CLIENTS ───────────────────────────────────────────────────
async function getClients(force = false) {
    if (!force && window.DB_CACHE.clients) return window.DB_CACHE.clients;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('clients').select('*').order('created_at', { ascending: false }));
        if (error) { console.error('getClients:', error); return []; }
        window.DB_CACHE.clients = (data || []).map(rowToClient);
        return window.DB_CACHE.clients;
    } catch (err) { console.error('getClients failed after retries:', err); return []; }
}

async function upsertClient(c) {
    if (window.DB_CACHE.clients) {
        const idx = window.DB_CACHE.clients.findIndex(x => x.id === c.id);
        if (idx !== -1) window.DB_CACHE.clients[idx] = { ...window.DB_CACHE.clients[idx], ...c };
        else window.DB_CACHE.clients.unshift(c);
    }
    const { error } = await _supabase.from('clients').upsert(clientToRow(c), { onConflict: 'id' });
    if (error) { console.error('upsertClient:', error); window.DB_CACHE.clients = null; }
}

async function deleteClientById(id) {
    if (window.DB_CACHE.clients) {
        window.DB_CACHE.clients = window.DB_CACHE.clients.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('clients').delete().eq('id', id);
    if (error) { console.error('deleteClientById:', error); window.DB_CACHE.clients = null; }
}

// ── GASTOS ────────────────────────────────────────────────────
async function getGastos(force = false) {
    if (!force && window.DB_CACHE.gastos) return window.DB_CACHE.gastos;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('gastos').select('*').order('created_at', { ascending: false }));
        if (error) { console.error('getGastos:', error); return []; }
        window.DB_CACHE.gastos = (data || []).map(rowToGasto);
        return window.DB_CACHE.gastos;
    } catch (err) { console.error('getGastos failed after retries:', err); return []; }
}

async function upsertGasto(g) {
    if (window.DB_CACHE.gastos) {
        const idx = window.DB_CACHE.gastos.findIndex(x => x.id === g.id);
        if (idx !== -1) window.DB_CACHE.gastos[idx] = { ...window.DB_CACHE.gastos[idx], ...g };
        else window.DB_CACHE.gastos.unshift(g);
    }
    const { error } = await _supabase.from('gastos').upsert(gastoToRow(g), { onConflict: 'id' });
    if (error) { console.error('upsertGasto:', error); window.DB_CACHE.gastos = null; }
}

async function deleteGastoById(id) {
    if (window.DB_CACHE.gastos) {
        window.DB_CACHE.gastos = window.DB_CACHE.gastos.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('gastos').delete().eq('id', id);
    if (error) { console.error('deleteGastoById:', error); window.DB_CACHE.gastos = null; }
}

async function updateGastoStatus(id, status, reviewNote = null) {
    if (window.DB_CACHE.gastos) {
        const g = window.DB_CACHE.gastos.find(x => x.id === id);
        if (g) { g.status = status; g.reviewNote = reviewNote; }
    }
    const { error } = await _supabase.from('gastos').update({ status, review_note: reviewNote }).eq('id', id);
    if (error) { console.error('updateGastoStatus:', error); window.DB_CACHE.gastos = null; }
}

async function updateGastoCobrado(id, cobrado, fechaCobro = null) {
    if (window.DB_CACHE.gastos) {
        const g = window.DB_CACHE.gastos.find(x => x.id === id);
        if (g) { g.cobrado = cobrado; g.fechaCobro = fechaCobro; }
    }
    const { error } = await _supabase.from('gastos').update({ cobrado, fecha_cobro: fechaCobro }).eq('id', id);
    if (error) { console.error('updateGastoCobrado:', error); window.DB_CACHE.gastos = null; }
}

// Actualiza un campo individual de un gasto (para edición inline tipo Excel).
// field: nombre del campo en camelCase → se convierte a snake_case automáticamente.
const _camelToSnake = s => s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
async function updateGastoField(id, field, value) {
    if (window.DB_CACHE.gastos) {
        const g = window.DB_CACHE.gastos.find(x => x.id === id);
        if (g) g[field] = value;
    }
    const col = _camelToSnake(field);
    const { error } = await _supabase.from('gastos').update({ [col]: value }).eq('id', id);
    if (error) { console.error('updateGastoField:', error); window.DB_CACHE.gastos = null; return false; }
    return true;
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
async function getCobros(force = false) {
    if (!force && window.DB_CACHE.cobros) return window.DB_CACHE.cobros;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('cobros').select('*').order('created_at', { ascending: false }));
        if (error) { console.error('getCobros:', error); return []; }
        window.DB_CACHE.cobros = (data || []).map(rowToCobro);
        return window.DB_CACHE.cobros;
    } catch (err) { console.error('getCobros failed after retries:', err); return []; }
}
async function upsertCobro(c) {
    if (window.DB_CACHE.cobros) {
        const idx = window.DB_CACHE.cobros.findIndex(x => x.id === c.id);
        if (idx !== -1) window.DB_CACHE.cobros[idx] = { ...window.DB_CACHE.cobros[idx], ...c };
        else window.DB_CACHE.cobros.unshift(c);
    }
    const { error } = await _supabase.from('cobros').upsert(cobroToRow(c), { onConflict: 'id' });
    if (error) { console.error('upsertCobro:', error); window.DB_CACHE.cobros = null; }
}
async function deleteCobroById(id) {
    if (window.DB_CACHE.cobros) {
        window.DB_CACHE.cobros = window.DB_CACHE.cobros.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('cobros').delete().eq('id', id);
    if (error) { console.error('deleteCobroById:', error); window.DB_CACHE.cobros = null; }
}

// ── COMMENTS ─────────────────────────────────────────────────
async function getComments(force = false) {
    if (!force && window.DB_CACHE.comments) return window.DB_CACHE.comments;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('comments').select('*').order('created_at', { ascending: true }));
        if (error) { console.error('getComments:', error); return []; }
        window.DB_CACHE.comments = (data || []).map(rowToComment);
        return window.DB_CACHE.comments;
    } catch (err) { console.error('getComments failed after retries:', err); return []; }
}

async function upsertComment(c) {
    if (window.DB_CACHE.comments) {
        const idx = window.DB_CACHE.comments.findIndex(x => x.id === c.id);
        if (idx !== -1) window.DB_CACHE.comments[idx] = { ...window.DB_CACHE.comments[idx], ...c };
        else window.DB_CACHE.comments.push(c);
    }
    const { error } = await _supabase.from('comments').upsert(commentToRow(c), { onConflict: 'id' });
    if (error) { console.error('upsertComment:', error); window.DB_CACHE.comments = null; }
}

async function deleteCommentById(id) {
    if (window.DB_CACHE.comments) {
        window.DB_CACHE.comments = window.DB_CACHE.comments.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('comments').delete().eq('id', id);
    if (error) { console.error('deleteCommentById:', error); window.DB_CACHE.comments = null; }
}

// ── FILES ─────────────────────────────────────────────────────
async function uploadFileToStorage(projectId, fileId, fileObj) {
    const ext = fileObj.name.split('.').pop() || '';
    const path = `${projectId}/${fileId}.${ext}`;

    // Usa supabase storage
    const { data, error } = await _supabase.storage.from('archivos').upload(path, fileObj, {
        cacheControl: '3600',
        upsert: false
    });

    if (error) {
        console.error('uploadFileToStorage Error:', error);
        return null; // Devolvemos null si falla (archivos grandes/bucket sin configurar)
    }

    const { data: urlData } = _supabase.storage.from('archivos').getPublicUrl(path);
    return urlData.publicUrl;
}

async function getFiles(force = false) {
    if (!force && window.DB_CACHE.files) return window.DB_CACHE.files;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('files').select('*').order('created_at', { ascending: false }));
        if (error) { console.error('getFiles:', error); return []; }
        window.DB_CACHE.files = (data || []).map(rowToFile);
        return window.DB_CACHE.files;
    } catch (err) { console.error('getFiles failed after retries:', err); return []; }
}

async function upsertFile(f) {
    if (window.DB_CACHE.files) {
        const idx = window.DB_CACHE.files.findIndex(x => x.id === f.id);
        if (idx !== -1) window.DB_CACHE.files[idx] = { ...window.DB_CACHE.files[idx], ...f };
        else window.DB_CACHE.files.unshift(f);
    }
    const { error } = await _supabase.from('files').upsert(fileToRow(f), { onConflict: 'id' });
    if (error) { console.error('upsertFile:', error); window.DB_CACHE.files = null; }
}

async function deleteFileById(id) {
    if (window.DB_CACHE.files) {
        window.DB_CACHE.files = window.DB_CACHE.files.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('files').delete().eq('id', id);
    if (error) { console.error('deleteFileById:', error); window.DB_CACHE.files = null; }
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
async function getTareas(force = false) {
    if (!force && window.DB_CACHE.tareas) return window.DB_CACHE.tareas;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('tareas').select('*').order('due_date', { ascending: true }));
        if (error) { console.error('getTareas:', error); return []; }
        window.DB_CACHE.tareas = (data || []).map(rowToTarea);
        return window.DB_CACHE.tareas;
    } catch (err) { console.error('getTareas failed after retries:', err); return []; }
}
async function upsertTarea(t) {
    if (window.DB_CACHE.tareas) {
        const idx = window.DB_CACHE.tareas.findIndex(x => x.id === t.id);
        if (idx !== -1) window.DB_CACHE.tareas[idx] = { ...window.DB_CACHE.tareas[idx], ...t };
        else window.DB_CACHE.tareas.push(t);
    }
    const { error } = await _supabase.from('tareas').upsert(tareaToRow(t), { onConflict: 'id' });
    if (error) { console.error('upsertTarea:', error); window.DB_CACHE.tareas = null; }
}
async function deleteTareaById(id) {
    if (window.DB_CACHE.tareas) {
        window.DB_CACHE.tareas = window.DB_CACHE.tareas.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('tareas').delete().eq('id', id);
    if (error) { console.error('deleteTareaById:', error); window.DB_CACHE.tareas = null; }
}

// ── USERS ─────────────────────────────────────────────────────
async function getUsers(force = false) {
    if (!force && window.DB_CACHE.users) return window.DB_CACHE.users;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('users').select('*').order('created_at', { ascending: true }));
        if (error) { console.error('getUsers:', error); return []; }
        window.DB_CACHE.users = (data || []).map(rowToUser);
        return window.DB_CACHE.users;
    } catch (err) { console.error('getUsers failed after retries:', err); return []; }
}

async function upsertUser(u) {
    if (window.DB_CACHE.users) {
        const idx = window.DB_CACHE.users.findIndex(x => x.id === u.id);
        if (idx !== -1) window.DB_CACHE.users[idx] = { ...window.DB_CACHE.users[idx], ...u };
        else window.DB_CACHE.users.push(u);
    }
    const { error } = await _supabase.from('users').upsert(userToRow(u), { onConflict: 'id' });
    if (error) { console.error('upsertUser:', error); window.DB_CACHE.users = null; }
}

async function deleteUserById(id) {
    if (window.DB_CACHE.users) {
        window.DB_CACHE.users = window.DB_CACHE.users.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('users').delete().eq('id', id);
    if (error) { console.error('deleteUserById:', error); window.DB_CACHE.users = null; }
}

// ── IDEAS ─────────────────────────────────────────────────────
async function getIdeas(force = false) {
    if (!force && window.DB_CACHE.ideas) return window.DB_CACHE.ideas;
    try {
        const { data, error } = await fetchWithRetry(() => _supabase.from('ideas').select('*').order('created_at', { ascending: false }));
        if (error) { console.error('getIdeas:', error); return []; }
        window.DB_CACHE.ideas = (data || []).map(rowToIdea);
        return window.DB_CACHE.ideas;
    } catch (err) { console.error('getIdeas failed after retries:', err); return []; }
}

async function upsertIdea(i) {
    if (window.DB_CACHE.ideas) {
        const idx = window.DB_CACHE.ideas.findIndex(x => x.id === i.id);
        if (idx !== -1) window.DB_CACHE.ideas[idx] = { ...window.DB_CACHE.ideas[idx], ...i };
        else window.DB_CACHE.ideas.unshift(i);
    }
    const { error } = await _supabase.from('ideas').upsert(ideaToRow(i), { onConflict: 'id' });
    if (error) { console.error('upsertIdea:', error); window.DB_CACHE.ideas = null; return error; }
    return true;
}

async function deleteIdeaById(id) {
    if (window.DB_CACHE.ideas) {
        window.DB_CACHE.ideas = window.DB_CACHE.ideas.filter(x => x.id !== id);
    }
    const { error } = await _supabase.from('ideas').delete().eq('id', id);
    if (error) { console.error('deleteIdeaById:', error); window.DB_CACHE.ideas = null; return false; }
    return true;
}
// ── NOTIFICATIONS ──────────────────────────────────────────────
function rowToNotification(r) {
    return {
        id: r.id, title: r.title, message: r.message,
        userId: r.user_id || null, read: r.read || false,
        createdAt: r.created_at,
    };
}
function notificationToRow(n) {
    return {
        id: n.id, title: n.title, message: n.message,
        user_id: n.userId || null, read: n.read || false,
    };
}
async function createNotification(n) {
    const { error } = await _supabase.from('notifications').insert(notificationToRow(n));
    if (error) console.error('createNotification:', error);
}
async function getNotifications() {
    const { data, error } = await _supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getNotifications:', error); return []; }
    return (data || []).map(rowToNotification);
}
