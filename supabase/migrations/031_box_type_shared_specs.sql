ALTER TABLE public.box_types
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS unit_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC;

COMMENT ON COLUMN public.box_types.description IS
  'Shared description for every physical unit of this embalagem type.';
COMMENT ON COLUMN public.box_types.unit_capacity IS
  'Shared unit capacity for every physical unit of this embalagem type.';
COMMENT ON COLUMN public.box_types.length_cm IS
  'Shared outer length in cm for every unit of this embalagem type.';
COMMENT ON COLUMN public.box_types.width_cm IS
  'Shared outer width in cm for every unit of this embalagem type.';
COMMENT ON COLUMN public.box_types.height_cm IS
  'Shared outer height in cm for every unit of this embalagem type.';

UPDATE public.box_types bt
SET
  description = src.description,
  unit_capacity = src.unit_capacity,
  length_cm = src.length_cm,
  width_cm = src.width_cm,
  height_cm = src.height_cm,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (type)
    type,
    description,
    unit_capacity,
    length_cm,
    width_cm,
    height_cm
  FROM public.assets
  WHERE type IS NOT NULL
  ORDER BY type, updated_at DESC NULLS LAST, code
) src
WHERE bt.value = src.type;

UPDATE public.assets a
SET
  description = bt.description,
  unit_capacity = bt.unit_capacity,
  length_cm = bt.length_cm,
  width_cm = bt.width_cm,
  height_cm = bt.height_cm,
  dimensions = CASE
    WHEN bt.length_cm IS NULL AND bt.width_cm IS NULL AND bt.height_cm IS NULL THEN a.dimensions
    ELSE trim(both ' ×cm' FROM concat_ws(' × ',
      CASE WHEN bt.length_cm IS NULL THEN NULL ELSE trim(trailing '.' FROM trim(trailing '0' FROM bt.length_cm::text)) END,
      CASE WHEN bt.width_cm IS NULL THEN NULL ELSE trim(trailing '.' FROM trim(trailing '0' FROM bt.width_cm::text)) END,
      CASE WHEN bt.height_cm IS NULL THEN NULL ELSE trim(trailing '.' FROM trim(trailing '0' FROM bt.height_cm::text)) END
    )) || CASE
      WHEN bt.length_cm IS NULL AND bt.width_cm IS NULL AND bt.height_cm IS NULL THEN NULL
      ELSE ' cm'
    END
  END,
  updated_at = now()
FROM public.box_types bt
WHERE a.type = bt.value;

NOTIFY pgrst, 'reload schema';
