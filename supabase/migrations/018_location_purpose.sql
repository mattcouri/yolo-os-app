-- Split stock locations: product/assembled vs assets, uniforms, and boxes.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'product';

ALTER TABLE locations
  DROP CONSTRAINT IF EXISTS locations_purpose_check;

ALTER TABLE locations
  ADD CONSTRAINT locations_purpose_check CHECK (purpose IN ('product', 'asset'));

COMMENT ON COLUMN locations.purpose IS
  'product = SKUs and assembled goods; asset = equipment, uniforms, and boxes.';

UPDATE locations
SET purpose = 'asset'
WHERE system_key IN ('asset_dirty', 'asset_clean');

UPDATE locations
SET purpose = 'product'
WHERE system_key = 'assembled' OR purpose IS NULL;
