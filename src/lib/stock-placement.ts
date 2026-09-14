import type { Location } from "@/types/database";

export type PrepareMode = "boxed" | "loose" | "discard";

export function locationRequiresBox(location?: Pick<Location, "requires_box"> | null) {
  return location?.requires_box !== false;
}

export function inferPrepareMode(
  grade: "AAA" | "B" | "C" | "blocked",
  location: Location | undefined,
  discarded: boolean
): PrepareMode {
  if (discarded && grade === "blocked") return "discard";
  if (location && !locationRequiresBox(location)) return "loose";
  return "boxed";
}
