-- Ejecuta esto en tu panel SQL Editor de Supabase
ALTER TABLE public.gastos 
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'aprobado',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS cobrado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_cobro text;
