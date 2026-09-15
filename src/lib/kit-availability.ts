import type {
  Asset,
  AssetStatus,
  EquipmentReservation,
  Order,
  Uniform,
  UniformCheckout,
  UniformSize,
} from "@/types/database";
import { statusLabel } from "@/lib/operational-assets";
import { availableForSize, totalForSize } from "@/lib/uniforms";

const BLOCKED_STATUSES = new Set<AssetStatus>([
  "damaged",
  "lost",
  "written_off",
  "maintenance",
  "incomplete",
  "cleaning",
  "returned_pending",
  "inspection",
]);

export const UNIFORM_STAY_OUT_NOTE = "fica";

export function checkoutStaysOut(checkout: Pick<UniformCheckout, "notes">) {
  const notes = checkout.notes || "";
  return notes === UNIFORM_STAY_OUT_NOTE || notes.startsWith(`${UNIFORM_STAY_OUT_NOTE}|`);
}

export function windowsOverlap(aFrom: string, aUntil: string, bFrom: string, bUntil: string) {
  return Boolean(aFrom && aUntil && bFrom && bUntil && aFrom < bUntil && aUntil > bFrom);
}

export function orderReserveWindow(
  order: Pick<
    Order,
    "needed_date" | "needed_time" | "event_start" | "event_end" | "pickup_at" | "reserve_from" | "reserve_until"
  >
) {
  const from = order.reserve_from || order.event_start || `${order.needed_date}T${order.needed_time || "00:00"}`;
  const until = order.reserve_until || order.pickup_at || order.event_end || `${order.needed_date}T23:59`;
  return { from, until };
}

export function formatReserveUntil(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) return `${match[3]}/${match[2]} ${match[4]}:${match[5]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export interface KitBlock {
  reason: string;
}

export function equipmentBlock(
  asset: Asset,
  reservations: EquipmentReservation[],
  from: string,
  until: string
): KitBlock | null {
  if (asset.status === "in_use") {
    return { reason: "Na rua" };
  }
  if (BLOCKED_STATUSES.has(asset.status)) {
    return { reason: statusLabel(asset.status) };
  }
  const clash = reservations.find(
    (row) =>
      row.asset_id === asset.id &&
      row.status === "active" &&
      windowsOverlap(from, until, row.reserved_from, row.reserved_until)
  );
  if (clash) {
    return {
      reason: `${clash.holder_name} · volta ${formatReserveUntil(clash.reserved_until)}`,
    };
  }
  if (asset.status !== "available" && asset.status !== "reserved" && asset.status !== "with_product") {
    return { reason: statusLabel(asset.status) };
  }
  return null;
}

function checkoutOccupiesWindow(
  checkout: UniformCheckout,
  orders: Order[],
  from: string,
  until: string
) {
  if (checkout.status !== "out") return false;
  if (checkoutStaysOut(checkout)) return true;
  if (!checkout.order_id) return true;
  const order = orders.find((row) => row.id === checkout.order_id);
  if (!order) return true;
  const window = orderReserveWindow(order);
  return windowsOverlap(from, until, window.from, window.until);
}

export function outForSizeOnWindow(
  uniformId: string,
  size: UniformSize,
  checkouts: UniformCheckout[],
  orders: Order[],
  from: string,
  until: string
) {
  return checkouts
    .filter((row) => row.uniform_id === uniformId && row.size === size && checkoutOccupiesWindow(row, orders, from, until))
    .reduce((sum, row) => sum + row.quantity, 0);
}

export function availableForSizeOnWindow(
  uniform: Uniform,
  size: UniformSize,
  checkouts: UniformCheckout[],
  orders: Order[],
  from: string,
  until: string
) {
  if (from && until) {
    return Math.max(0, totalForSize(uniform, size) - outForSizeOnWindow(uniform.id, size, checkouts, orders, from, until));
  }
  return availableForSize(uniform, size, checkouts);
}

export function occupyingUniformOrder(
  uniformId: string,
  checkouts: UniformCheckout[],
  orders: Order[],
  from: string,
  until: string
) {
  const hit = checkouts.find((row) => row.uniform_id === uniformId && checkoutOccupiesWindow(row, orders, from, until));
  if (!hit) return null;
  if (!hit.order_id) return "Já em uso";
  const order = orders.find((row) => row.id === hit.order_id);
  if (!order) return "Já em uso";
  if (checkoutStaysOut(hit)) return `${order.order_number} · na rua`;
  const window = orderReserveWindow(order);
  return `${order.order_number} · volta ${formatReserveUntil(window.until)}`;
}

export function uniformFullyBlocked(
  uniform: Uniform,
  checkouts: UniformCheckout[],
  orders: Order[],
  from: string,
  until: string
) {
  const sizes: UniformSize[] = ["P", "M", "G", "GG"];
  return sizes.every((size) => availableForSizeOnWindow(uniform, size, checkouts, orders, from, until) <= 0);
}
