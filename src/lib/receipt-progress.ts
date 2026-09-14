import type { Inspection, MaterialStock, Receipt, ReceiptItem, Stock } from "@/types/database";

function sameLot(a: string | null | undefined, b: string | null | undefined) {
  return (a || null) === (b || null);
}

export function analysisStockForReceipt(receiptId: string, stock: Stock[]) {
  return stock.filter((s) => s.receipt_id === receiptId && s.status === "analysis" && s.quantity > 0);
}

export function analysisMaterialsForReceipt(receiptId: string, materialStock: MaterialStock[]) {
  return materialStock.filter((m) => m.receipt_id === receiptId && m.status === "analysis" && m.quantity > 0);
}

export function sourceStockForLine(receiptId: string, productId: string, lot: string | null, stock: Stock[]) {
  const matches = stock.filter(
    (s) =>
      s.receipt_id === receiptId &&
      s.product_id === productId &&
      sameLot(s.lot, lot) &&
      !s.asset_id
  );
  return (
    matches.find((s) => s.status === "analysis") ||
    matches.find((s) => s.status === "depleted") ||
    matches[0]
  );
}

export function sourceMaterialForLine(
  receiptId: string,
  productId: string,
  lot: string | null,
  materialStock: MaterialStock[]
) {
  const matches = materialStock.filter(
    (m) => m.receipt_id === receiptId && m.product_id === productId && sameLot(m.lot, lot)
  );
  return matches.find((m) => m.status === "analysis") || matches[0];
}

export function declaredQuantity(items: ReceiptItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function isDirectEntryReceipt(receipt: Pick<Receipt, "status" | "close_notes">) {
  return receipt.status === "closed" && Boolean(receipt.close_notes?.startsWith("Entrada direta"));
}

export function remainingQuantity(
  receiptId: string,
  stock: Stock[],
  materialStock: MaterialStock[]
) {
  const pops = analysisStockForReceipt(receiptId, stock).reduce((sum, s) => sum + s.quantity, 0);
  const materials = analysisMaterialsForReceipt(receiptId, materialStock).reduce(
    (sum, m) => sum + m.quantity,
    0
  );
  return pops + materials;
}

export function remainingForLine(
  receiptId: string,
  productId: string,
  lot: string | null,
  stock: Stock[],
  materialStock: MaterialStock[]
) {
  const pop = analysisStockForReceipt(receiptId, stock).find(
    (s) => s.product_id === productId && sameLot(s.lot, lot)
  );
  if (pop) return pop.quantity;
  const material = analysisMaterialsForReceipt(receiptId, materialStock).find(
    (m) => m.product_id === productId && sameLot(m.lot, lot)
  );
  return material?.quantity || 0;
}

export function inspectionsForReceipt(receiptId: string, inspections: Inspection[]) {
  return inspections.filter((insp) => insp.receipt_id === receiptId);
}

export function liveCountedForItem(item: ReceiptItem, inspections: Inspection[]) {
  return inspectionsForReceipt(item.receipt_id, inspections)
    .filter((insp) => insp.product_id === item.product_id && sameLot(insp.lot, item.lot))
    .reduce((sum, insp) => sum + insp.actual_quantity, 0);
}

export function countedForItem(item: ReceiptItem, inspections: Inspection[]) {
  if (item.counted_quantity != null) return item.counted_quantity;
  return liveCountedForItem(item, inspections);
}

export function liveCountedQuantity(receiptId: string, inspections: Inspection[]) {
  return inspectionsForReceipt(receiptId, inspections).reduce(
    (sum, insp) => sum + insp.actual_quantity,
    0
  );
}

export function countedQuantity(receipt: Receipt, items: ReceiptItem[], inspections: Inspection[]) {
  if (receipt.status === "closed" && receipt.counted_quantity != null) {
    return receipt.counted_quantity;
  }
  return liveCountedQuantity(receipt.id, inspections);
}

export function rejectedQuantity(receiptId: string, inspections: Inspection[]) {
  return inspectionsForReceipt(receiptId, inspections).reduce(
    (sum, insp) => sum + insp.rejected_quantity,
    0
  );
}

export function varianceQuantity(counted: number, declared: number) {
  return counted - declared;
}

export function formatVariance(value: number) {
  if (value === 0) return "0";
  const formatted = Math.abs(value).toLocaleString("pt-BR");
  return value > 0 ? `+${formatted}` : `−${formatted}`;
}

export function describeBoxPlan(total: number, capacity: number) {
  if (total <= 0 || capacity <= 0) return "Informe a quantidade para montar as caixas.";
  const full = Math.floor(total / capacity);
  const partial = total % capacity;
  const boxes = full + (partial > 0 ? 1 : 0);
  if (partial === 0) {
    return `${boxes} caixa${boxes === 1 ? "" : "s"} média${boxes === 1 ? "" : "s"} (${full} × ${capacity})`;
  }
  if (full === 0) {
    return `1 caixa de montagem (${partial} un) — único parcial permitido`;
  }
  return `${boxes} caixas (${full} × ${capacity} + caixa de montagem ${partial})`;
}
