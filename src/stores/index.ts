import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  Location, Product, Asset, Receipt, ReceiptItem, Stock, MaterialStock,
  Inspection, Fill, Movement, InventoryCount, InventoryCountLine,
  Order, OrderItem, SeparationJob, EquipmentReservation,
  OrderType, FulfillmentMethod, SeparationStage, StockGrade,
  PhysicalState, StockStatus
} from '@/types/database';

interface AppState {
  isLoading: boolean;
  error: string | null;
  
  locations: Location[];
  products: Product[];
  assets: Asset[];
  receipts: Receipt[];
  receiptItems: ReceiptItem[];
  stock: Stock[];
  materialStock: MaterialStock[];
  inspections: Inspection[];
  fills: Fill[];
  movements: Movement[];
  inventoryCounts: InventoryCount[];
  inventoryCountLines: InventoryCountLine[];
  orders: Order[];
  orderItems: OrderItem[];
  separationJobs: SeparationJob[];
  equipmentReservations: EquipmentReservation[];
  
  fetchAll: () => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchAssets: () => Promise<void>;
  fetchReceipts: () => Promise<void>;
  fetchStock: () => Promise<void>;
  fetchMaterialStock: () => Promise<void>;
  fetchInspections: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchSeparationJobs: () => Promise<void>;
  fetchInventoryCounts: () => Promise<void>;
  fetchMovements: () => Promise<void>;
  
  createReceipt: (data: CreateReceiptData) => Promise<Receipt>;
  createInspection: (data: CreateInspectionData) => Promise<Inspection>;
  createFill: (data: CreateFillData) => Promise<Fill>;
  createMovement: (data: CreateMovementData) => Promise<Movement>;
  createOrder: (data: CreateOrderData) => Promise<Order>;
  createInventoryCount: (locationId: string) => Promise<InventoryCount>;
  
  updateStock: (id: string, data: Partial<Stock>) => Promise<void>;
  updateMaterialStock: (id: string, data: Partial<MaterialStock>) => Promise<void>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  updateSeparationJob: (id: string, data: Partial<SeparationJob>) => Promise<void>;
  updateInventoryCount: (id: string, data: Partial<InventoryCount>) => Promise<void>;
  updateAsset: (id: string, data: Partial<Asset>) => Promise<void>;
  
  createLocation: (data: Omit<Location, 'id' | 'created_at' | 'updated_at'>) => Promise<Location>;
  updateLocation: (id: string, data: Partial<Location>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  createProduct: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createAsset: (data: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'location_id'>) => Promise<Asset>;
  deleteAsset: (id: string) => Promise<void>;
  
  transferBoxes: (boxIds: string[], destinationId: string) => Promise<void>;
  withdrawFromBox: (boxId: string, quantity: number, reason: string) => Promise<void>;
  
  clearError: () => void;
}

interface CreateReceiptData {
  nf_number: string;
  supplier: string;
  receipt_date: string;
  location_id: string;
  items: {
    product_id: string;
    quantity: number;
    lot?: string;
    source_box_codes?: string[];
  }[];
}

interface CreateInspectionData {
  source_stock_id?: string;
  source_material_id?: string;
  kind: 'pop' | 'material';
  product_id: string;
  lot?: string;
  receipt_id?: string;
  expected_quantity: number;
  actual_quantity: number;
  rejected_quantity: number;
  count_aaa?: number;
  count_b?: number;
  count_c?: number;
  destination_aaa?: string;
  destination_b?: string;
  destination_c?: string;
  fifo_date?: string;
  reason?: string;
  scan_packing?: boolean;
}

interface CreateFillData {
  asset_id: string;
  inspection_id: string;
  pool_stock_id: string;
  quantity: number;
  location_id: string;
  batch_id?: string;
}

interface CreateMovementData {
  type: Movement['type'];
  stock_id?: string;
  asset_id?: string;
  order_id?: string;
  inspection_id?: string;
  inventory_count_id?: string;
  from_location_id?: string;
  to_location_id?: string;
  quantity?: number;
  quantity_before?: number;
  quantity_after?: number;
  reason?: string;
  notes?: string;
}

interface CreateOrderData {
  requester_name: string;
  organization: string;
  recipient_name: string;
  recipient_contact: string;
  recipient_email?: string;
  customer_reference?: string;
  order_type: OrderType;
  needed_date: string;
  needed_time: string;
  fulfillment: FulfillmentMethod;
  address?: string;
  event_name?: string;
  event_start?: string;
  event_end?: string;
  pickup_at?: string;
  onsite_contact?: string;
  audience?: number;
  reserve_from?: string;
  reserve_until?: string;
  payment_terms?: string;
  billable?: 'yes' | 'no' | 'review';
  no_charge_reason?: string;
  reference?: string;
  return_description?: string;
  item_notes?: string;
  notes?: string;
  items: {
    product_id?: string;
    asset_id?: string;
    name: string;
    code: string;
    quantity: number;
    unit: string;
    requested_state?: PhysicalState;
    is_returnable: boolean;
  }[];
  equipment_ids?: string[];
}

let stockSeq = 1;
let receiptSeq = 1;
let inspectionSeq = 1;
let fillSeq = 1;
let movementSeq = 1;
let orderSeq = 1;
let inventoryCountSeq = 1;

const generateId = () => crypto.randomUUID();
const generateStockNumber = (prefix = 'CX') => `${prefix}-${String(stockSeq++).padStart(3, '0')}`;
const generateReceiptNumber = () => `REC-${String(receiptSeq++).padStart(3, '0')}`;
const generateInspectionNumber = () => `INS-${String(inspectionSeq++).padStart(3, '0')}`;
const generateFillNumber = () => `ENV-${String(fillSeq++).padStart(4, '0')}`;
const generateMovementNumber = () => `MOV-${String(movementSeq++).padStart(3, '0')}`;
const generateOrderNumber = () => `PED-${String(orderSeq++).padStart(4, '0')}`;
const generateCountNumber = () => `INV-${String(inventoryCountSeq++).padStart(3, '0')}`;

const normalizeAssetCode = (code: string) => 
  code.trim().toUpperCase().replace(/[\s_-]+/g, '-');

const defaultLocations: Location[] = [
  { id: '1', name: 'Recebimento', type: 'receiving', is_active: true, sort_order: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'Resfriado', type: 'storage', is_active: true, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'Congelado', type: 'freezer', is_active: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', name: 'Estoque seco', type: 'storage', is_active: true, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', name: 'Freezer cozinha', type: 'freezer', is_active: true, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', name: 'Expedição', type: 'shipping', is_active: true, sort_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const defaultProducts: Product[] = [
  { id: '1', code: 'YOL-001', name: 'YOLO Pop · Morango', flavor: 'Morango', kind: 'pop', unit: 'un', category: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', code: 'YOL-002', name: 'YOLO Pop · Maracujá', flavor: 'Maracujá', kind: 'pop', unit: 'un', category: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', code: 'YOL-003', name: 'YOLO Pop · Limão', flavor: 'Limão', kind: 'pop', unit: 'un', category: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', code: 'YOL-004', name: 'YOLO Pop · Abacaxi', flavor: 'Abacaxi', kind: 'pop', unit: 'un', category: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', code: 'MAT-001', name: 'Caixa de envio', flavor: null, kind: 'material', unit: 'un', category: 'Embalagem', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', code: 'MAT-002', name: 'Insert / encarte', flavor: null, kind: 'material', unit: 'un', category: 'Material de envio', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const defaultAssets: Asset[] = [
  { id: '1', code: 'FREEZER-001', name: 'Freezer 1', type: 'freezer', location_id: null, status: 'available', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', code: 'CARRINHO-001', name: 'Carrinho de sorvete 1', type: 'carrinho', location_id: null, status: 'available', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 3),
    code: `MEDIA-${String(i + 1).padStart(3, '0')}`,
    name: `Caixa média ${i + 1}`,
    type: 'caixa_media' as const,
    location_id: null,
    status: 'available' as const,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: String(i + 13),
    code: `PRETA-${String(i + 1).padStart(3, '0')}`,
    name: `Caixa preta ${i + 1}`,
    type: 'caixa_preta' as const,
    location_id: null,
    status: 'at_factory' as const,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
];

export const useAppStore = create<AppState>((set, get) => ({
  isLoading: false,
  error: null,
  
  locations: defaultLocations,
  products: defaultProducts,
  assets: defaultAssets,
  receipts: [],
  receiptItems: [],
  stock: [],
  materialStock: [],
  inspections: [],
  fills: [],
  movements: [],
  inventoryCounts: [],
  inventoryCountLines: [],
  orders: [],
  orderItems: [],
  separationJobs: [],
  equipmentReservations: [],
  
  clearError: () => set({ error: null }),
  
  fetchAll: async () => {
    const state = get();
    await Promise.all([
      state.fetchLocations(),
      state.fetchProducts(),
      state.fetchAssets(),
      state.fetchReceipts(),
      state.fetchStock(),
      state.fetchMaterialStock(),
      state.fetchInspections(),
      state.fetchOrders(),
      state.fetchSeparationJobs(),
      state.fetchMovements(),
    ]);
  },
  
  fetchLocations: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('locations').select('*').order('sort_order');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ locations: data || defaultLocations, isLoading: false });
    }
  },
  
  fetchProducts: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('products').select('*').order('code');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ products: data || defaultProducts, isLoading: false });
    }
  },
  
  fetchAssets: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('assets').select('*').order('code');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ assets: data || defaultAssets, isLoading: false });
    }
  },

  createLocation: async (data) => {
    const now = new Date().toISOString();
    const newLocation: Location = {
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
    };
    
    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('locations')
        .insert(newLocation)
        .select()
        .single();
      if (error) throw new Error(error.message);
      set((state) => ({ locations: [...state.locations, inserted] }));
      return inserted;
    } else {
      set((state) => ({ locations: [...state.locations, newLocation] }));
      return newLocation;
    }
  },

  updateLocation: async (id, data) => {
    const now = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('locations')
        .update({ ...data, updated_at: now })
        .eq('id', id);
      if (error) throw new Error(error.message);
    }
    
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === id ? { ...l, ...data, updated_at: now } : l
      ),
    }));
  },

  deleteLocation: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
    
    set((state) => ({
      locations: state.locations.filter((l) => l.id !== id),
    }));
  },

  createProduct: async (data) => {
    const now = new Date().toISOString();
    const newProduct: Product = {
      id: generateId(),
      ...data,
      category: data.category || null,
      flavor: data.flavor || null,
      description: data.description || null,
      product_line: data.product_line || null,
      base_quantity: data.base_quantity || 1,
      is_composite: data.is_composite || false,
      created_at: now,
      updated_at: now,
    };
    
    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('products')
        .insert(newProduct)
        .select()
        .single();
      if (error) throw new Error(error.message);
      set((state) => ({ products: [...state.products, inserted] }));
      return inserted;
    } else {
      set((state) => ({ products: [...state.products, newProduct] }));
      return newProduct;
    }
  },

  updateProduct: async (id, data) => {
    const now = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('products')
        .update({ ...data, updated_at: now })
        .eq('id', id);
      if (error) throw new Error(error.message);
    }
    
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, ...data, updated_at: now } : p
      ),
    }));
  },

  deleteProduct: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }

    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    }));
  },

  saveProductComponents: async (productId: string, components: { product_id: string; quantity: number }[]) => {
    if (isSupabaseConfigured && supabase) {
      // Delete existing components for this product
      await supabase.from('product_components').delete().eq('parent_product_id', productId);
      
      // Insert new components
      if (components.length > 0) {
        const { error } = await supabase.from('product_components').insert(
          components.map(c => ({
            parent_product_id: productId,
            child_product_id: c.product_id,
            quantity: c.quantity,
          }))
        );
        if (error) throw new Error(error.message);
      }
    }
  },

  getProductComponents: async (productId: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('product_components')
        .select('*')
        .eq('parent_product_id', productId);
      if (error) throw new Error(error.message);
      return data?.map(c => ({ product_id: c.child_product_id, quantity: c.quantity })) || [];
    }
    return [];
  },

  createAsset: async (data) => {
    const now = new Date().toISOString();
    const newAsset: Asset = {
      id: generateId(),
      ...data,
      location_id: null,
      created_at: now,
      updated_at: now,
    };
    
    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('assets')
        .insert(newAsset)
        .select()
        .single();
      if (error) throw new Error(error.message);
      set((state) => ({ assets: [...state.assets, inserted] }));
      return inserted;
    } else {
      set((state) => ({ assets: [...state.assets, newAsset] }));
      return newAsset;
    }
  },

  deleteAsset: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
    
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    }));
  },
  
  fetchReceipts: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts').select('*').order('created_at', { ascending: false });
    const { data: items, error: itemsError } = await supabase
      .from('receipt_items').select('*');
    if (receiptsError || itemsError) {
      set({ error: receiptsError?.message || itemsError?.message, isLoading: false });
    } else {
      set({ receipts: receipts || [], receiptItems: items || [], isLoading: false });
    }
  },
  
  fetchStock: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('stock').select('*');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ stock: data || [], isLoading: false });
    }
  },
  
  fetchMaterialStock: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('material_stock').select('*');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ materialStock: data || [], isLoading: false });
    }
  },
  
  fetchInspections: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data: inspections, error: inspError } = await supabase
      .from('inspections').select('*').order('created_at', { ascending: false });
    const { data: fills, error: fillsError } = await supabase
      .from('fills').select('*');
    if (inspError || fillsError) {
      set({ error: inspError?.message || fillsError?.message, isLoading: false });
    } else {
      set({ inspections: inspections || [], fills: fills || [], isLoading: false });
    }
  },
  
  fetchOrders: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data: orders, error: ordersError } = await supabase
      .from('orders').select('*').order('created_at', { ascending: false });
    const { data: items, error: itemsError } = await supabase
      .from('order_items').select('*');
    if (ordersError || itemsError) {
      set({ error: ordersError?.message || itemsError?.message, isLoading: false });
    } else {
      set({ orders: orders || [], orderItems: items || [], isLoading: false });
    }
  },
  
  fetchSeparationJobs: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('separation_jobs').select('*');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ separationJobs: data || [], isLoading: false });
    }
  },
  
  fetchInventoryCounts: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data: counts, error: countsError } = await supabase
      .from('inventory_counts').select('*').order('created_at', { ascending: false });
    const { data: lines, error: linesError } = await supabase
      .from('inventory_count_lines').select('*');
    if (countsError || linesError) {
      set({ error: countsError?.message || linesError?.message, isLoading: false });
    } else {
      set({ inventoryCounts: counts || [], inventoryCountLines: lines || [], isLoading: false });
    }
  },
  
  fetchMovements: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('movements').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ movements: data || [], isLoading: false });
    }
  },
  
  createReceipt: async (data) => {
    const state = get();
    const now = new Date().toISOString();
    const receipt: Receipt = {
      id: generateId(),
      receipt_number: generateReceiptNumber(),
      nf_number: data.nf_number,
      supplier: data.supplier,
      receipt_date: data.receipt_date,
      location_id: data.location_id,
      status: 'pending',
      notes: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    };
    
    const newReceiptItems: ReceiptItem[] = data.items.map(item => ({
      id: generateId(),
      receipt_id: receipt.id,
      product_id: item.product_id,
      quantity: item.quantity,
      lot: item.lot || null,
      source_box_codes: item.source_box_codes || null,
      created_at: now,
    }));
    
    const newStock: Stock[] = [];
    const newMaterialStock: MaterialStock[] = [];
    
    for (const item of data.items) {
      const product = state.products.find(p => p.id === item.product_id);
      if (!product) continue;
      
      if (product.kind === 'pop') {
        newStock.push({
          id: generateId(),
          stock_number: generateStockNumber('CX'),
          product_id: item.product_id,
          asset_id: null,
          quantity: item.quantity,
          location_id: data.location_id,
          grade: null,
          physical_state: 'liquid',
          status: 'analysis',
          is_active_separation: false,
          lot: item.lot || null,
          fifo_date: data.receipt_date,
          received_date: data.receipt_date,
          packed_at: null,
          receipt_id: receipt.id,
          inspection_id: null,
          fill_id: null,
          created_at: now,
          updated_at: now,
        });
      } else {
        newMaterialStock.push({
          id: generateId(),
          stock_number: generateStockNumber('MAT'),
          product_id: item.product_id,
          quantity: item.quantity,
          location_id: data.location_id,
          status: 'analysis',
          lot: item.lot || null,
          receipt_id: receipt.id,
          source_box_codes: item.source_box_codes || null,
          created_at: now,
          updated_at: now,
        });
      }
      
      if (item.source_box_codes) {
        for (const code of item.source_box_codes) {
          const normalizedCode = normalizeAssetCode(code);
          const existingAsset = state.assets.find(a => a.code === normalizedCode);
          if (!existingAsset) {
            const newAsset: Asset = {
              id: generateId(),
              code: normalizedCode,
              name: normalizedCode,
              type: 'caixa_preta',
              location_id: data.location_id,
              status: 'with_product',
              is_active: true,
              created_at: now,
              updated_at: now,
            };
            set(s => ({ assets: [...s.assets, newAsset] }));
          } else {
            set(s => ({
              assets: s.assets.map(a => 
                a.code === normalizedCode 
                  ? { ...a, status: 'with_product' as const, location_id: data.location_id, updated_at: now }
                  : a
              )
            }));
          }
        }
      }
    }
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('receipts').insert(receipt);
      if (error) throw new Error(error.message);
      await supabase.from('receipt_items').insert(newReceiptItems);
      if (newStock.length) await supabase.from('stock').insert(newStock);
      if (newMaterialStock.length) await supabase.from('material_stock').insert(newMaterialStock);
    }
    
    set(s => ({
      receipts: [receipt, ...s.receipts],
      receiptItems: [...s.receiptItems, ...newReceiptItems],
      stock: [...s.stock, ...newStock],
      materialStock: [...s.materialStock, ...newMaterialStock],
    }));
    
    return receipt;
  },
  
  createInspection: async (data) => {
    const state = get();
    const now = new Date().toISOString();
    
    const inspection: Inspection = {
      id: generateId(),
      inspection_number: generateInspectionNumber(),
      source_stock_id: data.source_stock_id || null,
      source_material_id: data.source_material_id || null,
      kind: data.kind,
      product_id: data.product_id,
      lot: data.lot || null,
      receipt_id: data.receipt_id || null,
      expected_quantity: data.expected_quantity,
      actual_quantity: data.actual_quantity,
      rejected_quantity: data.rejected_quantity,
      count_aaa: data.count_aaa || 0,
      count_b: data.count_b || 0,
      count_c: data.count_c || 0,
      destination_aaa: data.destination_aaa || null,
      destination_b: data.destination_b || null,
      destination_c: data.destination_c || null,
      fifo_date: data.fifo_date || null,
      reason: data.reason || null,
      scan_packing: data.scan_packing ?? true,
      completed_at: now,
      completed_by: null,
      created_at: now,
    };
    
    const newStock: Stock[] = [];
    const product = state.products.find(p => p.id === data.product_id);
    
    if (data.kind === 'pop') {
      if (data.source_stock_id) {
        set(s => ({
          stock: s.stock.filter(st => st.id !== data.source_stock_id)
        }));
      }
      
      const grades: Array<{ grade: StockGrade; count: number; dest: string | null }> = [
        { grade: 'AAA', count: data.count_aaa || 0, dest: data.destination_aaa || null },
        { grade: 'B', count: data.count_b || 0, dest: data.destination_b || null },
        { grade: 'C', count: data.count_c || 0, dest: data.destination_c || null },
      ];
      
      for (const { grade, count, dest } of grades) {
        if (count > 0) {
          newStock.push({
            id: generateId(),
            stock_number: generateStockNumber('PEND'),
            product_id: data.product_id,
            asset_id: null,
            quantity: count,
            location_id: dest || state.locations[0].id,
            grade,
            physical_state: 'liquid',
            status: 'awaiting_packing',
            is_active_separation: false,
            lot: data.lot || null,
            fifo_date: data.fifo_date || null,
            received_date: null,
            packed_at: null,
            receipt_id: data.receipt_id || null,
            inspection_id: inspection.id,
            fill_id: null,
            created_at: now,
            updated_at: now,
          });
        }
      }
      
      if (data.rejected_quantity > 0) {
        newStock.push({
          id: generateId(),
          stock_number: generateStockNumber('BLQ'),
          product_id: data.product_id,
          asset_id: null,
          quantity: data.rejected_quantity,
          location_id: state.locations[0].id,
          grade: 'blocked',
          physical_state: 'liquid',
          status: 'blocked',
          is_active_separation: false,
          lot: data.lot || null,
          fifo_date: data.fifo_date || null,
          received_date: null,
          packed_at: null,
          receipt_id: data.receipt_id || null,
          inspection_id: inspection.id,
          fill_id: null,
          created_at: now,
          updated_at: now,
        });
      }
    } else {
      if (data.source_material_id) {
        set(s => ({
          materialStock: s.materialStock.map(m => 
            m.id === data.source_material_id
              ? { ...m, status: 'available' as const, quantity: data.actual_quantity - data.rejected_quantity, updated_at: now }
              : m
          )
        }));
      }
    }
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('inspections').insert(inspection);
      if (error) throw new Error(error.message);
      if (newStock.length) await supabase.from('stock').insert(newStock);
    }
    
    set(s => ({
      inspections: [inspection, ...s.inspections],
      stock: [...s.stock, ...newStock],
    }));
    
    return inspection;
  },
  
  createFill: async (data) => {
    const state = get();
    const now = new Date().toISOString();
    
    const poolStock = state.stock.find(s => s.id === data.pool_stock_id);
    if (!poolStock) throw new Error('Pool stock not found');
    
    const asset = state.assets.find(a => a.id === data.asset_id);
    if (!asset) throw new Error('Asset not found');
    
    const existingStock = state.stock.find(s => s.asset_id === data.asset_id && s.quantity > 0);
    if (existingStock) throw new Error('Asset already has stock');
    
    const inspection = state.inspections.find(i => i.id === data.inspection_id);
    
    const fill: Fill = {
      id: generateId(),
      fill_number: generateFillNumber(),
      batch_id: data.batch_id || null,
      asset_id: data.asset_id,
      stock_id: '', 
      inspection_id: data.inspection_id,
      quantity: data.quantity,
      product_id: poolStock.product_id,
      grade: poolStock.grade as 'AAA' | 'B' | 'C',
      lot: poolStock.lot,
      fifo_date: poolStock.fifo_date,
      location_id: data.location_id,
      filled_at: now,
      filled_by: null,
    };
    
    const newStock: Stock = {
      id: generateId(),
      stock_number: asset.code,
      product_id: poolStock.product_id,
      asset_id: data.asset_id,
      quantity: data.quantity,
      location_id: data.location_id,
      grade: poolStock.grade,
      physical_state: 'liquid',
      status: 'available',
      is_active_separation: false,
      lot: poolStock.lot,
      fifo_date: poolStock.fifo_date,
      received_date: poolStock.received_date,
      packed_at: now,
      receipt_id: poolStock.receipt_id,
      inspection_id: data.inspection_id,
      fill_id: fill.id,
      created_at: now,
      updated_at: now,
    };
    
    fill.stock_id = newStock.id;
    
    const newPoolQuantity = poolStock.quantity - data.quantity;
    
    if (isSupabaseConfigured && supabase) {
      await supabase.from('stock').insert(newStock);
      await supabase.from('fills').insert(fill);
      await supabase.from('stock').update({ quantity: newPoolQuantity, updated_at: now }).eq('id', data.pool_stock_id);
      await supabase.from('assets').update({ status: 'with_product', location_id: data.location_id, updated_at: now }).eq('id', data.asset_id);
    }
    
    set(s => ({
      fills: [...s.fills, fill],
      stock: [
        ...s.stock.map(st => 
          st.id === data.pool_stock_id ? { ...st, quantity: newPoolQuantity, updated_at: now } : st
        ),
        newStock
      ],
      assets: s.assets.map(a => 
        a.id === data.asset_id ? { ...a, status: 'with_product' as const, location_id: data.location_id, updated_at: now } : a
      ),
    }));
    
    return fill;
  },
  
  createMovement: async (data) => {
    const now = new Date().toISOString();
    const movement: Movement = {
      id: generateId(),
      movement_number: generateMovementNumber(),
      type: data.type,
      stock_id: data.stock_id || null,
      asset_id: data.asset_id || null,
      order_id: data.order_id || null,
      inspection_id: data.inspection_id || null,
      inventory_count_id: data.inventory_count_id || null,
      from_location_id: data.from_location_id || null,
      to_location_id: data.to_location_id || null,
      quantity: data.quantity ?? null,
      quantity_before: data.quantity_before ?? null,
      quantity_after: data.quantity_after ?? null,
      reason: data.reason || null,
      notes: data.notes || null,
      created_by: null,
      created_at: now,
    };
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('movements').insert(movement);
      if (error) throw new Error(error.message);
    }
    
    set(s => ({ movements: [movement, ...s.movements] }));
    return movement;
  },
  
  createOrder: async (data) => {
    const state = get();
    const now = new Date().toISOString();
    
    const order: Order = {
      id: generateId(),
      order_number: generateOrderNumber(),
      requester_id: null,
      requester_name: data.requester_name,
      organization: data.organization,
      recipient_name: data.recipient_name,
      recipient_contact: data.recipient_contact,
      recipient_email: data.recipient_email || null,
      customer_reference: data.customer_reference || null,
      order_type: data.order_type,
      needed_date: data.needed_date,
      needed_time: data.needed_time,
      fulfillment: data.fulfillment,
      address: data.address || null,
      event_name: data.event_name || null,
      event_start: data.event_start || null,
      event_end: data.event_end || null,
      pickup_at: data.pickup_at || null,
      onsite_contact: data.onsite_contact || null,
      audience: data.audience || null,
      reserve_from: data.reserve_from || null,
      reserve_until: data.reserve_until || null,
      payment_terms: data.payment_terms || null,
      billable: data.billable || null,
      no_charge_reason: data.no_charge_reason || null,
      reference: data.reference || null,
      return_description: data.return_description || null,
      item_notes: data.item_notes || null,
      notes: data.notes || null,
      status: 'received',
      created_at: now,
      updated_at: now,
    };
    
    const orderItems: OrderItem[] = data.items.map(item => ({
      id: generateId(),
      order_id: order.id,
      product_id: item.product_id || null,
      asset_id: item.asset_id || null,
      name: item.name,
      code: item.code,
      quantity: item.quantity,
      unit: item.unit,
      requested_state: item.requested_state || null,
      is_returnable: item.is_returnable,
      is_checked: false,
      created_at: now,
    }));
    
    const separationJob: SeparationJob = {
      id: generateId(),
      order_id: order.id,
      delivery_driver: null,
      pickup_driver: null,
      vehicle: null,
      departure_at: null,
      return_at: null,
      stage: 'a_separar',
      operations_notes: null,
      created_at: now,
      updated_at: now,
    };
    
    const reservations: EquipmentReservation[] = [];
    if (data.equipment_ids && data.reserve_from && data.reserve_until) {
      for (const assetId of data.equipment_ids) {
        reservations.push({
          id: generateId(),
          asset_id: assetId,
          order_id: order.id,
          reserved_from: data.reserve_from,
          reserved_until: data.reserve_until,
          holder_name: order.order_number,
          status: 'active',
          created_at: now,
        });
      }
    }
    
    if (isSupabaseConfigured && supabase) {
      await supabase.from('orders').insert(order);
      await supabase.from('order_items').insert(orderItems);
      await supabase.from('separation_jobs').insert(separationJob);
      if (reservations.length) await supabase.from('equipment_reservations').insert(reservations);
    }
    
    set(s => ({
      orders: [order, ...s.orders],
      orderItems: [...s.orderItems, ...orderItems],
      separationJobs: [...s.separationJobs, separationJob],
      equipmentReservations: [...s.equipmentReservations, ...reservations],
    }));
    
    return order;
  },
  
  createInventoryCount: async (locationId) => {
    const now = new Date().toISOString();
    const count: InventoryCount = {
      id: generateId(),
      count_number: generateCountNumber(),
      location_id: locationId,
      status: 'counting',
      started_at: now,
      started_by: null,
      completed_at: null,
      operator_notes: null,
      reviewed_at: null,
      reviewed_by: null,
      review_decision: null,
      review_comment: null,
      created_at: now,
    };
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('inventory_counts').insert(count);
      if (error) throw new Error(error.message);
    }
    
    set(s => ({ inventoryCounts: [count, ...s.inventoryCounts] }));
    return count;
  },
  
  updateStock: async (id, data) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('stock').update({ ...data, updated_at: now }).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set(s => ({
      stock: s.stock.map(st => st.id === id ? { ...st, ...data, updated_at: now } : st)
    }));
  },
  
  updateMaterialStock: async (id, data) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('material_stock').update({ ...data, updated_at: now }).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set(s => ({
      materialStock: s.materialStock.map(m => m.id === id ? { ...m, ...data, updated_at: now } : m)
    }));
  },
  
  updateOrder: async (id, data) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('orders').update({ ...data, updated_at: now }).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set(s => ({
      orders: s.orders.map(o => o.id === id ? { ...o, ...data, updated_at: now } : o)
    }));
  },
  
  updateSeparationJob: async (id, data) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('separation_jobs').update({ ...data, updated_at: now }).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set(s => ({
      separationJobs: s.separationJobs.map(j => j.id === id ? { ...j, ...data, updated_at: now } : j)
    }));
  },
  
  updateInventoryCount: async (id, data) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('inventory_counts').update(data).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set(s => ({
      inventoryCounts: s.inventoryCounts.map(c => c.id === id ? { ...c, ...data } : c)
    }));
  },
  
  updateAsset: async (id, data) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('assets').update({ ...data, updated_at: now }).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set(s => ({
      assets: s.assets.map(a => a.id === id ? { ...a, ...data, updated_at: now } : a)
    }));
  },
  
  transferBoxes: async (boxIds, destinationId) => {
    const state = get();
    const now = new Date().toISOString();
    
    const stockItems = state.stock.filter(s => boxIds.includes(s.id));
    if (stockItems.length !== boxIds.length) {
      throw new Error('Some boxes not found');
    }
    
    for (const stock of stockItems) {
      if (stock.location_id === destinationId) {
        throw new Error(`Box ${stock.stock_number} is already at destination`);
      }
    }
    
    const movements: Movement[] = stockItems.map(stock => ({
      id: generateId(),
      movement_number: generateMovementNumber(),
      type: 'transfer',
      stock_id: stock.id,
      asset_id: stock.asset_id,
      order_id: null,
      inspection_id: null,
      inventory_count_id: null,
      from_location_id: stock.location_id,
      to_location_id: destinationId,
      quantity: stock.quantity,
      quantity_before: stock.quantity,
      quantity_after: stock.quantity,
      reason: null,
      notes: null,
      created_by: null,
      created_at: now,
    }));
    
    if (isSupabaseConfigured && supabase) {
      for (const stock of stockItems) {
        await supabase.from('stock').update({ location_id: destinationId, updated_at: now }).eq('id', stock.id);
        if (stock.asset_id) {
          await supabase.from('assets').update({ location_id: destinationId, updated_at: now }).eq('id', stock.asset_id);
        }
      }
      await supabase.from('movements').insert(movements);
    }
    
    set(s => ({
      stock: s.stock.map(st => 
        boxIds.includes(st.id) ? { ...st, location_id: destinationId, updated_at: now } : st
      ),
      assets: s.assets.map(a => {
        const relatedStock = stockItems.find(st => st.asset_id === a.id);
        return relatedStock ? { ...a, location_id: destinationId, updated_at: now } : a;
      }),
      movements: [...movements, ...s.movements],
    }));
  },
  
  withdrawFromBox: async (boxId, quantity, reason) => {
    const state = get();
    const now = new Date().toISOString();
    
    const stock = state.stock.find(s => s.id === boxId);
    if (!stock) throw new Error('Box not found');
    if (stock.quantity < quantity) throw new Error('Insufficient quantity');
    
    const newQuantity = stock.quantity - quantity;
    
    const movement: Movement = {
      id: generateId(),
      movement_number: generateMovementNumber(),
      type: 'withdrawal',
      stock_id: boxId,
      asset_id: stock.asset_id,
      order_id: null,
      inspection_id: null,
      inventory_count_id: null,
      from_location_id: stock.location_id,
      to_location_id: null,
      quantity,
      quantity_before: stock.quantity,
      quantity_after: newQuantity,
      reason,
      notes: null,
      created_by: null,
      created_at: now,
    };
    
    if (isSupabaseConfigured && supabase) {
      await supabase.from('stock').update({ 
        quantity: newQuantity, 
        is_active_separation: newQuantity > 0 ? stock.is_active_separation : false,
        status: newQuantity > 0 ? stock.status : 'depleted',
        updated_at: now 
      }).eq('id', boxId);
      await supabase.from('movements').insert(movement);
    }
    
    set(s => ({
      stock: s.stock.map(st => 
        st.id === boxId ? { 
          ...st, 
          quantity: newQuantity, 
          is_active_separation: newQuantity > 0 ? st.is_active_separation : false,
          status: newQuantity > 0 ? st.status : 'depleted',
          updated_at: now 
        } : st
      ),
      movements: [movement, ...s.movements],
    }));
  },
}));

export const useLocations = () => useAppStore(state => state.locations);
export const useProducts = () => useAppStore(state => state.products);
export const useAssets = () => useAppStore(state => state.assets);
export const useStock = () => useAppStore(state => state.stock);
export const useMaterialStock = () => useAppStore(state => state.materialStock);
export const useOrders = () => useAppStore(state => state.orders);
export const useOrderItems = () => useAppStore(state => state.orderItems);
export const useSeparationJobs = () => useAppStore(state => state.separationJobs);
export const useInspections = () => useAppStore(state => state.inspections);
export const useFills = () => useAppStore(state => state.fills);
export const useMovements = () => useAppStore(state => state.movements);
export const useInventoryCounts = () => useAppStore(state => state.inventoryCounts);
export const useReceipts = () => useAppStore(state => state.receipts);
