import type { Location, Uniform, UniformCheckout, UniformSize, UniformStock } from "@/types/database";

export const UNIFORM_SIZES: UniformSize[] = ["P", "M", "G", "GG"];
export const UNIFORM_STREET_COLUMN = "__street__";

export function qtyField(size: UniformSize): "qty_p" | "qty_m" | "qty_g" | "qty_gg" {
  return `qty_${size.toLowerCase()}` as "qty_p" | "qty_m" | "qty_g" | "qty_gg";
}

export function totalForSize(uniform: Uniform, size: UniformSize) {
  return uniform[qtyField(size)] || 0;
}

export function outForSize(
  uniformId: string,
  size: UniformSize,
  checkouts: UniformCheckout[]
) {
  return checkouts
    .filter((c) => c.uniform_id === uniformId && c.size === size && c.status === "out")
    .reduce((sum, c) => sum + c.quantity, 0);
}

export function availableForSize(
  uniform: Uniform,
  size: UniformSize,
  checkouts: UniformCheckout[]
) {
  return Math.max(0, totalForSize(uniform, size) - outForSize(uniform.id, size, checkouts));
}

export function uniformTotals(uniform: Uniform, checkouts: UniformCheckout[]) {
  return UNIFORM_SIZES.map((size) => ({
    size,
    total: totalForSize(uniform, size),
    out: outForSize(uniform.id, size, checkouts),
    available: availableForSize(uniform, size, checkouts),
  }));
}

export function stockQtyAt(
  stock: UniformStock[],
  uniformId: string,
  size: UniformSize,
  locationId: string
) {
  return stock
    .filter((row) => row.uniform_id === uniformId && row.size === size && row.location_id === locationId)
    .reduce((sum, row) => sum + row.quantity, 0);
}

export function stockQtyForSize(stock: UniformStock[], uniformId: string, size: UniformSize) {
  return stock
    .filter((row) => row.uniform_id === uniformId && row.size === size)
    .reduce((sum, row) => sum + row.quantity, 0);
}

export function applyUniformStockDeltas(
  stock: UniformStock[],
  deltas: { uniform_id: string; size: UniformSize; location_id: string; delta: number }[],
  now = new Date().toISOString()
) {
  const next = [...stock];
  for (const change of deltas) {
    if (!change.location_id || change.delta === 0) continue;
    const index = next.findIndex(
      (row) =>
        row.uniform_id === change.uniform_id &&
        row.size === change.size &&
        row.location_id === change.location_id
    );
    if (index < 0) {
      if (change.delta <= 0) continue;
      next.push({
        id: crypto.randomUUID(),
        uniform_id: change.uniform_id,
        size: change.size,
        location_id: change.location_id,
        quantity: change.delta,
        updated_at: now,
      });
      continue;
    }
    const quantity = Math.max(0, next[index].quantity + change.delta);
    if (quantity === 0) {
      next.splice(index, 1);
    } else {
      next[index] = { ...next[index], quantity, updated_at: now };
    }
  }
  return next;
}

export function takeUniformFromYards(
  stock: UniformStock[],
  locations: Location[],
  uniformId: string,
  size: UniformSize,
  quantity: number
) {
  const yards = orderedUniformYards(locations);
  let remaining = quantity;
  const deltas: { uniform_id: string; size: UniformSize; location_id: string; delta: number }[] = [];
  for (const location of yards) {
    if (remaining <= 0) break;
    const have = stockQtyAt(stock, uniformId, size, location.id);
    const take = Math.min(have, remaining);
    if (take > 0) {
      deltas.push({ uniform_id: uniformId, size, location_id: location.id, delta: -take });
      remaining -= take;
    }
  }
  return { deltas, remaining };
}

function orderedUniformYards(locations: Location[]) {
  const trade = locations.find((location) => location.is_active && /sala\s*trade/i.test(location.name || ""));
  const dirty = locations.find((location) => location.is_active && location.system_key === "asset_dirty");
  return [...(trade ? [trade] : []), ...(dirty ? [dirty] : [])];
}
