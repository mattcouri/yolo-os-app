-- Migration: Add product tree (árvore de produto) / BOM functionality
-- This enables SKUs to be composed of other SKUs (e.g., a shipping box = 10 cartuchos = 60 units)

-- Add new columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_line TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_composite BOOLEAN NOT NULL DEFAULT false;

-- Create product_components table for Bill of Materials (BOM)
-- This defines which child products make up a composite product
CREATE TABLE IF NOT EXISTS product_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  child_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate parent-child relationships
  UNIQUE(parent_product_id, child_product_id),
  
  -- Prevent self-references
  CHECK (parent_product_id != child_product_id)
);

-- Index for fast lookups by parent product
CREATE INDEX IF NOT EXISTS idx_product_components_parent ON product_components(parent_product_id);

-- Index for fast lookups by child product (to find where a product is used)
CREATE INDEX IF NOT EXISTS idx_product_components_child ON product_components(child_product_id);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER product_components_updated_at
  BEFORE UPDATE ON product_components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies for product_components
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_components_select" ON product_components
  FOR SELECT USING (true);

CREATE POLICY "product_components_insert" ON product_components
  FOR INSERT WITH CHECK (true);

CREATE POLICY "product_components_update" ON product_components
  FOR UPDATE USING (true);

CREATE POLICY "product_components_delete" ON product_components
  FOR DELETE USING (true);

-- Function to calculate total base units for a composite product
-- This recursively sums up all component quantities
CREATE OR REPLACE FUNCTION calculate_product_base_units(product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  product_record RECORD;
  total_units INTEGER := 0;
  component RECORD;
BEGIN
  SELECT * INTO product_record FROM products WHERE id = product_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- If not composite, return base_quantity
  IF NOT product_record.is_composite THEN
    RETURN product_record.base_quantity;
  END IF;
  
  -- Sum up all component quantities
  FOR component IN 
    SELECT pc.quantity, p.base_quantity, p.is_composite, p.id
    FROM product_components pc
    JOIN products p ON pc.child_product_id = p.id
    WHERE pc.parent_product_id = product_id
  LOOP
    IF component.is_composite THEN
      -- Recursive call for nested composites
      total_units := total_units + (component.quantity * calculate_product_base_units(component.id));
    ELSE
      total_units := total_units + (component.quantity * component.base_quantity);
    END IF;
  END LOOP;
  
  RETURN total_units;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct stock when fulfilling a composite product order
-- Returns the movement IDs created
CREATE OR REPLACE FUNCTION deduct_composite_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(movement_id UUID, product_id UUID, quantity_deducted INTEGER) AS $$
DECLARE
  product_record RECORD;
  component RECORD;
  stock_record RECORD;
  remaining_qty INTEGER;
  deduct_qty INTEGER;
  new_movement_id UUID;
BEGIN
  SELECT * INTO product_record FROM products WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
  
  -- If simple product, deduct directly from stock
  IF NOT product_record.is_composite THEN
    remaining_qty := p_quantity * product_record.base_quantity;
    
    FOR stock_record IN
      SELECT * FROM stock
      WHERE stock.product_id = p_product_id
        AND status = 'available'
        AND quantity > 0
      ORDER BY fifo_date ASC NULLS LAST, created_at ASC
    LOOP
      IF remaining_qty <= 0 THEN
        EXIT;
      END IF;
      
      deduct_qty := LEAST(stock_record.quantity, remaining_qty);
      
      UPDATE stock SET 
        quantity = quantity - deduct_qty,
        updated_at = now()
      WHERE id = stock_record.id;
      
      INSERT INTO movements (
        movement_number,
        type,
        stock_id,
        order_id,
        from_location_id,
        quantity,
        quantity_before,
        quantity_after,
        reason,
        created_by
      ) VALUES (
        gen_movement_number(),
        'withdrawal',
        stock_record.id,
        p_order_id,
        stock_record.location_id,
        deduct_qty,
        stock_record.quantity,
        stock_record.quantity - deduct_qty,
        'Baixa automática - produto composto',
        p_user_id
      )
      RETURNING id INTO new_movement_id;
      
      movement_id := new_movement_id;
      product_id := p_product_id;
      quantity_deducted := deduct_qty;
      RETURN NEXT;
      
      remaining_qty := remaining_qty - deduct_qty;
    END LOOP;
    
    RETURN;
  END IF;
  
  -- For composite products, recursively deduct components
  FOR component IN 
    SELECT pc.child_product_id, pc.quantity
    FROM product_components pc
    WHERE pc.parent_product_id = p_product_id
  LOOP
    RETURN QUERY 
      SELECT * FROM deduct_composite_stock(
        component.child_product_id,
        p_quantity * component.quantity,
        p_order_id,
        p_user_id
      );
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Seed some example product lines
COMMENT ON COLUMN products.product_line IS 'Product line category: caipi, drinks, cremoso, frutas, etc.';
COMMENT ON COLUMN products.base_quantity IS 'Number of individual units this SKU represents';
COMMENT ON COLUMN products.is_composite IS 'Whether this SKU is composed of other SKUs';
