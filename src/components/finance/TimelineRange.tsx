"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { cn } from "@/lib/utils";

// A week ruler with a draggable range (after Mercury's transactions timeline): a tick per week, a taller
// tick and month name where a month starts, the year over January. Drag the range to move it, drag its
// handles to resize it, click a week to move the range there. The label opens quick presets.
// Arrow keys move the range a week; Shift+arrows resize its end.

const WEEK_PX = 14;

export type TimelineWeek = { start: Date; label: string };
export type Preset = { label: string; range: [number, number] };

export function TimelineRange({ weeks, value, onChange, presets, label }: { weeks: TimelineWeek[]; value: [number, number]; onChange: (v: [number, number]) => void; presets: Preset[]; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "from" | "to"; x: number; from: number; to: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));
  const [a, b] = value;
  const last = weeks.length - 1;

  // Open on the latest weeks.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const clamp = (from: number, to: number): [number, number] => {
    const len = to - from;
    if (from < 0) return [0, len];
    if (to > last) return [last - len, last];
    return [from, to];
  };
  // The range and its two handles share one handler; data-mode says which was grabbed.
  const onDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: e.currentTarget.dataset.mode as "move" | "from" | "to", x: e.clientX, from: a, to: b };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dw = Math.round((e.clientX - d.x) / WEEK_PX);
    if (d.mode === "move") onChange(clamp(d.from + dw, d.to + dw));
    else if (d.mode === "from") onChange([Math.max(0, Math.min(d.to, d.from + dw)), d.to]);
    else onChange([d.from, Math.min(last, Math.max(d.from, d.to + dw))]);
  };
  const onUp = () => (drag.current = null);
  const onTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    const w = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / WEEK_PX);
    onChange(clamp(w - (b - a), w));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    if (e.shiftKey) onChange([a, Math.min(last, Math.max(a, b + step))]);
    else onChange(clamp(a + step, b + step));
  };

  const scrollBtn = "absolute top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) shadow-[0_2px_8px_rgb(0_0_0/0.08)] outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

  return (
    <div className="flex items-center gap-3">
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="flex h-9 items-center gap-2 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-md text-(--color-text-primary) tabular-nums outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
        >
          <Calendar aria-hidden className="size-4 text-(--color-text-secondary)" />
          {label}
          <ChevronDown aria-hidden className="size-3.5 text-(--color-text-secondary)" />
        </button>
        {menu && (
          <div role="menu" className="absolute top-full left-0 z-30 mt-1 w-52 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-[0_8px_24px_rgb(0_0_0/0.10)]">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(p.range);
                  setMenu(false);
                }}
                className={cn("block w-full rounded-medium px-3 py-2 text-left text-body-md hover:bg-(--color-neutral-lightest)", p.range[0] === a && p.range[1] === b ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)")}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative min-w-0 flex-1">
        <button type="button" aria-label="Scroll left" onClick={() => scroller.current?.scrollBy({ left: -280, behavior: "smooth" })} className={cn(scrollBtn, "-left-1")}>
          <ChevronLeft className="size-4" />
        </button>
        <div ref={scroller} className="overflow-x-auto pr-12 pl-9 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_40px,black_calc(100%-40px),transparent)]">
          <div className="relative h-12 cursor-pointer select-none" style={{ width: weeks.length * WEEK_PX }} onClick={onTrack}>
            {weeks.map((w, i) => {
              const monthStart = i === 0 || w.start.getUTCMonth() !== weeks[i - 1].start.getUTCMonth();
              const yearStart = monthStart && (i === 0 || w.start.getUTCFullYear() !== weeks[i - 1].start.getUTCFullYear());
              return (
                <div key={i} className="absolute bottom-0" style={{ left: i * WEEK_PX }}>
                  {yearStart && <span className="absolute bottom-7 left-0 text-[11px] font-medium text-(--color-text-secondary)">{w.start.getUTCFullYear()}</span>}
                  {monthStart && <span className="absolute bottom-3.5 left-0 text-[11px] text-(--color-text-tertiary)">{w.start.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}</span>}
                  <span className={cn("absolute bottom-0 left-0 w-px", monthStart ? "h-3 bg-(--color-border-darker)" : "h-1.5 bg-(--color-border-default)")} />
                </div>
              );
            })}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Selected weeks"
              aria-valuemin={0}
              aria-valuemax={last}
              aria-valuenow={b}
              aria-valuetext={label}
              data-mode="move"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKey}
              className="absolute inset-y-0 cursor-grab rounded-medium border border-(--brand-700) bg-(--brand-200)/70 outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
              style={{ left: a * WEEK_PX, width: (b - a + 1) * WEEK_PX }}
            >
              {(["from", "to"] as const).map((edge) => (
                <span
                  key={edge}
                  aria-hidden
                  data-mode={edge}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  className={cn("absolute top-1/2 grid h-6 w-3 -translate-y-1/2 cursor-ew-resize place-items-center", edge === "from" ? "-left-1.5" : "-right-1.5")}
                >
                  <span className="h-5 w-1.5 rounded-circle border border-(--brand-700) bg-(--color-background-secondary)" />
                </span>
              ))}
            </div>
          </div>
        </div>
        <button type="button" aria-label="Scroll right" onClick={() => scroller.current?.scrollBy({ left: 280, behavior: "smooth" })} className={cn(scrollBtn, "-right-1")}>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
