CREATE TABLE IF NOT EXISTS public.box_types (
  value TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.box_types (value, label, sort_order)
VALUES
  ('caixa_media', 'Caixa Média', 1),
  ('caixa_preta', 'Caixa Preta', 2),
  ('caixa_grande', 'Caixa Grande', 3)
ON CONFLICT (value) DO NOTHING;

ALTER TABLE public.box_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.box_types;
CREATE POLICY "Allow all for authenticated" ON public.box_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.box_types IS
  'Catalog of embalagem vai-vem types. assets.type stores the value; label is the display name.';

NOTIFY pgrst, 'reload schema';
