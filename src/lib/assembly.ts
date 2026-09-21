import { getBoxUnitCapacity } from "@/lib/operational-assets";
import type {
  Asset,
  Location,
  PhysicalState,
  Product,
  ProductComponent,
  Stock,
} from "@/types/database";

export const ASSEMBLED_SYSTEM_KEY = "assembled";
export const RESTOCK_NOTE_PREFIX = "reposição:";

export function restockNote(productId: string, state: PhysicalState) {
  return `${RESTOCK_NOTE_PREFIX}${productId}:${state}`;
}

export function isPackingRoom(location?: Location | null) {
  return Boolean(location?.name && /packing/i.test(location.name));
}

export function assembledLocation(locations: Location[]) {
  return locations.find((location) => location.system_key === ASSEMBLED_SYSTEM_KEY);
}

export function physicalStateOf(stock: Pick<Stock, "physical_state">): PhysicalState {
  return stock.physical_state === "frozen" ? "frozen" : "liquid";
}

export function isLiveStock(stock: Stock) {
  return stock.quantity > 0 && stock.status !== "depleted";
}

export function isAssemblyBox(stock: Stock) {
  return Boolean(stock.is_active_separation);
}

export function findAssemblyBox(stock: Stock[], productId: string, state: PhysicalState) {
  return stock.find(
    (item) =>
      item.is_active_separation &&
      item.product_id === productId &&
      physicalStateOf(item) === state
  );
}

export function boxCapacity(stock: Pick<Stock, "asset_id">, assets: Asset[]) {
  const asset = stock.asset_id ? assets.find((item) => item.id === stock.asset_id) : undefined;
  return asset ? getBoxUnitCapacity(asset) : 100;
}

export function isPartialMediaBox(stock: Stock, assets: Asset[]) {
  if (!stock.asset_id || stock.quantity <= 0) return false;
  const capacity = boxCapacity(stock, assets);
  return capacity > 0 && stock.quantity < capacity;
}

type BomRow = Pick<ProductComponent, "parent_product_id" | "child_product_id" | "quantity">;

/** Qtd base in pops: individual SKU uses cadastro; composto sums child pops (6, 60, 6480, …). */
export function popBaseQuantity(
  productId: string,
  products: Product[],
  components: BomRow[],
  seen = new Set<string>()
): number {
  if (seen.has(productId)) return 0;
  seen.add(productId);
  const product = products.find((item) => item.id === productId);
  if (!product) return 0;
  const bom = components.filter((row) => row.parent_product_id === productId);
  if (bom.length === 0) return product.base_quantity || 1;

  let total = 0;
  for (const row of bom) {
    const child = products.find((item) => item.id === row.child_product_id);
    if (!child || child.kind !== "pop") continue;
    total += row.quantity * popBaseQuantity(row.child_product_id, products, components, new Set(seen));
  }
  return total > 0 ? total : product.base_quantity || 1;
}

export function leafUnits(
  productId: string,
  products: Product[],
  components: ProductComponent[],
  seen = new Set<string>()
): number {
  if (seen.has(productId)) return 0;
  seen.add(productId);
  const product = products.find((item) => item.id === productId);
  if (!product) return 1;
  const bom = components.filter((row) => row.parent_product_id === productId);
  if (!product.is_composite || bom.length === 0) return product.base_quantity || 1;
  return bom.reduce(
    (sum, row) =>
      sum + row.quantity * leafUnits(row.child_product_id, products, components, new Set(seen)),
    0
  );
}

export function stockLeafUnits(stock: Stock, products: Product[], components: ProductComponent[]) {
  return stock.quantity * leafUnits(stock.product_id, products, components);
}

export function stockPopUnits(stock: Stock, products: Product[], components: BomRow[]) {
  return stock.quantity * popBaseQuantity(stock.product_id, products, components);
}

export type BomNeedKind = "unit" | "composite" | "material";

export interface BomNeed {
  productId: string;
  quantity: number;
  kind: BomNeedKind;
}

export function bomNeeds(
  productId: string,
  quantity: number,
  products: Product[],
  components: ProductComponent[]
): BomNeed[] {
  const bom = components.filter((row) => row.parent_product_id === productId);
  if (bom.length === 0) {
    throw new Error("Este SKU composto não tem árvore de produto. Cadastre a composição em Cadastros.");
  }
  return bom.map((row) => {
    const child = products.find((item) => item.id === row.child_product_id);
    const kind: BomNeedKind =
      child?.kind === "material" ? "material" : child?.is_composite ? "composite" : "unit";
    return { productId: row.child_product_id, quantity: row.quantity * quantity, kind };
  });
}

export function assembledOnHand(
  stock: Stock[],
  productId: string,
  state: PhysicalState,
  locationId?: string | null
) {
  return stock
    .filter(
      (item) =>
        isLiveStock(item) &&
        item.product_id === productId &&
        physicalStateOf(item) === state &&
        (!locationId || item.location_id === locationId)
    )
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function stateLabel(state: PhysicalState | null | undefined) {
  return state === "frozen" ? "Congelado" : "Líquido";
}
