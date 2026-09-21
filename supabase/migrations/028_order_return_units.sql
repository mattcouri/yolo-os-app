CREATE TABLE IF NOT EXISTS public.order_return_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  unit_index INTEGER NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('ok', 'cleaning', 'damaged', 'lost')),
  location_id UUID REFERENCES public.locations(id),
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, unit_index)
);

CREATE INDEX IF NOT EXISTS order_return_units_order_idx ON public.order_return_units (order_id);

ALTER TABLE public.order_return_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.order_return_units;
CREATE POLICY "Allow all for authenticated" ON public.order_return_units
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.order_return_units IS
  'Per-unit return conferência when closing a pedido, including damage photo and notes.';

NOTIFY pgrst, 'reload schema';
