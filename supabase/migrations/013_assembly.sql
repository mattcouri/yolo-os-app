-- Caixa de montagem + produtos montados + min qty for composite restock

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS system_key TEXT UNIQUE;

COMMENT ON COLUMN locations.system_key IS
  'Reserved system locations the app maintains. assembled = shelf for cartuchos, caixas and pallets.';

COMMENT ON COLUMN stock.is_active_separation IS
  'Caixa de montagem: the only box of this flavor + physical state allowed under capacity. Source for assembling SKUs and unit orders.';

UPDATE locations
SET system_key = 'assembled',
    requires_box = false,
    is_active = true
WHERE system_key IS NULL
  AND name ILIKE 'produtos montados'
  AND NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'assembled');

INSERT INTO locations (name, type, is_active, sort_order, requires_box, system_key)
SELECT 'Produtos montados', 'storage', true, 90, false, 'assembled'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE system_key = 'assembled');

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 0 CHECK (min_quantity >= 0);

COMMENT ON COLUMN products.min_quantity IS
  'When composite stock on hand falls below this, create a reposição job on Separação.';

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, COALESCE(physical_state, 'liquid')
      ORDER BY CASE WHEN quantity > 0 THEN 0 ELSE 1 END, created_at
    ) AS rn
  FROM stock
  WHERE is_active_separation
)
UPDATE stock
SET is_active_separation = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS stock_one_assembly_box
  ON stock (product_id, (COALESCE(physical_state, 'liquid')))
  WHERE is_active_separation;
