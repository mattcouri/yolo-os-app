import { useLayoutEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CALENDAR_KIND_LABEL,
  WEEKDAYS,
  addDays,
  formatEventTime,
  needsCloseOut,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type CalendarBlock,
  type CalendarBlockKind,
} from "@/lib/separacao";

export type CalendarView = "week" | "month";

interface OpsCalendarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  cursor: Date;
  onCursorChange: (date: Date) => void;
  events: CalendarBlock[];
  onSelect: (orderId: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 40;
const DEFAULT_SCROLL_HOUR = 7;

function eventTone(event: CalendarBlock) {
  const closed = event.job.stage === "retorno";
  const overduePickup = event.kind === "pickup" && !closed && needsCloseOut(event.order, event.job);
  if (overduePickup) return "bg-amber-500 text-white border-amber-600";
  const tones: Record<CalendarBlockKind, { live: string; closed: string }> = {
    delivery: {
      live: "bg-emerald-600 text-white border-emerald-700",
      closed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200",
    },
    event_start: {
      live: "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900",
      closed: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300",
    },
    event_end: {
      live: "bg-violet-600 text-white border-violet-700",
      closed: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200",
    },
    pickup: {
      live: "bg-sky-600 text-white border-sky-700",
      closed: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-200",
    },
  };
  return closed ? tones[event.kind].closed : tones[event.kind].live;
}

const KIND_SLOT: Record<CalendarBlockKind, string> = {
  delivery: "left-0.5 right-3 z-[1]",
  event_start: "left-1 right-2 z-[2]",
  event_end: "left-1.5 right-1.5 z-[3]",
  pickup: "left-2 right-0.5 z-[4]",
};

function blocksOnDay(events: CalendarBlock[], day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return events.flatMap((event) => {
    const clipStart = Math.max(event.start.getTime(), dayStart);
    const clipEnd = Math.min(event.end.getTime(), dayEnd);
    if (clipEnd <= clipStart) return [];
    return [{ event, clipStart, clipEnd, dayStart }];
  });
}

export function OpsCalendar({ view, onViewChange, cursor, onCursorChange, events, onSelect }: OpsCalendarProps) {
  const today = new Date();
  const weekStart = startOfWeek(cursor);
  const monthStart = startOfMonth(cursor);
  const monthGridStart = startOfWeek(monthStart);

  const heading =
    view === "week"
      ? `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
      : cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const shift = (amount: number) => {
    if (view === "week") onCursorChange(addDays(cursor, amount * 7));
    else onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onCursorChange(new Date())}>
            Hoje
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-1 text-sm font-semibold capitalize sm:text-base">{heading}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              Entrega
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-zinc-900 dark:bg-zinc-100" />
              Início
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" />
              Fim
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" />
              Retirada
            </span>
          </div>
          <div className="flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => onViewChange("week")}
              className={cn("rounded-md px-3 py-1 text-xs font-medium", view === "week" && "bg-primary text-primary-foreground")}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => onViewChange("month")}
              className={cn("rounded-md px-3 py-1 text-xs font-medium", view === "month" && "bg-primary text-primary-foreground")}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      {view === "week" ? (
        <WeekGrid weekStart={weekStart} today={today} events={events} onSelect={onSelect} />
      ) : (
        <MonthGrid gridStart={monthGridStart} month={cursor.getMonth()} today={today} events={events} onSelect={onSelect} />
      )}
    </div>
  );
}

function WeekGrid({
  weekStart,
  today,
  events,
  onSelect,
}: {
  weekStart: Date;
  today: Date;
  events: CalendarBlock[];
  onSelect: (orderId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
  }, [weekStart]);

  return (
    <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto rounded-xl border">
      <div className="sticky top-0 z-10 grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b bg-card text-center text-[11px] font-medium text-muted-foreground">
        <div className="bg-muted/40" />
        {days.map((day, index) => (
          <div key={day.toISOString()} className={cn("bg-muted/40 py-2", sameDay(day, today) && "bg-primary/10 text-foreground")}>
            <div>{WEEKDAYS[index]}</div>
            <div className={cn("text-sm font-semibold", sameDay(day, today) && "text-primary")}>{day.getDate()}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
        <div>
          {HOURS.map((hour) => (
            <div key={hour} className="border-b pr-1 text-right text-[10px] text-muted-foreground" style={{ height: HOUR_HEIGHT }}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayBlocks = blocksOnDay(events, day);
          return (
            <div key={day.toISOString()} className={cn("relative border-l", sameDay(day, today) && "bg-primary/5")}>
              {HOURS.map((hour) => (
                <div key={hour} className="border-b" style={{ height: HOUR_HEIGHT }} />
              ))}
              {dayBlocks.map(({ event, clipStart, clipEnd, dayStart }) => {
                const startHour = (clipStart - dayStart) / 3_600_000;
                const endHour = (clipEnd - dayStart) / 3_600_000;
                const top = startHour * HOUR_HEIGHT;
                const height = Math.max(28, (endHour - startHour) * HOUR_HEIGHT);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelect(event.order.id)}
                    className={cn(
                      "absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight shadow-sm",
                      KIND_SLOT[event.kind],
                      eventTone(event)
                    )}
                    style={{ top, height: Math.min(height, 24 * HOUR_HEIGHT - top) }}
                  >
                    <span className="block truncate">{CALENDAR_KIND_LABEL[event.kind]}</span>
                    <span className="block truncate opacity-80">{formatEventTime(event.start)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({
  gridStart,
  month,
  today,
  events,
  onSelect,
}: {
  gridStart: Date;
  month: number;
  today: Date;
  events: CalendarBlock[];
  onSelect: (orderId: string) => void;
}) {
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1.5">
            {day}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const dayBlocks = blocksOnDay(events, day);
          const inMonth = day.getMonth() === month;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-0 overflow-hidden border-b border-r p-0.5",
                !inMonth && "bg-muted/20 text-muted-foreground",
                sameDay(day, today) && "bg-primary/5"
              )}
            >
              <div className={cn("mb-0.5 text-[10px] font-medium", sameDay(day, today) && "text-primary")}>{day.getDate()}</div>
              <div className="space-y-0.5">
                {dayBlocks.slice(0, 4).map(({ event }) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelect(event.order.id)}
                    className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium", eventTone(event))}
                  >
                    {CALENDAR_KIND_LABEL[event.kind]} {formatEventTime(event.start)}
                  </button>
                ))}
                {dayBlocks.length > 4 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{dayBlocks.length - 4}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
