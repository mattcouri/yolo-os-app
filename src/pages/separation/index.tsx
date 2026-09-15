import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OpsCalendar, type CalendarView } from "@/components/separacao/ops-calendar";
import { useAppStore } from "@/stores";
import {
  TYPE_LABEL,
  buildCalendarBlocks,
  eventTitle,
  formatEventDayShort,
  formatEventTime,
  formatEventWeekday,
  isClosed,
  isQueued,
  isScheduled,
  orderStart,
} from "@/lib/separacao";
import { SeparationJobPage } from "./sheet";

export { SeparationJobPage };

export function SeparationBoardPage() {
  const navigate = useNavigate();
  const { orders, orderItems, separationJobs } = useAppStore();
  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => new Date());

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
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
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
    () => scheduled.flatMap((row) => buildCalendarBlocks(row.order, row.job)),
    [scheduled]
  );

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 pb-4 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Painel da operação</p>
          <h1 className="text-2xl font-bold md:text-3xl">Separação de Pedidos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{queue.length}</span> na fila ·{" "}
          <span className="font-semibold text-foreground">{scheduled.filter((row) => isScheduled(row.job)).length}</span>{" "}
          no calendário
        </p>
      </div>

      <section className="h-[38vh] min-h-[280px] rounded-2xl border bg-card p-3 md:p-4">
        <OpsCalendar
          view={view}
          onViewChange={setView}
          cursor={cursor}
          onCursorChange={setCursor}
          events={calendarEvents}
          onSelect={(orderId) => navigate(`/separacao/${orderId}`)}
        />
      </section>

      <section className="min-h-0 flex-1">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Fila para separar</h2>
          <p className="text-xs text-muted-foreground">Mais próximo primeiro</p>
        </div>
        {queue.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Nenhum pedido na fila. O que já foi confirmado está no calendário.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {queue.map(({ order, job, items, start }) => {
              const checked = items.filter((item) => item.is_checked).length;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(`/separacao/${order.id}`)}
                  className="w-[260px] shrink-0 rounded-2xl border bg-card p-4 text-left hover:border-primary/40"
                >
                  <p className="text-3xl font-black tabular-nums leading-none tracking-tight">
                    {formatEventDayShort(start)}
                  </p>
                  <p className="mt-1 text-xs font-semibold capitalize text-muted-foreground">
                    {formatEventWeekday(start)} · {formatEventTime(start)}
                  </p>
                  <p className="mt-3 truncate text-[11px] font-medium text-muted-foreground">
                    {order.order_number} · {TYPE_LABEL[order.order_type] || order.order_type}
                  </p>
                  <p className="truncate font-semibold">{eventTitle(order)}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{order.address || "Sem endereço"}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {checked}/{items.length} conferidos
                  </p>
                  {!job.delivery_driver && (
                    <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      Falta motorista e horário
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
