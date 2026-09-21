import { physicalStateOf, popBaseQuantity } from "@/lib/assembly";
import type {
  MaterialStock,
  Movement,
  Order,
  OrderItem,
  PhysicalState,
  Product,
  ProductComponent,
  SeparationJob,
  Stock,
} from "@/types/database";

export function orderHoldsStockReservation(order: Order, job?: SeparationJob | null) {
  if (order.status === "cancelled" || order.status === "completed" || order.status === "retorno") {
    return false;
  }
  if (job) return job.stage === "em_separacao" || job.stage === "na_rua";
  return order.status === "em_separacao" || order.status === "na_rua";
}

function reservationKey(productId: string, state?: PhysicalState | null) {
  return `${productId}:${state || ""}`;
}

export function reservedSkuMap(
  orders: Order[],
  jobs: SeparationJob[],
  items: OrderItem[]
) {
  const jobByOrder = new Map(jobs.map((job) => [job.order_id, job]));
  const map = new Map<string, number>();
  for (const order of orders) {
    if (!orderHoldsStockReservation(order, jobByOrder.get(order.id))) continue;
    for (const item of items) {
      if (item.order_id !== order.id || !item.product_id) continue;
      const key = reservationKey(item.product_id, item.requested_state);
      map.set(key, (map.get(key) || 0) + item.quantity);
    }
  }
  return map;
}

export function reservedQuantityForProduct(
  reserved: Map<string, number>,
  productId: string,
  state?: PhysicalState | null
) {
  if (state) return reserved.get(reservationKey(productId, state)) || 0;
  let total = 0;
  for (const [key, qty] of reserved) {
    if (key.startsWith(`${productId}:`)) total += qty;
  }
  return total;
}

export function reservedPopUnitsForProduct(
  reservedSkuQty: number,
  productId: string,
  products: Product[],
  components: ProductComponent[]
) {
  return reservedSkuQty * popBaseQuantity(productId, products, components);
}

function alreadyDispatchedQty(orderId: string, item: OrderItem, movements: Movement[]) {
  return movements
    .filter(
      (row) =>
        row.order_id === orderId &&
        row.type === "dispatch" &&
        row.notes === item.name &&
        !row.asset_id
    )
    .reduce((sum, row) => sum + (row.quantity || 0), 0);
}

export function closeStockShortages(
  orderId: string,
  items: OrderItem[],
  products: Product[],
  stock: Stock[],
  materialStock: MaterialStock[],
  movements: Movement[]
) {
  const rows: {
    id: string;
    name: string;
    sku: string;
    state: "" | "liquid" | "frozen";
    qty: number;
    available: number;
  }[] = [];

  for (const item of items) {
    if (!item.product_id || item.asset_id || item.code.startsWith("UNI-")) continue;
    const product = products.find((row) => row.id === item.product_id);
    const qty = Math.max(0, item.quantity - alreadyDispatchedQty(orderId, item, movements));
    if (qty <= 0) continue;
    const isMaterial = product?.kind === "material";
    const state: "" | "liquid" | "frozen" = isMaterial
      ? ""
      : item.requested_state === "frozen"
        ? "frozen"
        : "liquid";
    const available = isMaterial
      ? materialStock
          .filter((row) => row.product_id === item.product_id && row.quantity > 0 && row.status === "available")
          .reduce((sum, row) => sum + row.quantity, 0)
      : stock
          .filter(
            (row) =>
              row.product_id === item.product_id &&
              row.quantity > 0 &&
              row.status === "available" &&
              (!item.requested_state || physicalStateOf(row) === item.requested_state)
          )
          .reduce((sum, row) => sum + row.quantity, 0);
    if (available >= qty) continue;
    rows.push({
      id: `${item.id}:${state}`,
      name: product?.name || item.name || "Produto",
      sku: product?.code || item.code || "—",
      state,
      qty,
      available,
    });
  }

  return rows;
}
