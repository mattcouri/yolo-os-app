import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAppStore } from "@/stores";

const POLL_MS = 15_000;
const DEBOUNCE_MS = 400;

export function useSeparationLive() {
  const refreshSeparationLive = useAppStore((state) => state.refreshSeparationLive);
  const [lastLiveAt, setLastLiveAt] = useState(() => new Date());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await refreshSeparationLive();
      if (!cancelled) setLastLiveAt(new Date());
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void run();
      }, DEBOUNCE_MS);
    };

    void run();
    const poll = window.setInterval(() => void run(), POLL_MS);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);

    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel("separacao-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, schedule)
        .on("postgres_changes", { event: "*", schema: "public", table: "separation_jobs" }, schedule)
        .subscribe();
    }

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [refreshSeparationLive]);

  return lastLiveAt;
}
