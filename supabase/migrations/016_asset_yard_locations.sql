-- Operational asset yard: dirty (to clean) vs clean (ready to reuse)

COMMENT ON COLUMN locations.system_key IS
  'Reserved system locations. assembled = montados shelf; asset_dirty = área suja; asset_clean = área limpa.';

UPDATE locations
SET system_key = 'asset_dirty',
    requires_box = false,
    is_active = true
WHERE system_key IS NULL
  AND (name ILIKE 'área suja' OR name ILIKE 'area suja')
  AND NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_dirty');

INSERT INTO locations (name, type, is_active, sort_order, requires_box, system_key)
SELECT 'Área suja', 'other', true, 100, false, 'asset_dirty'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_dirty');

UPDATE locations
SET system_key = 'asset_clean',
    requires_box = false,
    is_active = true
WHERE system_key IS NULL
  AND (name ILIKE 'área limpa' OR name ILIKE 'area limpa')
  AND NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_clean');

INSERT INTO locations (name, type, is_active, sort_order, requires_box, system_key)
SELECT 'Área limpa', 'other', true, 101, false, 'asset_clean'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_clean');
