import type { Asset, AssetType, Location, Movement, Product, Stock } from "@/types/database";

export const BOX_TYPES = ["caixa_preta", "caixa_media", "caixa_grande"] as const;
export type BoxType = (typeof BOX_TYPES)[number];

export const BOX_TYPE_LABEL: Record<BoxType, string> = {
  caixa_preta: "Caixa preta",
  caixa_media: "Caixa média",
  caixa_grande: "Caixa grande",
};

export const FACTORY_COLUMN = "__factory__";
export const TRANSIT_COLUMN = "__transit__";
export const UNLOCATED_COLUMN = "__unlocated__";

export function isBoxAsset(asset: Asset): asset is Asset & { type: BoxType } {
  return asset.type === "caixa_preta" || asset.type === "caixa_media" || asset.type === "caixa_grande";
}

export function boxColumnId(asset: Asset) {
  if (asset.status === "at_factory") return FACTORY_COLUMN;
  if (asset.status === "in_transit") return TRANSIT_COLUMN;
  return asset.location_id || UNLOCATED_COLUMN;
}

export function columnLabel(columnId: string, locations: Location[]) {
  if (columnId === FACTORY_COLUMN) return "Na fábrica";
  if (columnId === TRANSIT_COLUMN) return "Em trânsito";
  if (columnId === UNLOCATED_COLUMN) return "Sem local";
  return locations.find((location) => location.id === columnId)?.name || "—";
}

export function daysAging(iso?: string | null) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export function lastActivityAt(asset: Asset, movements: Movement[]) {
  const dates = movements
    .filter((movement) => movement.asset_id === asset.id)
    .map((movement) => movement.created_at);
  if (asset.last_moved_at) dates.push(asset.last_moved_at);
  dates.push(asset.updated_at, asset.created_at);
  return dates.filter(Boolean).sort().at(-1) || asset.created_at;
}

export function boxContents(asset: Asset, stock: Stock[], products: Product[]) {
  const rows = stock.filter(
    (item) => item.asset_id === asset.id && item.quantity > 0 && item.status !== "depleted"
  );
  const quantity = rows.reduce((sum, item) => sum + item.quantity, 0);
  const product = rows[0] ? products.find((item) => item.id === rows[0].product_id) : undefined;
  const grades = [...new Set(rows.map((item) => item.grade).filter(Boolean))];
  return {
    quantity,
    full: quantity > 0,
    sku: product?.code || null,
    name: product?.flavor || product?.name || null,
    grades,
    lots: [...new Set(rows.map((item) => item.lot).filter(Boolean))] as string[],
    state: rows.some((item) => item.physical_state === "frozen")
      ? rows.some((item) => item.physical_state === "liquid")
        ? "Misto"
        : "Congelado"
      : quantity > 0
        ? "Líquido"
        : null,
  };
}

const FACTORY_BLOCKED_STATUS = new Set<Asset["status"]>([
  "at_factory",
  "in_transit",
  "with_product",
  "in_use",
  "reserved",
  "damaged",
  "lost",
  "written_off",
]);

export function canSendToFactory(asset: Asset, stock: Stock[]) {
  if (!asset.is_active) return false;
  if (asset.type !== "caixa_preta" && asset.type !== "caixa_grande") return false;
  if (FACTORY_BLOCKED_STATUS.has(asset.status)) return false;
  return !stock.some((item) => item.asset_id === asset.id && item.quantity > 0 && item.status !== "depleted");
}

export function isBoxType(type: AssetType): type is BoxType {
  return BOX_TYPES.includes(type as BoxType);
}
