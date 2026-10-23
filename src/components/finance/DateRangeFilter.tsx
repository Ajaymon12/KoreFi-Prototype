"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";
import type { Preset, TimelineWeek } from "./TimelineRange";

// The P&L's Date filter (Mobbin: Quicken / Fresha / Bonsai report date pickers). One chip; its menu has
// the presets on the left (a click applies and closes) and a custom range on the right: start and end
// fields over a two-month calendar, applied with Apply. The reports arrive by the week, so a custom
// range rounds out to the whole weeks it touches, and the menu says which weeks that is before you apply.

const DAY = 86_400_000;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const fmt = (d: Date, year = false) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year && { year: "numeric" }), timeZone: "UTC" });
const monthName = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function DateRangeFilter({ weeks, presets, value, onChange }: { weeks: TimelineWeek[]; presets: Preset[]; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  // The menu opens under the chip's left edge; when that runs past the window (a wide calendar, a chip far
  // along the bar) it slides left until it fits. Re-measured when the calendar's width changes (custom range).
  const menu = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    if (!open) return setShift(0);
    const el = menu.current;
    const r = el?.getBoundingClientRect();
    if (!el || !r) return;
    const room = document.documentElement.clientWidth - 8;
    const natural = r.right - shift;
    setShift(natural > room ? Math.max(room - natural, 8 - (r.left - shift)) : 0);
  }, [open, custom]);

  const first = utcDay(weeks[0].start);
  const last = utcDay(weeks[weeks.length - 1].start) + 6 * DAY;
  /** The week a day falls in (days past a year's last week belong to it). */
  const weekOf = (t: number) => {
    let i = weeks.length - 1;
    while (i > 0 && utcDay(weeks[i].start) > t) i--;
    return i;
  };
  const rangeText = ([a, b]: [number, number]) => `${fmt(weeks[a].start)} – ${fmt(new Date(utcDay(weeks[b].start) + 6 * DAY), weeks[a].start.getUTCFullYear() !== weeks[b].start.getUTCFullYear())}`;

  const preset = presets.find((p) => p.range[0] === value[0] && p.range[1] === value[1]);
  const isDefault = preset === presets[0];

  // Custom draft: picked days, and which month the left calendar shows.
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const endOfValue = new Date(utcDay(weeks[value[1]].start) + 6 * DAY);
  const [view, setView] = useState({ y: endOfValue.getUTCFullYear(), m: endOfValue.getUTCMonth() - 1 });

  const openMenu = () => {
    setOpen((o) => !o);
    setCustom(!preset);
    setStart(utcDay(weeks[value[0]].start));
    setEnd(utcDay(weeks[value[1]].start) + 6 * DAY);
    setView({ y: endOfValue.getUTCFullYear(), m: endOfValue.getUTCMonth() - 1 });
  };
  const pick = (p: Preset) => {
    onChange(p.range);
    setOpen(false);
  };
  const clickDay = (t: number) => {
    setCustom(true);
    if (start === null || end !== null) {
      setStart(t);
      setEnd(null);
    } else if (t < start) setStart(t);
    else setEnd(t);
  };
  const lo = start;
  const hi = end ?? (start !== null && hover !== null && hover >= start ? hover : start);
  const draft: [number, number] | null = lo !== null && hi !== null ? [weekOf(lo), weekOf(hi)] : null;
  const apply = () => {
    if (!draft) return;
    onChange(draft);
    setOpen(false);
  };

  const month = (y: number, m: number) => {
    const d0 = new Date(Date.UTC(y, m, 1));
    const lead = d0.getUTCDay();
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return (
      <div className="w-[224px]">
        <p className="mb-2 text-center text-subtitle-xs text-(--color-text-primary)">{monthName(d0.getUTCFullYear(), d0.getUTCMonth())}</p>
        <div className="grid grid-cols-7 text-center text-body-sm text-(--color-text-tertiary)">
          {DOW.map((d, i) => (
            <span key={i} className="h-7 leading-7">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
          {Array.from({ length: lead }, (_, i) => (
            <span key={`x${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const t = Date.UTC(y, m, i + 1);
            const off = t < first || t > last;
            const edge = t === lo || t === hi;
            const inside = lo !== null && hi !== null && t > lo && t < hi;
            // The days the weekly reports will add, outside what was picked, shown faintly.
            const rounded = !edge && !inside && draft && t >= utcDay(weeks[draft[0]].start) && t <= utcDay(weeks[draft[1]].start) + 6 * DAY;
            return (
              <button
                key={i}
                type="button"
                disabled={off}
                onClick={() => clickDay(t)}
                onMouseEnter={() => setHover(t)}
                aria-pressed={edge || inside}
                aria-label={fmt(new Date(t), true)}
                className={cn(
                  "h-8 text-body-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:text-(--color-text-tertiary) disabled:opacity-40",
                  edge ? "rounded-small bg-(--color-primary-solid) font-medium text-white" : inside ? "bg-(--module-tint) text-(--color-text-primary)" : rounded ? "bg-(--gray-200) text-(--color-text-secondary)" : "rounded-small text-(--color-text-primary) enabled:hover:bg-(--color-neutral-light)",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  const next = { y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 };
  // Arrows stop where the reports do: the left month can't start past the first, nor the right month past the last.
  const firstMonth = new Date(first).getUTCFullYear() * 12 + new Date(first).getUTCMonth();
  const lastMonth = new Date(last).getUTCFullYear() * 12 + new Date(last).getUTCMonth() - 1;
  const canShift = (n: number) => (n < 0 ? view.y * 12 + view.m > firstMonth : view.y * 12 + view.m < lastMonth);
  const jump = (n: number) => {
    // A year jump that would overshoot lands on the first or last month instead.
    const at = Math.min(Math.max(view.y * 12 + view.m + n, firstMonth), Math.max(lastMonth, firstMonth));
    setView({ y: Math.floor(at / 12), m: at % 12 });
  };
  const nav = (n: number, label: string, Icon: typeof ChevronLeft) => (
    <button type="button" onClick={() => jump(n)} disabled={!canShift(n)} aria-label={label} className="grid size-6 place-items-center rounded-small text-(--color-text-secondary) enabled:hover:bg-(--color-neutral-light) disabled:opacity-30">
      <Icon aria-hidden className="size-4" />
    </button>
  );
  const field = (label: string, t: number | null, active: boolean) => (
    <div className={cn("flex h-11 flex-1 flex-col justify-center rounded-medium border px-3", active ? "border-(--color-focus-primary)" : "border-(--color-border-default)")}>
      <span className="text-[11px] text-(--color-text-tertiary)">{label}</span>
      <span className={cn("text-body-md tabular-nums", t === null ? "text-(--color-text-tertiary)" : "text-(--color-text-primary)")}>{t === null ? "Pick a day" : fmt(new Date(t), true)}</span>
    </div>
  );

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openMenu}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-medium border px-2.5 text-menu-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          isDefault ? "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)" : "border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-primary)",
        )}
      >
        <CalendarDays aria-hidden className="size-3.5" />
        {preset ? preset.label : rangeText(value)}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div ref={menu} role="dialog" aria-label="Date range" style={{ translate: shift ? `${shift}px 0` : undefined }} className="absolute top-full left-0 z-30 mt-1.5 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)] sm:flex-row">
          {/* Presets */}
          <ul className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-(--color-border-default) p-1.5 sm:w-44 sm:flex-col sm:border-r sm:border-b-0">
            {presets.map((p) => {
              const on = !custom && preset === p;
              return (
                <li key={p.label}>
                  <button type="button" onClick={() => pick(p)} className={cn("flex h-8 w-full items-center gap-2 rounded-small px-2 text-left text-body-md whitespace-nowrap", on ? "bg-(--color-neutral-lightest) font-medium text-(--color-text-primary)" : "text-(--color-text-primary) hover:bg-(--color-neutral-lightest)")}>
                    <Check aria-hidden className={cn("size-3.5 shrink-0", on ? "opacity-100" : "opacity-0")} />
                    {p.label}
                  </button>
                </li>
              );
            })}
            <li className="sm:mt-auto sm:border-t sm:border-(--color-border-default) sm:pt-1">
              <button type="button" onClick={() => setCustom(true)} className={cn("flex h-8 w-full items-center gap-2 rounded-small px-2 text-left text-body-md whitespace-nowrap", custom ? "bg-(--color-neutral-lightest) font-medium text-(--color-text-primary)" : "text-(--color-text-primary) hover:bg-(--color-neutral-lightest)")}>
                <Check aria-hidden className={cn("size-3.5 shrink-0", custom ? "opacity-100" : "opacity-0")} />
                Custom range
              </button>
            </li>
          </ul>

          {/* Custom range */}
          <div className="p-4">
            <div className="flex items-center gap-2">
              {field("Start", start, custom && end !== null ? false : custom && start === null)}
              <span aria-hidden className="text-(--color-text-tertiary)">→</span>
              {field("End", end, custom && start !== null && end === null)}
            </div>
            <div className="relative mt-4 flex gap-6">
              <div className="absolute top-0 left-0 flex">
                {nav(-12, "Previous year", ChevronsLeft)}
                {nav(-1, "Previous month", ChevronLeft)}
              </div>
              <div className="absolute top-0 right-0 flex">
                {nav(1, "Next month", ChevronRight)}
                {nav(12, "Next year", ChevronsRight)}
              </div>
              {month(view.y, view.m)}
              <div className="hidden lg:block">{month(next.y, next.m)}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-default) pt-3">
              <p className="text-body-sm text-(--color-text-secondary)">
                {draft ? (
                  <>
                    Reports are weekly, so this covers <span className="font-medium text-(--color-text-primary) tabular-nums">{rangeText(draft)}</span>
                  </>
                ) : (
                  "Pick a start and an end day"
                )}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={close} className="h-8 rounded-medium border border-(--color-border-default) px-3 text-body-sm text-(--color-text-primary) hover:bg-(--color-neutral-lightest)">
                  Cancel
                </button>
                <button type="button" onClick={apply} disabled={!draft || end === null} className="h-8 rounded-medium bg-(--color-primary-solid) px-3 text-body-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
