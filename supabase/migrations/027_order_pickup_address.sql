ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_address TEXT;

COMMENT ON COLUMN public.orders.pickup_address IS
  'Return/pickup address when different from delivery (events).';

NOTIFY pgrst, 'reload schema';
