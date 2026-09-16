import { checkoutStaysOut } from "@/lib/kit-availability";
import { locationSummary, parseCloseOut, unreturnedQty } from "@/lib/separacao";
import type { Asset, Order, OrderItem, Uniform, UniformCheckout } from "@/types/database";

export type StreetAssetRow = {
  id: string;
  kind: "equipamento" | "uniforme";
  name: string;
  code: string;
  where: string;
  organization: string;
  recipient: string;
  address: string;
  orderNumber: string;
  orderId: string;
  since: string;
  volta: string;
  qty: number;
  search: string;
};

const BACK_HOME = new Set(["available", "returned_pending", "cleaning", "inspection"]);

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = value.length <= 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function whereLabel(order: Order) {
  return [order.organization, order.recipient_name, locationSummary(order)].filter(Boolean).join(" · ") || "—";
}

export function checkoutMatchesItem(
  checkout: UniformCheckout,
  item: OrderItem,
  uniforms: Uniform[]
) {
  if (item.asset_id || checkout.order_id !== item.order_id) return false;
  const uniform = uniforms.find((row) => row.id === checkout.uniform_id);
  return item.name === `${uniform?.name || "Uniforme"} · ${checkout.size}`;
}

function pushRow(
  rows: StreetAssetRow[],
  row: Omit<StreetAssetRow, "search">
) {
  rows.push({
    ...row,
    search: `${row.name} ${row.code} ${row.where} ${row.orderNumber} ${row.volta}`.toLowerCase(),
  });
}

export function streetAssets(
  orders: Order[],
  orderItems: OrderItem[],
  assets: Asset[],
  uniforms: Uniform[],
  checkouts: UniformCheckout[]
): StreetAssetRow[] {
  const liveOrders = orders.filter((order) => order.status !== "cancelled");
  const byId = new Map(liveOrders.map((order) => [order.id, order]));
  const rows: StreetAssetRow[] = [];
  const seen = new Set<string>();

  for (const item of orderItems) {
    if (!item.asset_id) continue;
    const order = byId.get(item.order_id);
    if (!order) continue;
    const asset = assets.find((row) => row.id === item.asset_id);
    const close = parseCloseOut(order.return_description);
    const closeLine = close?.lines.find((line) => line.item_id === item.id);
    const leftover = closeLine ? unreturnedQty(closeLine) : item.is_returnable ? 0 : item.quantity;
    const plannedStay = !item.is_returnable;
    const failedReturn = Boolean(item.is_returnable && close && leftover > 0);
    if (!plannedStay && !failedReturn) continue;
    if (asset && BACK_HOME.has(asset.status) && !failedReturn) continue;
    if (failedReturn && leftover <= 0) continue;
    const key = `eq-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const where = whereLabel(order);
    pushRow(rows, {
      id: key,
      kind: "equipamento",
      name: asset?.name || item.name,
      code: asset?.code || item.code,
      where,
      organization: order.organization,
      recipient: order.recipient_name,
      address: locationSummary(order),
      orderNumber: order.order_number,
      orderId: order.id,
      since: formatWhen(order.needed_date),
      volta: failedReturn ? "Não voltou" : "Não",
      qty: failedReturn ? leftover : item.quantity,
    });
  }

  for (const checkout of checkouts) {
    if (checkout.status !== "out") continue;
    const order = checkout.order_id ? byId.get(checkout.order_id) : undefined;
    if (checkout.order_id && !order) continue;
    const item = order
      ? orderItems.find((row) => checkoutMatchesItem(checkout, row, uniforms))
      : undefined;
    const close = order ? parseCloseOut(order.return_description) : null;
    const closeLine = item && close ? close.lines.find((line) => line.item_id === item.id) : undefined;
    const leftover = closeLine ? unreturnedQty(closeLine) : checkout.quantity;
    const onStreet = checkoutStaysOut(checkout) || Boolean(close && leftover > 0);
    if (!onStreet) continue;
    const uniform = uniforms.find((row) => row.id === checkout.uniform_id);
    const where = order ? whereLabel(order) : "—";
    const orderNumber = order?.order_number || "—";
    pushRow(rows, {
      id: `uni-${checkout.id}`,
      kind: "uniforme",
      name: `${uniform?.name || "Uniforme"} · ${checkout.size}`,
      code: `UNI-${checkout.size}`,
      where,
      organization: order?.organization || "—",
      recipient: order?.recipient_name || "—",
      address: order ? locationSummary(order) : "—",
      orderNumber,
      orderId: order?.id || "",
      since: formatWhen(checkout.checked_out_at),
      volta: item?.is_returnable ? "Não voltou" : "Não",
      qty: leftover || checkout.quantity,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
