-- How many product units a returnable box can hold.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS unit_capacity INTEGER;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_unit_capacity_check;
ALTER TABLE assets ADD CONSTRAINT assets_unit_capacity_check
  CHECK (unit_capacity IS NULL OR unit_capacity > 0);

COMMENT ON COLUMN assets.unit_capacity IS 'Capacidade da embalagem em unidades de produto.';

-- Documented default for medium shelf/freezer boxes.
UPDATE assets
SET unit_capacity = 100
WHERE type = 'caixa_media'
  AND unit_capacity IS NULL;
