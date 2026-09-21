-- House uniforms live in Área suja or Sala Trade; Na rua stays on uniform_checkouts.

CREATE TABLE IF NOT EXISTS uniform_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uniform_id UUID NOT NULL REFERENCES uniforms(id) ON DELETE CASCADE,
  size TEXT NOT NULL CHECK (size IN ('P', 'M', 'G', 'GG')),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (uniform_id, size, location_id)
);

CREATE INDEX IF NOT EXISTS idx_uniform_stock_uniform ON uniform_stock(uniform_id);

ALTER TABLE uniform_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON uniform_stock;
CREATE POLICY "Allow all for authenticated" ON uniform_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
