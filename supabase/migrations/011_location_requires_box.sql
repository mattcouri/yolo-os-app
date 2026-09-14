-- Locations can hold pops without a medium box (kitchen freezer, trash staging, etc.)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS requires_box BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN locations.requires_box IS
  'When false, classified stock can sit loose at this location without a caixa média. Factory is not a stock location — empty pretas use asset status at_factory.';

UPDATE locations
SET requires_box = false
WHERE name ILIKE '%cozinha%';
