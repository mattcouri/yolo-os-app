import type { Uniform, UniformCheckout, UniformSize } from "@/types/database";

export const UNIFORM_SIZES: UniformSize[] = ["P", "M", "G", "GG"];

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
