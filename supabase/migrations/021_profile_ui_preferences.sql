ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.ui_preferences IS
  'Preferências de interface do usuário (larguras de colunas das tabelas de gestão, etc.).';

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
