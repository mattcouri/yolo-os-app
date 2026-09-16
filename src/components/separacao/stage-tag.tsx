import { cn } from "@/lib/utils";

export type StageTone = "queued" | "programmed" | "progress" | "closed" | "cancelled";

const TONE_CLASS: Record<StageTone, string> = {
  queued:
    "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:border-slate-400/35 dark:bg-slate-400/10 dark:text-slate-300",
  programmed:
    "border-sky-400/45 bg-sky-500/10 text-sky-800 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-300",
  progress:
    "border-amber-400/50 bg-amber-500/15 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300",
  closed:
    "border-emerald-400/45 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300",
  cancelled:
    "border-rose-400/45 bg-rose-500/10 text-rose-800 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300",
};

export function StageTag({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StageTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
        TONE_CLASS[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

export function stageTagFromStatus(status: string | null | undefined): { label: string; tone: StageTone } {
  switch (status) {
    case "a_separar":
    case "received":
      return { label: "Em aberto", tone: "queued" };
    case "em_separacao":
      return { label: "Programado", tone: "programmed" };
    case "na_rua":
      return { label: "Em andamento", tone: "progress" };
    case "retorno":
    case "completed":
      return { label: "Encerrado", tone: "closed" };
    case "cancelled":
      return { label: "Cancelado", tone: "cancelled" };
    default:
      return { label: status || "—", tone: "queued" };
  }
}

export function sheetStageTag(state: {
  closed: boolean;
  queued: boolean;
  inProgress: boolean;
}): { label: string; tone: StageTone } {
  if (state.closed) return { label: "Encerrado", tone: "closed" };
  if (state.queued) return { label: "Em aberto", tone: "queued" };
  if (state.inProgress) return { label: "Em andamento", tone: "progress" };
  return { label: "Programado", tone: "programmed" };
}
