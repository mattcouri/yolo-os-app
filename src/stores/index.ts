import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isSalaTradeLocation, locationPurpose, orderedUniformYardLocations, productStockLocations } from '@/lib/locations';
import {
  ASSET_CLEAN_SYSTEM_KEY,
  ASSET_DIRTY_SYSTEM_KEY,
  ASSET_FACTORY_SYSTEM_KEY,
  cleanLocation,
  defaultYardLocation,
  factoryLocation,
  getBoxUnitCapacity,
  isBoxAsset,
  needsYardLocation,
  planAssetPlacement,
  resolvedAssetLocationId,
  suggestedBoxCode,
} from '@/lib/operational-assets';
import {
  declaredQuantity,
  liveCountedForItem,
  liveCountedQuantity,
  remainingQuantity,
  sourceMaterialForLine,
  sourceStockForLine,
  varianceQuantity,
} from '@/lib/receipt-progress';
import { locationRequiresBox } from '@/lib/stock-placement';
import { TRANSIT_COLUMN, boxMatchesLocation, canRetireBox, canSendToFactory, isBoxType, boxTypeLabel } from '@/lib/packaging-board';
import { UNIFORM_STAY_OUT_NOTE, checkoutStaysOut } from '@/lib/kit-availability';
import {
  UNIFORM_SIZES,
  UNIFORM_STREET_COLUMN,
  applyUniformStockDeltas,
  availableForSize,
  stockQtyAt,
  stockQtyForSize,
  takeUniformFromYards,
  totalForSize,
} from '@/lib/uniforms';
import { checkoutMatchesItem } from '@/lib/ativos-na-rua';
import {
  closeOutLinesFromUnits,
  returnUnitAssetStatus,
  type ReturnUnit,
} from '@/lib/separacao';
import {
  ASSEMBLED_SYSTEM_KEY,
  assembledLocation,
  assembledOnHand,
  bomNeeds,
  boxCapacity,
  findAssemblyBox,
  physicalStateOf,
  restockNote,
} from '@/lib/assembly';
import type {
  Location, Product, ProductComponent, Asset, Receipt, ReceiptItem, Stock, MaterialStock,
  Inspection, Fill, Movement, InventoryCount, InventoryCountLine,
  Order, OrderItem, SeparationJob, EquipmentReservation,
  OrderType, FulfillmentMethod, SeparationStage, StockGrade,
  PhysicalState, StockStatus, AssetComponent, AssetAttachment,
  Uniform, UniformCheckout, UniformSize, UniformStock, Vehicle
} from '@/types/database';

interface AppState {
  isLoading: boolean;
  error: string | null;
  
  locations: Location[];
  products: Product[];
  productComponents: ProductComponent[];
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
  uniforms: Uniform[];
  uniformCheckouts: UniformCheckout[];
  uniformStock: UniformStock[];
  vehicles: Vehicle[];
  
  fetchAll: () => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchProductComponents: () => Promise<void>;
  saveProductComponents: (productId: string, components: { product_id: string; quantity: number }[]) => Promise<void>;
  getProductComponents: (productId: string) => Promise<{ product_id: string; quantity: number }[]>;
  getAllProductComponents: () => Promise<{ parent_product_id: string; child_product_id: string; quantity: number }[]>;
  ensureAssembledLocation: () => Promise<Location>;
  ensureAssetYardLocations: () => Promise<void>;
  ensureAssetPlaces: () => Promise<void>;
  ensureSeparationJobs: () => Promise<void>;
  fetchAssets: () => Promise<void>;
  fetchReceipts: () => Promise<void>;
  fetchStock: () => Promise<void>;
  fetchMaterialStock: () => Promise<void>;
  fetchInspections: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchSeparationJobs: () => Promise<void>;
  refreshSeparationLive: () => Promise<void>;
  fetchInventoryCounts: () => Promise<void>;
  fetchMovements: () => Promise<void>;
  
  createReceipt: (data: CreateReceiptData) => Promise<Receipt>;
  updateReceipt: (id: string, data: UpdateReceiptData) => Promise<void>;
  closeReceipt: (id: string, notes?: string) => Promise<void>;
  reopenReceipt: (id: string) => Promise<void>;
  deleteReceipt: (id: string) => Promise<void>;
  createPrepareBatch: (data: CreatePrepareBatchData) => Promise<Inspection>;
  createMovement: (data: CreateMovementData) => Promise<Movement>;
  createOrder: (data: CreateOrderData) => Promise<Order>;
  updatePlacedOrder: (orderId: string, data: CreateOrderData) => Promise<Order>;
  cancelPlacedOrder: (orderId: string) => Promise<void>;
  deleteClosedOrder: (orderId: string) => Promise<void>;
  createInventoryCount: (locationId: string) => Promise<InventoryCount>;
  
  updateStock: (id: string, data: Partial<Stock>) => Promise<void>;
  adjustSkuQuantity: (productId: string, newQuantity: number) => Promise<void>;
  adjustBoxTypeQuantity: (type: Asset['type'], newQuantity: number, locationId?: string | null) => Promise<void>;
  moveBoxTypeLocation: (type: Asset['type'], fromLocationId: string | null, toLocationId: string | null) => Promise<void>;
  updateMaterialStock: (id: string, data: Partial<MaterialStock>) => Promise<void>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  updateOrderItem: (id: string, data: Partial<OrderItem>) => Promise<void>;
  updateSeparationJob: (id: string, data: Partial<SeparationJob>) => Promise<void>;
  updateInventoryCount: (id: string, data: Partial<InventoryCount>) => Promise<void>;
  updateAsset: (id: string, data: Partial<Asset>) => Promise<void>;
  
  createLocation: (data: Omit<Location, 'id' | 'created_at' | 'updated_at'>) => Promise<Location>;
  updateLocation: (id: string, data: Partial<Location>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  createProduct: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createAsset: (data: Partial<Asset> & Pick<Asset, 'code' | 'name' | 'type'>) => Promise<Asset>;
  createAssets: (rows: Array<Partial<Asset> & Pick<Asset, 'code' | 'name' | 'type'>>) => Promise<Asset[]>;
  deleteAsset: (id: string) => Promise<void>;
  fetchAssetComponents: (assetId: string) => Promise<AssetComponent[]>;
  replaceAssetComponents: (assetId: string, components: Omit<AssetComponent, 'id' | 'parent_asset_id' | 'created_at'>[]) => Promise<AssetComponent[]>;
  fetchAssetAttachments: (assetId: string) => Promise<AssetAttachment[]>;
  addAssetAttachment: (data: Omit<AssetAttachment, 'id' | 'created_at'>) => Promise<AssetAttachment>;
  deleteAssetAttachment: (id: string) => Promise<void>;
  fetchEquipmentReservations: () => Promise<void>;
  fetchUniforms: () => Promise<void>;
  seedUniformStockIfNeeded: () => Promise<void>;
  moveUniformUnit: (input: {
    uniformId: string;
    size: UniformSize;
    fromColumn: string;
    toColumn: string;
    checkoutId?: string | null;
  }) => Promise<void>;
  fetchVehicles: () => Promise<void>;
  createVehicle: (name: string) => Promise<Vehicle>;
  updateVehicle: (id: string, name: string) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  createUniform: (data: Omit<Uniform, 'id' | 'created_at' | 'updated_at'>) => Promise<Uniform>;
  updateUniform: (id: string, data: Partial<Uniform>) => Promise<void>;
  deleteUniform: (id: string) => Promise<void>;
  checkoutUniforms: (orderId: string, lines: { uniform_id: string; size: UniformSize; quantity: number }[]) => Promise<void>;
  returnUniformsForOrder: (
    orderId: string,
    stayOut?: { id: string; remaining: number }[]
  ) => Promise<void>;
  completeEquipmentForOrder: (orderId: string, stayOutAssetIds?: string[]) => Promise<void>;
  closeSeparationOrder: (orderId: string, units: ReturnUnit[], notes?: string) => Promise<void>;
  dispatchOrderItem: (orderId: string, itemId: string) => Promise<void>;
  
  transferBoxes: (boxIds: string[], destinationId: string) => Promise<void>;
  sendBoxesToFactory: (assetIds: string[]) => Promise<void>;
  withdrawFromBox: (boxId: string, quantity: number, reason: string) => Promise<void>;
  promoteAssemblyBox: (stockId: string) => Promise<void>;
  scanEmptyAssemblyBox: (stockId: string) => Promise<void>;
  assembleSku: (productId: string, quantity: number, physicalState: PhysicalState) => Promise<void>;
  unbuildSku: (stockId: string, quantity: number) => Promise<void>;
  
  clearError: () => void;
}

interface CreateReceiptData {
  nf_number: string;
  supplier: string;
  receipt_date: string;
  location_id: string;
  direct?: boolean;
  close_notes?: string;
  items: {
    product_id: string;
    quantity: number;
    lot?: string;
    source_box_codes?: string[];
  }[];
}

interface UpdateReceiptData {
  nf_number?: string;
  supplier?: string;
  receipt_date?: string;
  notes?: string | null;
  items?: { id: string; quantity: number; lot: string | null }[];
}

export interface PrepareGradeFill {
  grade: 'AAA' | 'B' | 'C' | 'blocked';
  quantity: number;
  location_id: string;
  mode: 'boxed' | 'loose' | 'discard';
  boxes: { asset_id: string; quantity: number }[];
}

export interface CreatePrepareBatchData {
  kind: 'pop' | 'material';
  source_stock_id?: string;
  source_material_id?: string;
  product_id: string;
  lot?: string;
  receipt_id?: string;
  expected_quantity: number;
  actual_quantity: number;
  rejected_quantity: number;
  reason?: string;
  fifo_date?: string;
  destination_material?: string;
  grades?: PrepareGradeFill[];
  emptied_asset_ids?: string[];
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
  requester_id?: string;
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
  pickup_fulfillment?: FulfillmentMethod;
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
  uniforms?: { uniform_id: string; size: UniformSize; quantity: number; returns?: boolean }[];
  returning_equipment_ids?: string[];
}

const generateId = () => crypto.randomUUID();
const VEHICLES_KEY = 'yolo-os-vehicles';

function readLocalVehicles(): Vehicle[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(VEHICLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Vehicle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalVehicles(rows: Vehicle[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VEHICLES_KEY, JSON.stringify(rows));
}

function missingRelation(message: string) {
  return /schema cache|does not exist|Could not find the table/i.test(message);
}

function salaTradeId(locations: Location[]) {
  return locations.find((location) => location.is_active && isSalaTradeLocation(location))?.id || '';
}

function dirtyYardId(locations: Location[]) {
  return orderedUniformYardLocations(locations).find((location) => location.system_key === 'asset_dirty')?.id || '';
}

async function saveUniformStock(prev: UniformStock[], next: UniformStock[]) {
  if (!isSupabaseConfigured || !supabase) return;
  const nextIds = new Set(next.map((row) => row.id));
  const deleted = prev.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
  const upserts = next.filter((row) => {
    const old = prev.find((item) => item.id === row.id);
    return !old || old.quantity !== row.quantity || old.location_id !== row.location_id;
  });
  if (deleted.length) {
    const result = await supabase.from('uniform_stock').delete().in('id', deleted);
    if (result.error && !missingRelation(result.error.message)) throw new Error(result.error.message);
  }
  if (upserts.length) {
    const result = await supabase.from('uniform_stock').upsert(upserts);
    if (result.error && !missingRelation(result.error.message)) throw new Error(result.error.message);
  }
}

function deductStockForLines(
  stock: UniformStock[],
  locations: Location[],
  lines: { uniform_id: string; size: UniformSize; quantity: number }[]
) {
  let next = stock;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const taken = takeUniformFromYards(next, locations, line.uniform_id, line.size, line.quantity);
    next = applyUniformStockDeltas(next, taken.deltas);
  }
  return next;
}

function addStockForLines(
  stock: UniformStock[],
  locationId: string,
  lines: { uniform_id: string; size: UniformSize; quantity: number }[]
) {
  if (!locationId) return stock;
  return applyUniformStockDeltas(
    stock,
    lines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        uniform_id: line.uniform_id,
        size: line.size,
        location_id: locationId,
        delta: line.quantity,
      }))
  );
}

function jobStageFromOrder(status: Order['status']): SeparationStage {
  if (status === 'em_separacao' || status === 'na_rua' || status === 'retorno') return status;
  return 'a_separar';
}

function blankSeparationJob(orderId: string, stage: SeparationStage = 'a_separar'): SeparationJob {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    order_id: orderId,
    delivery_driver: null,
    pickup_driver: null,
    vehicle: null,
    pickup_vehicle: null,
    departure_at: null,
    return_at: null,
    stage,
    operations_notes: null,
    created_at: now,
    updated_at: now,
  };
}

async function persistSeparationJob(job: SeparationJob) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('separation_jobs').insert(job);
  if (!error) return;
  if (/pickup_vehicle/i.test(error.message)) {
    const { pickup_vehicle: _ignored, ...rest } = job;
    const retry = await supabase.from('separation_jobs').insert(rest);
    if (retry.error) throw new Error(retry.error.message);
    return;
  }
  throw new Error(error.message);
}
const usedCodes = new Set<string>();

function rememberCodes(values: (string | null | undefined)[]) {
  for (const value of values) {
    if (value) usedCodes.add(value.toUpperCase());
  }
}

function allocateCode(prefix: string, pad = 3) {
  let n = 1;
  while (usedCodes.has(`${prefix}-${String(n).padStart(pad, '0')}`.toUpperCase())) n += 1;
  const code = `${prefix}-${String(n).padStart(pad, '0')}`;
  usedCodes.add(code.toUpperCase());
  return code;
}

const generateStockNumber = (prefix = 'CX') => allocateCode(prefix, 3);
const generateReceiptNumber = () => allocateCode('REC', 3);
const generateInspectionNumber = () => allocateCode('INS', 3);
const generateFillNumber = () => allocateCode('ENV', 4);
const generateMovementNumber = () => allocateCode('MOV', 4);
const generateOrderNumber = () => allocateCode('PED', 4);
const generateCountNumber = () => allocateCode('INV', 3);

async function syncCompositeRestock(
  get: () => AppState,
  productId: string,
  physicalState: PhysicalState
) {
  const state = get();
  const product = state.products.find((item) => item.id === productId);
  if (!product?.is_composite) return;
  const location = assembledLocation(state.locations);
  const onHand = assembledOnHand(state.stock, productId, physicalState, location?.id);
  const note = restockNote(productId, physicalState);
  const existing = state.orders.find(
    (order) =>
      order.notes === note &&
      order.status !== 'cancelled' &&
      order.status !== 'completed'
  );
  const min = product.min_quantity || 0;
  if (min <= 0 || onHand >= min) {
    if (existing) await get().updateOrder(existing.id, { status: 'cancelled' });
    return;
  }
  if (existing) return;
  const need = min - onHand;
  await get().createOrder({
    requester_name: 'YOLO OS',
    organization: 'Reposição interna',
    recipient_name: 'Packing',
    recipient_contact: '—',
    order_type: 'solicitacao_interna',
    needed_date: new Date().toISOString().slice(0, 10),
    needed_time: '12:00',
    fulfillment: 'uso_interno',
    billable: 'no',
    notes: note,
    items: [
      {
        product_id: product.id,
        name: product.name,
        code: product.code,
        quantity: need,
        unit: product.unit,
        requested_state: physicalState,
        is_returnable: false,
      },
    ],
  });
}

const normalizeAssetCode = (code: string) => 
  code.trim().toUpperCase().replace(/[\s_-]+/g, '-');

const defaultLocations: Location[] = [
  { id: '1', name: 'Recebimento', type: 'receiving', purpose: 'product', is_active: true, sort_order: 0, requires_box: true, system_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'Resfriado', type: 'storage', purpose: 'product', is_active: true, sort_order: 1, requires_box: true, system_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'Congelado', type: 'freezer', purpose: 'product', is_active: true, sort_order: 2, requires_box: true, system_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', name: 'Estoque seco', type: 'storage', purpose: 'product', is_active: true, sort_order: 3, requires_box: true, system_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', name: 'Freezer cozinha', type: 'freezer', purpose: 'product', is_active: true, sort_order: 4, requires_box: false, system_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', name: 'Expedição', type: 'shipping', purpose: 'product', is_active: true, sort_order: 5, requires_box: true, system_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '7', name: 'Produtos montados', type: 'storage', purpose: 'product', is_active: true, sort_order: 90, requires_box: false, system_key: ASSEMBLED_SYSTEM_KEY, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '8', name: 'Área suja', type: 'other', purpose: 'asset', is_active: true, sort_order: 100, requires_box: false, system_key: ASSET_DIRTY_SYSTEM_KEY, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '9', name: 'Área limpa', type: 'other', purpose: 'asset', is_active: true, sort_order: 101, requires_box: false, system_key: ASSET_CLEAN_SYSTEM_KEY, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '10', name: 'Fábrica', type: 'other', purpose: 'asset', is_active: true, sort_order: 102, requires_box: false, system_key: ASSET_FACTORY_SYSTEM_KEY, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const defaultProducts: Product[] = [
  { id: '1', code: 'YOL-001', name: 'YOLO Pop · Morango', flavor: 'Morango', description: null, kind: 'pop', unit: 'un', category: null, product_line: null, format: null, base_quantity: 1, is_composite: false, min_quantity: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', code: 'YOL-002', name: 'YOLO Pop · Maracujá', flavor: 'Maracujá', description: null, kind: 'pop', unit: 'un', category: null, product_line: null, format: null, base_quantity: 1, is_composite: false, min_quantity: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', code: 'YOL-003', name: 'YOLO Pop · Limão', flavor: 'Limão', description: null, kind: 'pop', unit: 'un', category: null, product_line: null, format: null, base_quantity: 1, is_composite: false, min_quantity: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', code: 'YOL-004', name: 'YOLO Pop · Abacaxi', flavor: 'Abacaxi', description: null, kind: 'pop', unit: 'un', category: null, product_line: null, format: null, base_quantity: 1, is_composite: false, min_quantity: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', code: 'MAT-001', name: 'Caixa de envio', flavor: null, description: null, kind: 'material', unit: 'un', category: 'Embalagem', product_line: null, format: null, base_quantity: 1, is_composite: false, min_quantity: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', code: 'MAT-002', name: 'Insert / encarte', flavor: null, description: null, kind: 'material', unit: 'un', category: 'Material de envio', product_line: null, format: null, base_quantity: 1, is_composite: false, min_quantity: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const defaultAssets: Asset[] = [
  { id: '1', code: 'FREEZER-001', name: 'Freezer 1', type: 'freezer', location_id: '9', status: 'available', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', code: 'CARRINHO-001', name: 'Carrinho de sorvete 1', type: 'carrinho', location_id: '9', status: 'available', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 3),
    code: `MEDIA-${String(i + 1).padStart(3, '0')}`,
    name: `Caixa média ${i + 1}`,
    type: 'caixa_media' as const,
    location_id: '9',
    status: 'available' as const,
    is_active: true,
    unit_capacity: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: String(i + 13),
    code: `PRETA-${String(i + 1).padStart(3, '0')}`,
    name: `Caixa preta ${i + 1}`,
    type: 'caixa_preta' as const,
    location_id: '10',
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
  productComponents: [],
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
  uniforms: [],
  uniformCheckouts: [],
  uniformStock: [],
  vehicles: [],
  
  clearError: () => set({ error: null }),
  
  fetchAll: async () => {
    const state = get();
    await Promise.all([
      state.fetchLocations(),
      state.fetchProducts(),
      state.fetchProductComponents(),
      state.fetchAssets(),
      state.fetchReceipts(),
      state.fetchStock(),
      state.fetchMaterialStock(),
      state.fetchInspections(),
      state.fetchOrders(),
      state.fetchSeparationJobs(),
      state.fetchMovements(),
      state.fetchEquipmentReservations(),
      state.fetchUniforms(),
      state.fetchVehicles(),
    ]);
    await get().seedUniformStockIfNeeded();
    const next = get();
    rememberCodes(next.receipts.map((row) => row.receipt_number));
    rememberCodes(next.stock.map((row) => row.stock_number));
    rememberCodes(next.materialStock.map((row) => row.stock_number));
    rememberCodes(next.inspections.map((row) => row.inspection_number));
    rememberCodes(next.fills.map((row) => row.fill_number));
    rememberCodes(next.movements.map((row) => row.movement_number));
    rememberCodes(next.orders.map((row) => row.order_number));
    rememberCodes(next.inventoryCounts.map((row) => row.count_number));
    await get().ensureAssembledLocation();
    await get().ensureAssetYardLocations();
    await get().ensureAssetPlaces();
    await get().ensureSeparationJobs();
  },
  
  fetchLocations: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('locations').select('*').order('sort_order');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({
        locations: (data || defaultLocations).map((location) => ({
          ...location,
          requires_box: location.requires_box !== false,
          system_key: location.system_key ?? null,
          purpose: locationPurpose(location),
        })),
        isLoading: false,
      });
    }
  },
  
  fetchProducts: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true });
    const { data, error } = await supabase.from('products').select('*').order('code');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({
        products: (data || defaultProducts).map((product) => ({
          ...product,
          min_quantity: product.min_quantity ?? 0,
          is_composite: Boolean(product.is_composite),
          base_quantity: product.base_quantity || 1,
        })),
        isLoading: false,
      });
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
    const purpose = data.purpose === 'asset' ? 'asset' : 'product';
    const newLocation: Location = {
      id: generateId(),
      ...data,
      purpose,
      system_key: data.system_key ?? null,
      requires_box: purpose === 'asset' ? false : data.requires_box !== false,
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
    const location = get().locations.find((item) => item.id === id);
    if (location?.system_key) {
      throw new Error('Este local é do sistema e não pode ser excluído.');
    }
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
      min_quantity: data.min_quantity ?? 0,
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
    const dropFromCatalog = (hardDeleted: boolean) => {
      const now = new Date().toISOString();
      set((state) => ({
        products: hardDeleted
          ? state.products.filter((p) => p.id !== id)
          : state.products.map((p) =>
              p.id === id ? { ...p, is_active: false, updated_at: now } : p
            ),
        productComponents: state.productComponents.filter(
          (row) => row.parent_product_id !== id && row.child_product_id !== id
        ),
      }));
    };

    if (isSupabaseConfigured && supabase) {
      const { error: parentBomError } = await supabase
        .from('product_components')
        .delete()
        .eq('parent_product_id', id);
      if (parentBomError) throw new Error(parentBomError.message);

      const { error: childBomError } = await supabase
        .from('product_components')
        .delete()
        .eq('child_product_id', id);
      if (childBomError) throw new Error(childBomError.message);

      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        dropFromCatalog(true);
        return;
      }

      const now = new Date().toISOString();
      const { error: deactivateError } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: now })
        .eq('id', id);
      if (deactivateError) throw new Error(deactivateError.message);
      dropFromCatalog(false);
      return;
    }

    dropFromCatalog(true);
  },

  fetchProductComponents: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data, error } = await supabase.from('product_components').select('*');
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ productComponents: data || [] });
  },

  saveProductComponents: async (productId, components) => {
    const now = new Date().toISOString();
    const rows: ProductComponent[] = components.map((row) => ({
      id: generateId(),
      parent_product_id: productId,
      child_product_id: row.product_id,
      quantity: row.quantity,
      created_at: now,
      updated_at: now,
    }));

    if (isSupabaseConfigured && supabase) {
      await supabase.from('product_components').delete().eq('parent_product_id', productId);
      if (rows.length > 0) {
        const { data, error } = await supabase
          .from('product_components')
          .insert(
            rows.map(({ id, updated_at, ...row }) => row)
          )
          .select('*');
        if (error) throw new Error(error.message);
        set((state) => ({
          productComponents: [
            ...state.productComponents.filter((item) => item.parent_product_id !== productId),
            ...(data || rows),
          ],
        }));
        return;
      }
    }

    set((state) => ({
      productComponents: [
        ...state.productComponents.filter((item) => item.parent_product_id !== productId),
        ...rows,
      ],
    }));
  },

  getProductComponents: async (productId) => {
    const local = get().productComponents
      .filter((row) => row.parent_product_id === productId)
      .map((row) => ({ product_id: row.child_product_id, quantity: row.quantity }));
    if (local.length > 0 || !isSupabaseConfigured || !supabase) return local;
    const { data, error } = await supabase
      .from('product_components')
      .select('*')
      .eq('parent_product_id', productId);
    if (error) throw new Error(error.message);
    return data?.map((row) => ({ product_id: row.child_product_id, quantity: row.quantity })) || [];
  },

  getAllProductComponents: async () => {
    if (get().productComponents.length > 0) {
      return get().productComponents;
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('product_components').select('*');
      if (error) throw new Error(error.message);
      const rows = data || [];
      set({ productComponents: rows });
      return rows;
    }
    return [];
  },

  ensureAssembledLocation: async () => {
    const existing = assembledLocation(get().locations);
    if (existing) {
      if (existing.purpose !== 'product') {
        await get().updateLocation(existing.id, { purpose: 'product' });
      }
      return get().locations.find((location) => location.id === existing.id) || existing;
    }
    const byName = get().locations.find(
      (location) => location.name.toLowerCase() === 'produtos montados'
    );
    if (byName) {
      await get().updateLocation(byName.id, {
        system_key: ASSEMBLED_SYSTEM_KEY,
        purpose: 'product',
        requires_box: false,
        is_active: true,
      });
      return get().locations.find((location) => location.id === byName.id) || byName;
    }
    return get().createLocation({
      name: 'Produtos montados',
      type: 'storage',
      purpose: 'product',
      is_active: true,
      sort_order: 90,
      requires_box: false,
      system_key: ASSEMBLED_SYSTEM_KEY,
    });
  },

  ensureAssetYardLocations: async () => {
    const yards = [
      { key: ASSET_DIRTY_SYSTEM_KEY, name: 'Área suja', aliases: ['área suja', 'area suja'], sort_order: 100 },
      { key: ASSET_CLEAN_SYSTEM_KEY, name: 'Área limpa', aliases: ['área limpa', 'area limpa'], sort_order: 101 },
      { key: ASSET_FACTORY_SYSTEM_KEY, name: 'Fábrica', aliases: ['fábrica', 'fabrica'], sort_order: 102 },
    ] as const;
    for (const yard of yards) {
      const existing = get().locations.find((location) => location.system_key === yard.key);
      if (existing) {
        if (existing.purpose !== 'asset') {
          await get().updateLocation(existing.id, { purpose: 'asset' });
        }
        continue;
      }
      const byName = get().locations.find((location) =>
        (yard.aliases as readonly string[]).includes(location.name.trim().toLowerCase())
      );
      if (byName) {
        await get().updateLocation(byName.id, {
          system_key: yard.key,
          purpose: 'asset',
          requires_box: false,
          is_active: true,
        });
        continue;
      }
      await get().createLocation({
        name: yard.name,
        type: 'other',
        purpose: 'asset',
        is_active: true,
        sort_order: yard.sort_order,
        requires_box: false,
        system_key: yard.key,
      });
    }
  },

  ensureAssetPlaces: async () => {
    const locations = get().locations;
    const now = new Date().toISOString();
    const updates: { id: string; location_id: string }[] = [];
    for (const asset of get().assets) {
      if (!asset.is_active) continue;
      if (asset.location_id) continue;
      if (!needsYardLocation(asset.status)) continue;
      const location_id = resolvedAssetLocationId(asset, locations);
      if (!location_id) continue;
      updates.push({ id: asset.id, location_id });
    }
    if (updates.length === 0) return;

    if (isSupabaseConfigured && supabase) {
      for (const patch of updates) {
        const { error } = await supabase
          .from('assets')
          .update({ location_id: patch.location_id, updated_at: now })
          .eq('id', patch.id);
        if (error) throw new Error(error.message);
      }
    }

    const byId = new Map(updates.map((patch) => [patch.id, patch.location_id]));
    set((state) => ({
      assets: state.assets.map((asset) =>
        byId.has(asset.id)
          ? { ...asset, location_id: byId.get(asset.id)!, updated_at: now }
          : asset
      ),
    }));
  },

  ensureSeparationJobs: async () => {
    const state = get();
    const missing = state.orders.filter(
      (order) =>
        order.status !== 'cancelled' &&
        order.status !== 'completed' &&
        !state.separationJobs.some((job) => job.order_id === order.id)
    );
    if (missing.length === 0) return;
    const created: SeparationJob[] = [];
    for (const order of missing) {
      const job = blankSeparationJob(order.id, jobStageFromOrder(order.status));
      try {
        await persistSeparationJob(job);
        created.push(job);
      } catch (error) {
        if (error instanceof Error && /duplicate|unique/i.test(error.message)) continue;
      }
    }
    if (created.length === 0) return;
    set((s) => ({
      separationJobs: [
        ...s.separationJobs,
        ...created.filter((job) => !s.separationJobs.some((row) => row.order_id === job.order_id)),
      ],
    }));
  },

  createAsset: async (data) => {
    const now = new Date().toISOString();
    const status = data.status || 'available';
    const location_id =
      data.location_id ||
      (needsYardLocation(status) ? defaultYardLocation(status, get().locations)?.id || null : null);
    const newAsset: Asset = {
      id: generateId(),
      is_active: true,
      description: null,
      control_method: 'individual',
      quantity_on_hand: 1,
      custom_fields: {},
      ...data,
      location_id,
      status,
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

  createAssets: async (rows) => {
    if (rows.length === 0) return [];
    const now = new Date().toISOString();
    const locations = get().locations;
    const newAssets: Asset[] = rows.map((data) => {
      const status = data.status || 'available';
      const location_id =
        data.location_id ||
        (needsYardLocation(status) ? defaultYardLocation(status, locations)?.id || null : null);
      return {
        id: generateId(),
        is_active: true,
        description: null,
        control_method: 'individual',
        quantity_on_hand: 1,
        custom_fields: {},
        ...data,
        location_id,
        status,
        created_at: now,
        updated_at: now,
      };
    });

    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase.from('assets').insert(newAssets).select();
      if (error) throw new Error(error.message);
      const created = inserted || [];
      set((state) => ({ assets: [...state.assets, ...created] }));
      return created;
    }
    set((state) => ({ assets: [...state.assets, ...newAssets] }));
    return newAssets;
  },

  deleteAsset: async (id) => {
    const dropFromCatalog = (hardDeleted: boolean) => {
      const now = new Date().toISOString();
      set((state) => ({
        assets: hardDeleted
          ? state.assets.filter((a) => a.id !== id)
          : state.assets.map((a) =>
              a.id === id ? { ...a, is_active: false, updated_at: now } : a
            ),
      }));
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('asset_attachments').delete().eq('asset_id', id);
      await supabase.from('asset_components').delete().eq('parent_asset_id', id);

      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (!error) {
        dropFromCatalog(true);
        return;
      }

      const now = new Date().toISOString();
      const { data: deactivated, error: deactivateError } = await supabase
        .from('assets')
        .update({ is_active: false, updated_at: now })
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (deactivateError) throw new Error(deactivateError.message);
      if (!deactivated) {
        throw new Error(error.message || 'Não foi possível excluir esta embalagem.');
      }
      dropFromCatalog(false);
      return;
    }

    dropFromCatalog(true);
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
      rememberCodes((receipts || []).map((row) => row.receipt_number));
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
      rememberCodes((data || []).map((row) => row.stock_number));
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
      rememberCodes((data || []).map((row) => row.stock_number));
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
      rememberCodes((inspections || []).map((row) => row.inspection_number));
      rememberCodes((fills || []).map((row) => row.fill_number));
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
      rememberCodes((orders || []).map((row) => row.order_number));
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
      set({
        separationJobs: (data || []).map((job) => ({
          ...job,
          pickup_vehicle: job.pickup_vehicle ?? null,
        })),
        isLoading: false,
      });
    }
  },

  refreshSeparationLive: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: items, error: itemsError } = await supabase.from('order_items').select('*');
    const { data: jobs, error: jobsError } = await supabase.from('separation_jobs').select('*');
    if (ordersError || itemsError || jobsError) return;
    rememberCodes((orders || []).map((row) => row.order_number));
    set({
      orders: orders || [],
      orderItems: items || [],
      separationJobs: (jobs || []).map((job) => ({
        ...job,
        pickup_vehicle: job.pickup_vehicle ?? null,
      })),
    });
    await get().ensureSeparationJobs();
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
    const { data: numbers } = await supabase.from('movements').select('movement_number');
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      rememberCodes((numbers || data || []).map((row) => row.movement_number));
      set({ movements: data || [], isLoading: false });
    }
  },
  
  createReceipt: async (data) => {
    const state = get();
    const now = new Date().toISOString();
    const direct = Boolean(data.direct);
    const declared = data.items.reduce((sum, item) => sum + item.quantity, 0);

    if (direct) {
      for (const item of data.items) {
        const product = state.products.find((p) => p.id === item.product_id);
        if (product?.kind === 'pop') {
          throw new Error('Nota de fornecedor não recebe pops. Use origem Fábrica para produto que vai a Preparar.');
        }
      }
    }

    const receipt: Receipt = {
      id: generateId(),
      receipt_number: generateReceiptNumber(),
      nf_number: data.nf_number,
      supplier: data.supplier,
      receipt_date: data.receipt_date,
      location_id: data.location_id,
      status: direct ? 'closed' : 'pending',
      notes: null,
      created_by: null,
      closed_at: direct ? now : null,
      closed_by: null,
      close_notes: direct ? (data.close_notes || 'Entrada direta — fornecedor') : null,
      counted_quantity: direct ? declared : null,
      variance_quantity: direct ? 0 : null,
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
      counted_quantity: direct ? item.quantity : null,
      variance_quantity: direct ? 0 : null,
      created_at: now,
    }));
    
    const newStock: Stock[] = [];
    const newMaterialStock: MaterialStock[] = [];
    const inboundInserts: Asset[] = [];
    const inboundUpdateIds = new Set<string>();
    let assetsSnapshot = [...state.assets];
    
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
          status: direct ? 'available' : 'analysis',
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
          const existingAsset = assetsSnapshot.find(a => a.code === normalizedCode);
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
            inboundInserts.push(newAsset);
            assetsSnapshot = [...assetsSnapshot, newAsset];
          } else {
            inboundUpdateIds.add(existingAsset.id);
            assetsSnapshot = assetsSnapshot.map(a =>
              a.id === existingAsset.id
                ? { ...a, status: 'with_product' as const, location_id: data.location_id, updated_at: now }
                : a
            );
          }
        }
      }
    }

    const receivingMovements: Movement[] = [
      ...newStock.map((st) => ({
        id: generateId(),
        movement_number: generateMovementNumber(),
        type: 'receiving' as const,
        stock_id: st.id,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: null,
        to_location_id: data.location_id,
        quantity: st.quantity,
        quantity_before: 0,
        quantity_after: st.quantity,
        reason: `NF ${data.nf_number}`,
        notes: receipt.receipt_number,
        created_by: null,
        created_at: now,
      })),
      ...newMaterialStock.map((st) => ({
        id: generateId(),
        movement_number: generateMovementNumber(),
        type: 'receiving' as const,
        stock_id: null,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: null,
        to_location_id: data.location_id,
        quantity: st.quantity,
        quantity_before: 0,
        quantity_after: st.quantity,
        reason: `NF ${data.nf_number}`,
        notes: receipt.receipt_number,
        created_by: null,
        created_at: now,
      })),
    ];
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('receipts').insert(receipt);
      if (error) throw new Error(error.message);
      await supabase.from('receipt_items').insert(newReceiptItems);
      if (newStock.length) await supabase.from('stock').insert(newStock);
      if (newMaterialStock.length) await supabase.from('material_stock').insert(newMaterialStock);
      if (inboundInserts.length) await supabase.from('assets').insert(inboundInserts);
      for (const id of inboundUpdateIds) {
        await supabase.from('assets').update({
          status: 'with_product',
          location_id: data.location_id,
          updated_at: now,
        }).eq('id', id);
      }
      if (receivingMovements.length) await supabase.from('movements').insert(receivingMovements);
    }
    
    set(s => ({
      receipts: [receipt, ...s.receipts],
      receiptItems: [...s.receiptItems, ...newReceiptItems],
      stock: [...s.stock, ...newStock],
      materialStock: [...s.materialStock, ...newMaterialStock],
      assets: assetsSnapshot,
      movements: [...receivingMovements, ...s.movements],
    }));
    
    return receipt;
  },

  updateReceipt: async (id, data) => {
    const state = get();
    const now = new Date().toISOString();
    const receipt = state.receipts.find((r) => r.id === id);
    if (!receipt) throw new Error('Nota fiscal não encontrada.');

    const hasPrepare = state.inspections.some((insp) => insp.receipt_id === id)
      || state.stock.some((s) => s.receipt_id === id && s.status !== 'analysis' && s.status !== 'depleted' && s.quantity > 0);
    if (data.items && (hasPrepare || receipt.status === 'closed')) {
      throw new Error('Esta nota já tem preparação. Edite só os dados do documento.');
    }

    const header = {
      nf_number: data.nf_number ?? receipt.nf_number,
      supplier: data.supplier ?? receipt.supplier,
      receipt_date: data.receipt_date ?? receipt.receipt_date,
      notes: data.notes === undefined ? receipt.notes : data.notes,
      updated_at: now,
    };

    let nextItems = state.receiptItems;
    let nextStock = state.stock;
    let nextMaterial = state.materialStock;

    if (data.items) {
      nextItems = state.receiptItems.map((item) => {
        const patch = data.items?.find((row) => row.id === item.id);
        if (!patch || item.receipt_id !== id) return item;
        return { ...item, quantity: patch.quantity, lot: patch.lot };
      });
      nextStock = state.stock.map((stock) => {
        if (stock.receipt_id !== id || stock.status !== 'analysis') return stock;
        const item = nextItems.find((row) =>
          row.receipt_id === id && row.product_id === stock.product_id && (row.lot || '') === (stock.lot || '')
        );
        if (!item) return stock;
        return {
          ...stock,
          quantity: item.quantity,
          lot: item.lot,
          fifo_date: header.receipt_date,
          received_date: header.receipt_date,
          updated_at: now,
        };
      });
      nextMaterial = state.materialStock.map((stock) => {
        if (stock.receipt_id !== id || stock.status !== 'analysis') return stock;
        const item = nextItems.find((row) =>
          row.receipt_id === id && row.product_id === stock.product_id && (row.lot || '') === (stock.lot || '')
        );
        if (!item) return stock;
        return { ...stock, quantity: item.quantity, lot: item.lot, updated_at: now };
      });
    } else if (data.receipt_date) {
      nextStock = state.stock.map((stock) =>
        stock.receipt_id === id && stock.status === 'analysis'
          ? { ...stock, fifo_date: header.receipt_date, received_date: header.receipt_date, updated_at: now }
          : stock
      );
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('receipts').update(header).eq('id', id);
      if (error) throw new Error(error.message);
      if (data.items) {
        for (const item of data.items) {
          const { error: itemError } = await supabase.from('receipt_items').update({
            quantity: item.quantity,
            lot: item.lot,
          }).eq('id', item.id);
          if (itemError) throw new Error(itemError.message);
        }
        for (const stock of nextStock.filter((s) => s.receipt_id === id && s.status === 'analysis')) {
          await supabase.from('stock').update({
            quantity: stock.quantity,
            lot: stock.lot,
            fifo_date: stock.fifo_date,
            received_date: stock.received_date,
            updated_at: now,
          }).eq('id', stock.id);
        }
        for (const stock of nextMaterial.filter((s) => s.receipt_id === id && s.status === 'analysis')) {
          await supabase.from('material_stock').update({
            quantity: stock.quantity,
            lot: stock.lot,
            updated_at: now,
          }).eq('id', stock.id);
        }
      } else if (data.receipt_date) {
        await supabase.from('stock').update({
          fifo_date: header.receipt_date,
          received_date: header.receipt_date,
          updated_at: now,
        }).eq('receipt_id', id).eq('status', 'analysis');
      }
    }

    set({
      receipts: state.receipts.map((r) => (r.id === id ? { ...r, ...header } : r)),
      receiptItems: nextItems,
      stock: nextStock,
      materialStock: nextMaterial,
    });
  },

  closeReceipt: async (id, notes) => {
    const state = get();
    const now = new Date().toISOString();
    const receipt = state.receipts.find((r) => r.id === id);
    if (!receipt) throw new Error('Nota fiscal não encontrada.');
    if (receipt.status === 'closed') throw new Error('Esta nota já foi encerrada.');

    if (isSupabaseConfigured && supabase) {
      const { data: remote } = await supabase.from('receipts').select('status').eq('id', id).single();
      if (remote?.status === 'closed') {
        await Promise.all([get().fetchReceipts(), get().fetchStock(), get().fetchMaterialStock(), get().fetchMovements()]);
        return;
      }
    }

    const items = state.receiptItems.filter((item) => item.receipt_id === id);
    const declared = declaredQuantity(items);
    const counted = liveCountedQuantity(id, state.inspections);
    const variance = varianceQuantity(counted, declared);
    const closeNotes = notes?.trim() || null;
    if (variance !== 0 && !closeNotes) {
      throw new Error('Informe o motivo da diferença em relação à NF.');
    }

    let closedBy: string | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getUser();
      closedBy = data.user?.id ?? null;
    }

    const nextItems = state.receiptItems.map((item) => {
      if (item.receipt_id !== id) return item;
      const lineCounted = liveCountedForItem(item, state.inspections);
      return {
        ...item,
        counted_quantity: lineCounted,
        variance_quantity: varianceQuantity(lineCounted, item.quantity),
      };
    });

    const leftoverStock = state.stock.filter(
      (s) => s.receipt_id === id && s.status === 'analysis' && s.quantity > 0
    );
    const leftoverMaterial = state.materialStock.filter(
      (m) => m.receipt_id === id && m.status === 'analysis' && m.quantity > 0
    );

    const nextStock = state.stock.map((s) =>
      s.receipt_id === id && s.status === 'analysis' && s.quantity > 0
        ? { ...s, quantity: 0, status: 'depleted' as const, updated_at: now }
        : s
    );
    const nextMaterial = state.materialStock.map((m) =>
      m.receipt_id === id && m.status === 'analysis' && m.quantity > 0
        ? { ...m, quantity: 0, status: 'analysis' as const, updated_at: now }
        : m
    );

    const newMovements: Movement[] = [
      ...leftoverStock.map((s) => ({
        id: generateId(),
        movement_number: generateMovementNumber(),
        type: 'adjustment' as const,
        stock_id: s.id,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: s.location_id,
        to_location_id: null,
        quantity: s.quantity,
        quantity_before: s.quantity,
        quantity_after: 0,
        reason: 'Falta vs NF',
        notes: receipt.receipt_number,
        created_by: closedBy,
        created_at: now,
      })),
      ...leftoverMaterial.map((m) => ({
        id: generateId(),
        movement_number: generateMovementNumber(),
        type: 'adjustment' as const,
        stock_id: null,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: m.location_id,
        to_location_id: null,
        quantity: m.quantity,
        quantity_before: m.quantity,
        quantity_after: 0,
        reason: 'Falta vs NF',
        notes: `${receipt.receipt_number} · ${m.stock_number}`,
        created_by: closedBy,
        created_at: now,
      })),
    ];

    const header = {
      status: 'closed' as const,
      closed_at: now,
      closed_by: closedBy,
      close_notes: closeNotes,
      counted_quantity: counted,
      variance_quantity: variance,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('receipts').update(header).eq('id', id);
      if (error) throw new Error(error.message);
      for (const item of nextItems.filter((row) => row.receipt_id === id)) {
        const { error: itemError } = await supabase.from('receipt_items').update({
          counted_quantity: item.counted_quantity,
          variance_quantity: item.variance_quantity,
        }).eq('id', item.id);
        if (itemError) throw new Error(itemError.message);
      }
      for (const stock of leftoverStock) {
        const { error: stockError } = await supabase.from('stock').update({
          quantity: 0,
          status: 'depleted',
          updated_at: now,
        }).eq('id', stock.id);
        if (stockError) throw new Error(stockError.message);
      }
      for (const material of leftoverMaterial) {
        const { error: materialError } = await supabase.from('material_stock').update({
          quantity: 0,
          updated_at: now,
        }).eq('id', material.id);
        if (materialError) throw new Error(materialError.message);
      }
      if (newMovements.length) {
        const { error: movementError } = await supabase.from('movements').insert(newMovements);
        if (movementError) throw new Error(movementError.message);
      }
    }

    set({
      receipts: state.receipts.map((r) => (r.id === id ? { ...r, ...header } : r)),
      receiptItems: nextItems,
      stock: nextStock,
      materialStock: nextMaterial,
      movements: [...newMovements, ...state.movements],
    });
  },

  reopenReceipt: async (id) => {
    const state = get();
    const now = new Date().toISOString();
    const receipt = state.receipts.find((r) => r.id === id);
    if (!receipt) throw new Error('Nota fiscal não encontrada.');
    if (receipt.status !== 'closed') throw new Error('Esta nota ainda está em preparação.');
    if (receipt.close_notes?.startsWith('Entrada direta')) {
      throw new Error('Nota de fornecedor entra direto no estoque e não volta para Preparar.');
    }

    let reopenedBy: string | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getUser();
      reopenedBy = data.user?.id ?? null;
    }

    const items = state.receiptItems.filter((item) => item.receipt_id === id);
    const nextItems = state.receiptItems.map((item) =>
      item.receipt_id === id ? { ...item, counted_quantity: null, variance_quantity: null } : item
    );

    let nextStock = [...state.stock];
    let nextMaterial = [...state.materialStock];
    const insertedStock: Stock[] = [];
    const insertedMaterial: MaterialStock[] = [];
    const newMovements: Movement[] = [];
    const stockUpdates: Stock[] = [];
    const materialUpdates: MaterialStock[] = [];

    const pushMovement = (
      movement: Omit<Movement, 'id' | 'movement_number' | 'created_at' | 'created_by'>
    ) => {
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        created_by: reopenedBy,
        created_at: now,
        ...movement,
      });
    };

    for (const item of items) {
      const product = state.products.find((p) => p.id === item.product_id);
      if (!product) continue;
      const counted = liveCountedForItem(item, state.inspections);
      const target = Math.max(0, item.quantity - counted);

      if (product.kind === 'pop') {
        const source = sourceStockForLine(id, item.product_id, item.lot, nextStock);
        if (source) {
          if (source.quantity === target && source.status === 'analysis') continue;
          const updated: Stock = {
            ...source,
            quantity: target,
            status: 'analysis',
            updated_at: now,
          };
          nextStock = nextStock.map((row) => (row.id === source.id ? updated : row));
          stockUpdates.push(updated);
          pushMovement({
            type: 'adjustment',
            stock_id: source.id,
            asset_id: null,
            order_id: null,
            inspection_id: null,
            inventory_count_id: null,
            from_location_id: source.location_id,
            to_location_id: source.location_id,
            quantity: Math.abs(target - source.quantity),
            quantity_before: source.quantity,
            quantity_after: target,
            reason: 'Reabertura NF',
            notes: receipt.receipt_number,
          });
        } else if (target > 0) {
          const created: Stock = {
            id: generateId(),
            stock_number: generateStockNumber('CX'),
            product_id: item.product_id,
            asset_id: null,
            quantity: target,
            location_id: receipt.location_id,
            grade: null,
            physical_state: 'liquid',
            status: 'analysis',
            is_active_separation: false,
            lot: item.lot,
            fifo_date: receipt.receipt_date,
            received_date: receipt.receipt_date,
            packed_at: null,
            receipt_id: receipt.id,
            inspection_id: null,
            fill_id: null,
            created_at: now,
            updated_at: now,
          };
          insertedStock.push(created);
          nextStock = [...nextStock, created];
          pushMovement({
            type: 'adjustment',
            stock_id: created.id,
            asset_id: null,
            order_id: null,
            inspection_id: null,
            inventory_count_id: null,
            from_location_id: null,
            to_location_id: receipt.location_id,
            quantity: target,
            quantity_before: 0,
            quantity_after: target,
            reason: 'Reabertura NF',
            notes: receipt.receipt_number,
          });
        }
      } else {
        const source = sourceMaterialForLine(id, item.product_id, item.lot, nextMaterial);
        if (source) {
          if (source.quantity === target && source.status === 'analysis') continue;
          const updated: MaterialStock = {
            ...source,
            quantity: target,
            status: 'analysis',
            updated_at: now,
          };
          nextMaterial = nextMaterial.map((row) => (row.id === source.id ? updated : row));
          materialUpdates.push(updated);
          pushMovement({
            type: 'adjustment',
            stock_id: null,
            asset_id: null,
            order_id: null,
            inspection_id: null,
            inventory_count_id: null,
            from_location_id: source.location_id,
            to_location_id: source.location_id,
            quantity: Math.abs(target - source.quantity),
            quantity_before: source.quantity,
            quantity_after: target,
            reason: 'Reabertura NF',
            notes: `${receipt.receipt_number} · ${source.stock_number}`,
          });
        } else if (target > 0) {
          const created: MaterialStock = {
            id: generateId(),
            stock_number: generateStockNumber('MAT'),
            product_id: item.product_id,
            quantity: target,
            location_id: receipt.location_id,
            status: 'analysis',
            lot: item.lot,
            receipt_id: receipt.id,
            source_box_codes: item.source_box_codes,
            created_at: now,
            updated_at: now,
          };
          insertedMaterial.push(created);
          nextMaterial = [...nextMaterial, created];
          pushMovement({
            type: 'adjustment',
            stock_id: null,
            asset_id: null,
            order_id: null,
            inspection_id: null,
            inventory_count_id: null,
            from_location_id: null,
            to_location_id: receipt.location_id,
            quantity: target,
            quantity_before: 0,
            quantity_after: target,
            reason: 'Reabertura NF',
            notes: `${receipt.receipt_number} · ${created.stock_number}`,
          });
        }
      }
    }

    const header = {
      status: 'pending' as const,
      closed_at: null,
      closed_by: null,
      close_notes: null,
      counted_quantity: null,
      variance_quantity: null,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('receipts').update(header).eq('id', id);
      if (error) throw new Error(error.message);
      for (const item of nextItems.filter((row) => row.receipt_id === id)) {
        const { error: itemError } = await supabase.from('receipt_items').update({
          counted_quantity: null,
          variance_quantity: null,
        }).eq('id', item.id);
        if (itemError) throw new Error(itemError.message);
      }
      for (const stock of stockUpdates) {
        const { error: stockError } = await supabase.from('stock').update({
          quantity: stock.quantity,
          status: stock.status,
          updated_at: now,
        }).eq('id', stock.id);
        if (stockError) throw new Error(stockError.message);
      }
      for (const material of materialUpdates) {
        const { error: materialError } = await supabase.from('material_stock').update({
          quantity: material.quantity,
          status: material.status,
          updated_at: now,
        }).eq('id', material.id);
        if (materialError) throw new Error(materialError.message);
      }
      if (insertedStock.length) {
        const { error: insertError } = await supabase.from('stock').insert(insertedStock);
        if (insertError) throw new Error(insertError.message);
      }
      if (insertedMaterial.length) {
        const { error: insertError } = await supabase.from('material_stock').insert(insertedMaterial);
        if (insertError) throw new Error(insertError.message);
      }
      if (newMovements.length) {
        const { error: movementError } = await supabase.from('movements').insert(newMovements);
        if (movementError) throw new Error(movementError.message);
      }
    }

    set({
      receipts: state.receipts.map((r) => (r.id === id ? { ...r, ...header } : r)),
      receiptItems: nextItems,
      stock: nextStock,
      materialStock: nextMaterial,
      movements: [...newMovements, ...state.movements],
    });
  },

  deleteReceipt: async (id) => {
    const state = get();
    const now = new Date().toISOString();
    const receipt = state.receipts.find((r) => r.id === id);
    if (!receipt) throw new Error('Nota fiscal não encontrada.');

    const receiptStock = state.stock.filter((s) => s.receipt_id === id);
    const materials = state.materialStock.filter((m) => m.receipt_id === id);
    const items = state.receiptItems.filter((item) => item.receipt_id === id);
    const receiptInspections = state.inspections.filter((insp) => insp.receipt_id === id);
    const inspectionIds = receiptInspections.map((insp) => insp.id);
    const stockIds = receiptStock.map((s) => s.id);
    const fillIds = [
      ...new Set([
        ...receiptStock.map((s) => s.fill_id).filter((value): value is string => Boolean(value)),
        ...state.fills.filter((fill) => inspectionIds.includes(fill.inspection_id) || stockIds.includes(fill.stock_id)).map((fill) => fill.id),
      ]),
    ];
    const inboundCodes = [...new Set(items.flatMap((item) => item.source_box_codes || []))];
    const boxIds = [
      ...new Set([
        ...inboundCodes
          .map((code) => state.assets.find((a) => a.code === normalizeAssetCode(code))?.id)
          .filter((value): value is string => Boolean(value)),
        ...receiptStock.map((s) => s.asset_id).filter((value): value is string => Boolean(value)),
      ]),
    ];

    const adjustments = Object.entries(
      [...receiptStock, ...materials].reduce<Record<string, number>>((acc, row) => {
        acc[row.location_id] = (acc[row.location_id] || 0) + row.quantity;
        return acc;
      }, {})
    )
      .filter(([, quantity]) => quantity > 0)
      .map(([locationId, quantity]) => ({
        id: generateId(),
        movement_number: generateMovementNumber(),
        type: 'adjustment' as const,
        stock_id: null,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: locationId,
        to_location_id: null,
        quantity,
        quantity_before: quantity,
        quantity_after: 0,
        reason: `Exclusão NF ${receipt.nf_number}`,
        notes: receipt.receipt_number,
        created_by: null,
        created_at: now,
      }));

    if (isSupabaseConfigured && supabase) {
      if (stockIds.length) {
        await supabase.from('inventory_count_lines').delete().in('stock_id', stockIds);
      }
      if (stockIds.length) await supabase.from('movements').delete().in('stock_id', stockIds);
      if (inspectionIds.length) await supabase.from('movements').delete().in('inspection_id', inspectionIds);
      if (stockIds.length) {
        await supabase.from('stock').update({ fill_id: null, inspection_id: null, updated_at: now }).in('id', stockIds);
      }
      if (fillIds.length) {
        const { error } = await supabase.from('fills').delete().in('id', fillIds);
        if (error) throw new Error(error.message);
      }
      if (inspectionIds.length) {
        await supabase.from('inspections').update({ source_stock_id: null, source_material_id: null }).in('id', inspectionIds);
      }
      if (stockIds.length) {
        const { error } = await supabase.from('stock').delete().in('id', stockIds);
        if (error) throw new Error(error.message);
      }
      if (materials.length) {
        const { error } = await supabase.from('material_stock').delete().in('id', materials.map((m) => m.id));
        if (error) throw new Error(error.message);
      }
      if (inspectionIds.length) {
        const { error } = await supabase.from('inspections').delete().in('id', inspectionIds);
        if (error) throw new Error(error.message);
      }
      if (boxIds.length) {
        await supabase.from('assets').update({ status: 'available', updated_at: now }).in('id', boxIds);
      }
      await supabase.from('receipt_items').delete().eq('receipt_id', id);
      if (adjustments.length) await supabase.from('movements').insert(adjustments);
      const { error } = await supabase.from('receipts').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }

    set((s) => ({
      receipts: s.receipts.filter((r) => r.id !== id),
      receiptItems: s.receiptItems.filter((item) => item.receipt_id !== id),
      stock: s.stock.filter((st) => st.receipt_id !== id),
      materialStock: s.materialStock.filter((m) => m.receipt_id !== id),
      fills: s.fills.filter((fill) => !fillIds.includes(fill.id)),
      inspections: s.inspections.filter((insp) => insp.receipt_id !== id),
      inventoryCountLines: s.inventoryCountLines.filter((line) => !stockIds.includes(line.stock_id)),
      movements: [
        ...adjustments,
        ...s.movements.filter((m) =>
          (!m.stock_id || !stockIds.includes(m.stock_id))
          && (!m.inspection_id || !inspectionIds.includes(m.inspection_id))
        ),
      ],
      assets: s.assets.map((a) =>
        boxIds.includes(a.id) ? { ...a, status: 'available' as const, updated_at: now } : a
      ),
    }));
  },
  

  createPrepareBatch: async (data) => {
    const state = get();
    const now = new Date().toISOString();
    const actual = data.actual_quantity;
    const rejected = data.rejected_quantity;

    if (!Number.isFinite(actual) || actual <= 0) {
      throw new Error('Informe a quantidade contada nesta leva.');
    }
    if (!Number.isFinite(rejected) || rejected < 0 || rejected > actual) {
      throw new Error('Quantidade rejeitada inválida.');
    }
    if (data.receipt_id) {
      const receipt = state.receipts.find((r) => r.id === data.receipt_id);
      if (receipt?.status === 'closed') throw new Error('Esta nota já foi encerrada.');
    }

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
      actual_quantity: actual,
      rejected_quantity: rejected,
      count_aaa: 0,
      count_b: 0,
      count_c: 0,
      destination_aaa: null,
      destination_b: null,
      destination_c: null,
      fifo_date: data.fifo_date || null,
      reason: data.reason || null,
      scan_packing: false,
      completed_at: now,
      completed_by: null,
      created_at: now,
    };

    const newStock: Stock[] = [];
    const newFills: Fill[] = [];
    const newMaterialStock: MaterialStock[] = [];
    const newMovements: Movement[] = [];
    const mergedAssemblyIds = new Set<string>();
    const assetUpdates = new Map<string, Partial<Asset>>();
    let nextStock = [...state.stock];
    let nextMaterial = [...state.materialStock];
    let nextAssets = [...state.assets];

    const markAsset = (id: string, patch: Partial<Asset>) => {
      assetUpdates.set(id, { ...(assetUpdates.get(id) || {}), ...patch });
      nextAssets = nextAssets.map((a) => (a.id === id ? { ...a, ...patch, updated_at: now } : a));
    };

    const pushMovement = (movement: Omit<Movement, 'id' | 'movement_number' | 'created_at' | 'created_by'>) => {
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        created_by: null,
        created_at: now,
        ...movement,
      });
    };

    if (data.kind === 'pop') {
      const source = state.stock.find((s) => s.id === data.source_stock_id);
      if (!source) throw new Error('Estoque em recebimento não encontrado.');
      if (source.status !== 'analysis' && source.status !== 'depleted') {
        throw new Error('Esta linha já saiu do recebimento.');
      }

      const grades = data.grades || [];
      const aaa = grades.find((g) => g.grade === 'AAA')?.quantity || 0;
      const b = grades.find((g) => g.grade === 'B')?.quantity || 0;
      const c = grades.find((g) => g.grade === 'C')?.quantity || 0;
      const blockedQty = grades.find((g) => g.grade === 'blocked')?.quantity || rejected;
      if (aaa + b + c + blockedQty !== actual) {
        throw new Error('AAA + B + C + rejeito deve ser igual à quantidade desta leva.');
      }

      const usedBoxIds = new Set<string>();
      for (const grade of grades) {
        const label = grade.grade === 'blocked' ? 'rejeito' : grade.grade;
        const mode = grade.mode || (grade.boxes.length > 0 ? 'boxed' : grade.grade === 'blocked' ? 'discard' : 'loose');
        if (grade.quantity < 0) throw new Error(`Quantidade ${label} inválida.`);
        if (grade.quantity === 0) {
          if (grade.boxes.length > 0) throw new Error(`Remova caixas da classe ${label}.`);
          continue;
        }
        if (mode === 'discard') {
          if (grade.grade !== 'blocked') throw new Error('Só rejeito pode ir para o lixo.');
          if (grade.boxes.length > 0) throw new Error('Rejeito descartado não usa caixa.');
          continue;
        }
        if (!grade.location_id) throw new Error(`Escolha o destino da classe ${label}.`);
        const location = state.locations.find((item) => item.id === grade.location_id);
        if (!location) throw new Error(`Local da classe ${label} não encontrado.`);
        if (mode === 'loose') {
          if (locationRequiresBox(location)) {
            throw new Error(`${location.name} exige caixa média. Cadastre o local como estoque solto ou encaixote.`);
          }
          if (grade.boxes.length > 0) throw new Error(`Remova caixas da classe ${label} — este local é estoque solto.`);
          continue;
        }
        const boxed = grade.boxes.reduce((sum, box) => sum + box.quantity, 0);
        if (boxed !== grade.quantity) {
          throw new Error(`As caixas da classe ${label} devem somar ${grade.quantity} un.`);
        }
        for (const box of grade.boxes) {
          if (usedBoxIds.has(box.asset_id)) throw new Error('A mesma caixa média não pode ser usada duas vezes.');
          usedBoxIds.add(box.asset_id);
          const asset = nextAssets.find((a) => a.id === box.asset_id);
          if (!asset) throw new Error('Caixa média não encontrada.');
          if (asset.type !== 'caixa_media') throw new Error(`${asset.code} não é caixa média de movimentação interna.`);
          if (asset.status !== 'available') throw new Error(`${asset.code} não está disponível.`);
          const occupied = nextStock.some((s) => s.asset_id === asset.id && s.quantity > 0);
          if (occupied) throw new Error(`${asset.code} já tem produto.`);
          const capacity = getBoxUnitCapacity(asset);
          if (box.quantity <= 0 || box.quantity > capacity) {
            throw new Error(`${asset.code} comporta no máximo ${capacity} un.`);
          }
        }
      }

      inspection.count_aaa = aaa;
      inspection.count_b = b;
      inspection.count_c = c;
      inspection.rejected_quantity = blockedQty;
      inspection.destination_aaa = grades.find((g) => g.grade === 'AAA' && g.mode !== 'discard')?.location_id || null;
      inspection.destination_b = grades.find((g) => g.grade === 'B' && g.mode !== 'discard')?.location_id || null;
      inspection.destination_c = grades.find((g) => g.grade === 'C' && g.mode !== 'discard')?.location_id || null;

      const remaining = Math.max(0, source.quantity - actual);
      nextStock = nextStock.map((s) =>
        s.id === source.id
          ? { ...s, quantity: remaining, status: remaining > 0 ? 'analysis' : 'depleted', updated_at: now }
          : s
      );

      const batchId = `PREP-${inspection.inspection_number}`;
      const placeLoose = (grade: PrepareGradeFill) => {
        const isBlocked = grade.grade === 'blocked';
        const looseStock: Stock = {
          id: generateId(),
          stock_number: generateStockNumber(isBlocked ? 'BLQ' : 'SOL'),
          product_id: data.product_id,
          asset_id: null,
          quantity: grade.quantity,
          location_id: grade.location_id,
          grade: isBlocked ? 'blocked' : grade.grade,
          physical_state: 'liquid',
          status: isBlocked ? 'blocked' : 'available',
          is_active_separation: false,
          lot: data.lot || source.lot,
          fifo_date: data.fifo_date || source.fifo_date,
          received_date: source.received_date,
          packed_at: now,
          receipt_id: data.receipt_id || source.receipt_id,
          inspection_id: inspection.id,
          fill_id: null,
          created_at: now,
          updated_at: now,
        };
        newStock.push(looseStock);
        nextStock = [...nextStock, looseStock];
        pushMovement({
          type: 'packing',
          stock_id: looseStock.id,
          asset_id: null,
          order_id: null,
          inspection_id: inspection.id,
          inventory_count_id: null,
          from_location_id: source.location_id,
          to_location_id: grade.location_id,
          quantity: grade.quantity,
          quantity_before: null,
          quantity_after: grade.quantity,
          reason: `${grade.grade} · estoque solto`,
          notes: inspection.inspection_number,
        });
      };

      for (const grade of grades) {
        if (grade.quantity <= 0) continue;
        const mode = grade.mode || (grade.boxes.length > 0 ? 'boxed' : grade.grade === 'blocked' ? 'discard' : 'loose');
        if (mode === 'discard') {
          pushMovement({
            type: 'withdrawal',
            stock_id: source.id,
            asset_id: null,
            order_id: null,
            inspection_id: inspection.id,
            inventory_count_id: null,
            from_location_id: source.location_id,
            to_location_id: null,
            quantity: grade.quantity,
            quantity_before: source.quantity,
            quantity_after: remaining,
            reason: 'Descarte de rejeito',
            notes: inspection.inspection_number,
          });
          continue;
        }
        if (mode === 'loose') {
          placeLoose(grade);
          continue;
        }
        for (const box of grade.boxes) {
          const asset = nextAssets.find((a) => a.id === box.asset_id)!;
          const isBlocked = grade.grade === 'blocked';
          const capacity = getBoxUnitCapacity(asset);
          const isPartial = !isBlocked && box.quantity < capacity;
          if (isPartial) {
            const existing = findAssemblyBox(nextStock, data.product_id, 'liquid');
            if (existing) {
              const existingAsset = nextAssets.find((item) => item.id === existing.asset_id);
              if (existing.grade && existing.grade !== grade.grade) {
                throw new Error(
                  `A caixa de montagem ${existingAsset?.code || existing.stock_number} é ${existing.grade}. Não crie outro parcial ${grade.grade} — só uma caixa de montagem por sabor e estado.`
                );
              }
              if (existing.quantity <= 0) {
                throw new Error(
                  `A caixa de montagem ${existingAsset?.code || existing.stock_number} está vazia. Escaneie-a vazia em Montar SKUs e traga uma caixa de 100.`
                );
              }
              const room = boxCapacity(existing, nextAssets) - existing.quantity;
              if (box.quantity > room) {
                throw new Error(
                  `A caixa de montagem ${existingAsset?.code || existing.stock_number} só cabe mais ${room} un. Monte SKUs ou use esse resto nela antes de encaixotar outro parcial.`
                );
              }
              nextStock = nextStock.map((item) =>
                item.id === existing.id
                  ? { ...item, quantity: item.quantity + box.quantity, updated_at: now }
                  : item
              );
              mergedAssemblyIds.add(existing.id);
              pushMovement({
                type: 'packing',
                stock_id: existing.id,
                asset_id: existing.asset_id,
                order_id: null,
                inspection_id: inspection.id,
                inventory_count_id: null,
                from_location_id: source.location_id,
                to_location_id: existing.location_id,
                quantity: box.quantity,
                quantity_before: existing.quantity,
                quantity_after: existing.quantity + box.quantity,
                reason: `Resto ${grade.grade} na caixa de montagem`,
                notes: inspection.inspection_number,
              });
              continue;
            }
          }
          const fillId = generateId();
          const boxedStock: Stock = {
            id: generateId(),
            stock_number: generateStockNumber(isBlocked ? 'BLQ' : 'CX'),
            product_id: data.product_id,
            asset_id: asset.id,
            quantity: box.quantity,
            location_id: grade.location_id,
            grade: isBlocked ? 'blocked' : grade.grade,
            physical_state: 'liquid',
            status: isBlocked ? 'blocked' : 'available',
            is_active_separation: isPartial,
            lot: data.lot || source.lot,
            fifo_date: data.fifo_date || source.fifo_date,
            received_date: source.received_date,
            packed_at: now,
            receipt_id: data.receipt_id || source.receipt_id,
            inspection_id: inspection.id,
            fill_id: fillId,
            created_at: now,
            updated_at: now,
          };
          const fill: Fill = {
            id: fillId,
            fill_number: generateFillNumber(),
            batch_id: batchId,
            asset_id: asset.id,
            stock_id: boxedStock.id,
            inspection_id: inspection.id,
            quantity: box.quantity,
            product_id: data.product_id,
            grade: grade.grade,
            lot: boxedStock.lot,
            fifo_date: boxedStock.fifo_date,
            location_id: grade.location_id,
            filled_at: now,
            filled_by: null,
          };
          newStock.push(boxedStock);
          newFills.push(fill);
          nextStock = [...nextStock, boxedStock];
          markAsset(asset.id, { status: 'with_product', location_id: grade.location_id, last_moved_at: now });
          pushMovement({
            type: 'packing',
            stock_id: boxedStock.id,
            asset_id: asset.id,
            order_id: null,
            inspection_id: inspection.id,
            inventory_count_id: null,
            from_location_id: source.location_id,
            to_location_id: grade.location_id,
            quantity: box.quantity,
            quantity_before: null,
            quantity_after: box.quantity,
            reason: `${grade.grade} · ${asset.code}`,
            notes: inspection.inspection_number,
          });
        }
      }

      const emptiedIds = new Set(data.emptied_asset_ids || []);
      const receiptId = data.receipt_id || source.receipt_id;
      const leftoverAfter = receiptId ? remainingQuantity(receiptId, nextStock, nextMaterial) : 1;
      if (leftoverAfter <= 0 && receiptId) {
        const receiptItems = state.receiptItems.filter((item) => item.receipt_id === receiptId);
        for (const item of receiptItems) {
          for (const code of item.source_box_codes || []) {
            const asset = nextAssets.find((a) => a.code === normalizeAssetCode(code));
            if (asset && (asset.status === 'with_product' || asset.status === 'in_use')) {
              emptiedIds.add(asset.id);
            }
          }
        }
      }
      for (const id of emptiedIds) {
        const asset = nextAssets.find((a) => a.id === id);
        if (!asset) continue;
        markAsset(id, { status: 'cleaning', last_moved_at: now });
        pushMovement({
          type: 'inspection_result',
          stock_id: source.id,
          asset_id: id,
          order_id: null,
          inspection_id: inspection.id,
          inventory_count_id: null,
          from_location_id: asset.location_id,
          to_location_id: asset.location_id,
          quantity: null,
          quantity_before: null,
          quantity_after: 0,
          reason: 'Caixa de entrada vazia — aguardando limpeza',
          notes: asset.code,
        });
      }
    } else {
      const source = state.materialStock.find((m) => m.id === data.source_material_id);
      if (!source) throw new Error('Material em recebimento não encontrado.');
      const fromAnalysis = source.status === 'analysis';
      const remaining = fromAnalysis ? Math.max(0, source.quantity - actual) : source.quantity;
      const approved = actual - rejected;
      if (fromAnalysis) {
        nextMaterial = nextMaterial.map((m) =>
          m.id === source.id
            ? { ...m, quantity: remaining, status: 'analysis' as const, updated_at: now }
            : m
        );
      }
      if (approved > 0) {
        const released: MaterialStock = {
          id: generateId(),
          stock_number: generateStockNumber('MAT'),
          product_id: data.product_id,
          quantity: approved,
          location_id: data.destination_material || source.location_id,
          status: 'available',
          lot: data.lot || source.lot,
          receipt_id: data.receipt_id || source.receipt_id,
          source_box_codes: source.source_box_codes,
          created_at: now,
          updated_at: now,
        };
        newMaterialStock.push(released);
        nextMaterial = [...nextMaterial, released];
      }
      if (rejected > 0) {
        const blocked: MaterialStock = {
          id: generateId(),
          stock_number: generateStockNumber('BLQ'),
          product_id: data.product_id,
          quantity: rejected,
          location_id: source.location_id,
          status: 'blocked',
          lot: data.lot || source.lot,
          receipt_id: data.receipt_id || source.receipt_id,
          source_box_codes: source.source_box_codes,
          created_at: now,
          updated_at: now,
        };
        newMaterialStock.push(blocked);
        nextMaterial = [...nextMaterial, blocked];
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('inspections').insert(inspection);
      if (error) throw new Error(error.message);

      if (data.kind === 'pop' && data.source_stock_id) {
        const sourceRow = nextStock.find((s) => s.id === data.source_stock_id);
        if (sourceRow) {
          await supabase.from('stock').update({
            quantity: sourceRow.quantity,
            status: sourceRow.status,
            updated_at: now,
          }).eq('id', data.source_stock_id);
        }
      }
      if (data.kind === 'material' && data.source_material_id) {
        const sourceRow = nextMaterial.find((m) => m.id === data.source_material_id);
        if (sourceRow) {
          await supabase.from('material_stock').update({
            quantity: sourceRow.quantity,
            status: sourceRow.status,
            location_id: sourceRow.location_id,
            updated_at: now,
          }).eq('id', data.source_material_id);
        }
      }

      const boxedWithoutFill = newStock.map((s) => ({ ...s, fill_id: null }));
      if (boxedWithoutFill.length) await supabase.from('stock').insert(boxedWithoutFill);
      if (newFills.length) await supabase.from('fills').insert(newFills);
      for (const fill of newFills) {
        await supabase.from('stock').update({ fill_id: fill.id, updated_at: now }).eq('id', fill.stock_id);
      }
      for (const id of mergedAssemblyIds) {
        const row = nextStock.find((item) => item.id === id);
        if (row) {
          await supabase.from('stock').update({ quantity: row.quantity, updated_at: now }).eq('id', id);
        }
      }
      if (newMaterialStock.length) await supabase.from('material_stock').insert(newMaterialStock);
      for (const [id, patch] of assetUpdates) {
        await supabase.from('assets').update({ ...patch, updated_at: now }).eq('id', id);
      }
      if (newMovements.length) await supabase.from('movements').insert(newMovements);
    }

    set({
      inspections: [inspection, ...state.inspections],
      stock: nextStock,
      materialStock: nextMaterial,
      fills: [...state.fills, ...newFills],
      assets: nextAssets,
      movements: [...newMovements, ...state.movements],
    });

    return inspection;
  },
  
  
  createMovement: async (data) => {
    const now = new Date().toISOString();
    rememberCodes(get().movements.map((row) => row.movement_number));
    if (isSupabaseConfigured && supabase) {
      const { data: numbers } = await supabase.from('movements').select('movement_number');
      rememberCodes((numbers || []).map((row) => row.movement_number));
    }
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
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { error } = await supabase.from('movements').insert(movement);
        if (!error) break;
        if (!/movement_number|duplicate key|unique/i.test(error.message) || attempt === 7) {
          throw new Error(error.message);
        }
        usedCodes.add(movement.movement_number.toUpperCase());
        movement.movement_number = generateMovementNumber();
      }
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
      requester_id: data.requester_id || null,
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
      pickup_fulfillment: data.pickup_fulfillment || null,
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
      status: 'a_separar',
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
      pickup_vehicle: null,
      departure_at: null,
      return_at: null,
      stage: 'a_separar',
      operations_notes: null,
      created_at: now,
      updated_at: now,
    };
    
    const vaiEquipment = data.equipment_ids || [];
    const voltaEquipment = new Set(data.returning_equipment_ids ?? vaiEquipment);
    const stayOutEquipment = vaiEquipment.filter((assetId) => !voltaEquipment.has(assetId));

    const reservations: EquipmentReservation[] = [];
    if (data.reserve_from && data.reserve_until) {
      for (const assetId of vaiEquipment) {
        if (!voltaEquipment.has(assetId)) continue;
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

    const uniformCheckouts: UniformCheckout[] = (data.uniforms || [])
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        id: generateId(),
        uniform_id: line.uniform_id,
        order_id: order.id,
        size: line.size,
        quantity: line.quantity,
        status: 'out' as const,
        checked_out_at: now,
        returned_at: null,
        notes: line.returns === false ? UNIFORM_STAY_OUT_NOTE : null,
        created_at: now,
      }));

    if (isSupabaseConfigured && supabase) {
      const { error: orderError } = await supabase.from('orders').insert(order);
      if (orderError) {
        const missingPickupCol = /pickup_fulfillment/i.test(orderError.message);
        if (!missingPickupCol) throw new Error(orderError.message);
        const { pickup_fulfillment: _ignored, ...withoutPickupMethod } = order;
        const retry = await supabase.from('orders').insert(withoutPickupMethod);
        if (retry.error) throw new Error(retry.error.message);
      }
      await supabase.from('order_items').insert(orderItems);
      await persistSeparationJob(separationJob);
      if (reservations.length) await supabase.from('equipment_reservations').insert(reservations);
      if (uniformCheckouts.length) await supabase.from('uniform_checkouts').insert(uniformCheckouts);
      for (const assetId of stayOutEquipment) {
        const { error } = await supabase
          .from('assets')
          .update({ status: 'in_use', last_moved_at: now, updated_at: now })
          .eq('id', assetId);
        if (error) throw new Error(error.message);
      }
    }

    const nextUniformStock = deductStockForLines(get().uniformStock, get().locations, uniformCheckouts);
    await saveUniformStock(get().uniformStock, nextUniformStock);

    set((s) => ({
      orders: [order, ...s.orders],
      orderItems: [...s.orderItems, ...orderItems],
      separationJobs: [...s.separationJobs, ...[separationJob]],
      equipmentReservations: [...s.equipmentReservations, ...reservations],
      uniformCheckouts: [...s.uniformCheckouts, ...uniformCheckouts],
      uniformStock: nextUniformStock,
      assets: s.assets.map((asset) =>
        stayOutEquipment.includes(asset.id)
          ? { ...asset, status: 'in_use', last_moved_at: now, updated_at: now }
          : asset
      ),
    }));
    
    return order;
  },

  updatePlacedOrder: async (orderId, data) => {
    const state = get();
    const existing = state.orders.find((row) => row.id === orderId);
    if (!existing) throw new Error('Pedido não encontrado.');
    const now = new Date().toISOString();
    const previousItems = state.orderItems.filter((item) => item.order_id === orderId);
    const previousStayOut = previousItems
      .filter((item) => item.asset_id && !item.is_returnable)
      .map((item) => item.asset_id!);

    const patch: Partial<Order> = {
      requester_id: data.requester_id || null,
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
      pickup_fulfillment: data.pickup_fulfillment || null,
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
      item_notes: data.item_notes || null,
      notes: data.notes || null,
      updated_at: now,
    };

    const nextItems: OrderItem[] = data.items.map((item) => ({
      id: generateId(),
      order_id: orderId,
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

    const vaiEquipment = data.equipment_ids || [];
    const voltaEquipment = new Set(data.returning_equipment_ids ?? vaiEquipment);
    const stayOutEquipment = vaiEquipment.filter((assetId) => !voltaEquipment.has(assetId));
    const releasedAssets = previousStayOut.filter((id) => !stayOutEquipment.includes(id));

    const reservations: EquipmentReservation[] = [];
    if (data.reserve_from && data.reserve_until) {
      for (const assetId of vaiEquipment) {
        if (!voltaEquipment.has(assetId)) continue;
        reservations.push({
          id: generateId(),
          asset_id: assetId,
          order_id: orderId,
          reserved_from: data.reserve_from,
          reserved_until: data.reserve_until,
          holder_name: existing.order_number,
          status: 'active',
          created_at: now,
        });
      }
    }

    const uniformCheckouts: UniformCheckout[] = (data.uniforms || [])
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        id: generateId(),
        uniform_id: line.uniform_id,
        order_id: orderId,
        size: line.size,
        quantity: line.quantity,
        status: 'out' as const,
        checked_out_at: now,
        returned_at: null,
        notes: line.returns === false ? UNIFORM_STAY_OUT_NOTE : null,
        created_at: now,
      }));

    if (isSupabaseConfigured && supabase) {
      const { error: orderError } = await supabase.from('orders').update(patch).eq('id', orderId);
      if (orderError) {
        const missingPickupCol = /pickup_fulfillment/i.test(orderError.message);
        if (!missingPickupCol) throw new Error(orderError.message);
        const { pickup_fulfillment: _ignored, ...withoutPickupMethod } = patch;
        const retry = await supabase.from('orders').update(withoutPickupMethod).eq('id', orderId);
        if (retry.error) throw new Error(retry.error.message);
      }
      await supabase.from('order_items').delete().eq('order_id', orderId);
      if (nextItems.length) await supabase.from('order_items').insert(nextItems);
      await supabase.from('equipment_reservations').delete().eq('order_id', orderId);
      if (reservations.length) await supabase.from('equipment_reservations').insert(reservations);
      await supabase.from('uniform_checkouts').delete().eq('order_id', orderId);
      if (uniformCheckouts.length) await supabase.from('uniform_checkouts').insert(uniformCheckouts);
      for (const assetId of stayOutEquipment) {
        const { error } = await supabase
          .from('assets')
          .update({ status: 'in_use', last_moved_at: now, updated_at: now })
          .eq('id', assetId);
        if (error) throw new Error(error.message);
      }
      for (const assetId of releasedAssets) {
        const asset = get().assets.find((row) => row.id === assetId);
        if (!asset || asset.status !== 'in_use') continue;
        const { error } = await supabase
          .from('assets')
          .update({ status: 'available', last_moved_at: now, updated_at: now })
          .eq('id', assetId);
        if (error) throw new Error(error.message);
      }
    }

    const previousOut = get().uniformCheckouts.filter(
      (row) => row.order_id === orderId && row.status === 'out'
    );
    const restoredStock = addStockForLines(
      get().uniformStock,
      salaTradeId(get().locations),
      previousOut
    );
    const nextUniformStock = deductStockForLines(restoredStock, get().locations, uniformCheckouts);
    await saveUniformStock(get().uniformStock, nextUniformStock);

    const nextOrder: Order = { ...existing, ...patch };
    set((s) => ({
      orders: s.orders.map((row) => (row.id === orderId ? nextOrder : row)),
      orderItems: [...s.orderItems.filter((item) => item.order_id !== orderId), ...nextItems],
      equipmentReservations: [
        ...s.equipmentReservations.filter((row) => row.order_id !== orderId),
        ...reservations,
      ],
      uniformCheckouts: [
        ...s.uniformCheckouts.filter((row) => row.order_id !== orderId),
        ...uniformCheckouts,
      ],
      uniformStock: nextUniformStock,
      assets: s.assets.map((asset) => {
        if (stayOutEquipment.includes(asset.id)) {
          return { ...asset, status: 'in_use', last_moved_at: now, updated_at: now };
        }
        if (releasedAssets.includes(asset.id) && asset.status === 'in_use') {
          return { ...asset, status: 'available', last_moved_at: now, updated_at: now };
        }
        return asset;
      }),
    }));
    return nextOrder;
  },

  cancelPlacedOrder: async (orderId) => {
    const state = get();
    const existing = state.orders.find((row) => row.id === orderId);
    if (!existing) throw new Error('Pedido não encontrado.');
    const now = new Date().toISOString();
    const heldAssets = state.orderItems
      .filter((item) => item.order_id === orderId && item.asset_id)
      .map((item) => item.asset_id!)
      .filter((id, index, all) => all.indexOf(id) === index)
      .filter((id) => state.assets.find((asset) => asset.id === id)?.status === 'in_use');

    if (isSupabaseConfigured && supabase) {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', orderId);
      if (orderError) throw new Error(orderError.message);
      await supabase
        .from('equipment_reservations')
        .update({ status: 'cancelled' })
        .eq('order_id', orderId)
        .eq('status', 'active');
      await supabase
        .from('uniform_checkouts')
        .update({ status: 'returned', returned_at: now })
        .eq('order_id', orderId)
        .eq('status', 'out');
      const job = state.separationJobs.find((row) => row.order_id === orderId);
      if (job) {
        await supabase.from('separation_jobs').update({ stage: 'retorno', updated_at: now }).eq('id', job.id);
      }
      for (const assetId of heldAssets) {
        const { error } = await supabase
          .from('assets')
          .update({ status: 'available', last_moved_at: now, updated_at: now })
          .eq('id', assetId);
        if (error) throw new Error(error.message);
      }
    }

    const restored = addStockForLines(
      get().uniformStock,
      salaTradeId(get().locations),
      get().uniformCheckouts.filter((row) => row.order_id === orderId && row.status === 'out')
    );
    await saveUniformStock(get().uniformStock, restored);

    set((s) => ({
      orders: s.orders.map((row) => (row.id === orderId ? { ...row, status: 'cancelled', updated_at: now } : row)),
      equipmentReservations: s.equipmentReservations.map((row) =>
        row.order_id === orderId && row.status === 'active' ? { ...row, status: 'cancelled' } : row
      ),
      uniformCheckouts: s.uniformCheckouts.map((row) =>
        row.order_id === orderId && row.status === 'out'
          ? { ...row, status: 'returned', returned_at: now }
          : row
      ),
      uniformStock: restored,
      separationJobs: s.separationJobs.map((job) =>
        job.order_id === orderId ? { ...job, stage: 'retorno', updated_at: now } : job
      ),
      assets: s.assets.map((asset) =>
        heldAssets.includes(asset.id)
          ? { ...asset, status: 'available', last_moved_at: now, updated_at: now }
          : asset
      ),
    }));
  },

  deleteClosedOrder: async (orderId) => {
    const state = get();
    const existing = state.orders.find((row) => row.id === orderId);
    if (!existing) throw new Error('Pedido não encontrado.');

    if (isSupabaseConfigured && supabase) {
      const relatedDeletes = [
        supabase.from('separation_jobs').delete().eq('order_id', orderId),
        supabase.from('equipment_reservations').delete().eq('order_id', orderId),
        supabase.from('uniform_checkouts').delete().eq('order_id', orderId),
        supabase.from('order_items').delete().eq('order_id', orderId),
        supabase.from('order_attachments').delete().eq('order_id', orderId),
        supabase.from('order_events').delete().eq('order_id', orderId),
      ];
      const results = await Promise.all(relatedDeletes);
      for (const result of results) {
        if (result.error && !/schema cache|does not exist|Could not find the table/i.test(result.error.message)) {
          throw new Error(result.error.message);
        }
      }
      const movements = await supabase.from('movements').update({ order_id: null }).eq('order_id', orderId);
      if (movements.error && !/schema cache|does not exist|Could not find the table/i.test(movements.error.message)) {
        throw new Error(movements.error.message);
      }
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw new Error(error.message);
    }

    set((s) => ({
      orders: s.orders.filter((row) => row.id !== orderId),
      orderItems: s.orderItems.filter((row) => row.order_id !== orderId),
      separationJobs: s.separationJobs.filter((row) => row.order_id !== orderId),
      equipmentReservations: s.equipmentReservations.filter((row) => row.order_id !== orderId),
      uniformCheckouts: s.uniformCheckouts.filter((row) => row.order_id !== orderId),
      movements: s.movements.map((row) =>
        row.order_id === orderId ? { ...row, order_id: null } : row
      ),
    }));
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

  adjustSkuQuantity: async (productId, newQuantity) => {
    if (!Number.isFinite(newQuantity) || newQuantity < 0 || Math.round(newQuantity) !== newQuantity) {
      throw new Error('Informe uma quantidade inteira maior ou igual a zero.');
    }
    const product = get().products.find((item) => item.id === productId);
    if (!product || product.kind !== 'pop') throw new Error('SKU não encontrado.');

    const isLive = (item: Stock) =>
      item.product_id === productId && item.status !== 'depleted' && item.quantity > 0;
    const current = get().stock.filter(isLive).reduce((sum, item) => sum + item.quantity, 0);
    const target = Math.round(newQuantity);
    const delta = target - current;
    if (delta === 0) return;

    const now = new Date().toISOString();
    rememberCodes(get().stock.map((row) => row.stock_number));
    rememberCodes(get().movements.map((row) => row.movement_number));
    let nextStock = [...get().stock];
    let nextAssets = [...get().assets];
    const newStock: Stock[] = [];
    const newMovements: Movement[] = [];
    const touchedStock = new Set<string>();
    const touchedAssets = new Set<string>();

    const pushMovement = (movement: Omit<Movement, 'id' | 'movement_number' | 'created_at' | 'created_by'>) => {
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        created_by: null,
        created_at: now,
        ...movement,
      });
    };

    const applyRow = (row: Stock, after: number) => {
      const depleted = after <= 0;
      nextStock = nextStock.map((item) =>
        item.id === row.id
          ? {
              ...item,
              quantity: Math.max(0, after),
              status: depleted ? 'depleted' : item.status === 'depleted' ? 'available' : item.status,
              is_active_separation: depleted ? false : item.is_active_separation,
              updated_at: now,
            }
          : item
      );
      touchedStock.add(row.id);
      if (depleted && row.asset_id) {
        nextAssets = nextAssets.map((asset) =>
          asset.id === row.asset_id
            ? { ...asset, status: 'available', last_moved_at: now, updated_at: now }
            : asset
        );
        touchedAssets.add(row.asset_id);
      }
      pushMovement({
        type: 'adjustment',
        stock_id: row.id,
        asset_id: row.asset_id,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: row.location_id,
        to_location_id: row.location_id,
        quantity: Math.abs(after - row.quantity),
        quantity_before: row.quantity,
        quantity_after: Math.max(0, after),
        reason: 'Ajuste administrativo',
        notes: product.code,
      });
    };

    if (delta > 0) {
      const loose = nextStock.find((item) => isLive(item) && !item.asset_id);
      if (loose) {
        applyRow(loose, loose.quantity + delta);
      } else {
        let locationId = nextStock.find((item) => item.product_id === productId)?.location_id || null;
        if (product.is_composite) {
          locationId = (await get().ensureAssembledLocation()).id;
        } else if (!locationId) {
          locationId = productStockLocations(get().locations, true)[0]?.id || null;
        }
        if (!locationId) throw new Error('Cadastre um local de estoque de SKUs.');
        const sample = nextStock.find((item) => item.product_id === productId && item.quantity > 0);
        const created: Stock = {
          id: generateId(),
          stock_number: generateStockNumber(product.is_composite ? 'CMP' : 'SOL'),
          product_id: productId,
          asset_id: null,
          quantity: delta,
          location_id: locationId,
          grade: sample?.grade && sample.grade !== 'pending' ? sample.grade : 'AAA',
          physical_state: sample?.physical_state === 'frozen' ? 'frozen' : 'liquid',
          status: 'available',
          is_active_separation: false,
          lot: null,
          fifo_date: now.slice(0, 10),
          received_date: now.slice(0, 10),
          packed_at: now,
          receipt_id: null,
          inspection_id: null,
          fill_id: null,
          created_at: now,
          updated_at: now,
        };
        newStock.push(created);
        nextStock = [...nextStock, created];
        pushMovement({
          type: 'adjustment',
          stock_id: created.id,
          asset_id: null,
          order_id: null,
          inspection_id: null,
          inventory_count_id: null,
          from_location_id: locationId,
          to_location_id: locationId,
          quantity: delta,
          quantity_before: 0,
          quantity_after: delta,
          reason: 'Ajuste administrativo',
          notes: product.code,
        });
      }
    } else {
      let remaining = -delta;
      const ordered = [
        ...nextStock
          .filter((item) => isLive(item) && !item.asset_id)
          .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
        ...nextStock
          .filter((item) => isLive(item) && item.asset_id)
          .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
      ];
      for (const row of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(row.quantity, remaining);
        applyRow(row, row.quantity - take);
        remaining -= take;
      }
      if (remaining > 0) throw new Error('Não foi possível aplicar o ajuste neste SKU.');
    }

    if (isSupabaseConfigured && supabase) {
      if (newStock.length) {
        const { error } = await supabase.from('stock').insert(newStock);
        if (error) throw new Error(error.message);
      }
      for (const id of touchedStock) {
        const row = nextStock.find((item) => item.id === id);
        if (!row) continue;
        const { error } = await supabase
          .from('stock')
          .update({
            quantity: row.quantity,
            status: row.status,
            is_active_separation: row.is_active_separation,
            updated_at: now,
          })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      for (const id of touchedAssets) {
        const asset = nextAssets.find((item) => item.id === id);
        if (!asset) continue;
        const { error } = await supabase
          .from('assets')
          .update({ status: asset.status, last_moved_at: asset.last_moved_at, updated_at: now })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      if (newMovements.length) {
        const { error } = await supabase.from('movements').insert(newMovements);
        if (error) throw new Error(error.message);
      }
    }

    set({
      stock: nextStock,
      assets: nextAssets,
      movements: [...newMovements, ...get().movements],
    });
  },

  adjustBoxTypeQuantity: async (type, newQuantity, locationId) => {
    if (!isBoxType(type)) throw new Error('Tipo de embalagem inválido.');
    if (!Number.isFinite(newQuantity) || newQuantity < 0 || Math.round(newQuantity) !== newQuantity) {
      throw new Error('Informe uma quantidade inteira maior ou igual a zero.');
    }
    const target = Math.round(newQuantity);
    const locations = get().locations;
    const destId = locationId || cleanLocation(locations)?.id || null;
    if (!destId) throw new Error('Escolha um local cadastrado.');
    const active = get().assets.filter(
      (asset) =>
        isBoxAsset(asset) &&
        asset.is_active &&
        asset.type === type &&
        (locationId === undefined || boxMatchesLocation(asset, destId, locations))
    );
    const delta = target - active.length;
    if (delta === 0) return;

    const now = new Date().toISOString();
    rememberCodes(get().movements.map((row) => row.movement_number));
    let nextAssets = [...get().assets];
    const newAssets: Asset[] = [];
    const newMovements: Movement[] = [];
    const retiredIds = new Set<string>();

    const pushMovement = (movement: Omit<Movement, 'id' | 'movement_number' | 'created_at' | 'created_by'>) => {
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        created_by: null,
        created_at: now,
        ...movement,
      });
    };

    if (delta > 0) {
      if (locationId === TRANSIT_COLUMN) {
        throw new Error('Escolha um local cadastrado. Em trânsito não recebe caixas novas.');
      }
      const sample = active[0] || nextAssets.find((asset) => asset.type === type);
      const planned = planAssetPlacement(
        { status: 'available', location_id: null },
        { locationId: destId },
        locations,
        false
      );
      const unitCapacity =
        sample?.unit_capacity && sample.unit_capacity > 0
          ? sample.unit_capacity
          : type === 'caixa_media'
            ? 100
            : null;
      const codes = nextAssets.map((asset) => asset.code);
      for (let i = 0; i < delta; i += 1) {
        const code = suggestedBoxCode(codes);
        codes.push(code);
        const created: Asset = {
          id: generateId(),
          code,
          name: `${boxTypeLabel(type)} ${code}`,
          description: null,
          type,
          location_id: planned.location_id,
          status: planned.status,
          is_active: true,
          control_method: 'individual',
          quantity_on_hand: 1,
          unit_capacity: unitCapacity,
          custom_fields: {},
          created_at: now,
          updated_at: now,
        };
        newAssets.push(created);
        nextAssets = [...nextAssets, created];
        pushMovement({
          type: 'adjustment',
          stock_id: null,
          asset_id: created.id,
          order_id: null,
          inspection_id: null,
          inventory_count_id: null,
          from_location_id: null,
          to_location_id: planned.location_id,
          quantity: 1,
          quantity_before: 0,
          quantity_after: 1,
          reason: 'Ajuste administrativo',
          notes: code,
        });
      }
    } else {
      const removable = active
        .filter((asset) => canRetireBox(asset, get().stock))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      if (removable.length < -delta) {
        const min = active.length - removable.length;
        throw new Error(
          `Só é possível reduzir para ${min}. ${-delta - removable.length} caixa(s) estão cheias, em uso ou na fábrica.`
        );
      }
      for (const asset of removable.slice(0, -delta)) {
        retiredIds.add(asset.id);
        nextAssets = nextAssets.map((item) =>
          item.id === asset.id
            ? { ...item, is_active: false, last_moved_at: now, updated_at: now }
            : item
        );
        pushMovement({
          type: 'adjustment',
          stock_id: null,
          asset_id: asset.id,
          order_id: null,
          inspection_id: null,
          inventory_count_id: null,
          from_location_id: asset.location_id,
          to_location_id: asset.location_id,
          quantity: 1,
          quantity_before: 1,
          quantity_after: 0,
          reason: 'Ajuste administrativo',
          notes: asset.code,
        });
      }
    }

    if (isSupabaseConfigured && supabase) {
      if (newAssets.length) {
        const { error } = await supabase.from('assets').insert(newAssets);
        if (error) throw new Error(error.message);
      }
      for (const id of retiredIds) {
        const { error } = await supabase
          .from('assets')
          .update({ is_active: false, last_moved_at: now, updated_at: now })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      if (newMovements.length) {
        const { error } = await supabase.from('movements').insert(newMovements);
        if (error) throw new Error(error.message);
      }
    }

    set({
      assets: nextAssets,
      movements: [...newMovements, ...get().movements],
    });
  },

  moveBoxTypeLocation: async (type, fromLocationId, toLocationId) => {
    if (!isBoxType(type)) throw new Error('Tipo de embalagem inválido.');
    const fromKey = fromLocationId || '';
    const toKey = toLocationId || '';
    if (fromKey === toKey) return;
    if (!toKey || toKey === TRANSIT_COLUMN) throw new Error('Escolha um local cadastrado.');

    const locations = get().locations;
    const factory = factoryLocation(locations);
    const destId = toKey || null;
    const group = get().assets.filter(
      (asset) =>
        isBoxAsset(asset) &&
        asset.is_active &&
        asset.type === type &&
        boxMatchesLocation(asset, fromKey || null, locations)
    );
    if (group.length === 0) return;

    const now = new Date().toISOString();
    rememberCodes(get().movements.map((row) => row.movement_number));
    let nextAssets = [...get().assets];
    let nextStock = [...get().stock];
    const newMovements: Movement[] = [];
    const touchedAssets = new Set<string>();
    const touchedStock = new Set<string>();

    for (const asset of group) {
      const hasProduct = nextStock.some(
        (item) => item.asset_id === asset.id && item.quantity > 0 && item.status !== 'depleted'
      );
      if (factory && destId === factory.id) {
        if (hasProduct || !canSendToFactory(asset, nextStock)) {
          throw new Error(
            `${asset.code} não pode ir à fábrica. Só caixa preta ou grande, vazia, após limpeza.`
          );
        }
      }
      const planned = planAssetPlacement(asset, { locationId: destId }, locations, false);
      if (planned.error) throw new Error(planned.error);
      let status = planned.status;
      if (!(factory && destId === factory.id) && status === 'at_factory') {
        status = hasProduct ? 'with_product' : 'available';
      }
      if (hasProduct && (status === 'available' || status === 'empty_ready_return')) {
        status = 'with_product';
      }
      if (hasProduct && (status === 'cleaning' || status === 'at_factory')) {
        throw new Error(`${asset.code} está cheia e não pode ir para ${status === 'cleaning' ? 'área suja' : 'fábrica'}.`);
      }

      nextAssets = nextAssets.map((item) =>
        item.id === asset.id
          ? { ...item, location_id: planned.location_id, status, last_moved_at: now, updated_at: now }
          : item
      );
      touchedAssets.add(asset.id);
      for (const stock of nextStock.filter(
        (item) => item.asset_id === asset.id && item.quantity > 0 && item.status !== 'depleted'
      )) {
        nextStock = nextStock.map((item) =>
          item.id === stock.id ? { ...item, location_id: planned.location_id || item.location_id, updated_at: now } : item
        );
        touchedStock.add(stock.id);
      }
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        type: 'transfer',
        stock_id: null,
        asset_id: asset.id,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: asset.location_id,
        to_location_id: planned.location_id,
        quantity: 1,
        quantity_before: 1,
        quantity_after: 1,
        reason: 'Ajuste administrativo',
        notes: asset.code,
        created_by: null,
        created_at: now,
      });
    }

    if (isSupabaseConfigured && supabase) {
      for (const id of touchedAssets) {
        const asset = nextAssets.find((item) => item.id === id);
        if (!asset) continue;
        const { error } = await supabase
          .from('assets')
          .update({
            location_id: asset.location_id,
            status: asset.status,
            last_moved_at: now,
            updated_at: now,
          })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      for (const id of touchedStock) {
        const stock = nextStock.find((item) => item.id === id);
        if (!stock) continue;
        const { error } = await supabase
          .from('stock')
          .update({ location_id: stock.location_id, updated_at: now })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      if (newMovements.length) {
        const { error } = await supabase.from('movements').insert(newMovements);
        if (error) throw new Error(error.message);
      }
    }

    set({
      assets: nextAssets,
      stock: nextStock,
      movements: [...newMovements, ...get().movements],
    });
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
      if (error && /pickup_vehicle/i.test(error.message) && 'pickup_vehicle' in data) {
        const { pickup_vehicle: _ignored, ...rest } = data;
        const retry = await supabase.from('separation_jobs').update({ ...rest, updated_at: now }).eq('id', id);
        if (retry.error) throw new Error(retry.error.message);
      } else if (error) {
        throw new Error(error.message);
      }
    }
    set(s => ({
      separationJobs: s.separationJobs.map(j => j.id === id ? { ...j, ...data, updated_at: now } : j)
    }));
  },

  updateOrderItem: async (id, data) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('order_items').update(data).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set((s) => ({
      orderItems: s.orderItems.map((item) => (item.id === id ? { ...item, ...data } : item)),
    }));
  },

  closeSeparationOrder: async (orderId, units, notes) => {
    const order = get().orders.find((row) => row.id === orderId);
    const job = get().separationJobs.find((row) => row.order_id === orderId);
    if (!order || !job) throw new Error('Pedido não encontrado.');
    if (job.stage === 'retorno') return;

    const items = get().orderItems.filter((row) => row.order_id === orderId);
    const now = new Date().toISOString();
    const closeOut = {
      closed_at: now,
      notes: notes || undefined,
      lines: closeOutLinesFromUnits(items, units),
      units,
    };

    await get().updateOrder(orderId, {
      status: 'retorno',
      return_description: JSON.stringify(closeOut),
    });
    await get().updateSeparationJob(job.id, { stage: 'retorno' });

    const openReservations = get().equipmentReservations.filter(
      (row) => row.order_id === orderId && row.status === 'active'
    );
    if (openReservations.length && isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('equipment_reservations')
        .update({ status: 'completed' })
        .eq('order_id', orderId)
        .eq('status', 'active');
      if (error) throw new Error(error.message);
    }
    if (openReservations.length) {
      set((s) => ({
        equipmentReservations: s.equipmentReservations.map((row) =>
          row.order_id === orderId && row.status === 'active' ? { ...row, status: 'completed' } : row
        ),
      }));
    }

    const unitsByItem = new Map<string, ReturnUnit[]>();
    for (const unit of units) {
      const list = unitsByItem.get(unit.item_id) || [];
      list.push(unit);
      unitsByItem.set(unit.item_id, list);
    }

    for (const item of items.filter((row) => row.is_returnable)) {
      const itemUnits = (unitsByItem.get(item.id) || []).sort((a, b) => a.unit_index - b.unit_index);
      if (item.asset_id) {
        const unit = itemUnits[0];
        if (!unit) continue;
        const status = returnUnitAssetStatus(unit.condition);
        const locationId = unit.condition === 'lost' ? null : unit.location_id;
        await get().updateAsset(item.asset_id, {
          status,
          location_id: locationId,
          last_moved_at: now,
        });
        await get().createMovement({
          type: unit.condition === 'lost' ? 'dispatch' : 'return',
          order_id: orderId,
          asset_id: item.asset_id,
          quantity: 1,
          to_location_id: locationId || undefined,
          reason: `Retorno ${order.order_number}`,
          notes: `${item.name} · ${unit.condition}`,
        });
        continue;
      }

      if (!item.code.startsWith('UNI-')) continue;

      const checkout = get().uniformCheckouts.find(
        (row) =>
          row.order_id === orderId &&
          row.status === 'out' &&
          checkoutMatchesItem(row, item, get().uniforms)
      );
      const lostN = itemUnits.filter((unit) => unit.condition === 'lost').length;
      const backN = itemUnits.length - lostN;
      if (checkout) {
        if (lostN === 0) {
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase
              .from('uniform_checkouts')
              .update({ status: 'returned', returned_at: now })
              .eq('id', checkout.id);
            if (error) throw new Error(error.message);
          }
          set((s) => ({
            uniformCheckouts: s.uniformCheckouts.map((row) =>
              row.id === checkout.id ? { ...row, status: 'returned', returned_at: now } : row
            ),
          }));
          const returnedStock = addStockForLines(get().uniformStock, dirtyYardId(get().locations), [
            { uniform_id: checkout.uniform_id, size: checkout.size, quantity: checkout.quantity },
          ]);
          await saveUniformStock(get().uniformStock, returnedStock);
          set({ uniformStock: returnedStock });
        } else if (backN === 0) {
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase
              .from('uniform_checkouts')
              .update({ notes: UNIFORM_STAY_OUT_NOTE })
              .eq('id', checkout.id);
            if (error) throw new Error(error.message);
          }
          set((s) => ({
            uniformCheckouts: s.uniformCheckouts.map((row) =>
              row.id === checkout.id ? { ...row, notes: UNIFORM_STAY_OUT_NOTE } : row
            ),
          }));
        } else {
          const returnedRow = {
            id: generateId(),
            uniform_id: checkout.uniform_id,
            order_id: orderId,
            size: checkout.size,
            quantity: Math.max(1, backN),
            status: 'returned' as const,
            checked_out_at: checkout.checked_out_at,
            returned_at: now,
            notes: null,
            created_at: now,
          };
          if (isSupabaseConfigured && supabase) {
            const stay = await supabase
              .from('uniform_checkouts')
              .update({
                quantity: Math.max(1, lostN),
                notes: UNIFORM_STAY_OUT_NOTE,
              })
              .eq('id', checkout.id);
            if (stay.error) throw new Error(stay.error.message);
            const inserted = await supabase.from('uniform_checkouts').insert(returnedRow);
            if (inserted.error) throw new Error(inserted.error.message);
          }
          set((s) => ({
            uniformCheckouts: [
              ...s.uniformCheckouts.map((row) =>
                row.id === checkout.id
                  ? { ...row, quantity: Math.max(1, lostN), notes: UNIFORM_STAY_OUT_NOTE }
                  : row
              ),
              returnedRow,
            ],
          }));
          const returnedStock = addStockForLines(get().uniformStock, dirtyYardId(get().locations), [
            { uniform_id: checkout.uniform_id, size: checkout.size, quantity: Math.max(1, backN) },
          ]);
          await saveUniformStock(get().uniformStock, returnedStock);
          set({ uniformStock: returnedStock });
        }
      }
    }
  },

  dispatchOrderItem: async (orderId, itemId) => {
    const item = get().orderItems.find((row) => row.id === itemId && row.order_id === orderId);
    if (!item) throw new Error('Item não encontrado.');
    if (item.is_checked) return;

    const order = get().orders.find((row) => row.id === orderId);
    const now = new Date().toISOString();
    const reason = `Separação ${order?.order_number || ''}`.trim();

    if (item.asset_id) {
      const asset = get().assets.find((row) => row.id === item.asset_id);
      if (asset && asset.status !== 'lost' && asset.status !== 'written_off') {
        await get().updateAsset(item.asset_id, { status: 'in_use', last_moved_at: now });
      }
      await get().createMovement({
        type: 'dispatch',
        order_id: orderId,
        asset_id: item.asset_id,
        quantity: item.quantity,
        reason,
        notes: item.name,
      });
    } else if (item.code.startsWith('UNI-')) {
      await get().createMovement({
        type: 'dispatch',
        order_id: orderId,
        quantity: item.quantity,
        reason,
        notes: `${item.name} · na rua`,
      });
    } else if (item.product_id) {
      const product = get().products.find((row) => row.id === item.product_id);
      let remaining = item.quantity;
      if (product?.kind === 'material') {
        const lots = get()
          .materialStock.filter(
            (row) =>
              row.product_id === item.product_id &&
              row.quantity > 0 &&
              row.status === 'available'
          )
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const onHand = lots.reduce((sum, row) => sum + row.quantity, 0);
        if (onHand < remaining) {
          throw new Error(`Estoque insuficiente para ${item.name} (${remaining} ${item.unit}).`);
        }
        for (const lot of lots) {
          if (remaining <= 0) break;
          const fresh = get().materialStock.find((row) => row.id === lot.id);
          if (!fresh || fresh.quantity <= 0) continue;
          const take = Math.min(fresh.quantity, remaining);
          await get().updateMaterialStock(fresh.id, { quantity: fresh.quantity - take });
          await get().createMovement({
            type: 'dispatch',
            order_id: orderId,
            quantity: take,
            quantity_before: fresh.quantity,
            quantity_after: fresh.quantity - take,
            from_location_id: fresh.location_id,
            reason,
            notes: item.name,
          });
          remaining -= take;
        }
      } else {
        const wanted = item.requested_state;
        const lots = get()
          .stock.filter(
            (row) =>
              row.product_id === item.product_id &&
              row.quantity > 0 &&
              row.status === 'available' &&
              (!wanted || physicalStateOf(row) === wanted)
          )
          .sort((a, b) => {
            if (a.is_active_separation !== b.is_active_separation) return a.is_active_separation ? -1 : 1;
            return (a.fifo_date || a.created_at).localeCompare(b.fifo_date || b.created_at);
          });
        const onHand = lots.reduce((sum, row) => sum + row.quantity, 0);
        if (onHand < remaining) {
          throw new Error(`Estoque insuficiente para ${item.name} (${remaining} ${item.unit}).`);
        }
        for (const lot of lots) {
          if (remaining <= 0) break;
          const fresh = get().stock.find((row) => row.id === lot.id);
          if (!fresh || fresh.quantity <= 0) continue;
          const take = Math.min(fresh.quantity, remaining);
          const left = fresh.quantity - take;
          await get().updateStock(fresh.id, {
            quantity: left,
            status: left > 0 ? fresh.status : 'depleted',
          });
          await get().createMovement({
            type: 'dispatch',
            stock_id: fresh.id,
            order_id: orderId,
            asset_id: fresh.asset_id || undefined,
            quantity: take,
            quantity_before: fresh.quantity,
            quantity_after: left,
            from_location_id: fresh.location_id,
            reason,
            notes: item.name,
          });
          remaining -= take;
        }
      }
    }

    await get().updateOrderItem(itemId, { is_checked: true });
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

  fetchEquipmentReservations: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data, error } = await supabase
      .from('equipment_reservations')
      .select('*')
      .order('reserved_from', { ascending: false });
    if (!error) set({ equipmentReservations: data || [] });
  },

  fetchUniforms: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: uniforms, error } = await supabase.from('uniforms').select('*').order('name');
    const { data: checkouts } = await supabase.from('uniform_checkouts').select('*').order('checked_out_at', { ascending: false });
    const stockResult = await supabase.from('uniform_stock').select('*');
    if (error) {
      set({ error: error.message });
      return;
    }
    const stock =
      stockResult.error && missingRelation(stockResult.error.message) ? [] : stockResult.error ? [] : stockResult.data || [];
    if (stockResult.error && !missingRelation(stockResult.error.message)) {
      set({ error: stockResult.error.message });
    }
    set({ uniforms: uniforms || [], uniformCheckouts: checkouts || [], uniformStock: stock });
  },

  seedUniformStockIfNeeded: async () => {
    const tradeId = salaTradeId(get().locations);
    if (!tradeId) return;
    let stock = get().uniformStock;
    const checkouts = get().uniformCheckouts;
    for (const uniform of get().uniforms.filter((item) => item.is_active !== false)) {
      for (const size of UNIFORM_SIZES) {
        const available = availableForSize(uniform, size, checkouts);
        const placed = stockQtyForSize(stock, uniform.id, size);
        if (available > placed) {
          stock = applyUniformStockDeltas(stock, [
            { uniform_id: uniform.id, size, location_id: tradeId, delta: available - placed },
          ]);
        } else if (placed > available) {
          const taken = takeUniformFromYards(stock, get().locations, uniform.id, size, placed - available);
          stock = applyUniformStockDeltas(stock, taken.deltas);
        }
      }
    }
    const prev = get().uniformStock;
    if (JSON.stringify(prev) === JSON.stringify(stock)) return;
    try {
      await saveUniformStock(prev, stock);
      set({ uniformStock: stock });
    } catch {
      set({ uniformStock: stock });
    }
  },

  moveUniformUnit: async ({ uniformId, size, fromColumn, toColumn, checkoutId }) => {
    if (!fromColumn || !toColumn || fromColumn === toColumn) return;
    const now = new Date().toISOString();
    const locations = get().locations;
    const yards = new Set(orderedUniformYardLocations(locations).map((location) => location.id));
    const fromStreet = fromColumn === UNIFORM_STREET_COLUMN;
    const toStreet = toColumn === UNIFORM_STREET_COLUMN;
    if (!fromStreet && !yards.has(fromColumn)) throw new Error('Local de origem inválido para uniforme.');
    if (!toStreet && !yards.has(toColumn)) throw new Error('Local de destino inválido para uniforme.');

    let stock = get().uniformStock;
    let checkouts = get().uniformCheckouts;

    if (!fromStreet && stockQtyAt(stock, uniformId, size, fromColumn) < 1) {
      void get().seedUniformStockIfNeeded();
      stock = get().uniformStock;
    }

    if (fromStreet) {
      const checkout = checkouts.find(
        (row) =>
          row.id === checkoutId &&
          row.uniform_id === uniformId &&
          row.size === size &&
          row.status === 'out'
      ) || checkouts.find((row) => row.uniform_id === uniformId && row.size === size && row.status === 'out');
      if (!checkout) throw new Error('Não há uniforme na rua para mover.');
      if (checkout.quantity > 1) {
        checkouts = checkouts.map((row) =>
          row.id === checkout.id ? { ...row, quantity: row.quantity - 1 } : row
        );
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase
            .from('uniform_checkouts')
            .update({ quantity: checkout.quantity - 1 })
            .eq('id', checkout.id);
          if (error) throw new Error(error.message);
        }
      } else {
        checkouts = checkouts.map((row) =>
          row.id === checkout.id ? { ...row, status: 'returned', returned_at: now } : row
        );
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase
            .from('uniform_checkouts')
            .update({ status: 'returned', returned_at: now })
            .eq('id', checkout.id);
          if (error) throw new Error(error.message);
        }
      }
    } else {
      if (stockQtyAt(stock, uniformId, size, fromColumn) < 1) {
        throw new Error('Não há uniforme neste local.');
      }
      stock = applyUniformStockDeltas(stock, [{ uniform_id: uniformId, size, location_id: fromColumn, delta: -1 }]);
    }

    if (toStreet) {
      const row: UniformCheckout = {
        id: generateId(),
        uniform_id: uniformId,
        order_id: null,
        size,
        quantity: 1,
        status: 'out',
        checked_out_at: now,
        returned_at: null,
        notes: UNIFORM_STAY_OUT_NOTE,
        created_at: now,
      };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('uniform_checkouts').insert(row);
        if (error) throw new Error(error.message);
      }
      checkouts = [row, ...checkouts];
    } else {
      stock = applyUniformStockDeltas(stock, [{ uniform_id: uniformId, size, location_id: toColumn, delta: 1 }]);
    }

    set({ uniformStock: stock, uniformCheckouts: checkouts });
    void saveUniformStock(get().uniformStock, stock).catch(() => undefined);
  },

  fetchVehicles: async () => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('vehicles').select('*').order('name');
      if (!error) {
        const rows = data || [];
        writeLocalVehicles(rows);
        set({ vehicles: rows });
        return;
      }
    }
    set({ vehicles: readLocalVehicles() });
  },

  createVehicle: async (name) => {
    const label = name.trim();
    if (!label) throw new Error('Informe o nome do veículo.');
    const existing = get().vehicles.find((row) => row.name.toLowerCase() === label.toLowerCase());
    if (existing) return existing;
    const now = new Date().toISOString();
    const row: Vehicle = { id: generateId(), name: label, created_at: now, updated_at: now };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('vehicles').insert(row).select().single();
      if (!error && data) {
        const next = [...get().vehicles, data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        writeLocalVehicles(next);
        set({ vehicles: next });
        return data;
      }
    }
    const next = [...get().vehicles, row].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    writeLocalVehicles(next);
    set({ vehicles: next });
    return row;
  },

  updateVehicle: async (id, name) => {
    const label = name.trim();
    if (!label) throw new Error('Informe o nome do veículo.');
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      await supabase.from('vehicles').update({ name: label, updated_at: now }).eq('id', id);
    }
    const next = get()
      .vehicles.map((row) => (row.id === id ? { ...row, name: label, updated_at: now } : row))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    writeLocalVehicles(next);
    set({ vehicles: next });
  },

  deleteVehicle: async (id) => {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('vehicles').delete().eq('id', id);
    }
    const next = get().vehicles.filter((row) => row.id !== id);
    writeLocalVehicles(next);
    set({ vehicles: next });
  },

  createUniform: async (data) => {
    const now = new Date().toISOString();
    const row: Uniform = {
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
    };
    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase.from('uniforms').insert(row).select().single();
      if (error) throw new Error(error.message);
      const created = inserted;
      const stock = addStockForLines(
        get().uniformStock,
        salaTradeId(get().locations),
        UNIFORM_SIZES.map((size) => ({ uniform_id: created.id, size, quantity: totalForSize(created, size) }))
      );
      await saveUniformStock(get().uniformStock, stock);
      set((s) => ({ uniforms: [...s.uniforms, created], uniformStock: stock }));
      return created;
    }
    const stock = addStockForLines(
      get().uniformStock,
      salaTradeId(get().locations),
      UNIFORM_SIZES.map((size) => ({ uniform_id: row.id, size, quantity: totalForSize(row, size) }))
    );
    set((s) => ({ uniforms: [...s.uniforms, row], uniformStock: stock }));
    return row;
  },

  updateUniform: async (id, data) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('uniforms').update({ ...data, updated_at: now }).eq('id', id);
      if (error) throw new Error(error.message);
    }
    set((s) => ({
      uniforms: s.uniforms.map((u) => (u.id === id ? { ...u, ...data, updated_at: now } : u)),
    }));
    const uniform = get().uniforms.find((item) => item.id === id);
    if (uniform) {
      let stock = get().uniformStock;
      for (const size of UNIFORM_SIZES) {
        const available = availableForSize(uniform, size, get().uniformCheckouts);
        const placed = stockQtyForSize(stock, id, size);
        if (available > placed) {
          const tradeId = salaTradeId(get().locations);
          if (tradeId) {
            stock = applyUniformStockDeltas(stock, [
              { uniform_id: id, size, location_id: tradeId, delta: available - placed },
            ]);
          }
        } else if (placed > available) {
          stock = applyUniformStockDeltas(
            stock,
            takeUniformFromYards(stock, get().locations, id, size, placed - available).deltas
          );
        }
      }
      await saveUniformStock(get().uniformStock, stock);
      set({ uniformStock: stock });
    }
  },

  deleteUniform: async (id) => {
    const dropFromCatalog = (hardDeleted: boolean) => {
      const now = new Date().toISOString();
      set((s) => ({
        uniforms: hardDeleted
          ? s.uniforms.filter((u) => u.id !== id)
          : s.uniforms.map((u) => (u.id === id ? { ...u, is_active: false, updated_at: now } : u)),
        uniformCheckouts: hardDeleted
          ? s.uniformCheckouts.filter((c) => c.uniform_id !== id)
          : s.uniformCheckouts,
        uniformStock: hardDeleted ? s.uniformStock.filter((row) => row.uniform_id !== id) : s.uniformStock,
      }));
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('uniforms').delete().eq('id', id);
      if (!error) {
        dropFromCatalog(true);
        return;
      }

      const now = new Date().toISOString();
      const { data: deactivated, error: deactivateError } = await supabase
        .from('uniforms')
        .update({ is_active: false, updated_at: now })
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (deactivateError) throw new Error(deactivateError.message);
      if (!deactivated) {
        throw new Error(error.message || 'Não foi possível excluir este uniforme.');
      }
      dropFromCatalog(false);
      return;
    }

    dropFromCatalog(true);
  },

  checkoutUniforms: async (orderId, lines) => {
    const now = new Date().toISOString();
    const rows: UniformCheckout[] = lines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        id: generateId(),
        uniform_id: line.uniform_id,
        order_id: orderId,
        size: line.size,
        quantity: line.quantity,
        status: 'out',
        checked_out_at: now,
        returned_at: null,
        notes: null,
        created_at: now,
      }));
    if (!rows.length) return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('uniform_checkouts').insert(rows);
      if (error) throw new Error(error.message);
    }
    set((s) => ({ uniformCheckouts: [...s.uniformCheckouts, ...rows] }));
    const nextStock = deductStockForLines(get().uniformStock, get().locations, rows);
    await saveUniformStock(get().uniformStock, nextStock);
    set({ uniformStock: nextStock });
  },

  returnUniformsForOrder: async (orderId, stayOut = []) => {
    const now = new Date().toISOString();
    const stayOutIds = new Set(stayOut.map((row) => row.id));
    const remainingById = new Map(stayOut.map((row) => [row.id, row.remaining]));
    const returning = get().uniformCheckouts.filter(
      (c) => c.order_id === orderId && c.status === 'out' && !checkoutStaysOut(c) && !stayOutIds.has(c.id)
    );
    const keep = get().uniformCheckouts.filter((c) => stayOutIds.has(c.id) && c.status === 'out');

    if (isSupabaseConfigured && supabase) {
      if (returning.length) {
        const { error } = await supabase
          .from('uniform_checkouts')
          .update({ status: 'returned', returned_at: now })
          .in('id', returning.map((c) => c.id));
        if (error) throw new Error(error.message);
      }
      for (const checkout of keep) {
        const remaining = remainingById.get(checkout.id) ?? checkout.quantity;
        const { error } = await supabase
          .from('uniform_checkouts')
          .update({
            notes: UNIFORM_STAY_OUT_NOTE,
            quantity: Math.max(1, remaining),
          })
          .eq('id', checkout.id);
        if (error) throw new Error(error.message);
      }
    }

    const returningIds = new Set(returning.map((c) => c.id));
    const returnedStock = addStockForLines(get().uniformStock, dirtyYardId(get().locations), returning);
    await saveUniformStock(get().uniformStock, returnedStock);
    set((s) => ({
      uniformStock: returnedStock,
      uniformCheckouts: s.uniformCheckouts.map((c) => {
        if (returningIds.has(c.id)) return { ...c, status: 'returned', returned_at: now };
        if (stayOutIds.has(c.id) && c.status === 'out') {
          return {
            ...c,
            notes: UNIFORM_STAY_OUT_NOTE,
            quantity: Math.max(1, remainingById.get(c.id) ?? c.quantity),
          };
        }
        return c;
      }),
    }));
  },

  completeEquipmentForOrder: async (orderId, stayOutAssetIds = []) => {
    const now = new Date().toISOString();
    const stayOut = new Set(stayOutAssetIds);
    const open = get().equipmentReservations.filter((row) => row.order_id === orderId && row.status === 'active');
    const fromItems = get()
      .orderItems.filter((item) => item.order_id === orderId && item.asset_id)
      .map((item) => item.asset_id!)
      .filter((id) => stayOut.has(id));
    const assetIds = [...new Set([...open.map((row) => row.asset_id), ...fromItems])];
    if (!open.length && !fromItems.length) return;

    if (isSupabaseConfigured && supabase && open.length) {
      const { error } = await supabase
        .from('equipment_reservations')
        .update({ status: 'completed' })
        .eq('order_id', orderId)
        .eq('status', 'active');
      if (error) throw new Error(error.message);
    }

    for (const assetId of assetIds) {
      const asset = get().assets.find((row) => row.id === assetId);
      if (!asset) continue;
      if (asset.status === 'damaged' || asset.status === 'lost') continue;
      const nextStatus = stayOut.has(assetId) ? 'in_use' : 'returned_pending';
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('assets')
          .update({ status: nextStatus, last_moved_at: now, updated_at: now })
          .eq('id', assetId);
      }
    }

    set((s) => ({
      equipmentReservations: s.equipmentReservations.map((row) =>
        row.order_id === orderId && row.status === 'active' ? { ...row, status: 'completed' } : row
      ),
      assets: s.assets.map((asset) => {
        if (!assetIds.includes(asset.id) || asset.status === 'damaged' || asset.status === 'lost') return asset;
        return {
          ...asset,
          status: stayOut.has(asset.id) ? 'in_use' : 'returned_pending',
          last_moved_at: now,
          updated_at: now,
        };
      }),
    }));
  },

  fetchAssetComponents: async (assetId) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('asset_components')
        .select('*')
        .eq('parent_asset_id', assetId)
        .order('sort_order');
      if (error) throw new Error(error.message);
      return data || [];
    }
    return [];
  },

  replaceAssetComponents: async (assetId, components) => {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { error: delError } = await supabase
        .from('asset_components')
        .delete()
        .eq('parent_asset_id', assetId);
      if (delError) throw new Error(delError.message);
      if (components.length === 0) return [];
      const rows = components.map((c, index) => ({
        id: generateId(),
        parent_asset_id: assetId,
        ...c,
        sort_order: index,
        created_at: now,
      }));
      const { data, error } = await supabase
        .from('asset_components')
        .insert(rows)
        .select();
      if (error) throw new Error(error.message);
      return data || [];
    }
    return components.map((c, index) => ({
      id: generateId(),
      parent_asset_id: assetId,
      ...c,
      sort_order: index,
      created_at: now,
    }));
  },

  fetchAssetAttachments: async (assetId) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('asset_attachments')
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }
    return [];
  },

  addAssetAttachment: async (data) => {
    const row: AssetAttachment = {
      id: generateId(),
      ...data,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('asset_attachments')
        .insert(row)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    }
    return row;
  },

  deleteAssetAttachment: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('asset_attachments').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
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
          await supabase.from('assets').update({
            location_id: destinationId,
            last_moved_at: now,
            updated_at: now,
          }).eq('id', stock.asset_id);
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
        return relatedStock ? { ...a, location_id: destinationId, last_moved_at: now, updated_at: now } : a;
      }),
      movements: [...movements, ...s.movements],
    }));
  },

  sendBoxesToFactory: async (assetIds) => {
    await get().ensureAssetYardLocations();
    const state = get();
    const now = new Date().toISOString();
    const uniqueIds = [...new Set(assetIds)];
    if (uniqueIds.length === 0) throw new Error('Escaneie ao menos uma caixa vazia.');
    const factory = factoryLocation(state.locations);
    if (!factory) throw new Error('Local Fábrica não está cadastrado.');

    const selected = uniqueIds.map((id) => {
      const asset = state.assets.find((item) => item.id === id);
      if (!asset) throw new Error('Caixa não encontrada.');
      if (!canSendToFactory(asset, state.stock)) {
        throw new Error(`${asset.code} não pode ir à fábrica. Precisa estar vazia (após limpeza) e ser caixa preta ou grande.`);
      }
      return asset;
    });

    const movements: Movement[] = selected.map((asset) => ({
      id: generateId(),
      movement_number: generateMovementNumber(),
      type: 'transfer' as const,
      stock_id: null,
      asset_id: asset.id,
      order_id: null,
      inspection_id: null,
      inventory_count_id: null,
      from_location_id: asset.location_id,
      to_location_id: factory.id,
      quantity: null,
      quantity_before: 0,
      quantity_after: 0,
      reason: 'Envio à fábrica (vazia)',
      notes: asset.code,
      created_by: null,
      created_at: now,
    }));

    if (isSupabaseConfigured && supabase) {
      const { error: assetError } = await supabase
        .from('assets')
        .update({ status: 'at_factory', location_id: factory.id, last_moved_at: now, updated_at: now })
        .in('id', uniqueIds);
      if (assetError) throw new Error(assetError.message);
      const { error: movementError } = await supabase.from('movements').insert(movements);
      if (movementError) throw new Error(movementError.message);
    }

    set((current) => ({
      assets: current.assets.map((asset) =>
        uniqueIds.includes(asset.id)
          ? { ...asset, status: 'at_factory' as const, location_id: factory.id, last_moved_at: now, updated_at: now }
          : asset
      ),
      movements: [...movements, ...current.movements],
    }));
  },
  
  withdrawFromBox: async (boxId, quantity, reason) => {
    const state = get();
    const now = new Date().toISOString();
    
    const stock = state.stock.find(s => s.id === boxId);
    if (!stock) throw new Error('Caixa não encontrada.');
    if (!stock.is_active_separation) {
      throw new Error('Só a caixa de montagem deste sabor e estado pode ter unidades retiradas. Caixas de 100 ficam fechadas na prateleira.');
    }
    if (stock.quantity < quantity) throw new Error('Quantidade insuficiente na caixa de montagem.');
    
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
        is_active_separation: true,
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
          is_active_separation: true,
          status: newQuantity > 0 ? st.status : 'depleted',
          updated_at: now 
        } : st
      ),
      movements: [movement, ...s.movements],
    }));
  },

  promoteAssemblyBox: async (stockId) => {
    const state = get();
    const now = new Date().toISOString();
    const stock = state.stock.find((item) => item.id === stockId);
    if (!stock) throw new Error('Caixa não encontrada.');
    if (stock.quantity <= 0 || stock.status === 'depleted') {
      throw new Error('Esta caixa está vazia. Escaneie-a vazia e traga uma caixa de 100.');
    }
    if (!stock.asset_id) throw new Error('Só caixa média vira caixa de montagem.');
    const asset = state.assets.find((item) => item.id === stock.asset_id);
    if (!asset || asset.type !== 'caixa_media') {
      throw new Error('Só caixa média vira caixa de montagem.');
    }
    if (stock.is_active_separation) return;
    const existing = findAssemblyBox(state.stock, stock.product_id, physicalStateOf(stock));
    if (existing) {
      const existingAsset = state.assets.find((item) => item.id === existing.asset_id);
      if (existing.quantity <= 0) {
        throw new Error(
          `Escanear vazia ${existingAsset?.code || existing.stock_number} antes de abrir a próxima caixa de montagem.`
        );
      }
      throw new Error(
        `Já existe caixa de montagem para este sabor e estado: ${existingAsset?.code || existing.stock_number}.`
      );
    }
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('stock')
        .update({ is_active_separation: true, updated_at: now })
        .eq('id', stockId);
      if (error) throw new Error(error.message);
    }
    set((current) => ({
      stock: current.stock.map((item) =>
        item.id === stockId ? { ...item, is_active_separation: true, updated_at: now } : item
      ),
    }));
  },

  scanEmptyAssemblyBox: async (stockId) => {
    const state = get();
    const now = new Date().toISOString();
    const stock = state.stock.find((item) => item.id === stockId);
    if (!stock) throw new Error('Caixa não encontrada.');
    if (!stock.is_active_separation) {
      throw new Error('Esta não é a caixa de montagem.');
    }
    if (stock.quantity > 0) {
      throw new Error(
        `Ainda há ${stock.quantity} un nesta caixa. Monte SKUs ou retire até zerar, depois escaneie vazia.`
      );
    }
    const movement: Movement = {
      id: generateId(),
      movement_number: generateMovementNumber(),
      type: 'adjustment',
      stock_id: stock.id,
      asset_id: stock.asset_id,
      order_id: null,
      inspection_id: null,
      inventory_count_id: null,
      from_location_id: stock.location_id,
      to_location_id: stock.location_id,
      quantity: 0,
      quantity_before: 0,
      quantity_after: 0,
      reason: 'Caixa de montagem vazia — pronta para reuso',
      notes: null,
      created_by: null,
      created_at: now,
    };
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('stock')
        .update({
          is_active_separation: false,
          status: 'depleted',
          quantity: 0,
          updated_at: now,
        })
        .eq('id', stock.id);
      if (error) throw new Error(error.message);
      if (stock.asset_id) {
        const { error: assetError } = await supabase
          .from('assets')
          .update({ status: 'available', last_moved_at: now, updated_at: now })
          .eq('id', stock.asset_id);
        if (assetError) throw new Error(assetError.message);
      }
      await supabase.from('movements').insert(movement);
    }
    set((current) => ({
      stock: current.stock.map((item) =>
        item.id === stockId
          ? { ...item, is_active_separation: false, status: 'depleted' as const, quantity: 0, updated_at: now }
          : item
      ),
      assets: current.assets.map((asset) =>
        asset.id === stock.asset_id
          ? { ...asset, status: 'available' as const, last_moved_at: now, updated_at: now }
          : asset
      ),
      movements: [movement, ...current.movements],
    }));
  },

  assembleSku: async (productId, quantity, physicalState) => {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Informe quantos SKUs montar.');
    }
    const location = await get().ensureAssembledLocation();
    if (get().productComponents.length === 0) await get().fetchProductComponents();
    const state = get();
    const now = new Date().toISOString();
    const product = state.products.find((item) => item.id === productId);
    if (!product || !product.is_composite) {
      throw new Error('Escolha um SKU composto (cartucho, caixa, pallet).');
    }
    const needs = bomNeeds(productId, quantity, state.products, state.productComponents);
    let nextStock = [...state.stock];
    let nextMaterial = [...state.materialStock];
    const newStock: Stock[] = [];
    const newMovements: Movement[] = [];
    const touchedStock = new Set<string>();
    const touchedMaterial = new Set<string>();
    let assembledGrade: Stock['grade'] = null;

    const pushMovement = (movement: Omit<Movement, 'id' | 'movement_number' | 'created_at' | 'created_by'>) => {
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        created_by: null,
        created_at: now,
        ...movement,
      });
    };

    const consumeStock = (row: Stock, take: number, reason: string) => {
      if (row.quantity < take) {
        throw new Error('Saldo insuficiente para montar este SKU.');
      }
      const after = row.quantity - take;
      nextStock = nextStock.map((item) =>
        item.id === row.id
          ? {
              ...item,
              quantity: after,
              status: after > 0 ? item.status : 'depleted',
              is_active_separation: item.is_active_separation,
              updated_at: now,
            }
          : item
      );
      touchedStock.add(row.id);
      pushMovement({
        type: 'packing',
        stock_id: row.id,
        asset_id: row.asset_id,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: row.location_id,
        to_location_id: location.id,
        quantity: take,
        quantity_before: row.quantity,
        quantity_after: after,
        reason,
        notes: product.code,
      });
    };

    for (const need of needs) {
      const child = state.products.find((item) => item.id === need.productId);
      if (!child) throw new Error('Componente da árvore de produto não encontrado.');
      if (need.kind === 'material') {
        const row = nextMaterial.find(
          (item) => item.product_id === need.productId && item.status === 'available' && item.quantity > 0
        );
        if (!row || row.quantity < need.quantity) {
          throw new Error(`Falta ${child.name} (${need.quantity} ${child.unit}) para montar ${product.code}.`);
        }
        nextMaterial = nextMaterial.map((item) =>
          item.id === row.id ? { ...item, quantity: item.quantity - need.quantity, updated_at: now } : item
        );
        touchedMaterial.add(row.id);
        continue;
      }
      if (need.kind === 'unit') {
        const box = findAssemblyBox(nextStock, need.productId, physicalState);
        const boxAsset = box ? state.assets.find((item) => item.id === box.asset_id) : undefined;
        if (!box || box.quantity <= 0) {
          throw new Error(
            `Abra a caixa de montagem de ${child.flavor || child.name} (${physicalState === 'frozen' ? 'congelado' : 'líquido'}) e traga uma caixa de 100.`
          );
        }
        if (box.quantity < need.quantity) {
          throw new Error(
            `A caixa de montagem ${boxAsset?.code || box.stock_number} tem ${box.quantity} un. Precisa de ${need.quantity} para montar ${quantity} × ${product.code}.`
          );
        }
        if (assembledGrade && box.grade && box.grade !== assembledGrade) {
          throw new Error('Monte a partir de caixas de montagem da mesma classificação.');
        }
        if (box.grade) assembledGrade = box.grade;
        consumeStock(box, need.quantity, `Montar ${quantity} × ${product.code}`);
        continue;
      }
      const source = nextStock.find(
        (item) =>
          item.product_id === need.productId &&
          physicalStateOf(item) === physicalState &&
          item.location_id === location.id &&
          item.quantity > 0 &&
          item.status !== 'depleted'
      );
      if (!source || source.quantity < need.quantity) {
        throw new Error(
          `Falta ${child.code} em Produtos montados (${need.quantity} un, ${physicalState === 'frozen' ? 'congelado' : 'líquido'}). Monte o nível anterior primeiro.`
        );
      }
      assembledGrade = source.grade || assembledGrade;
      consumeStock(source, need.quantity, `Montar ${quantity} × ${product.code}`);
    }

    const existingAssembled = nextStock.find(
      (item) =>
        item.product_id === productId &&
        physicalStateOf(item) === physicalState &&
        item.location_id === location.id &&
        item.grade === (assembledGrade || 'AAA') &&
        item.status !== 'depleted'
    );
    if (existingAssembled) {
      nextStock = nextStock.map((item) =>
        item.id === existingAssembled.id
          ? { ...item, quantity: item.quantity + quantity, status: 'available', updated_at: now }
          : item
      );
      touchedStock.add(existingAssembled.id);
      pushMovement({
        type: 'packing',
        stock_id: existingAssembled.id,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: location.id,
        to_location_id: location.id,
        quantity,
        quantity_before: existingAssembled.quantity,
        quantity_after: existingAssembled.quantity + quantity,
        reason: `Montagem ${product.code}`,
        notes: `${quantity} un`,
      });
    } else {
      const created: Stock = {
        id: generateId(),
        stock_number: generateStockNumber('CMP'),
        product_id: productId,
        asset_id: null,
        quantity,
        location_id: location.id,
        grade: assembledGrade || 'AAA',
        physical_state: physicalState,
        status: 'available',
        is_active_separation: false,
        lot: null,
        fifo_date: now.slice(0, 10),
        received_date: now.slice(0, 10),
        packed_at: now,
        receipt_id: null,
        inspection_id: null,
        fill_id: null,
        created_at: now,
        updated_at: now,
      };
      newStock.push(created);
      nextStock = [...nextStock, created];
      pushMovement({
        type: 'packing',
        stock_id: created.id,
        asset_id: null,
        order_id: null,
        inspection_id: null,
        inventory_count_id: null,
        from_location_id: location.id,
        to_location_id: location.id,
        quantity,
        quantity_before: 0,
        quantity_after: quantity,
        reason: `Montagem ${product.code}`,
        notes: `${quantity} un`,
      });
    }

    if (isSupabaseConfigured && supabase) {
      if (newStock.length) await supabase.from('stock').insert(newStock);
      for (const id of touchedStock) {
        const row = nextStock.find((item) => item.id === id);
        if (!row) continue;
        const { error } = await supabase
          .from('stock')
          .update({
            quantity: row.quantity,
            status: row.status,
            is_active_separation: row.is_active_separation,
            updated_at: now,
          })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      for (const id of touchedMaterial) {
        const row = nextMaterial.find((item) => item.id === id);
        if (!row) continue;
        const { error } = await supabase
          .from('material_stock')
          .update({ quantity: row.quantity, updated_at: now })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      if (newMovements.length) await supabase.from('movements').insert(newMovements);
    }

    set({
      stock: nextStock,
      materialStock: nextMaterial,
      movements: [...newMovements, ...state.movements],
    });

    await syncCompositeRestock(get, productId, physicalState);
  },

  unbuildSku: async (stockId, quantity) => {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Informe quantos SKUs desmontar.');
    }
    const location = await get().ensureAssembledLocation();
    if (get().productComponents.length === 0) await get().fetchProductComponents();
    const state = get();
    const now = new Date().toISOString();
    const source = state.stock.find((item) => item.id === stockId);
    if (!source) throw new Error('Estoque montado não encontrado.');
    const product = state.products.find((item) => item.id === source.product_id);
    if (!product?.is_composite) throw new Error('Só SKU composto pode ser desmontado.');
    if (source.quantity < quantity) throw new Error('Quantidade maior que o saldo montado.');
    const physicalState = physicalStateOf(source);
    const needs = bomNeeds(product.id, quantity, state.products, state.productComponents);
    let nextStock = [...state.stock];
    let nextMaterial = [...state.materialStock];
    const newStock: Stock[] = [];
    const newMovements: Movement[] = [];
    const touchedStock = new Set<string>();
    const touchedMaterial = new Set<string>();

    const pushMovement = (movement: Omit<Movement, 'id' | 'movement_number' | 'created_at' | 'created_by'>) => {
      newMovements.push({
        id: generateId(),
        movement_number: generateMovementNumber(),
        created_by: null,
        created_at: now,
        ...movement,
      });
    };

    const afterSource = source.quantity - quantity;
    nextStock = nextStock.map((item) =>
      item.id === source.id
        ? {
            ...item,
            quantity: afterSource,
            status: afterSource > 0 ? item.status : 'depleted',
            updated_at: now,
          }
        : item
    );
    touchedStock.add(source.id);
    pushMovement({
      type: 'adjustment',
      stock_id: source.id,
      asset_id: null,
      order_id: null,
      inspection_id: null,
      inventory_count_id: null,
      from_location_id: source.location_id,
      to_location_id: source.location_id,
      quantity,
      quantity_before: source.quantity,
      quantity_after: afterSource,
      reason: `Desmontar ${product.code}`,
      notes: `${quantity} un`,
    });

    for (const need of needs) {
      const child = state.products.find((item) => item.id === need.productId);
      if (!child) throw new Error('Componente da árvore de produto não encontrado.');
      if (need.kind === 'material') {
        const row = nextMaterial.find(
          (item) => item.product_id === need.productId && item.status === 'available'
        );
        if (row) {
          nextMaterial = nextMaterial.map((item) =>
            item.id === row.id ? { ...item, quantity: item.quantity + need.quantity, updated_at: now } : item
          );
          touchedMaterial.add(row.id);
        }
        continue;
      }
      if (need.kind === 'unit') {
        const box = findAssemblyBox(nextStock, need.productId, physicalState);
        if (!box) {
          throw new Error(
            `Abra a caixa de montagem de ${child.flavor || child.name} para receber as unidades desmontadas.`
          );
        }
        const room = boxCapacity(box, state.assets) - box.quantity;
        if (need.quantity > room) {
          throw new Error(
            `A caixa de montagem de ${child.flavor || child.name} só cabe mais ${room} un.`
          );
        }
        nextStock = nextStock.map((item) =>
          item.id === box.id
            ? {
                ...item,
                quantity: item.quantity + need.quantity,
                status: 'available',
                updated_at: now,
              }
            : item
        );
        touchedStock.add(box.id);
        pushMovement({
          type: 'adjustment',
          stock_id: box.id,
          asset_id: box.asset_id,
          order_id: null,
          inspection_id: null,
          inventory_count_id: null,
          from_location_id: location.id,
          to_location_id: box.location_id,
          quantity: need.quantity,
          quantity_before: box.quantity,
          quantity_after: box.quantity + need.quantity,
          reason: `Retorno da desmontagem ${product.code}`,
          notes: child.code,
        });
        continue;
      }
      const existing = nextStock.find(
        (item) =>
          item.product_id === need.productId &&
          physicalStateOf(item) === physicalState &&
          item.location_id === location.id &&
          item.grade === source.grade &&
          item.status !== 'depleted'
      );
      if (existing) {
        nextStock = nextStock.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + need.quantity, status: 'available', updated_at: now }
            : item
        );
        touchedStock.add(existing.id);
      } else {
        const created: Stock = {
          id: generateId(),
          stock_number: generateStockNumber('CMP'),
          product_id: need.productId,
          asset_id: null,
          quantity: need.quantity,
          location_id: location.id,
          grade: source.grade,
          physical_state: physicalState,
          status: 'available',
          is_active_separation: false,
          lot: source.lot,
          fifo_date: source.fifo_date,
          received_date: source.received_date,
          packed_at: now,
          receipt_id: null,
          inspection_id: null,
          fill_id: null,
          created_at: now,
          updated_at: now,
        };
        newStock.push(created);
        nextStock = [...nextStock, created];
      }
    }

    if (isSupabaseConfigured && supabase) {
      if (newStock.length) await supabase.from('stock').insert(newStock);
      for (const id of touchedStock) {
        const row = nextStock.find((item) => item.id === id);
        if (!row) continue;
        const { error } = await supabase
          .from('stock')
          .update({
            quantity: row.quantity,
            status: row.status,
            is_active_separation: row.is_active_separation,
            updated_at: now,
          })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      for (const id of touchedMaterial) {
        const row = nextMaterial.find((item) => item.id === id);
        if (!row) continue;
        const { error } = await supabase
          .from('material_stock')
          .update({ quantity: row.quantity, updated_at: now })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      if (newMovements.length) await supabase.from('movements').insert(newMovements);
    }

    set({
      stock: nextStock,
      materialStock: nextMaterial,
      movements: [...newMovements, ...state.movements],
    });

    await syncCompositeRestock(get, product.id, physicalState);
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
