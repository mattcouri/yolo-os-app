-- Operational assets (Ativos): equipment used to run the business.
-- Boxes (caixa_*) stay on the same assets table; extra fields are nullable for them.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS control_method TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sku_code TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS quantity_on_hand NUMERIC(12,3) NOT NULL DEFAULT 1;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS acquired_at DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS nf_number TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_until DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS useful_life_months INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS voltage TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS power_watts NUMERIC(10,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS plug_type TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS dimensions TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS capacity TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS operating_temp TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS handling_notes TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS specs TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_moved_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_maintenance_at DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS maintenance_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assets_control_method_check'
  ) THEN
    ALTER TABLE assets ADD CONSTRAINT assets_control_method_check
      CHECK (control_method IN ('individual', 'kit', 'quantity'));
  END IF;
END $$;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK (status IN (
  'available',
  'reserved',
  'in_use',
  'with_product',
  'empty_ready_return',
  'at_factory',
  'in_transit',
  'inspection',
  'returned_pending',
  'cleaning',
  'maintenance',
  'damaged',
  'incomplete',
  'lost',
  'written_off'
));

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_serial_unique
  ON assets (serial_number)
  WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_sku_unique
  ON assets (sku_code)
  WHERE sku_code IS NOT NULL AND btrim(sku_code) <> '';

UPDATE assets
SET category = CASE type
  WHEN 'freezer' THEN 'freezer'
  WHEN 'carrinho' THEN 'carrinho'
  WHEN 'cooler' THEN 'cooler'
  ELSE category
END
WHERE category IS NULL
  AND type IN ('freezer', 'carrinho', 'cooler');

CREATE TABLE IF NOT EXISTS asset_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  control_method TEXT NOT NULL DEFAULT 'quantity' CHECK (control_method IN ('individual', 'quantity')),
  component_code TEXT,
  replaceable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  photo_url TEXT,
  is_present BOOLEAN NOT NULL DEFAULT true,
  condition TEXT NOT NULL DEFAULT 'ok' CHECK (condition IN ('ok', 'missing', 'damaged', 'replaced')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_components_parent ON asset_components(parent_asset_id);

CREATE TABLE IF NOT EXISTS asset_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  caption TEXT,
  kind TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'document', 'serial', 'assembly', 'component', 'damage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_attachments_asset ON asset_attachments(asset_id);

ALTER TABLE asset_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON asset_components;
CREATE POLICY "Allow all for authenticated" ON asset_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON asset_attachments;
CREATE POLICY "Allow all for authenticated" ON asset_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-files', 'asset-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated asset files" ON storage.objects;
CREATE POLICY "Authenticated asset files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'asset-files')
  WITH CHECK (bucket_id = 'asset-files');

DROP POLICY IF EXISTS "Public read asset files" ON storage.objects;
CREATE POLICY "Public read asset files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'asset-files');
