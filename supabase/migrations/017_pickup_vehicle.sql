-- Separate vehicle for the return / coleta trip

ALTER TABLE separation_jobs
  ADD COLUMN IF NOT EXISTS pickup_vehicle TEXT;

COMMENT ON COLUMN separation_jobs.vehicle IS
  'Vehicle for the outbound / entrega trip.';
COMMENT ON COLUMN separation_jobs.pickup_vehicle IS
  'Vehicle for the return / coleta trip. Independent from entrega.';
