-- Configurar Supabase Storage para los archivos del CRM
-- 1. Crear el bucket 'archivos' si no existe
insert into storage.buckets (id, name, public) 
values ('archivos', 'archivos', true)
on conflict (id) do nothing;

-- 2. Habilitar leer de forma publica todos los archivos del bucket
create policy "Lectura pulblica archivos" 
on storage.objects for select 
using (bucket_id = 'archivos');

-- 3. Habilitar inserción (subir manual o por aplicación)
create policy "Subida archivos" 
on storage.objects for insert 
with check (bucket_id = 'archivos');

-- 4. Habilitar modificación
create policy "Update archivos" 
on storage.objects for update 
using (bucket_id = 'archivos');

-- 5. Habilitar eliminación de archivos
create policy "Delete archivos" 
on storage.objects for delete 
using (bucket_id = 'archivos');
