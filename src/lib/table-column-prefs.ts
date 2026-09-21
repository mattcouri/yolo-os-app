import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthProfile } from "@/lib/auth";
import type { TableColumnWidths, UiPreferences } from "@/types/database";

export const MIN_TABLE_COL_PX = 56;
export const MAX_TABLE_COL_PX = 720;

const TAILWIND_WIDTH_PX: Record<string, number> = {
  "w-8": 32,
  "w-12": 48,
  "w-16": 64,
  "w-20": 80,
  "w-24": 96,
  "w-28": 112,
  "w-32": 128,
  "w-36": 144,
  "w-40": 160,
  "w-44": 176,
  "w-48": 192,
  "w-52": 208,
  "w-56": 224,
  "w-64": 256,
};

export function defaultWidthFromClass(width?: string, fallback = 160) {
  if (!width) return fallback;
  return TAILWIND_WIDTH_PX[width] ?? fallback;
}

export function clampColumnWidth(px: number) {
  return Math.min(MAX_TABLE_COL_PX, Math.max(MIN_TABLE_COL_PX, Math.round(px)));
}

function storageKey(userId: string) {
  return `yolo-table-columns:${userId}`;
}

function readLocal(userId: string): Record<string, TableColumnWidths> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TableColumnWidths>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocal(userId: string, tables: Record<string, TableColumnWidths>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(tables));
}

async function persistProfilePreferences(userId: string, prefs: UiPreferences) {
  if (!isSupabaseConfigured || !supabase || userId === "demo") return;
  await supabase
    .from("profiles")
    .update({ ui_preferences: prefs, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export function useTableColumnWidths(
  tableId: string,
  defaults: TableColumnWidths
) {
  const { profile } = useAuthProfile();
  const userId = profile?.id || "demo";
  const defaultsKey = JSON.stringify(defaults);

  const initial = useMemo(() => {
    const local = readLocal(userId)[tableId] || {};
    const fromProfile = profile?.ui_preferences?.tableColumns?.[tableId] || {};
    return { ...defaults, ...fromProfile, ...local };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tableId, defaultsKey]);

  const [widths, setWidths] = useState<TableColumnWidths>(initial);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setWidths(initial);
  }, [initial]);

  const persist = useCallback(
    (nextWidths: TableColumnWidths) => {
      const tables = { ...readLocal(userId), [tableId]: nextWidths };
      writeLocal(userId, tables);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const currentPrefs = profile?.ui_preferences || {};
        void persistProfilePreferences(userId, {
          ...currentPrefs,
          tableColumns: {
            ...(currentPrefs.tableColumns || {}),
            ...tables,
          },
        });
      }, 400);
    },
    [profile?.ui_preferences, tableId, userId]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setColumnWidth = useCallback(
    (key: string, px: number, persistNow = false) => {
      setWidths((prev) => {
        const next = { ...prev, [key]: clampColumnWidth(px) };
        if (persistNow) persist(next);
        return next;
      });
    },
    [persist]
  );

  return { widths, setColumnWidth, persistWidths: persist };
}
