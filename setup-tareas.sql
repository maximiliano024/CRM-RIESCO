create table public.tareas (
  id text primary key,
  project_id text,
  user_id text,
  description text not null,
  due_date text,
  status text default 'pendiente',
  created_at timestamp with time zone default now()
);

-- Habilitar RLS si es necesario
-- alter table public.tareas enable row level security;
-- create policy "Tareas son publicas" on public.tareas for all using (true);
