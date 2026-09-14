-- Fills can follow each box's cadastro capacity, including partials over or under 100.
ALTER TABLE fills DROP CONSTRAINT IF EXISTS fills_quantity_check;
ALTER TABLE fills ADD CONSTRAINT fills_quantity_check CHECK (quantity > 0);
