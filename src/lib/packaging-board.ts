import { factoryLocation, isBoxAsset as assetIsBox, resolvedAssetLocationId } from "@/lib/operational-assets";
import type { Asset, AssetType, Location, Movement, Product, Stock } from "@/types/database";

export const BOX_TYPES = ["caixa_preta", "caixa_media", "caixa_grande"] as const;
export type BoxType = (typeof BOX_TYPES)[number];

export const BOX_TYPE_LABEL: Record<BoxType, string> = {
  caixa_preta: "Caixa preta",
  caixa_media: "Caixa média",
  caixa_grande: "Caixa grande",
};

export function boxTypeLabel(type: string, catalog?: { value: string; label: string }[]) {
  const named = catalog?.find((row) => row.value === type)?.label?.trim();
  if (named) return named;
  if (type === "caixa_preta" || type === "caixa_media" || type === "caixa_grande") {
    return BOX_TYPE_LABEL[type];
  }
  return type.replace(/_/g, " ");
}

export const FACTORY_COLUMN = "__factory__";
export const TRANSIT_COLUMN = "__transit__";

export function isBoxAsset(asset: Asset) {
  return assetIsBox(asset);
}

export function boxColumnId(asset: Asset, locations: Location[] = []) {
  const factory = factoryLocation(locations);
  if (asset.status === "at_factory" || (factory && asset.location_id === factory.id)) {
    return factory?.id || FACTORY_COLUMN;
  }
  if (asset.status === "in_transit") return TRANSIT_COLUMN;
  return resolvedAssetLocationId(asset, locations) || asset.location_id || "";
}

export function columnLabel(columnId: string, locations: Location[]) {
  if (columnId === FACTORY_COLUMN) return "Fábrica";
  if (columnId === TRANSIT_COLUMN) return "Em trânsito";
  return locations.find((location) => location.id === columnId)?.name || "—";
}

export function isFactoryColumn(columnId: string, locations: Location[]) {
  const factory = factoryLocation(locations);
  return columnId === FACTORY_COLUMN || (Boolean(factory) && columnId === factory?.id);
}

export function boxLocationKey(asset: Asset, locations: Location[] = []) {
  const column = boxColumnId(asset, locations);
  if (isFactoryColumn(column, locations)) return factoryLocation(locations)?.id || FACTORY_COLUMN;
  return column;
}

export function boxMatchesLocation(asset: Asset, locationId: string | null, locations: Location[]) {
  return boxLocationKey(asset, locations) === (locationId || "");
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
    name: product?.name || product?.code || null,
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

const RETIRE_BLOCKED_STATUS = new Set<Asset["status"]>([
  "with_product",
  "in_use",
  "reserved",
  "in_transit",
  "at_factory",
  "lost",
  "written_off",
  "damaged",
]);

export function canRetireBox(asset: Asset, stock: Stock[]) {
  if (!isBoxAsset(asset) || !asset.is_active) return false;
  if (RETIRE_BLOCKED_STATUS.has(asset.status)) return false;
  return !stock.some((item) => item.asset_id === asset.id && item.quantity > 0 && item.status !== "depleted");
}

export function isBoxType(type: AssetType | string): boolean {
  if (BOX_TYPES.includes(type as BoxType)) return true;
  return Boolean(type) && type !== "cooler" && type !== "freezer" && type !== "carrinho" && type !== "other";
}
