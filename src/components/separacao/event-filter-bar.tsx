import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { eventColor, eventTitle } from "@/lib/separacao";
import type { Order } from "@/types/database";

interface EventFilterBarProps {
  orders: Order[];
  hiddenIds: Set<string>;
  onToggle: (orderId: string) => void;
}

export function EventFilterBar({ orders, hiddenIds, onToggle }: EventFilterBarProps) {
  if (orders.length === 0) return null;
  return (
    <div
      className="flex shrink-0 gap-3 overflow-x-auto pb-1"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {orders.map((order) => {
        const visible = !hiddenIds.has(order.id);
        const color = eventColor(order.id);
        return (
          <button
            key={order.id}
            type="button"
            onClick={() => onToggle(order.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
              visible ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                visible ? `${color.swatch} border-transparent text-white` : "border-muted-foreground/40 bg-transparent"
              )}
            >
              {visible && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className="whitespace-nowrap">{eventTitle(order)}</span>
          </button>
        );
      })}
    </div>
  );
}
