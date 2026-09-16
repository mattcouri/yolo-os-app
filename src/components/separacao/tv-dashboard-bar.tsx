import { ArrowLeft, Move, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

interface TvDashboardBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onLeavePanel: () => void;
  lastLiveAt: Date;
}

function liveStamp(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.getMonth() + 1)}/${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

const pill =
  "inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-100";

export function TvDashboardBar({ zoom, onZoomIn, onZoomOut, onReset, onLeavePanel, lastLiveAt }: TvDashboardBarProps) {
  return (
    <div className="flex shrink-0 justify-center bg-[#0b1220] px-4 py-3 text-slate-100">
      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
        <div className={pill}>
          <button type="button" onClick={onZoomOut} className="rounded-full p-1 hover:bg-white/10" aria-label="Reduzir zoom">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={onZoomIn} className="rounded-full p-1 hover:bg-white/10" aria-label="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={onReset} className={pill}>
          <RefreshCw className="h-4 w-4" />
          Resetar
        </button>
        <span className={`${pill} cursor-grab`}>
          <Move className="h-4 w-4" />
          Arraste para mover
        </span>
        <button type="button" onClick={onLeavePanel} className={pill}>
          <ArrowLeft className="h-4 w-4" />
          Sair do Painel
        </button>
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
        <p className="inline-flex items-center gap-2 px-2 text-sm font-medium text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Ao vivo {liveStamp(lastLiveAt)}
        </p>
      </div>
    </div>
  );
}
