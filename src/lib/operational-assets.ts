import type {
  Asset,
  AssetControlMethod,
  AssetStatus,
  AssetType,
  AssetComponent,
  Location,
} from "@/types/database";

export const EMBALAGEM_CATEGORY = "embalagem";

export const BOX_ASSET_TYPES: AssetType[] = [
  "caixa_preta",
  "caixa_media",
  "caixa_grande",
];

export function isBoxAsset(asset: Pick<Asset, "type" | "category">) {
  return BOX_ASSET_TYPES.includes(asset.type) || asset.category === EMBALAGEM_CATEGORY;
}

export function isUniformAsset(asset: Pick<Asset, "category" | "code">) {
  return asset.category === "uniforme" || /^UNI-/i.test(asset.code || "");
}

export function getBoxUnitCapacity(asset: Pick<Asset, "type" | "unit_capacity">) {
  if (asset.unit_capacity && asset.unit_capacity > 0) return asset.unit_capacity;
  if (asset.type === "caixa_media") return 100;
  return 0;
}

export function formatBoxOuterMeasures(
  asset: Pick<Asset, "length_cm" | "width_cm" | "height_cm">
) {
  if (asset.length_cm == null && asset.width_cm == null && asset.height_cm == null) return "";
  const part = (value: number | null | undefined) =>
    value == null ? "—" : String(value).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${part(asset.length_cm)} × ${part(asset.width_cm)} × ${part(asset.height_cm)} cm`;
}

export function isOperationalAsset(asset: Pick<Asset, "type" | "category" | "code">) {
  return !isBoxAsset(asset) && !isUniformAsset(asset);
}

export const ASSET_CATEGORIES: { value: string; label: string }[] = [
  { value: "freezer", label: "Freezer" },
  { value: "carrinho", label: "Carrinho" },
  { value: "cooler", label: "Cooler" },
  { value: "windbanner", label: "Windbanner" },
  { value: "mesa", label: "Mesa" },
  { value: "expositor", label: "Expositor" },
  { value: "material_promocional", label: "Material promocional" },
  { value: "eletronico", label: "Eletrônico" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "maquina", label: "Máquina" },
  { value: "uniforme", label: "Uniforme" },
  { value: "other", label: "Outro" },
];

export const EQUIPMENT_CATEGORIES = ASSET_CATEGORIES.filter((c) => c.value !== "uniforme");

export const CONTROL_METHODS: { value: AssetControlMethod; label: string; hint: string }[] = [
  { value: "individual", label: "Individual", hint: "Um registro por peça identificável" },
  { value: "kit", label: "Kit", hint: "Um ativo principal com componentes" },
  { value: "quantity", label: "Por quantidade", hint: "Itens intercambiáveis contados juntos" },
];

export const OPERATIONAL_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: "available", label: "Disponível" },
  { value: "reserved", label: "Reservado" },
  { value: "in_use", label: "Em uso" },
  { value: "in_transit", label: "Em trânsito" },
  { value: "returned_pending", label: "Retornado — aguardando conferência" },
  { value: "inspection", label: "Inspeção" },
  { value: "cleaning", label: "Aguardando limpeza" },
  { value: "maintenance", label: "Aguardando manutenção" },
  { value: "damaged", label: "Danificado" },
  { value: "incomplete", label: "Incompleto" },
  { value: "lost", label: "Perdido" },
  { value: "written_off", label: "Baixado" },
];

export const VOLTAGE_OPTIONS = [
  { value: "110v", label: "110 V" },
  { value: "220v", label: "220 V" },
  { value: "bivolt", label: "Bivolt" },
  { value: "battery", label: "Bateria" },
  { value: "na", label: "Não se aplica" },
];

export const TECHNICAL_CATEGORIES = new Set([
  "freezer",
  "carrinho",
  "cooler",
  "eletronico",
  "maquina",
]);

const CATEGORY_PREFIX: Record<string, string> = {
  freezer: "FRZ",
  carrinho: "CAR",
  cooler: "CLR",
  windbanner: "WB",
  mesa: "MESA",
  expositor: "EXP",
  material_promocional: "MP",
  eletronico: "EL",
  ferramenta: "FER",
  maquina: "MAQ",
  uniforme: "UNI",
  other: "ATV",
};

export function categoryLabel(value?: string | null) {
  return ASSET_CATEGORIES.find((c) => c.value === value)?.label || value || "—";
}

export function statusLabel(status: string) {
  return OPERATIONAL_STATUSES.find((s) => s.value === status)?.label || status;
}

export const ASSET_DIRTY_SYSTEM_KEY = "asset_dirty";
export const ASSET_CLEAN_SYSTEM_KEY = "asset_clean";
export const ASSET_FACTORY_SYSTEM_KEY = "asset_factory";

export const EXCEPTION_ASSET_STATUSES: AssetStatus[] = [
  "damaged",
  "lost",
  "written_off",
  "incomplete",
];

export function dirtyLocation(locations: Location[]) {
  return locations.find((location) => location.system_key === ASSET_DIRTY_SYSTEM_KEY);
}

export function cleanLocation(locations: Location[]) {
  return locations.find((location) => location.system_key === ASSET_CLEAN_SYSTEM_KEY);
}

export function factoryLocation(locations: Location[]) {
  return locations.find((location) => location.system_key === ASSET_FACTORY_SYSTEM_KEY);
}

const STREET_OR_TRANSIT_STATUSES = new Set<AssetStatus>(["reserved", "in_use", "in_transit"]);

export function needsYardLocation(status: AssetStatus) {
  return !STREET_OR_TRANSIT_STATUSES.has(status);
}

export function defaultYardLocation(status: AssetStatus, locations: Location[]) {
  if (status === "cleaning") return dirtyLocation(locations) || cleanLocation(locations);
  if (status === "at_factory") return factoryLocation(locations) || cleanLocation(locations);
  return cleanLocation(locations) || dirtyLocation(locations) || factoryLocation(locations);
}

export function resolvedAssetLocationId(
  asset: Pick<Asset, "status" | "location_id">,
  locations: Location[]
) {
  if (asset.location_id) return asset.location_id;
  if (!needsYardLocation(asset.status)) return null;
  return defaultYardLocation(asset.status, locations)?.id || null;
}

export function planAssetPlacement(
  asset: Pick<Asset, "status" | "location_id">,
  change: { status?: AssetStatus; locationId?: string | null },
  locations: Location[],
  hasActiveReservation: boolean
): { status: AssetStatus; location_id: string | null; error?: string } {
  const dirty = dirtyLocation(locations);
  const clean = cleanLocation(locations);
  const factory = factoryLocation(locations);
  let status = change.status ?? asset.status;
  let location_id = change.locationId !== undefined ? change.locationId : asset.location_id;
  const keepsException =
    EXCEPTION_ASSET_STATUSES.includes(asset.status) && change.status === undefined;

  if (change.locationId !== undefined && !keepsException) {
    if (dirty && change.locationId === dirty.id) status = "cleaning";
    if (clean && change.locationId === clean.id) status = "available";
    if (factory && change.locationId === factory.id) status = "at_factory";
  }

  if (change.status !== undefined) {
    status = change.status;
    if (status === "cleaning" && dirty) location_id = dirty.id;
    if (status === "available" && clean) location_id = clean.id;
    if (status === "at_factory" && factory) location_id = factory.id;
  }

  if (status === "available" && hasActiveReservation) {
    return {
      status: asset.status,
      location_id: asset.location_id,
      error:
        "Este ativo ainda está reservado em um pedido. Encerre o retorno antes de marcar como disponível.",
    };
  }

  if (!location_id && needsYardLocation(status)) {
    location_id = defaultYardLocation(status, locations)?.id || null;
  }

  return { status, location_id };
}

export function controlLabel(method?: string | null) {
  return CONTROL_METHODS.find((m) => m.value === method)?.label || "Individual";
}

export function categoryToAssetType(category: string): AssetType {
  if (category === "freezer") return "freezer";
  if (category === "carrinho") return "carrinho";
  if (category === "cooler") return "cooler";
  return "other";
}

export function suggestedAssetCode(category: string, existingCodes: string[]) {
  const prefix = CATEGORY_PREFIX[category] || "ATV";
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  existingCodes.forEach((code) => {
    const match = code.match(re);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function suggestedBoxCode(existingCodes: string[]) {
  let max = 0;
  const re = /^CX-(\d+)$/i;
  existingCodes.forEach((code) => {
    const match = code.match(re);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `CX-${String(max + 1).padStart(3, "0")}`;
}

export function parseSequentialCode(code: string) {
  const match = code.trim().match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], start: Number(match[2]), pad: match[2].length };
}

export function sequentialBoxCodes(startCode: string, count: number) {
  const qty = Math.max(1, Math.floor(count));
  const parsed = parseSequentialCode(startCode);
  if (!parsed) {
    return Array.from({ length: qty }, (_, index) =>
      index === 0 ? startCode : `${startCode}-${String(index + 1).padStart(3, "0")}`
    );
  }
  return Array.from({ length: qty }, (_, index) => {
    return `${parsed.prefix}${String(parsed.start + index).padStart(parsed.pad, "0")}`;
  });
}

export function nextSequentialCode(startCode: string, existingCodes: string[]) {
  const parsed = parseSequentialCode(startCode);
  if (!parsed) return suggestedBoxCode(existingCodes);
  const taken = new Set(existingCodes.map((code) => code.toLowerCase()));
  let n = parsed.start;
  let next = startCode;
  while (taken.has(next.toLowerCase())) {
    n += 1;
    next = `${parsed.prefix}${String(n).padStart(parsed.pad, "0")}`;
  }
  return next;
}

export function monthsBetween(from: string, to = new Date()) {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const years = to.getFullYear() - start.getFullYear();
  const months = years * 12 + (to.getMonth() - start.getMonth());
  return Math.max(0, months - (to.getDate() < start.getDate() ? 1 : 0));
}

export function addMonths(dateIso: string, months: number) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function formatAge(acquiredAt?: string | null) {
  if (!acquiredAt) return "—";
  const months = monthsBetween(acquiredAt);
  if (months === null) return "—";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${years}a ${rest}m`;
}

export function warrantyStatus(until?: string | null) {
  if (!until) return { label: "Sem garantia", variant: "outline" as const };
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return { label: "Sem garantia", variant: "outline" as const };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end >= today) return { label: "Em garantia", variant: "default" as const };
  return { label: "Garantia vencida", variant: "destructive" as const };
}

export function kitCompleteness(components: Pick<AssetComponent, "is_present" | "condition">[]) {
  if (components.length === 0) {
    return { complete: false, label: "Sem componentes" };
  }
  const missing = components.filter((c) => !c.is_present || c.condition === "missing").length;
  const damaged = components.filter((c) => c.condition === "damaged").length;
  if (missing === 0 && damaged === 0) return { complete: true, label: "Completo" };
  const parts = [];
  if (missing) parts.push(`${missing} ausente${missing > 1 ? "s" : ""}`);
  if (damaged) parts.push(`${damaged} danificado${damaged > 1 ? "s" : ""}`);
  return { complete: false, label: parts.join(" · ") };
}

export function isUnavailableStatus(status: AssetStatus) {
  return [
    "reserved",
    "in_use",
    "in_transit",
    "returned_pending",
    "cleaning",
    "maintenance",
    "damaged",
    "incomplete",
    "lost",
    "written_off",
  ].includes(status);
}
