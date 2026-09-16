// Adapted from Hyperiux Vault hover-stack — vertical, straight-column variant.
// Colors intentionally removed: the wrapper uses the app's theme tokens only.

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type CSSVars = CSSProperties & Record<string, string | number | undefined>;

export interface HoverStackItem {
  /** Stable key. Use your existing record id. */
  id: string | number;
  /** Your existing card, rendered unchanged. */
  content: ReactNode;
}

export interface HoverStackProps {
  /** Existing cards, in the order they should stack (index 0 = top of the column). */
  items: HoverStackItem[];
  /** Fixed card width in px (the stack is a single column). */
  cardWidth?: number;
  /** Fixed card height in px. Every card in the stack uses the same height. */
  cardHeight?: number;
  /** Visible strip of each card below the one above it, in px. */
  overlap?: number;
  /** How far the hovered card rises (scale + upward nudge), in px. */
  hoverLift?: number;
  /** How far cards above/below the hovered card slide away, in px. */
  pushDistance?: number;
  /** Transition duration in seconds. */
  duration?: number;
  className?: string;
  /** Extra classes applied to every card slot (e.g. shadow tweaks). */
  cardClassName?: string;
}

function HoverStack({
  items,
  cardWidth = 320,
  cardHeight = 200,
  overlap = 72,
  hoverLift = 12,
  pushDistance = 140,
  duration = 0.45,
  className = "",
  cardClassName = "",
}: HoverStackProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false)
  );

  useEffect(() => {
    setHasMounted(true);
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      setReduceMotion(e.matches);
      if (e.matches) setActiveIndex(null);
    };
    setReduceMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Straight column: every card at x = 0, y = index * overlap, rotation = 0.
  const prepared = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        _baseY: index * overlap,
        _baseZ: index + 1,
      })),
    [items, overlap]
  );

  const downPush = Math.max(0, cardHeight - overlap);

  const getCardStyle = (index: number): CSSVars => {
    const card = prepared[index];
    const isActive = activeIndex === index;
    const hasActive = activeIndex !== null;

    let y = card._baseY;
    let zIndex = card._baseZ;
    let scale = 1;

    if (reduceMotion) {
      if (isActive) zIndex = 999;
      return {
        transform: `translate3d(0, ${y}px, 0)`,
        zIndex,
        transition: "none",
      };
    }

    if (hasActive) {
      if (index > activeIndex!) y += downPush;

      if (isActive) {
        zIndex = 999;
        scale = 1.02;
      }
    }

    const ms = Math.max(0, duration) * 1000;
    const transition = isActive
      ? `transform ${ms}ms cubic-bezier(0.22, 1.4, 0.32, 1)`
      : hasActive
        ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : `transform ${ms * 0.7}ms cubic-bezier(0.4, 0, 0.2, 1)`;

    return {
      transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
      zIndex,
      transition,
    };
  };

  const stackHeight =
    (prepared.length > 0 ? prepared[prepared.length - 1]._baseY + cardHeight : cardHeight) +
    (reduceMotion ? 0 : downPush);

  if (!hasMounted) return null;

  // Touch devices: plain vertical list of the same cards, no overlap.
  if (isTouch) {
    return (
      <div className={cn("flex w-full flex-col gap-4", className)}>
        {items.map((item) => (
          <div key={item.id} className={cn("w-full", cardClassName)}>
            {item.content}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)} style={{ minHeight: stackHeight }}>
      <div
        className="relative mx-auto"
        style={{
          width: `${cardWidth}px`,
          height: `${stackHeight}px`,
        }}
        onMouseLeave={() => setActiveIndex(null)}
      >
        {prepared.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "absolute left-0 top-0 origin-top cursor-pointer select-none will-change-transform",
              "[&>*]:h-full [&>*]:w-full",
              cardClassName
            )}
            style={{
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
              ...getCardStyle(index),
            }}
            onMouseEnter={() => setActiveIndex(index)}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default HoverStack;
