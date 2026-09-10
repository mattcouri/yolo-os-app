-- Migration: Embalagens (packaging boxes) enhancements
-- Run this on Supabase to update existing database

-- Add description column to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS description TEXT;

-- Add new asset types to the enum
-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction
-- These may need to be run separately if in a transaction context
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'caixa_grande' AND enumtypid = 'asset_type'::regtype) THEN
    ALTER TYPE asset_type ADD VALUE 'caixa_grande';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cooler' AND enumtypid = 'asset_type'::regtype) THEN
    ALTER TYPE asset_type ADD VALUE 'cooler';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add comment to document asset workflow
COMMENT ON TABLE assets IS 'Physical reusable assets (boxes, equipment) with QR code tracking. Boxes flow: factory → receiving → storage → cleaning → factory';
COMMENT ON COLUMN assets.description IS 'Optional description of the asset (e.g., "Caixa retornável para transporte de fábrica")';
COMMENT ON COLUMN assets.status IS 'Current status: available, in_use, with_product, empty_ready_return, at_factory, in_transit, inspection, cleaning, damaged';
