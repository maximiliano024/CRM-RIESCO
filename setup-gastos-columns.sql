-- Ejecuta esto en tu panel SQL Editor de Supabase
ALTER TABLE public.gastos 
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS user_name text;
