"use client";
import { useCallback, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PERIOD } from "@/lib/period";
import { useDismiss } from "./useDismiss";

// Date range filter: preset list + two-month range calendar + Apply, after the Calendly /
// Shopify / Vimeo pickers on Mobbin. UI state only for now — the mock data behind the cards
// is a single fixed period, so applying a range updates the label but not the figures.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;
const at = (y: number, m: number, d: number) => new Date(y, m, d, 12);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
const short = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const full = (d: Date) => `${short(d)} ${d.getFullYear()}`;
const rangeLabel = (a: Date, b: Date) => (a.getFullYear() === b.getFullYear() ? `${short(a)} – ${full(b)}` : `${full(a)} – ${full(b)}`);

// The latest complete reporting day; later days can't be picked.
const [ey, em, ed] = PERIOD.end.split("-").map(Number);
const LATEST = at(ey, em - 1, ed);

type Range = { start: Date; end: Date };
type Preset = { key: string; label: string; range: () => Range };
const PRESETS: Preset[] = [
  { key: "7d", label: "Last 7 days", range: () => ({ start: addDays(LATEST, -6), end: LATEST }) },
  { key: "14d", label: "Last 14 days", range: () => ({ start: addDays(LATEST, -13), end: LATEST }) },
  { key: "30d", label: "Last 30 days", range: () => ({ start: addDays(LATEST, -29), end: LATEST }) },
  { key: "90d", label: "Last 90 days", range: () => ({ start: addDays(LATEST, -89), end: LATEST }) },
  { key: "mtd", label: "This month", range: () => ({ start: at(LATEST.getFullYear(), LATEST.getMonth(), 1), end: LATEST }) },
  { key: "lm", label: "Last month", range: () => ({ start: at(LATEST.getFullYear(), LATEST.getMonth() - 1, 1), end: at(LATEST.getFullYear(), LATEST.getMonth(), 0) }) },
];
const presetFor = (r: Range) => PRESETS.find((p) => same(p.range().start, r.start) && same(p.range().end, r.end));

function Month({ year, month, draft, hover, onPick, onHover }: { year: number; month: number; draft: { start: Date; end: Date | null }; hover: Date | null; onPick: (d: Date) => void; onHover: (d: Date | null) => void }) {
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const end = draft.end ?? hover;
  const [lo, hi] = end && end < draft.start ? [end, draft.start] : [draft.start, end];
  return (
    <div className="w-[238px]">
      <div className="grid grid-cols-7 text-center text-body-sm text-(--color-text-secondary)">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d} className="grid h-8 place-items-center">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = at(year, month, i + 1);
          const disabled = date > LATEST;
          const isEdge = same(date, draft.start) || (!!draft.end && same(date, draft.end));
          const inRange = !!lo && !!hi && date >= lo && date <= hi;
          return (
            <span key={i} className={cn("grid h-8 place-items-center", inRange && "bg-(--brand-400)", lo && same(date, lo) && "rounded-l-medium", hi && same(date, hi) && "rounded-r-medium")}>
              <button
                type="button"
                disabled={disabled}
                aria-label={date.toDateString()}
                aria-pressed={isEdge}
                onClick={() => onPick(date)}
                onMouseEnter={() => onHover(date)}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "grid size-8 place-items-center rounded-medium text-body-md tabular-nums transition-colors",
                  isEdge ? "bg-(--color-primary-solid) text-(--color-text-inverse-primary)" : "text-(--color-text-primary) hover:bg-(--color-neutral-light)",
                  disabled && "pointer-events-none text-(--color-text-disabled)",
                )}
              >
                {i + 1}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangeFilter() {
  const initial = PRESETS.find((p) => p.key === "30d")!.range();
  const [applied, setApplied] = useState<Range>(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: Date; end: Date | null }>(initial);
  const [hover, setHover] = useState<Date | null>(null);
  const [view, setView] = useState({ y: LATEST.getFullYear(), m: LATEST.getMonth() - 1 }); // left month
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  const openPicker = () => {
    setDraft(applied);
    setHover(null);
    const s = applied.start;
    // show the start month on the left, but never push the right month past the latest day
    const left = new Date(s.getFullYear(), s.getMonth(), 1);
    const maxLeft = new Date(LATEST.getFullYear(), LATEST.getMonth() - 1, 1);
    const l = left > maxLeft ? maxLeft : left;
    setView({ y: l.getFullYear(), m: l.getMonth() });
    setOpen((o) => !o);
  };

  const pick = (d: Date) => {
    if (!draft.end) {
      setDraft(d < draft.start ? { start: d, end: draft.start } : { start: draft.start, end: d });
    } else {
      setDraft({ start: d, end: null });
    }
  };
  const shift = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const right = new Date(view.y, view.m + 1, 1);
  const canNext = new Date(right.getFullYear(), right.getMonth() + 1, 1) <= LATEST;

  const complete = draft.end ? { start: draft.start, end: draft.end } : null;
  const draftPreset = complete ? presetFor(complete) : undefined;
  const appliedPreset = presetFor(applied);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        className="flex h-9 items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-md text-(--color-text-primary) transition-colors hover:bg-(--color-neutral-lightest) aria-expanded:bg-(--color-neutral-lightest)"
      >
        <CalendarDays className="size-4 text-(--color-text-secondary)" />
        <span className="font-medium">{appliedPreset?.label ?? "Custom"}</span>
        <span className="hidden text-(--color-text-secondary) sm:inline">{rangeLabel(applied.start, applied.end)}</span>
        <ChevronDown className={cn("size-4 text-(--color-text-secondary) transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="dialog" aria-label="Date range" className="absolute top-full right-0 z-30 mt-2 flex w-max max-w-[calc(100vw-3rem)] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
          <ul className="w-40 shrink-0 space-y-0.5 border-r border-(--color-border-default) p-2">
            {PRESETS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => {
                    const r = p.range();
                    setDraft(r);
                    const maxLeft = new Date(LATEST.getFullYear(), LATEST.getMonth() - 1, 1);
                    const left = new Date(r.start.getFullYear(), r.start.getMonth(), 1);
                    const l = left > maxLeft ? maxLeft : left;
                    setView({ y: l.getFullYear(), m: l.getMonth() });
                  }}
                  className={cn("flex h-8 w-full items-center rounded-medium px-2.5 text-menu-md transition-colors", draftPreset?.key === p.key ? "bg-(--brand-400) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)")}
                >
                  {p.label}
                </button>
              </li>
            ))}
            <li>
              <span className={cn("flex h-8 items-center rounded-medium px-2.5 text-menu-md", !draftPreset ? "bg-(--brand-400) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)")}>Custom range</span>
            </li>
          </ul>

          <div className="p-4">
            <div className="flex gap-6">
              {[new Date(view.y, view.m, 1), right].map((m, i) => (
                <div key={i}>
                  <div className="mb-1 flex h-8 items-center justify-between">
                    {i === 0 ? (
                      <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light)">
                        <ChevronLeft className="size-4" />
                      </button>
                    ) : (
                      <span className="size-8" />
                    )}
                    <span className="text-body-md font-medium text-(--color-text-primary)">
                      {MONTHS[m.getMonth()]} {m.getFullYear()}
                    </span>
                    {i === 1 ? (
                      <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => shift(1)} className="grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light) disabled:opacity-40">
                        <ChevronRight className="size-4" />
                      </button>
                    ) : (
                      <span className="size-8" />
                    )}
                  </div>
                  <Month year={m.getFullYear()} month={m.getMonth()} draft={draft} hover={draft.end ? null : hover} onPick={pick} onHover={setHover} />
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-(--color-border-default) pt-3">
              <p className="text-body-sm text-(--color-text-secondary)">
                {complete ? (
                  <>
                    <span className="text-(--color-text-primary)">{rangeLabel(complete.start, complete.end)}</span> · {days(complete.start, complete.end)} days
                  </>
                ) : (
                  "Pick an end date"
                )}
              </p>
              <div className="flex gap-2">
                <Button size="small" onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  size="small"
                  disabled={!complete}
                  onClick={() => {
                    if (complete) setApplied(complete);
                    close();
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
