-- Uniform inventory: one record per shirt style, quantities by size.
-- Checkout/check-in is append-only so event orders reuse the same uniform record.

CREATE TABLE IF NOT EXISTS uniforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  photo_back_url TEXT,
  qty_p INTEGER NOT NULL DEFAULT 0 CHECK (qty_p >= 0),
  qty_m INTEGER NOT NULL DEFAULT 0 CHECK (qty_m >= 0),
  qty_g INTEGER NOT NULL DEFAULT 0 CHECK (qty_g >= 0),
  qty_gg INTEGER NOT NULL DEFAULT 0 CHECK (qty_gg >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uniform_checkouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uniform_id UUID NOT NULL REFERENCES uniforms(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  size TEXT NOT NULL CHECK (size IN ('P', 'M', 'G', 'GG')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'out' CHECK (status IN ('out', 'returned')),
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uniform_checkouts_uniform ON uniform_checkouts(uniform_id);
CREATE INDEX IF NOT EXISTS idx_uniform_checkouts_order ON uniform_checkouts(order_id);
CREATE INDEX IF NOT EXISTS idx_uniform_checkouts_open ON uniform_checkouts(uniform_id, size) WHERE status = 'out';

ALTER TABLE uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniform_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON uniforms;
CREATE POLICY "Allow all for authenticated" ON uniforms FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON uniform_checkouts;
CREATE POLICY "Allow all for authenticated" ON uniform_checkouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
