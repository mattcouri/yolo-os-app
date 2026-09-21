ALTER TABLE public.assets
  ALTER COLUMN type TYPE text USING type::text;

COMMENT ON COLUMN public.assets.type IS
  'Tipo do ativo. Embalagens vai-vem podem ter tipos cadastrados pelo usuário; cada unidade física continua com código único.';
