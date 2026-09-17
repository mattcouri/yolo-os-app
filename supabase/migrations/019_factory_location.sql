-- Reserved factory location for empty reusable boxes awaiting refill.

UPDATE locations
SET system_key = 'asset_factory',
    purpose = 'asset',
    requires_box = false,
    is_active = true
WHERE system_key IS NULL
  AND (name ILIKE 'fábrica' OR name ILIKE 'fabrica')
  AND NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_factory');

INSERT INTO locations (name, type, is_active, sort_order, requires_box, system_key, purpose)
SELECT 'Fábrica', 'other', true, 102, false, 'asset_factory', 'asset'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_factory');

UPDATE assets
SET location_id = (
  SELECT id FROM locations WHERE system_key = 'asset_factory' LIMIT 1
),
    updated_at = now()
WHERE status = 'at_factory'
  AND location_id IS NULL
  AND EXISTS (SELECT 1 FROM locations WHERE system_key = 'asset_factory');
