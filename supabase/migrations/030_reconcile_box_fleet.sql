ALTER TABLE public.box_types
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.box_types.photo_url IS
  'Shared photo for every physical unit of this embalagem type.';

-- Drop leftover box codes. Keep CXF-001..068, CEI-001..072, CVF-001..020.
WITH extra AS (
  SELECT id
  FROM public.assets
  WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
    AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
    AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
    AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$'
)
UPDATE public.stock SET asset_id = NULL
WHERE asset_id IN (SELECT id FROM extra);

WITH extra AS (
  SELECT id
  FROM public.assets
  WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
    AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
    AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
    AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$'
)
UPDATE public.movements SET asset_id = NULL
WHERE asset_id IN (SELECT id FROM extra);

WITH extra AS (
  SELECT id
  FROM public.assets
  WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
    AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
    AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
    AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$'
)
UPDATE public.order_items SET asset_id = NULL
WHERE asset_id IN (SELECT id FROM extra);

WITH extra AS (
  SELECT id
  FROM public.assets
  WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
    AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
    AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
    AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$'
)
DELETE FROM public.equipment_reservations WHERE asset_id IN (SELECT id FROM extra);

WITH extra AS (
  SELECT id
  FROM public.assets
  WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
    AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
    AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
    AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$'
)
DELETE FROM public.asset_attachments WHERE asset_id IN (SELECT id FROM extra);

WITH extra AS (
  SELECT id
  FROM public.assets
  WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
    AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
    AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
    AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$'
)
DELETE FROM public.asset_components WHERE parent_asset_id IN (SELECT id FROM extra);

DELETE FROM public.assets
WHERE (category = 'embalagem' OR type IN ('caixa_preta', 'caixa_media', 'caixa_grande'))
  AND code !~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$'
  AND code !~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$'
  AND code !~ '^CVF-0(0[1-9]|1[0-9]|20)$';

UPDATE public.assets
SET
  name = 'Caixa p/ fábrica',
  category = 'embalagem',
  type = 'caixa_preta',
  is_active = true,
  updated_at = now()
WHERE code ~ '^CXF-0(0[1-9]|[1-5][0-9]|6[0-8])$';

UPDATE public.assets
SET
  name = 'Caixa estoque interno',
  category = 'embalagem',
  type = 'caixa_grande',
  is_active = true,
  updated_at = now()
WHERE code ~ '^CEI-0(0[1-9]|[1-6][0-9]|7[0-2])$';

UPDATE public.assets
SET
  name = 'Caixa vazada freezer',
  category = 'embalagem',
  type = 'caixa_media',
  is_active = true,
  status = CASE WHEN status IS NULL THEN 'available' ELSE status END,
  updated_at = now()
WHERE code ~ '^CVF-0(0[1-9]|1[0-9]|20)$';

INSERT INTO public.assets (
  code, name, type, category, location_id, status, is_active,
  unit_capacity, length_cm, width_cm, height_cm, control_method, quantity_on_hand
)
SELECT
  'CVF-' || lpad(n::text, 3, '0'),
  'Caixa vazada freezer',
  'caixa_media',
  'embalagem',
  'd3425557-49a5-4e30-b38d-6eabf4da38b8',
  'available',
  true,
  100,
  50,
  30,
  17,
  'individual',
  1
FROM generate_series(1, 20) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets a WHERE a.code = 'CVF-' || lpad(n::text, 3, '0')
);

INSERT INTO public.assets (
  code, name, type, category, location_id, status, is_active,
  unit_capacity, length_cm, width_cm, height_cm, control_method, quantity_on_hand
)
SELECT
  'CXF-' || lpad(n::text, 3, '0'),
  'Caixa p/ fábrica',
  'caixa_preta',
  'embalagem',
  '02d6fa97-8dce-4b67-b13e-8d315a0bbe2f',
  'available',
  true,
  400,
  55,
  36,
  30,
  'individual',
  1
FROM generate_series(1, 68) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets a WHERE a.code = 'CXF-' || lpad(n::text, 3, '0')
);

INSERT INTO public.assets (
  code, name, type, category, location_id, status, is_active,
  unit_capacity, length_cm, width_cm, height_cm, control_method, quantity_on_hand
)
SELECT
  'CEI-' || lpad(n::text, 3, '0'),
  'Caixa estoque interno',
  'caixa_grande',
  'embalagem',
  'f8edd535-266c-43c9-9f60-88bd8bf4bf2d',
  'available',
  true,
  100,
  48,
  30,
  17,
  'individual',
  1
FROM generate_series(1, 72) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets a WHERE a.code = 'CEI-' || lpad(n::text, 3, '0')
);

UPDATE public.box_types SET label = 'Caixa p/ fábrica', sort_order = 1, updated_at = now() WHERE value = 'caixa_preta';
UPDATE public.box_types SET label = 'Caixa estoque interno', sort_order = 2, updated_at = now() WHERE value = 'caixa_grande';
UPDATE public.box_types SET label = 'Caixa vazada freezer', sort_order = 3, updated_at = now() WHERE value = 'caixa_media';

INSERT INTO public.box_types (value, label, sort_order)
VALUES
  ('caixa_preta', 'Caixa p/ fábrica', 1),
  ('caixa_grande', 'Caixa estoque interno', 2),
  ('caixa_media', 'Caixa vazada freezer', 3)
ON CONFLICT (value) DO UPDATE
SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, updated_at = now();

DELETE FROM public.box_types
WHERE value NOT IN ('caixa_preta', 'caixa_grande', 'caixa_media');

UPDATE public.box_types bt
SET photo_url = src.photo_url, updated_at = now()
FROM (
  SELECT type, max(photo_url) AS photo_url
  FROM public.assets
  WHERE photo_url IS NOT NULL AND photo_url <> ''
  GROUP BY type
) src
WHERE bt.value = src.type;

UPDATE public.assets a
SET photo_url = bt.photo_url, updated_at = now()
FROM public.box_types bt
WHERE a.type = bt.value
  AND bt.photo_url IS NOT NULL
  AND coalesce(a.photo_url, '') IS DISTINCT FROM bt.photo_url;

NOTIFY pgrst, 'reload schema';
