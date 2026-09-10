-- YOLO OS Database Schema
-- Full operational system for inventory, orders, deliveries, and asset management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- CORE LOOKUP TABLES
-- ============================================================================

-- Locations (warehouse areas, freezers, etc.)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('receiving', 'storage', 'freezer', 'shipping', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product SKUs (pops and materials)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  flavor TEXT, -- NULL for non-pop products
  kind TEXT NOT NULL CHECK (kind IN ('pop', 'material', 'equipment_service')),
  unit TEXT NOT NULL DEFAULT 'un',
  category TEXT, -- for materials: 'Embalagem', 'Material de envio', 'Insumo', etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Physical asset types
CREATE TYPE asset_type AS ENUM (
  'caixa_preta',      -- Large returnable shipping boxes from factory
  'caixa_media',      -- Medium boxes for storing 100 pops
  'freezer',          -- Freezer equipment
  'carrinho',         -- Ice cream cart
  'other'             -- Tables, banners, etc.
);

-- Physical assets (containers and equipment with unique IDs)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE, -- Normalized: uppercase, hyphens only
  name TEXT NOT NULL,
  type asset_type NOT NULL,
  location_id UUID REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
    'available', 'in_use', 'with_product', 'empty_ready_return', 
    'at_factory', 'in_transit', 'inspection', 'cleaning', 'damaged'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- RECEIVING AND INVENTORY
-- ============================================================================

-- Receiving notes (Notas Fiscais)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT NOT NULL, -- System-generated: REC-001
  nf_number TEXT NOT NULL,      -- Nota Fiscal number
  supplier TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'inspected', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt line items
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  lot TEXT,
  source_box_codes TEXT[], -- Array of caixa preta codes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock records (inventory items - boxes of pops or material quantities)
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_number TEXT NOT NULL UNIQUE, -- CX-001, BLQ-001, PEND-001, etc.
  product_id UUID NOT NULL REFERENCES products(id),
  asset_id UUID REFERENCES assets(id), -- Link to physical container (caixa_media)
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity >= 0),
  location_id UUID NOT NULL REFERENCES locations(id),
  
  -- Quality and state tracking
  grade TEXT CHECK (grade IN ('AAA', 'B', 'C', 'blocked', 'pending')),
  physical_state TEXT CHECK (physical_state IN ('liquid', 'frozen')),
  
  -- Status flags
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
    'analysis', 'available', 'blocked', 'awaiting_packing', 'in_separation', 'reserved', 'depleted'
  )),
  is_active_separation BOOLEAN NOT NULL DEFAULT false,
  
  -- Traceability
  lot TEXT,
  fifo_date DATE,
  received_date DATE,
  packed_at TIMESTAMPTZ,
  receipt_id UUID REFERENCES receipts(id),
  inspection_id UUID, -- Forward reference, will add FK later
  fill_id UUID, -- Forward reference for packing
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material stock (separate from pop boxes)
CREATE TABLE material_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_number TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity >= 0),
  location_id UUID NOT NULL REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'analysis' CHECK (status IN ('analysis', 'available', 'blocked')),
  lot TEXT,
  receipt_id UUID REFERENCES receipts(id),
  source_box_codes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INSPECTION AND CLASSIFICATION
-- ============================================================================

-- Inspections (classification and counting)
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_number TEXT NOT NULL UNIQUE, -- INS-001
  source_stock_id UUID REFERENCES stock(id),
  source_material_id UUID REFERENCES material_stock(id),
  kind TEXT NOT NULL CHECK (kind IN ('pop', 'material')),
  
  -- Product info
  product_id UUID NOT NULL REFERENCES products(id),
  lot TEXT,
  receipt_id UUID REFERENCES receipts(id),
  
  -- Quantities
  expected_quantity DECIMAL(10,3) NOT NULL,
  actual_quantity DECIMAL(10,3) NOT NULL,
  rejected_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  
  -- Classification counts (for pops)
  count_aaa INTEGER DEFAULT 0,
  count_b INTEGER DEFAULT 0,
  count_c INTEGER DEFAULT 0,
  
  -- Destinations
  destination_aaa UUID REFERENCES locations(id),
  destination_b UUID REFERENCES locations(id),
  destination_c UUID REFERENCES locations(id),
  
  -- Metadata
  fifo_date DATE,
  reason TEXT, -- Required if discrepancy
  scan_packing BOOLEAN NOT NULL DEFAULT true, -- Requires packing step
  
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK to stock table
ALTER TABLE stock ADD CONSTRAINT fk_stock_inspection 
  FOREIGN KEY (inspection_id) REFERENCES inspections(id);

-- ============================================================================
-- PACKING
-- ============================================================================

-- Packing fills (linking stock to physical containers)
CREATE TABLE fills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fill_number TEXT NOT NULL UNIQUE, -- ENV-0001
  batch_id TEXT, -- PACK-001 for batch operations
  
  asset_id UUID NOT NULL REFERENCES assets(id), -- The caixa_media being filled
  stock_id UUID NOT NULL REFERENCES stock(id),  -- The resulting stock record
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  product_id UUID NOT NULL REFERENCES products(id),
  grade TEXT NOT NULL CHECK (grade IN ('AAA', 'B', 'C')),
  lot TEXT,
  fifo_date DATE,
  location_id UUID NOT NULL REFERENCES locations(id),
  
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filled_by UUID REFERENCES auth.users(id)
);

-- Add FK to stock table
ALTER TABLE stock ADD CONSTRAINT fk_stock_fill 
  FOREIGN KEY (fill_id) REFERENCES fills(id);

-- ============================================================================
-- MOVEMENTS AND TRANSFERS
-- ============================================================================

-- Warehouse movements (append-only history)
CREATE TABLE movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movement_number TEXT NOT NULL UNIQUE, -- MOV-001
  type TEXT NOT NULL CHECK (type IN (
    'receiving', 'transfer', 'withdrawal', 'adjustment', 
    'dispatch', 'return', 'inspection_result', 'packing'
  )),
  
  -- Related records
  stock_id UUID REFERENCES stock(id),
  asset_id UUID REFERENCES assets(id),
  order_id UUID, -- Forward reference to orders
  inspection_id UUID REFERENCES inspections(id),
  inventory_count_id UUID, -- Forward reference
  
  -- Movement details
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  quantity DECIMAL(10,3),
  quantity_before DECIMAL(10,3),
  quantity_after DECIMAL(10,3),
  
  -- Metadata
  reason TEXT,
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INVENTORY COUNTS
-- ============================================================================

-- Inventory count sessions
CREATE TABLE inventory_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number TEXT NOT NULL UNIQUE, -- INV-001
  location_id UUID NOT NULL REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'counting' CHECK (status IN (
    'counting', 'pending_approval', 'approved', 'rejected'
  )),
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  
  -- Operator notes
  operator_notes TEXT,
  
  -- Review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_decision TEXT CHECK (review_decision IN ('approve', 'reject')),
  review_comment TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK to movements
ALTER TABLE movements ADD CONSTRAINT fk_movement_inventory_count 
  FOREIGN KEY (inventory_count_id) REFERENCES inventory_counts(id);

-- Inventory count lines
CREATE TABLE inventory_count_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stock(id),
  
  system_quantity DECIMAL(10,3) NOT NULL,
  actual_quantity DECIMAL(10,3),
  system_location_id UUID NOT NULL REFERENCES locations(id),
  
  -- Discrepancy info
  issue TEXT CHECK (issue IN ('correct', 'quantity_discrepancy', 'location_discrepancy', 'not_found')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ORDERS AND REQUESTS
-- ============================================================================

-- Order request types
CREATE TYPE order_type AS ENUM (
  'venda', 'evento', 'amostra', 'solicitacao_interna', 
  'consignacao', 'emprestimo_equipamentos', 'troca_devolucao',
  'doacao_patrocinio', 'material_promocional', 'outro'
);

-- Order fulfillment methods
CREATE TYPE fulfillment_method AS ENUM (
  'entrega_yolo', 'retirada_yolo', 'uso_interno', 'transportadora'
);

-- Orders (unified requests)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE, -- PED-0001
  
  -- Requester (YOLO staff)
  requester_id UUID REFERENCES auth.users(id),
  requester_name TEXT NOT NULL,
  
  -- Recipient
  organization TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_contact TEXT NOT NULL,
  recipient_email TEXT,
  customer_reference TEXT,
  
  -- Order details
  order_type order_type NOT NULL,
  needed_date DATE NOT NULL,
  needed_time TEXT NOT NULL, -- "09h-12h"
  fulfillment fulfillment_method NOT NULL,
  address TEXT,
  
  -- Event details (optional)
  event_name TEXT,
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  pickup_at TIMESTAMPTZ,
  onsite_contact TEXT,
  audience INTEGER,
  
  -- Equipment reservation period
  reserve_from TIMESTAMPTZ,
  reserve_until TIMESTAMPTZ,
  
  -- Commercial
  payment_terms TEXT,
  billable TEXT CHECK (billable IN ('yes', 'no', 'review')),
  no_charge_reason TEXT,
  
  -- Return/exchange reference
  reference TEXT,
  return_description TEXT,
  
  -- Notes and attachments
  item_notes TEXT,
  notes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'a_separar', 'em_separacao', 'na_rua', 'retorno', 'completed', 'cancelled'
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK to movements
ALTER TABLE movements ADD CONSTRAINT fk_movement_order 
  FOREIGN KEY (order_id) REFERENCES orders(id);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  asset_id UUID REFERENCES assets(id), -- For equipment
  
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  requested_state TEXT, -- 'liquid', 'frozen', or NULL
  is_returnable BOOLEAN NOT NULL DEFAULT false,
  
  -- Separation tracking
  is_checked BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order attachments
CREATE TABLE order_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Equipment reservations
CREATE TABLE equipment_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  reserved_from TIMESTAMPTZ NOT NULL,
  reserved_until TIMESTAMPTZ NOT NULL,
  holder_name TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent overlapping reservations
  CONSTRAINT no_overlapping_reservations EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(reserved_from, reserved_until) WITH &&
  ) WHERE (status = 'active')
);

-- ============================================================================
-- SEPARATION / DELIVERY OPERATIONS
-- ============================================================================

-- Separation jobs (operational view of orders)
CREATE TABLE separation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) UNIQUE,
  
  -- Assignments
  delivery_driver TEXT,
  pickup_driver TEXT,
  vehicle TEXT,
  
  -- Timing
  departure_at TIMESTAMPTZ,
  return_at TIMESTAMPTZ,
  
  -- Stage (synced with order status)
  stage TEXT NOT NULL DEFAULT 'a_separar' CHECK (stage IN (
    'a_separar', 'em_separacao', 'na_rua', 'retorno'
  )),
  
  -- Operations notes
  operations_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- CLASSIFICATION REFERENCE FILES
-- ============================================================================

-- Reference files for classification (AAA/B/C photos)
CREATE TABLE classification_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade TEXT NOT NULL CHECK (grade IN ('AAA', 'B', 'C')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  is_image BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SEQUENCES
-- ============================================================================

-- Sequences for generating numbers
CREATE SEQUENCE receipt_seq START 1;
CREATE SEQUENCE stock_seq START 1;
CREATE SEQUENCE material_stock_seq START 1;
CREATE SEQUENCE inspection_seq START 1;
CREATE SEQUENCE fill_seq START 1;
CREATE SEQUENCE movement_seq START 1;
CREATE SEQUENCE inventory_count_seq START 1;
CREATE SEQUENCE order_seq START 1;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Normalize asset code
CREATE OR REPLACE FUNCTION normalize_asset_code(code TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(TRIM(REGEXP_REPLACE(code, '[\s_-]+', '-', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate stock number
CREATE OR REPLACE FUNCTION generate_stock_number(prefix TEXT DEFAULT 'CX')
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || LPAD(nextval('stock_seq')::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PED-' || LPAD(nextval('order_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_receipts_updated_at
  BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_stock_updated_at
  BEFORE UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_material_stock_updated_at
  BEFORE UPDATE ON material_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_separation_jobs_updated_at
  BEFORE UPDATE ON separation_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Normalize asset code on insert/update
CREATE OR REPLACE FUNCTION normalize_asset_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code = normalize_asset_code(NEW.code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_normalize_code
  BEFORE INSERT OR UPDATE OF code ON assets 
  FOR EACH ROW EXECUTE FUNCTION normalize_asset_code_trigger();

-- Sync separation job stage with order status
CREATE OR REPLACE FUNCTION sync_order_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET status = NEW.stage, updated_at = now()
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_separation_job_sync_status
  AFTER UPDATE OF stage ON separation_jobs
  FOR EACH ROW EXECUTE FUNCTION sync_order_status();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fills ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE separation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_references ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (permissive for now)
CREATE POLICY "Allow all for authenticated" ON locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON receipt_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON material_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON fills FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON inventory_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON inventory_count_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON order_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON equipment_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON separation_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON classification_references FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default locations
INSERT INTO locations (name, type, sort_order) VALUES
  ('Recebimento', 'receiving', 0),
  ('Resfriado', 'storage', 1),
  ('Congelado', 'freezer', 2),
  ('Estoque seco', 'storage', 3),
  ('Freezer cozinha', 'freezer', 4),
  ('Expedição', 'shipping', 5);

-- Default products (flavors)
INSERT INTO products (code, name, flavor, kind, unit) VALUES
  ('YOL-001', 'YOLO Pop · Morango', 'Morango', 'pop', 'un'),
  ('YOL-002', 'YOLO Pop · Maracujá', 'Maracujá', 'pop', 'un'),
  ('YOL-003', 'YOLO Pop · Limão', 'Limão', 'pop', 'un'),
  ('YOL-004', 'YOLO Pop · Abacaxi', 'Abacaxi', 'pop', 'un');

-- Default materials
INSERT INTO products (code, name, kind, unit, category) VALUES
  ('MAT-001', 'Caixa de envio', 'material', 'un', 'Embalagem'),
  ('MAT-002', 'Insert / encarte', 'material', 'un', 'Material de envio'),
  ('MAT-003', 'Aromatizante (exemplo)', 'material', 'L', 'Insumo');

-- Equipment/service catalog items
INSERT INTO products (code, name, kind, unit) VALUES
  ('EQ-CARRINHO', 'Carrinho de sorvete', 'equipment_service', 'un'),
  ('EQ-FREEZER', 'Freezer', 'equipment_service', 'un'),
  ('EV-MESA', 'Mesa', 'equipment_service', 'un'),
  ('EV-BANNER', 'Banner', 'equipment_service', 'un'),
  ('EV-FLYER', 'Flyer', 'equipment_service', 'un'),
  ('SERV-MONTAGEM', 'Montagem / apoio operacional', 'equipment_service', 'serviço'),
  ('OUTRO', 'Outro item', 'equipment_service', 'un');

-- Sample equipment assets
INSERT INTO assets (code, name, type, status) VALUES
  ('FREEZER-001', 'Freezer 1', 'freezer', 'available'),
  ('CARRINHO-001', 'Carrinho de sorvete 1', 'carrinho', 'available');

-- Sample medium boxes
INSERT INTO assets (code, name, type, status) VALUES
  ('MEDIA-001', 'Caixa média 1', 'caixa_media', 'available'),
  ('MEDIA-002', 'Caixa média 2', 'caixa_media', 'available'),
  ('MEDIA-003', 'Caixa média 3', 'caixa_media', 'available'),
  ('MEDIA-004', 'Caixa média 4', 'caixa_media', 'available'),
  ('MEDIA-005', 'Caixa média 5', 'caixa_media', 'available'),
  ('MEDIA-006', 'Caixa média 6', 'caixa_media', 'available'),
  ('MEDIA-007', 'Caixa média 7', 'caixa_media', 'available'),
  ('MEDIA-008', 'Caixa média 8', 'caixa_media', 'available'),
  ('MEDIA-009', 'Caixa média 9', 'caixa_media', 'available'),
  ('MEDIA-010', 'Caixa média 10', 'caixa_media', 'available');

-- Sample caixas pretas
INSERT INTO assets (code, name, type, status) VALUES
  ('PRETA-001', 'Caixa preta 1', 'caixa_preta', 'at_factory'),
  ('PRETA-002', 'Caixa preta 2', 'caixa_preta', 'at_factory'),
  ('PRETA-003', 'Caixa preta 3', 'caixa_preta', 'at_factory');

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_stock_location ON stock(location_id);
CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_status ON stock(status);
CREATE INDEX idx_stock_asset ON stock(asset_id);

CREATE INDEX idx_material_stock_location ON material_stock(location_id);
CREATE INDEX idx_material_stock_product ON material_stock(product_id);
CREATE INDEX idx_material_stock_status ON material_stock(status);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_needed_date ON orders(needed_date);

CREATE INDEX idx_movements_stock ON movements(stock_id);
CREATE INDEX idx_movements_order ON movements(order_id);
CREATE INDEX idx_movements_type ON movements(type);
CREATE INDEX idx_movements_created_at ON movements(created_at);

CREATE INDEX idx_equipment_reservations_asset ON equipment_reservations(asset_id);
CREATE INDEX idx_equipment_reservations_dates ON equipment_reservations(reserved_from, reserved_until);

CREATE INDEX idx_separation_jobs_stage ON separation_jobs(stage);
