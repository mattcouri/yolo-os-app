import type { Asset } from "@/types/database";
import { getBoxUnitCapacity } from "@/lib/operational-assets";

export function suggestedBoxCount(total: number, capacity: number) {
  if (total <= 0 || capacity <= 0) return 0;
  return Math.ceil(total / capacity);
}

export function allocateToBoxes(
  total: number,
  boxes: Pick<Asset, "id" | "type" | "unit_capacity">[]
) {
  let remaining = total;
  const allocations = boxes.map((box) => {
    const capacity = getBoxUnitCapacity(box);
    const quantity = remaining > 0 ? Math.min(remaining, capacity) : 0;
    remaining -= quantity;
    return { assetId: box.id, quantity, capacity };
  });
  return { allocations, leftover: remaining };
}
