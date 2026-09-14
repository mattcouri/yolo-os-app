import type {
  Asset,
  AssetControlMethod,
  AssetStatus,
  AssetType,
  AssetComponent,
} from "@/types/database";

export const BOX_ASSET_TYPES: AssetType[] = [
  "caixa_preta",
  "caixa_media",
  "caixa_grande",
];

export function isBoxAsset(asset: Pick<Asset, "type">) {
  return BOX_ASSET_TYPES.includes(asset.type);
}

export function getBoxUnitCapacity(asset: Pick<Asset, "type" | "unit_capacity">) {
  if (asset.unit_capacity && asset.unit_capacity > 0) return asset.unit_capacity;
  if (asset.type === "caixa_media") return 100;
  return 0;
}

export function isOperationalAsset(asset: Pick<Asset, "type">) {
  return !isBoxAsset(asset);
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
  { value: "other", label: "Outro" },
];

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
  other: "ATV",
};

export function categoryLabel(value?: string | null) {
  return ASSET_CATEGORIES.find((c) => c.value === value)?.label || value || "—";
}

export function statusLabel(status: string) {
  return OPERATIONAL_STATUSES.find((s) => s.value === status)?.label || status;
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
