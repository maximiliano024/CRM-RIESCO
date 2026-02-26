# CRM — Riesco & Asociados

Plataforma CRM para gestión de proyectos legales e inmobiliarios.

## ⚡ Configuración rápida

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New Project**
2. Ve a **SQL Editor** y ejecuta el script completo de `supabase-schema.sql` (ver abajo)
3. Ve a **Settings → API** y copia:
   - **Project URL**
   - **anon/public key**

4. Abre `config.js` y reemplaza los placeholders:
```js
const SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';
```

### 2. Schema SQL (ejecutar en Supabase SQL Editor)

```sql
create table projects (
  id text primary key, name text not null, client text not null,
  category text not null, stage text not null, value numeric default 0,
  date text, responsible text, address text, description text,
  lat numeric, lng numeric, created_at timestamptz default now()
);
create table clients (
  id text primary key, name text not null, rut text, email text,
  phone text, category text, address text, notes text,
  created_at timestamptz default now()
);
create table gastos (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  date text, category text, description text not null, amount numeric not null,
  voucher text, receipt_data_url text, created_at timestamptz default now()
);
create table comments (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  author text, text text not null, created_at timestamptz default now()
);
create table files (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  name text, size numeric, type text, data_url text,
  created_at timestamptz default now()
);
create table users (
  id text primary key, name text not null, username text unique not null,
  password text not null, role text default 'visualizador',
  access text[] default '{"legal","inmobiliario"}',
  created_at timestamptz default now()
);

-- RLS policies (acceso público con anon key)
alter table projects enable row level security;
alter table clients enable row level security;
alter table gastos enable row level security;
alter table comments enable row level security;
alter table files enable row level security;
alter table users enable row level security;

create policy "Allow all" on projects for all using (true) with check (true);
create policy "Allow all" on clients for all using (true) with check (true);
create policy "Allow all" on gastos for all using (true) with check (true);
create policy "Allow all" on comments for all using (true) with check (true);
create policy "Allow all" on files for all using (true) with check (true);
create policy "Allow all" on users for all using (true) with check (true);
```

### 3. Publicar en GitHub + Netlify

```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "CRM Riesco v1 con Supabase"
git remote add origin https://github.com/TU-USUARIO/crm-riesco.git
git push -u origin main
```

Luego en [netlify.com](https://netlify.com):
- **Add new site → Import from GitHub**
- Build command: (vacío) | Publish directory: `.`
- Deploy 🚀

La URL quedará como: `https://crm-riesco.netlify.app`

## 🔑 Credenciales por defecto

- **Usuario:** `admin`
- **Contraseña:** `admin1234`

> Cambia la contraseña en Panel de Administrador después del primer login.
