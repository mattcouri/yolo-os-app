-- Freeze declared vs counted when preparação is closed.
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS close_notes TEXT,
  ADD COLUMN IF NOT EXISTS counted_quantity DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS variance_quantity DECIMAL(10,3);

COMMENT ON COLUMN receipts.counted_quantity IS
  'Physical units found at close (inspections). Null while preparação is open.';
COMMENT ON COLUMN receipts.variance_quantity IS
  'counted_quantity - declared NF quantity. Positive = sobra, negative = falta. Frozen on close.';

ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS counted_quantity DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS variance_quantity DECIMAL(10,3);

COMMENT ON COLUMN receipt_items.counted_quantity IS
  'Physical units found for this SKU/lot at close. Null while open.';
COMMENT ON COLUMN receipt_items.variance_quantity IS
  'counted_quantity - receipt_items.quantity. Frozen on close.';
