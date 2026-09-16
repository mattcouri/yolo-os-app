import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MonitorPlay } from "lucide-react";
import { OpsCalendar, type CalendarView } from "@/components/separacao/ops-calendar";
import { EventFilterBar } from "@/components/separacao/event-filter-bar";
import { TvDashboardBar } from "@/components/separacao/tv-dashboard-bar";
import HoverStack from "@/components/ui/hover-stack";
import { CloseOrderWizard } from "@/components/separacao/close-order-wizard";
import { StageTag } from "@/components/separacao/stage-tag";
import { Button } from "@/components/ui/button";
import { useSeparationLive } from "@/lib/use-separation-live";
import { useAppStore } from "@/stores";
import type { Order, OrderItem, SeparationJob } from "@/types/database";
import {
  TYPE_LABEL,
  buildCalendarBlocks,
  daysUntil,
  eventTitle,
  formatEventDayShort,
  formatEventTime,
  formatEventWeekday,
  isClosed,
  isInProgress,
  isProgrammed,
  isQueued,
  isScheduled,
  locationSummary,
  missingTripAssignment,
  orderStart,
  tripSummary,
} from "@/lib/separacao";
import { SeparationJobPage } from "./sheet";

export { SeparationJobPage };

function requestFullscreen(el: HTMLElement) {
  const req =
    el.requestFullscreen?.bind(el) ||
    (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(el);
  if (!req) return Promise.reject(new Error("fullscreen unsupported"));
  try {
    return Promise.resolve(req.call(el, { navigationUI: "hide" } as FullscreenOptions));
  } catch {
    return Promise.resolve(req.call(el));
  }
}

function exitFullscreen() {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void>; webkitFullscreenElement?: Element | null };
  if (!document.fullscreenElement && !doc.webkitFullscreenElement) return Promise.resolve();
  const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(document);
  return exit ? exit() : Promise.resolve();
}

function isFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

function DaysLeftRing({ days }: { days: number }) {
  const size = 36;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const horizon = 14;
  const progress = days <= 0 ? 1 : Math.max(0.1, Math.min(1, 1 - days / horizon));
  const tone =
    days <= 0 ? "text-red-600" : days <= 2 ? "text-orange-600" : days <= 7 ? "text-sky-600" : "text-emerald-600";
  const label = days < 0 ? "atrasado" : days === 0 ? "hoje" : `${days}d`;

  return (
    <span className={`inline-flex items-center gap-2 ${tone}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-current opacity-35"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-current"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
        />
      </svg>
      <span className="text-sm font-bold tabular-nums">{label}</span>
    </span>
  );
}

type QueueRecord = {
  order: Order;
  job: SeparationJob;
  items: OrderItem[];
  start: Date;
};

function assigned(value?: string | null) {
  if (!value || value === "Não se aplica") return null;
  return value;
}

function OrderPlanCard({
  record,
  onSelect,
  onCloseOrder,
  variant,
}: {
  record: QueueRecord;
  onSelect: (orderId: string) => void;
  onCloseOrder?: (record: QueueRecord) => void;
  variant: "fila" | "programado";
}) {
  const { order, job, items, start } = record;
  const checked = items.filter((item) => item.is_checked).length;
  const trip = tripSummary(order, items);
  const missing = missingTripAssignment(order, job, items);
  const location = locationSummary(order, items);
  const tripLine = [trip.outbound, trip.inbound].filter(Boolean).join(" · ");
  const showAddress = Boolean(location && location !== trip.outbound && location !== trip.inbound && location !== tripLine);
  const preview = items.slice(0, variant === "programado" ? 6 : 4);
  const extra = items.length - preview.length;
  const deliveryDriver = assigned(job.delivery_driver);
  const pickupDriver = assigned(job.pickup_driver);
  const deliveryVehicle = assigned(job.vehicle);
  const pickupVehicle = assigned(job.pickup_vehicle);
  const stageTag =
    job.stage === "na_rua"
      ? { label: "Em andamento", tone: "progress" as const }
      : job.stage === "em_separacao"
        ? { label: "Programado", tone: "programmed" as const }
        : null;
  const headline =
    order.order_type === "evento"
      ? order.event_name?.trim() || order.recipient_name
      : order.recipient_name;

  return (
    <div
      className={
        variant === "fila"
          ? "flex w-[280px] shrink-0 flex-col rounded-2xl border bg-card px-3 py-2.5 text-left"
          : "flex h-full w-full shrink-0 flex-col rounded-xl border bg-background px-3 py-2.5 text-left hover:border-primary/40"
      }
    >
      <button type="button" onClick={() => onSelect(order.id)} className="flex min-h-0 flex-1 flex-col text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xl font-black uppercase leading-none tracking-tight">
          {TYPE_LABEL[order.order_type] || order.order_type}
        </p>
        <p className="text-2xl font-black tabular-nums leading-none tracking-tight">{formatEventDayShort(start)}</p>
      </div>
      {headline && <p className="mt-1 truncate text-base font-bold leading-tight">{headline}</p>}
      <div className="mt-1 flex items-center justify-between gap-2">
        {stageTag ? <StageTag label={stageTag.label} tone={stageTag.tone} /> : <span />}
        <DaysLeftRing days={daysUntil(start)} />
      </div>
      <p className="mt-0.5 text-xs font-semibold capitalize text-muted-foreground">
        {formatEventWeekday(start)} · {formatEventTime(start)}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-snug">{tripLine}</p>
      <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{order.order_number}</p>
      {showAddress && variant === "fila" && <p className="truncate text-xs text-muted-foreground">{location}</p>}
      {variant === "programado" && (order.address || location) && (
        <p className="truncate text-xs text-muted-foreground">{order.address || location}</p>
      )}
      {variant === "programado" && (
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {order.recipient_name && (
            <p className="truncate">
              Contato · {order.recipient_name}
              {order.recipient_contact ? ` · ${order.recipient_contact}` : ""}
            </p>
          )}
          {deliveryDriver && (
            <p className="truncate">
              Entrega · {deliveryDriver}
              {deliveryVehicle ? ` · ${deliveryVehicle}` : ""}
            </p>
          )}
          {pickupDriver && (
            <p className="truncate">
              Coleta · {pickupDriver}
              {pickupVehicle ? ` · ${pickupVehicle}` : ""}
            </p>
          )}
        </div>
      )}
      {preview.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {preview.map((item, index) => (
            <li key={item.id} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                {variant === "fila" ? `${index + 1}. ` : ""}
                {item.name}
                {item.requested_state === "liquid" ? " · líq." : item.requested_state === "frozen" ? " · cong." : ""}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.quantity} {item.unit}
              </span>
            </li>
          ))}
          {extra > 0 && <li className="text-muted-foreground">+{extra} itens</li>}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {variant === "fila"
          ? `${items.length} ${items.length === 1 ? "item" : "itens"}`
          : `${checked}/${items.length} conferidos`}
      </p>
      {missing.length > 0 && (
        <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Falta {missing.join(" e ")}
        </p>
      )}
      </button>
      {onCloseOrder && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCloseOrder(record);
          }}
          className="mt-auto h-8 w-full rounded-md border border-amber-400/60 bg-amber-500/20 text-[11px] font-semibold uppercase tracking-wide text-amber-950 hover:bg-amber-500/30 dark:text-amber-100"
        >
          Fechar pedido
        </button>
      )}
    </div>
  );
}

export function SeparationBoardPage() {
  const navigate = useNavigate();
  const { orders, orderItems, separationJobs } = useAppStore();
  const lastLiveAt = useSeparationLive();
  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [tvMode, setTvMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [closing, setClosing] = useState<QueueRecord | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const didDragRef = useRef(false);

  const records = useMemo(() => {
    return separationJobs
      .map((job) => {
        const order = orders.find((row) => row.id === job.order_id);
        if (!order || order.status === "cancelled") return null;
        const start = orderStart(order);
        if (!start) return null;
        return {
          job,
          order,
          items: orderItems.filter((item) => item.order_id === order.id),
          start,
        };
      })
      .filter((row): row is QueueRecord => Boolean(row));
  }, [orders, orderItems, separationJobs]);

  const queue = useMemo(
    () =>
      records
        .filter((row) => isQueued(row.job))
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [records]
  );

  const scheduled = useMemo(
    () => records.filter((row) => isScheduled(row.job) || isClosed(row.job)),
    [records]
  );

  const calendarEvents = useMemo(
    () =>
      scheduled
        .filter((row) => !hiddenIds.has(row.order.id))
        .flatMap((row) => buildCalendarBlocks(row.order, row.job)),
    [scheduled, hiddenIds]
  );

  const filterOrders = useMemo(
    () => scheduled.map((row) => row.order).sort((a, b) => eventTitle(a).localeCompare(eventTitle(b), "pt-BR")),
    [scheduled]
  );

  const programmed = useMemo(
    () =>
      records
        .filter((row) => isProgrammed(row.job))
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [records]
  );

  const inProgress = useMemo(
    () =>
      records
        .filter((row) => isInProgress(row.job))
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [records]
  );

  const setZoomClamped = (next: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(next.toFixed(2)))));

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleEvent = (orderId: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const leavePanel = () => {
    resetView();
    setTvMode(false);
    void exitFullscreen();
  };

  const openTv = () => {
    resetView();
    flushSync(() => setTvMode(true));
    void requestFullscreen(document.documentElement).catch(() => {
      const target = overlayRef.current;
      if (target) void requestFullscreen(target).catch(() => undefined);
    });
  };

  useEffect(() => {
    const onChange = () => {
      if (!isFullscreen()) {
        setTvMode(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!tvMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [tvMode]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea, [role='button']")) return;
    didDragRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true;
    if (didDragRef.current) setPan({ x: drag.panX + dx, y: drag.panY + dy });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((current) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((current + delta).toFixed(2)))));
  }, []);

  useEffect(() => {
    if (!tvMode) return;
    const el = overlayRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tvMode, onWheel]);

  const boardProps = {
    view,
    onViewChange: setView,
    cursor,
    onCursorChange: setCursor,
    events: calendarEvents,
    filterOrders,
    hiddenIds,
    onToggleEvent: toggleEvent,
    queue,
    programmed,
    inProgress,
    onSelect: (orderId: string) => {
      if (didDragRef.current) return;
      if (tvMode) leavePanel();
      navigate(`/separacao/${orderId}`);
    },
    onCloseOrder: (record: QueueRecord) => {
      if (didDragRef.current) return;
      if (tvMode) leavePanel();
      setClosing(record);
    },
  };

  return (
    <>
      <div className="flex h-[calc(100vh-5.5rem)] min-h-0 flex-col gap-3 overflow-hidden pb-3 pt-3">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Painel da operação</p>
            <h1 className="text-2xl font-bold md:text-3xl">Separação de Pedidos</h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button type="button" variant="outline" className="h-9" onClick={openTv}>
              <MonitorPlay className="h-4 w-4" />
              TV Dashboard
            </Button>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{queue.length}</span> em aberto ·{" "}
              <span className="font-semibold text-foreground">{programmed.length}</span> programados ·{" "}
              <span className="font-semibold text-foreground">{inProgress.length}</span> em andamento
            </p>
          </div>
        </div>
        <SeparationBoard {...boardProps} />
      </div>
      <CloseOrderWizard record={closing} onClose={() => setClosing(null)} />

      {tvMode &&
        createPortal(
          <div ref={overlayRef} className="fixed inset-0 z-[100] flex flex-col bg-background">
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
              <h1 className="text-lg font-bold">Separação de Pedidos</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{queue.length}</span> em aberto ·{" "}
                <span className="font-semibold text-foreground">{programmed.length}</span> programados ·{" "}
                <span className="font-semibold text-foreground">{inProgress.length}</span> em andamento
              </p>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <div
                className="absolute inset-0 flex cursor-grab flex-col p-4 active:cursor-grabbing"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <SeparationBoard {...boardProps} />
              </div>
            </div>
            <TvDashboardBar
              zoom={zoom}
              onZoomIn={() => setZoomClamped(zoom + ZOOM_STEP)}
              onZoomOut={() => setZoomClamped(zoom - ZOOM_STEP)}
              onReset={resetView}
              onLeavePanel={leavePanel}
              lastLiveAt={lastLiveAt}
            />
          </div>,
          document.body
        )}
    </>
  );
}

function PlanRail({
  title,
  countLabel,
  emptyLabel,
  records,
  onSelect,
  onCloseOrder,
  cardHeight = 400,
}: {
  title: string;
  countLabel: string;
  emptyLabel: string;
  records: QueueRecord[];
  onSelect: (orderId: string) => void;
  onCloseOrder?: (record: QueueRecord) => void;
  cardHeight?: number;
}) {
  return (
    <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="shrink-0 border-b px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wider">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{countLabel}</p>
      </div>
      {records.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2">
          <HoverStack
            items={records.map((record) => ({
              id: record.order.id,
              content: (
                <OrderPlanCard
                  record={record}
                  onSelect={onSelect}
                  onCloseOrder={onCloseOrder}
                  variant="programado"
                />
              ),
            }))}
            cardWidth={276}
            cardHeight={cardHeight}
            overlap={88}
          />
        </div>
      )}
    </aside>
  );
}

function SeparationBoard({
  view,
  onViewChange,
  cursor,
  onCursorChange,
  events,
  filterOrders,
  hiddenIds,
  onToggleEvent,
  queue,
  programmed,
  inProgress,
  onSelect,
  onCloseOrder,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  cursor: Date;
  onCursorChange: (date: Date) => void;
  events: ReturnType<typeof buildCalendarBlocks>;
  filterOrders: Order[];
  hiddenIds: Set<string>;
  onToggleEvent: (orderId: string) => void;
  queue: QueueRecord[];
  programmed: QueueRecord[];
  inProgress: QueueRecord[];
  onSelect: (orderId: string) => void;
  onCloseOrder: (record: QueueRecord) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <section className="flex min-h-0 flex-[2] flex-col rounded-2xl border bg-card p-3 md:p-4">
        <EventFilterBar orders={filterOrders} hiddenIds={hiddenIds} onToggle={onToggleEvent} />
        <div className={filterOrders.length ? "mt-2 min-h-0 flex-1" : "min-h-0 flex-1"}>
          <OpsCalendar
            view={view}
            onViewChange={onViewChange}
            cursor={cursor}
            onCursorChange={onCursorChange}
            events={events}
            onSelect={onSelect}
          />
        </div>
      </section>

      <section className="flex min-h-0 flex-[1] flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-semibold">Pedidos em aberto</h2>
          <p className="text-xs text-muted-foreground">Mais próximo primeiro</p>
        </div>
        {queue.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Nenhum pedido em aberto. O que já foi confirmado está em Programado.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-auto pb-1">
            {queue.map((record) => (
              <OrderPlanCard key={record.order.id} record={record} onSelect={onSelect} variant="fila" />
            ))}
          </div>
        )}
      </section>
      </div>

      <PlanRail
        title="Programado"
        countLabel={programmed.length === 0 ? "Nenhum pedido aceito" : `${programmed.length} no plano`}
        emptyLabel="Confirme um pedido em aberto para montar o plano."
        records={programmed}
        onSelect={onSelect}
      />
      <PlanRail
        title="Em Andamento"
        countLabel={inProgress.length === 0 ? "Nenhum pedido na rua" : `${inProgress.length} em andamento`}
        emptyLabel="Marque a saída na folha para mover o pedido para cá."
        records={inProgress}
        onSelect={onSelect}
        onCloseOrder={onCloseOrder}
        cardHeight={440}
      />
    </div>
  );
}
