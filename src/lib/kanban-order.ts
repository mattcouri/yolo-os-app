export const KANBAN_BOARDS = {
  inventorySku: "inventory_sku",
  inventoryMaterial: "inventory_material",
  ativos: "ativos",
  embalagens: "embalagens",
  uniformes: "uniformes",
} as const;

export type KanbanBoardKey = (typeof KANBAN_BOARDS)[keyof typeof KANBAN_BOARDS];

export function applySavedColumnOrder(defaultIds: string[], saved?: string[] | null) {
  if (!saved?.length) return defaultIds;
  const allowed = new Set(defaultIds);
  const ordered = saved.filter((id) => allowed.has(id));
  const missing = defaultIds.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}
