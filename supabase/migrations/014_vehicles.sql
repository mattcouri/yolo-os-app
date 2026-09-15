-- Fleet names used on Separação sheets. Operators create/edit/delete them in the vehicle dropdown.

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_name ON vehicles (name);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON vehicles;
CREATE POLICY "Allow all for authenticated" ON vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
