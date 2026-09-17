-- Outer measures of returnable boxes, registered in centimeters.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8,2);

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_length_cm_check;
ALTER TABLE assets ADD CONSTRAINT assets_length_cm_check
  CHECK (length_cm IS NULL OR length_cm > 0);

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_width_cm_check;
ALTER TABLE assets ADD CONSTRAINT assets_width_cm_check
  CHECK (width_cm IS NULL OR width_cm > 0);

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_height_cm_check;
ALTER TABLE assets ADD CONSTRAINT assets_height_cm_check
  CHECK (height_cm IS NULL OR height_cm > 0);

COMMENT ON COLUMN assets.length_cm IS 'Comprimento externo da embalagem, em centímetros.';
COMMENT ON COLUMN assets.width_cm IS 'Largura externa da embalagem, em centímetros.';
COMMENT ON COLUMN assets.height_cm IS 'Altura externa da embalagem, em centímetros.';
