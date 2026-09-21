-- Persisted column order for each kanban board.

CREATE TABLE IF NOT EXISTS public.kanban_column_orders (
  board_key TEXT PRIMARY KEY,
  column_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kanban_column_orders IS
  'Order of kanban columns per board (inventory SKUs, materials, ativos, embalagens, uniformes).';

ALTER TABLE public.kanban_column_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.kanban_column_orders;
CREATE POLICY "Allow all for authenticated"
  ON public.kanban_column_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kanban_column_orders TO authenticated;

NOTIFY pgrst, 'reload schema';
