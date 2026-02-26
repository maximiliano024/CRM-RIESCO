/* ============================================================
   CONFIGURACIÓN DE SUPABASE
   ============================================================
   1. Ve a https://supabase.com → tu proyecto → Settings → API
   2. Copia "Project URL" y "anon/public key" y pégalos abajo
   ============================================================ */

const SUPABASE_URL = 'https://ntrfixcrwkppzycgcxde.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_frSD_dGzYZQyyQEVk5uP8w_vhS4yjet';

// Inicializar cliente Supabase (se usa en supabase-storage.js)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
