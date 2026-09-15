import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function TimeSelect({
  value,
  onChange,
  required,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hoursRef = useRef<HTMLDivElement>(null);
  const [hour = "", minute = ""] = value.split(":");
  const minuteValue = minute.slice(0, 2);
  const extraMinute = minuteValue && !MINUTES.includes(minuteValue) ? minuteValue : null;
  const minuteOptions = extraMinute ? [extraMinute, ...MINUTES] : MINUTES;

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      hoursRef.current?.querySelector("[data-selected='true']")?.scrollIntoView({ block: "center" });
    }, 30);
    return () => window.clearTimeout(id);
  }, [open, hour]);

  const commit = (nextHour: string, nextMinute: string, close = false) => {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    onChange(`${nextHour || "00"}:${nextMinute || "00"}`);
    if (close && nextHour && nextMinute) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="tabular-nums">{value || "Hora"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-[72px_64px] gap-2">
          <div>
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hora</p>
            <div ref={hoursRef} className="h-48 overflow-y-auto rounded-md border">
              {HOURS.map((option) => (
                <button
                  key={option}
                  type="button"
                  data-selected={hour === option || undefined}
                  onClick={() => commit(option, minuteValue || "00")}
                  className={cn(
                    "flex h-8 w-full items-center justify-center text-sm tabular-nums hover:bg-muted",
                    hour === option && "bg-primary text-primary-foreground hover:bg-primary"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Min</p>
            <div className="rounded-md border">
              {minuteOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => commit(hour || "10", option, true)}
                  className={cn(
                    "flex h-8 w-full items-center justify-center text-sm tabular-nums hover:bg-muted",
                    minuteValue === option && "bg-primary text-primary-foreground hover:bg-primary"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
      <input tabIndex={-1} className="sr-only" value={value} required={required} readOnly aria-hidden />
    </Popover>
  );
}
