import type { Location, LocationKind } from "@/types/database";

export type LocationPurpose = Location["purpose"];

export const LOCATION_KIND_OPTIONS: { value: LocationKind; label: string }[] = [
  { value: "sku", label: "SKUs" },
  { value: "material", label: "Materiais" },
  { value: "embalagem", label: "Embalagens" },
  { value: "ativo", label: "Ativos" },
  { value: "uniforme", label: "Uniformes" },
];

const KIND_SET = new Set<LocationKind>(LOCATION_KIND_OPTIONS.map((item) => item.value));

export function locationPurpose(location: Pick<Location, "purpose" | "system_key">): LocationPurpose {
  if (location.purpose === "asset" || location.purpose === "product") return location.purpose;
  if (location.system_key === "asset_dirty" || location.system_key === "asset_clean" || location.system_key === "asset_factory") {
    return "asset";
  }
  return "product";
}

export function isSalaTradeLocation(location: Pick<Location, "name">) {
  return /sala\s*trade/i.test((location.name || "").trim());
}

export function isRecebimentoLocation(location: Pick<Location, "name" | "type">) {
  if (location.type === "receiving") return true;
  return /^recebimento$/i.test((location.name || "").trim());
}

export function isFabricaLocation(location: Pick<Location, "name" | "system_key">) {
  if (location.system_key === "asset_factory") return true;
  return /^(f[áa]brica)$/i.test((location.name || "").trim());
}

/** Kanban rooms: Recebimento first, Fábrica last. */
export function pinKanbanLocations(locations: Location[]) {
  const receiving: Location[] = [];
  const factory: Location[] = [];
  const middle: Location[] = [];
  for (const location of locations) {
    if (isFabricaLocation(location)) factory.push(location);
    else if (isRecebimentoLocation(location)) receiving.push(location);
    else middle.push(location);
  }
  return [...receiving, ...middle, ...factory];
}

export function defaultStoredKinds(
  location: Pick<Location, "purpose" | "system_key" | "name">
): LocationKind[] {
  if (location.system_key === "assembled") return ["sku"];
  if (location.system_key === "asset_factory") return ["embalagem"];
  if (isSalaTradeLocation(location)) return ["ativo", "uniforme"];
  if (locationPurpose(location) === "asset") return ["ativo", "embalagem", "uniforme"];
  return ["sku", "material"];
}

export function normalizeStoredKinds(
  location: Pick<Location, "purpose" | "system_key" | "name" | "stored_kinds">
): LocationKind[] {
  const raw = Array.isArray(location.stored_kinds) ? location.stored_kinds : [];
  const kinds = [...new Set(raw.filter((kind): kind is LocationKind => KIND_SET.has(kind as LocationKind)))];
  return kinds.length ? kinds : defaultStoredKinds(location);
}

export function locationStoresKind(location: Location, kind: LocationKind) {
  return normalizeStoredKinds(location).includes(kind);
}

export function locationsForKind(locations: Location[], kind: LocationKind, activeOnly = true) {
  return pinKanbanLocations(
    locations
      .filter((location) => locationStoresKind(location, kind) && (!activeOnly || location.is_active))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"))
  );
}

export function isProductLocation(location: Location) {
  return locationPurpose(location) === "product";
}

export function isAssetYardLocation(location: Location) {
  return locationPurpose(location) === "asset";
}

export function productStockLocations(locations: Location[], activeOnly = false) {
  return locations
    .filter((location) => isProductLocation(location) && (!activeOnly || location.is_active))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"));
}

export function assetYardLocations(locations: Location[], activeOnly = false) {
  return locations
    .filter((location) => isAssetYardLocation(location) && (!activeOnly || location.is_active))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"));
}

function orderYards(yards: Location[]) {
  const dirty = yards.find((location) => location.system_key === "asset_dirty");
  const clean = yards.find((location) => location.system_key === "asset_clean");
  const rest = yards.filter(
    (location) => location.system_key !== "asset_dirty" && location.system_key !== "asset_clean"
  );
  return pinKanbanLocations([...(dirty ? [dirty] : []), ...(clean ? [clean] : []), ...rest]);
}

export function orderedAssetYardLocations(locations: Location[]) {
  return orderYards(assetYardLocations(locations, true));
}

export function orderedEquipmentYardLocations(locations: Location[]) {
  return orderYards(locationsForKind(locations, "ativo"));
}

export function orderedBoxYardLocations(locations: Location[]) {
  return orderYards(locationsForKind(locations, "embalagem"));
}

export function orderedUniformYardLocations(locations: Location[]) {
  const yards = locationsForKind(locations, "uniforme");
  const dirty = yards.find((location) => location.system_key === "asset_dirty");
  const rest = yards.filter((location) => location.system_key !== "asset_dirty");
  return pinKanbanLocations([...(dirty ? [dirty] : []), ...rest]);
}

export function returnAssetYardLocations(locations: Location[]) {
  return orderedAssetYardLocations(locations).filter((location) => location.system_key !== "asset_factory");
}

export function locationKindLabels(location: Location) {
  const kinds = normalizeStoredKinds(location);
  return LOCATION_KIND_OPTIONS.filter((item) => kinds.includes(item.value)).map((item) => item.label);
}
