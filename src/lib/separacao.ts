import type { Order, OrderItem, SeparationJob } from "@/types/database";

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

export type CalendarBlockKind = "delivery" | "event_start" | "event_end" | "pickup";

export interface CalendarBlock {
  id: string;
  order: Order;
  job: SeparationJob;
  start: Date;
  end: Date;
  kind: CalendarBlockKind;
}

const POINT_BLOCK_MS = 60 * 60 * 1000;

function pointBlock(
  order: Order,
  job: SeparationJob,
  kind: CalendarBlockKind,
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

export function buildCalendarBlocks(order: Order, job: SeparationJob): CalendarBlock[] {
  return [
    pointBlock(order, job, "delivery", orderDeliveryAt(order)),
    pointBlock(order, job, "event_start", parseLocalDateTime(order.event_start || "")),
    pointBlock(order, job, "event_end", parseLocalDateTime(order.event_end || "")),
    pointBlock(order, job, "pickup", orderPickupAt(order)),
  ].filter((row): row is CalendarBlock => Boolean(row));
}

export const CALENDAR_KIND_LABEL: Record<CalendarBlockKind, string> = {
  delivery: "Entrega",
  event_start: "Início",
  event_end: "Fim",
  pickup: "Retirada",
};

export function eventTitle(order: Order) {
  return order.event_name?.trim() || order.organization || order.order_number;
}

export function needsPickup(order: Order, items: OrderItem[]) {
  return order.order_type === "evento" || items.some((item) => item.is_returnable);
}

export function isQueued(job: SeparationJob) {
  return job.stage === "a_separar";
}

export function isScheduled(job: SeparationJob) {
  return job.stage === "em_separacao" || job.stage === "na_rua";
}

export function isClosed(job: SeparationJob) {
  return job.stage === "retorno";
}

export function needsCloseOut(order: Order, job: SeparationJob) {
  if (!isScheduled(job)) return false;
  const end = orderEnd(order);
  if (!end) return false;
  return end.getTime() <= Date.now();
}

export type ReturnDest = "stock" | "consumed" | "inspection" | "missing" | "damaged";

export interface ReturnLine {
  item_id: string;
  sent: number;
  returned: number;
  dest: ReturnDest;
}

export interface CloseOutRecord {
  closed_at: string;
  notes?: string;
  lines: ReturnLine[];
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
  solicitacao_interna: "Interna",
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
