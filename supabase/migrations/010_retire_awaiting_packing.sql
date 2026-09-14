-- Return leftover awaiting_packing pools to recebimento so they can be
-- classified and boxed in the merged Preparar flow.

UPDATE stock AS analysis
SET
  quantity = analysis.quantity + pack.qty,
  updated_at = now()
FROM (
  SELECT
    receipt_id,
    product_id,
    COALESCE(lot, '') AS lot_key,
    SUM(quantity) AS qty
  FROM stock
  WHERE status = 'awaiting_packing'
    AND quantity > 0
  GROUP BY receipt_id, product_id, COALESCE(lot, '')
) AS pack
WHERE analysis.status = 'analysis'
  AND analysis.receipt_id IS NOT DISTINCT FROM pack.receipt_id
  AND analysis.product_id = pack.product_id
  AND COALESCE(analysis.lot, '') = pack.lot_key;

UPDATE inspections
SET source_stock_id = NULL
WHERE source_stock_id IN (SELECT id FROM stock WHERE status = 'awaiting_packing');

DELETE FROM movements
WHERE stock_id IN (SELECT id FROM stock WHERE status = 'awaiting_packing');

DELETE FROM stock AS pack
WHERE pack.status = 'awaiting_packing'
  AND EXISTS (
    SELECT 1
    FROM stock AS analysis
    WHERE analysis.status = 'analysis'
      AND analysis.id <> pack.id
      AND analysis.receipt_id IS NOT DISTINCT FROM pack.receipt_id
      AND analysis.product_id = pack.product_id
      AND COALESCE(analysis.lot, '') = COALESCE(pack.lot, '')
  );

UPDATE stock
SET
  status = 'analysis',
  grade = NULL,
  asset_id = NULL,
  fill_id = NULL,
  packed_at = NULL,
  updated_at = now()
WHERE status = 'awaiting_packing';

UPDATE receipts
SET status = 'pending', updated_at = now()
WHERE id IN (
  SELECT DISTINCT receipt_id
  FROM stock
  WHERE status = 'analysis' AND quantity > 0 AND receipt_id IS NOT NULL
);
