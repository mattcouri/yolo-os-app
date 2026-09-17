export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AssetType = 'caixa_preta' | 'caixa_media' | 'caixa_grande' | 'cooler' | 'freezer' | 'carrinho' | 'other';

export type AssetStatus =
  | 'available'
  | 'reserved'
  | 'in_use'
  | 'with_product'
  | 'empty_ready_return'
  | 'at_factory'
  | 'in_transit'
  | 'inspection'
  | 'returned_pending'
  | 'cleaning'
  | 'maintenance'
  | 'damaged'
  | 'incomplete'
  | 'lost'
  | 'written_off';

export type AssetControlMethod = 'individual' | 'kit' | 'quantity';

export type AssetComponentCondition = 'ok' | 'missing' | 'damaged' | 'replaced';

export type AssetAttachmentKind =
  | 'photo'
  | 'document'
  | 'serial'
  | 'assembly'
  | 'component'
  | 'damage';

export type ProductKind = 'pop' | 'material' | 'equipment_service';

export type StockStatus = 
  | 'analysis' 
  | 'available' 
  | 'blocked' 
  | 'awaiting_packing' 
  | 'in_separation' 
  | 'reserved' 
  | 'depleted';

export type StockGrade = 'AAA' | 'B' | 'C' | 'blocked' | 'pending';

export type PhysicalState = 'liquid' | 'frozen';

export type OrderType = 
  | 'venda' 
  | 'evento' 
  | 'amostra' 
  | 'solicitacao_interna'
  | 'consignacao' 
  | 'emprestimo_equipamentos' 
  | 'troca_devolucao'
  | 'doacao_patrocinio' 
  | 'material_promocional' 
  | 'outro';

export type FulfillmentMethod = 
  | 'entrega_yolo' 
  | 'retirada_yolo' 
  | 'uso_interno' 
  | 'transportadora';

export type OrderStatus = 
  | 'received' 
  | 'a_separar' 
  | 'em_separacao' 
  | 'na_rua' 
  | 'retorno' 
  | 'completed' 
  | 'cancelled';

export type SeparationStage = 'a_separar' | 'em_separacao' | 'na_rua' | 'retorno';

export type MovementType = 
  | 'receiving' 
  | 'transfer' 
  | 'withdrawal' 
  | 'adjustment'
  | 'dispatch' 
  | 'return' 
  | 'inspection_result' 
  | 'packing';

export type InventoryCountStatus = 'counting' | 'pending_approval' | 'approved' | 'rejected';

export type InventoryCountIssue = 'correct' | 'quantity_discrepancy' | 'location_discrepancy' | 'not_found';

export interface Location {
  id: string;
  name: string;
  type: 'receiving' | 'storage' | 'freezer' | 'shipping' | 'other';
  purpose: 'product' | 'asset';
  is_active: boolean;
  sort_order: number;
  requires_box: boolean;
  system_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  flavor: string | null;
  description: string | null;
  kind: ProductKind;
  unit: string;
  category: string | null;
  product_line: string | null;
  format: string | null;
  base_quantity: number;
  is_composite: boolean;
  min_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductComponent {
  id: string;
  parent_product_id: string;
  child_product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: AssetType;
  location_id: string | null;
  status: AssetStatus;
  is_active: boolean;
  category?: string | null;
  control_method?: AssetControlMethod;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  sku_code?: string | null;
  quantity_on_hand?: number;
  acquired_at?: string | null;
  purchase_price?: number | null;
  supplier?: string | null;
  nf_number?: string | null;
  warranty_until?: string | null;
  useful_life_months?: number | null;
  voltage?: string | null;
  power_watts?: number | null;
  plug_type?: string | null;
  dimensions?: string | null;
  weight_kg?: number | null;
  capacity?: string | null;
  unit_capacity?: number | null;
  color?: string | null;
  operating_temp?: string | null;
  handling_notes?: string | null;
  specs?: string | null;
  custom_fields?: Record<string, string> | null;
  responsible_name?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  last_moved_at?: string | null;
  last_maintenance_at?: string | null;
  maintenance_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetComponent {
  id: string;
  parent_asset_id: string;
  name: string;
  quantity: number;
  control_method: 'individual' | 'quantity';
  component_code: string | null;
  replaceable: boolean;
  notes: string | null;
  photo_url: string | null;
  is_present: boolean;
  condition: AssetComponentCondition;
  sort_order: number;
  created_at: string;
}

export interface AssetAttachment {
  id: string;
  asset_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  caption: string | null;
  kind: AssetAttachmentKind;
  created_at: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  nf_number: string;
  supplier: string;
  receipt_date: string;
  location_id: string;
  status: 'pending' | 'inspected' | 'closed';
  notes: string | null;
  created_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  close_notes: string | null;
  counted_quantity: number | null;
  variance_quantity: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  product_id: string;
  quantity: number;
  lot: string | null;
  source_box_codes: string[] | null;
  counted_quantity: number | null;
  variance_quantity: number | null;
  created_at: string;
}

export interface Stock {
  id: string;
  stock_number: string;
  product_id: string;
  asset_id: string | null;
  quantity: number;
  location_id: string;
  grade: StockGrade | null;
  physical_state: PhysicalState | null;
  status: StockStatus;
  is_active_separation: boolean;
  lot: string | null;
  fifo_date: string | null;
  received_date: string | null;
  packed_at: string | null;
  receipt_id: string | null;
  inspection_id: string | null;
  fill_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialStock {
  id: string;
  stock_number: string;
  product_id: string;
  quantity: number;
  location_id: string;
  status: 'analysis' | 'available' | 'blocked';
  lot: string | null;
  receipt_id: string | null;
  source_box_codes: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  inspection_number: string;
  source_stock_id: string | null;
  source_material_id: string | null;
  kind: 'pop' | 'material';
  product_id: string;
  lot: string | null;
  receipt_id: string | null;
  expected_quantity: number;
  actual_quantity: number;
  rejected_quantity: number;
  count_aaa: number;
  count_b: number;
  count_c: number;
  destination_aaa: string | null;
  destination_b: string | null;
  destination_c: string | null;
  fifo_date: string | null;
  reason: string | null;
  scan_packing: boolean;
  completed_at: string;
  completed_by: string | null;
  created_at: string;
}

export interface Fill {
  id: string;
  fill_number: string;
  batch_id: string | null;
  asset_id: string;
  stock_id: string;
  inspection_id: string;
  quantity: number;
  product_id: string;
  grade: 'AAA' | 'B' | 'C' | 'blocked';
  lot: string | null;
  fifo_date: string | null;
  location_id: string;
  filled_at: string;
  filled_by: string | null;
}

export interface Movement {
  id: string;
  movement_number: string;
  type: MovementType;
  stock_id: string | null;
  asset_id: string | null;
  order_id: string | null;
  inspection_id: string | null;
  inventory_count_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number | null;
  quantity_before: number | null;
  quantity_after: number | null;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryCount {
  id: string;
  count_number: string;
  location_id: string;
  status: InventoryCountStatus;
  started_at: string;
  started_by: string | null;
  completed_at: string | null;
  operator_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_decision: 'approve' | 'reject' | null;
  review_comment: string | null;
  created_at: string;
}

export interface InventoryCountLine {
  id: string;
  count_id: string;
  stock_id: string;
  system_quantity: number;
  actual_quantity: number | null;
  system_location_id: string;
  issue: InventoryCountIssue | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  requester_id: string | null;
  requester_name: string;
  organization: string;
  recipient_name: string;
  recipient_contact: string;
  recipient_email: string | null;
  customer_reference: string | null;
  order_type: OrderType;
  needed_date: string;
  needed_time: string;
  fulfillment: FulfillmentMethod;
  pickup_fulfillment: FulfillmentMethod | null;
  address: string | null;
  event_name: string | null;
  event_start: string | null;
  event_end: string | null;
  pickup_at: string | null;
  onsite_contact: string | null;
  audience: number | null;
  reserve_from: string | null;
  reserve_until: string | null;
  payment_terms: string | null;
  billable: 'yes' | 'no' | 'review' | null;
  no_charge_reason: string | null;
  reference: string | null;
  return_description: string | null;
  item_notes: string | null;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  asset_id: string | null;
  name: string;
  code: string;
  quantity: number;
  unit: string;
  requested_state: PhysicalState | null;
  is_returnable: boolean;
  is_checked: boolean;
  created_at: string;
}

export interface OrderAttachment {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  created_at: string;
}

export interface EquipmentReservation {
  id: string;
  asset_id: string;
  order_id: string | null;
  reserved_from: string;
  reserved_until: string;
  holder_name: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface SeparationJob {
  id: string;
  order_id: string;
  delivery_driver: string | null;
  pickup_driver: string | null;
  vehicle: string | null;
  pickup_vehicle?: string | null;
  departure_at: string | null;
  return_at: string | null;
  stage: SeparationStage;
  operations_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassificationReference {
  id: string;
  grade: 'AAA' | 'B' | 'C';
  file_name: string;
  file_url: string;
  is_image: boolean;
  created_by: string | null;
  created_at: string;
}

export type UniformSize = 'P' | 'M' | 'G' | 'GG';

export type AppRole = 'admin' | 'supervisor' | 'user';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
}

export interface Uniform {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  photo_back_url?: string | null;
  qty_p: number;
  qty_m: number;
  qty_g: number;
  qty_gg: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UniformCheckout {
  id: string;
  uniform_id: string;
  order_id: string | null;
  size: UniformSize;
  quantity: number;
  status: 'out' | 'returned';
  checked_out_at: string;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: Location;
        Insert: Omit<Location, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Location, 'id' | 'created_at' | 'updated_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      assets: {
        Row: Asset;
        Insert: Omit<Asset, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>;
      };
      asset_components: {
        Row: AssetComponent;
        Insert: Omit<AssetComponent, 'id' | 'created_at'>;
        Update: Partial<Omit<AssetComponent, 'id' | 'created_at'>>;
      };
      asset_attachments: {
        Row: AssetAttachment;
        Insert: Omit<AssetAttachment, 'id' | 'created_at'>;
        Update: Partial<Omit<AssetAttachment, 'id' | 'created_at'>>;
      };
      receipts: {
        Row: Receipt;
        Insert: Omit<Receipt, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Receipt, 'id' | 'created_at' | 'updated_at'>>;
      };
      receipt_items: {
        Row: ReceiptItem;
        Insert: Omit<ReceiptItem, 'id' | 'created_at'>;
        Update: Partial<Omit<ReceiptItem, 'id' | 'created_at'>>;
      };
      stock: {
        Row: Stock;
        Insert: Omit<Stock, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Stock, 'id' | 'created_at' | 'updated_at'>>;
      };
      material_stock: {
        Row: MaterialStock;
        Insert: Omit<MaterialStock, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MaterialStock, 'id' | 'created_at' | 'updated_at'>>;
      };
      inspections: {
        Row: Inspection;
        Insert: Omit<Inspection, 'id' | 'created_at'>;
        Update: Partial<Omit<Inspection, 'id' | 'created_at'>>;
      };
      fills: {
        Row: Fill;
        Insert: Omit<Fill, 'id'>;
        Update: Partial<Omit<Fill, 'id'>>;
      };
      movements: {
        Row: Movement;
        Insert: Omit<Movement, 'id' | 'created_at'>;
        Update: Partial<Omit<Movement, 'id' | 'created_at'>>;
      };
      inventory_counts: {
        Row: InventoryCount;
        Insert: Omit<InventoryCount, 'id' | 'created_at'>;
        Update: Partial<Omit<InventoryCount, 'id' | 'created_at'>>;
      };
      inventory_count_lines: {
        Row: InventoryCountLine;
        Insert: Omit<InventoryCountLine, 'id' | 'created_at'>;
        Update: Partial<Omit<InventoryCountLine, 'id' | 'created_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderItem, 'id' | 'created_at'>>;
      };
      order_attachments: {
        Row: OrderAttachment;
        Insert: Omit<OrderAttachment, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderAttachment, 'id' | 'created_at'>>;
      };
      equipment_reservations: {
        Row: EquipmentReservation;
        Insert: Omit<EquipmentReservation, 'id' | 'created_at'>;
        Update: Partial<Omit<EquipmentReservation, 'id' | 'created_at'>>;
      };
      separation_jobs: {
        Row: SeparationJob;
        Insert: Omit<SeparationJob, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SeparationJob, 'id' | 'created_at' | 'updated_at'>>;
      };
      classification_references: {
        Row: ClassificationReference;
        Insert: Omit<ClassificationReference, 'id' | 'created_at'>;
        Update: Partial<Omit<ClassificationReference, 'id' | 'created_at'>>;
      };
      uniforms: {
        Row: Uniform;
        Insert: Omit<Uniform, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Uniform, 'id' | 'created_at' | 'updated_at'>>;
      };
      uniform_checkouts: {
        Row: UniformCheckout;
        Insert: Omit<UniformCheckout, 'id' | 'created_at'>;
        Update: Partial<Omit<UniformCheckout, 'id' | 'created_at'>>;
      };
      vehicles: {
        Row: Vehicle;
        Insert: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'last_sign_in_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'last_sign_in_at'>>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

export type Insertable<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];

export type Updatable<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];
