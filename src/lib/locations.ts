import type { Location } from "@/types/database";

export type LocationPurpose = Location["purpose"];

export function locationPurpose(location: Pick<Location, "purpose" | "system_key">): LocationPurpose {
  if (location.purpose === "asset" || location.purpose === "product") return location.purpose;
  if (location.system_key === "asset_dirty" || location.system_key === "asset_clean" || location.system_key === "asset_factory") {
    return "asset";
  }
  return "product";
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

export function isSalaTradeLocation(location: Pick<Location, "name">) {
  return /sala\s*trade/i.test((location.name || "").trim());
}

export function orderedAssetYardLocations(locations: Location[]) {
  const yards = assetYardLocations(locations, true);
  const dirty = yards.find((location) => location.system_key === "asset_dirty");
  const clean = yards.find((location) => location.system_key === "asset_clean");
  const factory = yards.find((location) => location.system_key === "asset_factory");
  const rest = yards.filter(
    (location) =>
      location.system_key !== "asset_dirty" &&
      location.system_key !== "asset_clean" &&
      location.system_key !== "asset_factory"
  );
  return [...(dirty ? [dirty] : []), ...(clean ? [clean] : []), ...(factory ? [factory] : []), ...rest];
}

/** Pátio de embalagens: sem Sala Trade; Fábrica por último. */
export function orderedBoxYardLocations(locations: Location[]) {
  const yards = assetYardLocations(locations, true).filter((location) => !isSalaTradeLocation(location));
  const dirty = yards.find((location) => location.system_key === "asset_dirty");
  const clean = yards.find((location) => location.system_key === "asset_clean");
  const factory = yards.find((location) => location.system_key === "asset_factory");
  const rest = yards.filter(
    (location) =>
      location.system_key !== "asset_dirty" &&
      location.system_key !== "asset_clean" &&
      location.system_key !== "asset_factory"
  );
  return [...(dirty ? [dirty] : []), ...(clean ? [clean] : []), ...rest, ...(factory ? [factory] : [])];
}

export function orderedUniformYardLocations(locations: Location[]) {
  const dirty = locations.find((location) => location.is_active && location.system_key === "asset_dirty");
  const trade = locations.find((location) => location.is_active && isSalaTradeLocation(location));
  return [...(dirty ? [dirty] : []), ...(trade ? [trade] : [])];
}

export function returnAssetYardLocations(locations: Location[]) {
  return orderedAssetYardLocations(locations).filter((location) => location.system_key !== "asset_factory");
}
