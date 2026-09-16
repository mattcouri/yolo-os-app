import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { eventColor, eventTitle, formatEventTime, isMultiDay, layoutSpanningBars, needsCloseOut, sameDay, spanningBarRows, startOfDay, startOfMonth, startOfWeek, WEEKDAYS, addDays, CALENDAR_KIND_LABEL, type CalendarBlock, type CalendarBlockKind, type SpanningBar } from "@/lib/separacao";

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
const HOUR_HEIGHT = 128;
const TIME_GUTTER = 64;
const MIN_BLOCK_HEIGHT = 32;
const ALL_DAY_ROW = 24;
const WEEK_COLS = "grid-cols-[64px_repeat(7,minmax(0,1fr))]";

function isClosedBlock(event: CalendarBlock) {
  return event.job.stage === "retorno";
}

function eventTone(event: CalendarBlock) {
  const closed = isClosedBlock(event);
  const overduePickup = event.kind === "pickup" && !closed && needsCloseOut(event.order, event.job);
  if (overduePickup) return "bg-amber-500 text-white border-amber-600";
  const tones: Record<CalendarBlockKind, { live: string; closed: string }> = {
    delivery: {
      live: "bg-emerald-500/35 text-emerald-950 border-emerald-400/70 backdrop-blur-[2px] dark:bg-emerald-400/25 dark:text-emerald-50",
      closed: "bg-emerald-100/80 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200",
    },
    event: {
      live: `${eventColor(event.order.id).span} backdrop-blur-[2px]`,
      closed: eventColor(event.order.id).spanClosed,
    },
    pickup: {
      live: "bg-sky-500/35 text-sky-950 border-sky-400/70 backdrop-blur-[2px] dark:bg-sky-400/25 dark:text-sky-50",
      closed: "bg-sky-100/80 text-sky-800 border-sky-200 dark:bg-sky-950/80 dark:text-sky-200",
    },
  };
  return closed ? tones[event.kind].closed : tones[event.kind].live;
}

function headerBarTone(event: CalendarBlock) {
  const color = eventColor(event.order.id);
  return isClosedBlock(event) ? color.headerClosed : color.header;
}

const KIND_SLOT: Record<CalendarBlockKind, string> = {
  delivery: "left-0.5 right-4 z-[3]",
  event: "left-0.5 right-0.5 z-[1]",
  pickup: "left-4 right-0.5 z-[3]",
};

function kindCaption(event: CalendarBlock) {
  return `${eventTitle(event.order)} ${CALENDAR_KIND_LABEL[event.kind]}`;
}

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2" onPointerDown={(event) => event.stopPropagation()}>
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
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              Início
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
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

function Marker({ color, label, closed }: { color: string; label: string; closed?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", color, closed && "opacity-70")} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function AllDayLane({
  bars,
  onSelect,
  compact,
}: {
  bars: SpanningBar[];
  onSelect: (orderId: string) => void;
  compact?: boolean;
}) {
  const rows = spanningBarRows(bars);
  if (!rows) return null;
  const rowH = compact ? 18 : ALL_DAY_ROW;
  return (
    <div className="col-span-7 grid grid-cols-7 px-px py-0.5" style={{ gridTemplateRows: `repeat(${rows}, ${rowH}px)` }}>
      {bars.map((bar) => (
        <button
          key={bar.event.id}
          type="button"
          onClick={() => onSelect(bar.event.order.id)}
          className={cn(
            "mx-0.5 truncate px-1.5 text-left text-xs font-semibold leading-5 shadow-sm",
            compact ? "leading-4" : "leading-5",
            headerBarTone(bar.event),
            bar.startsBefore ? "rounded-l-sm" : "rounded-l-md",
            bar.endsAfter ? "rounded-r-sm" : "rounded-r-md"
          )}
          style={{
            gridColumn: `${bar.col + 1} / span ${bar.span}`,
            gridRow: bar.row + 1,
          }}
        >
          {eventTitle(bar.event.order)}
        </button>
      ))}
    </div>
  );
}

function nowOffset(now: Date) {
  return ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
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
  const gridRef = useRef<HTMLDivElement>(null);
  const userPausedUntil = useRef(0);
  const [now, setNow] = useState(() => new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const spanning = layoutSpanningBars(events, weekStart, 7);
  const todayInWeek = days.some((day) => sameDay(day, now));
  const nowTop = nowOffset(now);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(tick);
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (!scroller || !grid) return;
    const headerH = (scroller.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    if (todayInWeek) return;
    scroller.scrollTop = headerH + 8 * HOUR_HEIGHT;
  }, [weekStart, todayInWeek]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (!scroller || !grid) return;
    if (!todayInWeek) return;
    if (Date.now() < userPausedUntil.current) return;
    const headerH = (scroller.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    scroller.scrollTop = Math.max(0, headerH + nowTop - scroller.clientHeight / 2);
  }, [weekStart, todayInWeek, nowTop]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-auto rounded-xl border"
      onWheel={() => {
        userPausedUntil.current = Date.now() + 20_000;
      }}
      onPointerDown={() => {
        userPausedUntil.current = Date.now() + 20_000;
      }}
    >
      <div className="sticky top-0 z-10 border-b bg-card">
        <div className={cn("grid text-center text-xs font-medium text-muted-foreground", WEEK_COLS)}>
          <div className="bg-muted/40" />
          {days.map((day, index) => (
            <div key={day.toISOString()} className={cn("bg-muted/40 py-2", sameDay(day, today) && "bg-primary/10 text-foreground")}>
              <div>{WEEKDAYS[index]}</div>
              <div className={cn("text-base font-semibold", sameDay(day, today) && "text-primary")}>{day.getDate()}</div>
            </div>
          ))}
        </div>
        {spanning.length > 0 && (
          <div className={cn("grid border-t bg-card", WEEK_COLS)}>
            <div />
            <AllDayLane bars={spanning} onSelect={onSelect} />
          </div>
        )}
      </div>
      <div ref={gridRef} className={cn("relative grid", WEEK_COLS)}>
        <div>
          {HOURS.map((hour) => (
            <div key={hour} className="border-b pr-2 pt-0.5 text-right text-[13px] font-medium text-muted-foreground" style={{ height: HOUR_HEIGHT }}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayBlocks = blocksOnDay(events, day);
          return (
            <div key={day.toISOString()} className={cn("relative border-l", sameDay(day, today) && "bg-primary/5")}>
              {HOURS.map((hour) => (
                <div key={hour} className="relative border-b border-border/80" style={{ height: HOUR_HEIGHT }}>
                  <div className="absolute left-0 right-0 top-1/4 border-t border-dashed border-border/50" />
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-border/35" />
                  <div className="absolute left-0 right-0 top-3/4 border-t border-dashed border-border/50" />
                </div>
              ))}
              {dayBlocks.map(({ event, clipStart, clipEnd, dayStart }) => {
                const startHour = (clipStart - dayStart) / 3_600_000;
                const endHour = (clipEnd - dayStart) / 3_600_000;
                const top = startHour * HOUR_HEIGHT;
                const rawHeight = (endHour - startHour) * HOUR_HEIGHT;
                const height = Math.max(MIN_BLOCK_HEIGHT, rawHeight);
                const compact = height < 48;
                const closed = isClosedBlock(event);
                const showStart = event.kind === "event" && clipStart <= event.start.getTime();
                const showEnd = event.kind === "event" && clipEnd >= event.end.getTime();
                const continues = event.kind === "event" && clipStart > event.start.getTime();
                const continuesAfter = event.kind === "event" && clipEnd < event.end.getTime();
                const title = eventTitle(event.order);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelect(event.order.id)}
                    className={cn(
                      "absolute overflow-hidden border px-2 text-left text-sm font-semibold leading-snug shadow-sm",
                      compact ? "py-0.5" : "py-1",
                      KIND_SLOT[event.kind],
                      eventTone(event),
                      continues ? "rounded-t-none" : "rounded-t-md",
                      continuesAfter ? "rounded-b-none" : "rounded-b-md"
                    )}
                    style={{ top, height: Math.min(height, 24 * HOUR_HEIGHT - top) }}
                  >
                    {event.kind === "event" ? (
                      compact ? (
                        <Marker
                          color="bg-zinc-900 dark:bg-zinc-100"
                          label={showStart ? `${title} Início` : showEnd ? `${title} Fim` : title}
                          closed={closed}
                        />
                      ) : (
                        <span className="flex h-full flex-col">
                          {showStart ? (
                            <Marker color="bg-zinc-900 dark:bg-zinc-100" label={`${title} Início`} closed={closed} />
                          ) : (
                            <span className="truncate opacity-80">{title}</span>
                          )}
                          <span className="min-h-0 flex-1" />
                          {showEnd && <Marker color="bg-violet-600" label={`${title} Fim`} closed={closed} />}
                        </span>
                      )
                    ) : compact ? (
                      <span className="block truncate">{kindCaption(event)}</span>
                    ) : (
                      <>
                        <span className="block truncate">{kindCaption(event)}</span>
                        <span className="mt-0.5 block truncate text-xs font-medium opacity-80">{formatEventTime(event.start)}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        {todayInWeek && (
          <div className="pointer-events-none absolute z-20" style={{ top: nowTop, left: TIME_GUTTER, right: 0 }}>
            <div className="relative h-0">
              <span className="absolute -left-1.5 top-0 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-sm ring-2 ring-background" />
              <div className="h-[2px] w-full bg-red-500" />
            </div>
          </div>
        )}
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
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(gridStart, i * 7));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1.5">
            {day}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weeks.map((weekStart) => {
          const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
          const spanning = layoutSpanningBars(events, weekStart, 7);
          return (
            <div key={weekStart.toISOString()} className="grid min-h-0 grid-rows-[auto_auto_1fr] border-b">
              <div className="grid grid-cols-7">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "px-1 pt-0.5 text-[10px] font-medium",
                      day.getMonth() !== month && "text-muted-foreground",
                      sameDay(day, today) && "text-primary"
                    )}
                  >
                    {day.getDate()}
                  </div>
                ))}
              </div>
              {spanning.length > 0 && (
                <div className="grid grid-cols-7">
                  <AllDayLane bars={spanning} onSelect={onSelect} compact />
                </div>
              )}
              <div className="grid min-h-0 grid-cols-7">
                {days.map((day) => {
                  const dayBlocks = blocksOnDay(events, day).filter(
                    ({ event }) => event.kind !== "event" || !isMultiDay(event.start, event.end)
                  );
                  const inMonth = day.getMonth() === month;
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-0 overflow-hidden border-r p-0.5",
                        !inMonth && "bg-muted/20 text-muted-foreground",
                        sameDay(day, today) && "bg-primary/5"
                      )}
                    >
                      <div className="space-y-0.5">
                        {dayBlocks.slice(0, 3).map(({ event }) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => onSelect(event.order.id)}
                            className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-xs font-medium", eventTone(event))}
                          >
                            {event.kind === "event"
                              ? `${formatEventTime(event.start)} ${eventTitle(event.order)}`
                              : kindCaption(event)}
                          </button>
                        ))}
                        {dayBlocks.length > 3 && (
                          <p className="px-1 text-[10px] text-muted-foreground">+{dayBlocks.length - 3}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
