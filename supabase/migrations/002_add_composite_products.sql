-- Migration: Add composite product support
-- Run this on Supabase to update existing database

-- Add missing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_line TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_composite BOOLEAN NOT NULL DEFAULT false;

-- Create product_components table if not exists
CREATE TABLE IF NOT EXISTS product_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  child_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_product_id, child_product_id)
);

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_product_components_parent ON product_components(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_child ON product_components(child_product_id);

-- Enable RLS
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

-- Create policy (drop first if exists to avoid error)
DROP POLICY IF EXISTS "Allow all for authenticated" ON product_components;
CREATE POLICY "Allow all for authenticated" ON product_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
