import type { AssetStatus, Order, OrderItem, SeparationJob } from "@/types/database";

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalDateTime(value: string) {
  const normalized = value.includes("T") ? value.slice(0, 16) : `${value}T00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function orderDeliveryAt(order: Order) {
  return (
    parseLocalDateTime(`${order.needed_date}T${order.needed_time || "10:00"}`) ||
    parseLocalDateTime(`${order.needed_date}T10:00`)
  );
}

export function orderStart(order: Order) {
  return parseLocalDateTime(order.event_start || "") || orderDeliveryAt(order);
}

export function orderEventEnd(order: Order) {
  return parseLocalDateTime(order.event_end || "");
}

export function orderPickupAt(order: Order) {
  return parseLocalDateTime(order.pickup_at || "");
}

export function orderEnd(order: Order) {
  return orderPickupAt(order) || orderEventEnd(order) || orderStart(order);
}

export type CalendarBlockKind = "delivery" | "event" | "pickup";

export interface CalendarBlock {
  id: string;
  order: Order;
  job: SeparationJob;
  start: Date;
  end: Date;
  kind: CalendarBlockKind;
}

export interface SpanningBar {
  event: CalendarBlock;
  row: number;
  col: number;
  span: number;
  startsBefore: boolean;
  endsAfter: boolean;
}

const POINT_BLOCK_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pointBlock(
  order: Order,
  job: SeparationJob,
  kind: Exclude<CalendarBlockKind, "event">,
  start: Date | null
): CalendarBlock | null {
  if (!start) return null;
  return {
    id: `${order.id}-${kind}`,
    order,
    job,
    start,
    end: new Date(start.getTime() + POINT_BLOCK_MS),
    kind,
  };
}

function eventSpanBlock(order: Order, job: SeparationJob): CalendarBlock | null {
  const start = parseLocalDateTime(order.event_start || "");
  if (!start) return null;
  const parsedEnd = parseLocalDateTime(order.event_end || "");
  const end = parsedEnd && parsedEnd.getTime() > start.getTime() ? parsedEnd : new Date(start.getTime() + POINT_BLOCK_MS);
  return {
    id: `${order.id}-event`,
    order,
    job,
    start,
    end,
    kind: "event",
  };
}

export function buildCalendarBlocks(order: Order, job: SeparationJob): CalendarBlock[] {
  return [
    pointBlock(order, job, "delivery", orderDeliveryAt(order)),
    eventSpanBlock(order, job),
    pointBlock(order, job, "pickup", orderPickupAt(order)),
  ].filter((row): row is CalendarBlock => Boolean(row));
}

export const CALENDAR_KIND_LABEL: Record<CalendarBlockKind, string> = {
  delivery: "Entrega",
  event: "Evento",
  pickup: "Retirada",
};

export function isMultiDay(start: Date, end: Date) {
  const lastMs = Math.max(start.getTime(), end.getTime() - 1);
  return toDateKey(start) !== toDateKey(new Date(lastMs));
}

export function dayIndexInRange(day: Date, rangeStart: Date) {
  return Math.round((startOfDay(day).getTime() - startOfDay(rangeStart).getTime()) / DAY_MS);
}

export function daysUntil(date: Date, from = new Date()) {
  return dayIndexInRange(date, from);
}

export function layoutSpanningBars(events: CalendarBlock[], rangeStart: Date, dayCount: number): SpanningBar[] {
  const candidates = events
    .filter((event) => event.kind === "event" && isMultiDay(event.start, event.end))
    .map((event) => {
      const startIdx = dayIndexInRange(event.start, rangeStart);
      const endIdx = dayIndexInRange(new Date(Math.max(event.start.getTime(), event.end.getTime() - 1)), rangeStart);
      const col = Math.max(0, startIdx);
      const last = Math.min(dayCount - 1, endIdx);
      return {
        event,
        col,
        span: last - col + 1,
        last,
        startsBefore: startIdx < 0,
        endsAfter: endIdx > dayCount - 1,
      };
    })
    .filter((row) => row.span > 0 && row.last >= 0 && row.col < dayCount)
    .sort((a, b) => a.col - b.col || b.span - a.span);

  const occupied: { start: number; end: number }[][] = [];
  const result: SpanningBar[] = [];
  for (const item of candidates) {
    const end = item.col + item.span;
    let row = 0;
    for (; row < occupied.length; row++) {
      if (!occupied[row].some((seg) => item.col < seg.end && end > seg.start)) break;
    }
    if (row === occupied.length) occupied.push([]);
    occupied[row].push({ start: item.col, end });
    result.push({
      event: item.event,
      row,
      col: item.col,
      span: item.span,
      startsBefore: item.startsBefore,
      endsAfter: item.endsAfter,
    });
  }
  return result;
}

export function spanningBarRows(bars: SpanningBar[]) {
  return bars.reduce((max, bar) => Math.max(max, bar.row + 1), 0);
}

export function eventTitle(order: Order) {
  return order.event_name?.trim() || order.organization || order.order_number;
}

export interface EventColor {
  swatch: string;
  span: string;
  spanClosed: string;
  header: string;
  headerClosed: string;
}

export const EVENT_COLORS: EventColor[] = [
  {
    swatch: "bg-orange-500",
    span: "bg-orange-500/30 text-orange-950 border-orange-400/70 dark:bg-orange-500/25 dark:text-orange-50 dark:border-orange-400/60",
    spanClosed: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200",
    header: "bg-orange-500 text-white",
    headerClosed: "bg-orange-200 text-orange-900",
  },
  {
    swatch: "bg-pink-500",
    span: "bg-pink-500/30 text-pink-950 border-pink-400/70 dark:bg-pink-500/25 dark:text-pink-50 dark:border-pink-400/60",
    spanClosed: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950 dark:text-pink-200",
    header: "bg-pink-500 text-white",
    headerClosed: "bg-pink-200 text-pink-900",
  },
  {
    swatch: "bg-cyan-500",
    span: "bg-cyan-500/30 text-cyan-950 border-cyan-400/70 dark:bg-cyan-500/25 dark:text-cyan-50 dark:border-cyan-400/60",
    spanClosed: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-200",
    header: "bg-cyan-500 text-white",
    headerClosed: "bg-cyan-200 text-cyan-900",
  },
  {
    swatch: "bg-blue-600",
    span: "bg-blue-500/30 text-blue-950 border-blue-400/70 dark:bg-blue-500/25 dark:text-blue-50 dark:border-blue-400/60",
    spanClosed: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200",
    header: "bg-blue-600 text-white",
    headerClosed: "bg-blue-200 text-blue-900",
  },
  {
    swatch: "bg-amber-500",
    span: "bg-amber-500/30 text-amber-950 border-amber-400/70 dark:bg-amber-500/25 dark:text-amber-50 dark:border-amber-400/60",
    spanClosed: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200",
    header: "bg-amber-500 text-white",
    headerClosed: "bg-amber-200 text-amber-900",
  },
  {
    swatch: "bg-emerald-600",
    span: "bg-emerald-500/30 text-emerald-950 border-emerald-400/70 dark:bg-emerald-500/25 dark:text-emerald-50 dark:border-emerald-400/60",
    spanClosed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200",
    header: "bg-emerald-600 text-white",
    headerClosed: "bg-emerald-200 text-emerald-900",
  },
  {
    swatch: "bg-violet-600",
    span: "bg-violet-500/30 text-violet-950 border-violet-400/70 dark:bg-violet-500/25 dark:text-violet-50 dark:border-violet-400/60",
    spanClosed: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200",
    header: "bg-violet-600 text-white",
    headerClosed: "bg-violet-200 text-violet-900",
  },
  {
    swatch: "bg-rose-500",
    span: "bg-rose-500/30 text-rose-950 border-rose-400/70 dark:bg-rose-500/25 dark:text-rose-50 dark:border-rose-400/60",
    spanClosed: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200",
    header: "bg-rose-500 text-white",
    headerClosed: "bg-rose-200 text-rose-900",
  },
  {
    swatch: "bg-teal-500",
    span: "bg-teal-500/30 text-teal-950 border-teal-400/70 dark:bg-teal-500/25 dark:text-teal-50 dark:border-teal-400/60",
    spanClosed: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200",
    header: "bg-teal-500 text-white",
    headerClosed: "bg-teal-200 text-teal-900",
  },
  {
    swatch: "bg-indigo-500",
    span: "bg-indigo-500/30 text-indigo-950 border-indigo-400/70 dark:bg-indigo-500/25 dark:text-indigo-50 dark:border-indigo-400/60",
    spanClosed: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200",
    header: "bg-indigo-600 text-white",
    headerClosed: "bg-indigo-200 text-indigo-900",
  },
];

export function eventColor(orderId: string) {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0;
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

export function needsPickup(order: Pick<Order, "order_type">, items: OrderItem[]) {
  return order.order_type === "evento" || items.some((item) => item.is_returnable);
}

/** YOLO goes to the client: Entrega YOLO / Transportadora outbound, or Coleta YOLO on return. */
export function isYoloTrip(method?: string | null) {
  return method === "entrega_yolo" || method === "transportadora";
}

export function isCdVisit(method?: string | null) {
  return method === "retirada_yolo";
}

export function resolvedPickupFulfillment(order: Pick<Order, "pickup_fulfillment" | "order_type">, items: OrderItem[] = []) {
  if (order.pickup_fulfillment) return order.pickup_fulfillment;
  return needsPickup(order, items) ? "entrega_yolo" : null;
}

export function needsDeliveryDriver(order: Pick<Order, "fulfillment">) {
  return isYoloTrip(order.fulfillment);
}

export function needsPickupDriver(order: Pick<Order, "pickup_fulfillment" | "order_type">, items: OrderItem[]) {
  if (!needsPickup(order, items)) return false;
  return isYoloTrip(resolvedPickupFulfillment(order, items));
}

export function needsOrderAddress(
  fulfillment: string,
  pickupFulfillment?: string | null,
  hasReturn = false
) {
  return isYoloTrip(fulfillment) || (hasReturn && isYoloTrip(pickupFulfillment));
}

export function tripSummary(order: Order, items: OrderItem[] = []) {
  const outbound = FULFILL_LABEL[order.fulfillment] || order.fulfillment;
  const pickupMethod = resolvedPickupFulfillment(order, items);
  const inbound = needsPickup(order, items) && pickupMethod ? PICKUP_FULFILL_LABEL[pickupMethod] || pickupMethod : null;
  return { outbound, inbound };
}

export function locationSummary(order: Order, items: OrderItem[] = []) {
  const hasReturn = needsPickup(order, items);
  const pickupMethod = resolvedPickupFulfillment(order, items);
  if (needsOrderAddress(order.fulfillment, pickupMethod, hasReturn) && order.address?.trim()) {
    return order.address.trim();
  }
  const parts: string[] = [];
  if (order.fulfillment === "uso_interno") parts.push("Uso interno");
  else if (isCdVisit(order.fulfillment)) parts.push("Retirada no CD");
  if (hasReturn && isCdVisit(pickupMethod)) parts.push("Devolução no CD");
  return parts.join(" · ") || "No CD";
}

export function missingTripAssignment(order: Order, job: SeparationJob, items: OrderItem[]) {
  const missing: string[] = [];
  if (needsDeliveryDriver(order) && !job.delivery_driver) missing.push("motorista da entrega");
  if (needsPickupDriver(order, items) && !job.pickup_driver) missing.push("motorista da retirada");
  return missing;
}

export function isQueued(job: SeparationJob) {
  return job.stage === "a_separar";
}

export function isScheduled(job: SeparationJob) {
  return job.stage === "em_separacao" || job.stage === "na_rua";
}

export function isInProgress(job: SeparationJob) {
  return job.stage === "na_rua";
}

export function isProgrammed(job: SeparationJob) {
  return job.stage === "em_separacao";
}

export function isClosed(job: SeparationJob) {
  return job.stage === "retorno";
}

export function isClosedOrder(order: Order, job?: SeparationJob | null) {
  if (order.status === "retorno" || order.status === "completed") return true;
  return Boolean(job && isClosed(job));
}

export function needsCloseOut(order: Order, job: SeparationJob) {
  if (!isScheduled(job)) return false;
  const end = orderEnd(order);
  if (!end) return false;
  return end.getTime() <= Date.now();
}

export type ReturnDest = "stock" | "consumed" | "inspection" | "missing" | "damaged";

export type ReturnUnitCondition = "ok" | "cleaning" | "inspection" | "damaged" | "lost";

export interface ReturnLine {
  item_id: string;
  sent: number;
  returned: number;
  dest: ReturnDest;
}

export interface ReturnUnit {
  item_id: string;
  unit_index: number;
  condition: ReturnUnitCondition;
  location_id: string | null;
}

export interface CloseOutRecord {
  closed_at: string;
  notes?: string;
  lines: ReturnLine[];
  units?: ReturnUnit[];
}

export const RETURN_UNIT_CONDITIONS: { value: ReturnUnitCondition; label: string; hint: string }[] = [
  { value: "ok", label: "OK", hint: "Voltou em ordem" },
  { value: "cleaning", label: "Limpar", hint: "Voltou sujo" },
  { value: "inspection", label: "Inspeção", hint: "Conferir depois" },
  { value: "damaged", label: "Danificado", hint: "Quebrou ou rasgou" },
  { value: "lost", label: "Não voltou", hint: "Ficou na rua" },
];

export function expandReturnUnits(items: OrderItem[]) {
  return items
    .filter((item) => item.is_returnable)
    .flatMap((item) => {
      const sent = Math.max(1, Math.round(item.quantity));
      return Array.from({ length: sent }, (_, unitIndex) => ({
        item,
        unitIndex,
        label: sent > 1 ? `${item.name} · ${unitIndex + 1}/${sent}` : item.name,
        code: item.code,
        sent,
      }));
    });
}

export function returnUnitAssetStatus(condition: ReturnUnitCondition): AssetStatus {
  if (condition === "ok") return "available";
  if (condition === "cleaning") return "cleaning";
  if (condition === "inspection") return "inspection";
  if (condition === "damaged") return "damaged";
  return "lost";
}

export function closeOutLinesFromUnits(items: OrderItem[], units: ReturnUnit[]): ReturnLine[] {
  return items
    .filter((item) => item.is_returnable)
    .map((item) => {
      const rows = units.filter((unit) => unit.item_id === item.id);
      const sent = Math.max(rows.length, Math.round(item.quantity) || 1);
      const returned = rows.filter((unit) => unit.condition !== "lost").length;
      const dest: ReturnDest = rows.some((unit) => unit.condition === "lost")
        ? "missing"
        : rows.some((unit) => unit.condition === "damaged")
          ? "damaged"
          : rows.some((unit) => unit.condition === "inspection")
            ? "inspection"
            : "stock";
      return { item_id: item.id, sent, returned, dest };
    });
}

export function parseCloseOut(value: string | null): CloseOutRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CloseOutRecord;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatEventDay(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatEventDayShort(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatEventWeekday(value: Date | null) {
  if (!value) return "";
  return value.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

export function formatEventTime(value: Date | null) {
  if (!value) return "";
  return value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatSheetDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function unreturnedQty(line: Pick<ReturnLine, "sent" | "returned">) {
  return Math.max(0, line.sent - line.returned);
}

export function toDateTimeLocal(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const TYPE_LABEL: Record<string, string> = {
  venda: "Venda",
  evento: "Evento",
  amostra: "Amostra",
  solicitacao_interna: "Interno",
};

export const FULFILL_LABEL: Record<string, string> = {
  entrega_yolo: "Entrega YOLO",
  retirada_yolo: "Retirada no CD",
  uso_interno: "Uso interno",
  transportadora: "Transportadora",
};

export const PICKUP_FULFILL_LABEL: Record<string, string> = {
  entrega_yolo: "Coleta YOLO",
  retirada_yolo: "Devolução no CD",
  uso_interno: "Não se aplica",
  transportadora: "Transportadora",
};
