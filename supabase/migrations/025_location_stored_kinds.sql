-- Each stock room declares which item kinds it can hold.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS stored_kinds TEXT[] NOT NULL DEFAULT ARRAY['sku','material']::TEXT[];

UPDATE public.locations
SET stored_kinds = ARRAY['sku']::TEXT[]
WHERE system_key = 'assembled';

UPDATE public.locations
SET stored_kinds = ARRAY['embalagem']::TEXT[]
WHERE system_key = 'asset_factory';

UPDATE public.locations
SET stored_kinds = ARRAY['ativo','uniforme']::TEXT[]
WHERE purpose = 'asset'
  AND coalesce(system_key, '') <> 'asset_factory'
  AND name ~* 'sala\s*trade';

UPDATE public.locations
SET stored_kinds = ARRAY['ativo','embalagem','uniforme']::TEXT[]
WHERE purpose = 'asset'
  AND coalesce(system_key, '') <> 'asset_factory'
  AND name !~* 'sala\s*trade';

UPDATE public.locations
SET stored_kinds = ARRAY['sku','material']::TEXT[]
WHERE purpose = 'product'
  AND coalesce(system_key, '') <> 'assembled';

COMMENT ON COLUMN public.locations.stored_kinds IS
  'Kinds this room can hold: sku, material, embalagem, ativo, uniforme.';

NOTIFY pgrst, 'reload schema';
