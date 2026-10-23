"use client";
import { useState } from "react";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import { PRESETS, WEEKS } from "@/components/finance/PnlStory";
import { cn } from "@/lib/utils";
import { OutletCount, OutletFilters, useOutletFilter } from "./OutletFilters";

// Pieces MVP 2's reports share with the P&L Summary: the outlet filters + date bar that scopes the whole page,
// a row of stat tiles, and a section card. Same chips, same weeks, so every page reads the same period.

const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The page's scope: the outlets the filters leave (all when unfiltered, maybe none) and a run of the P&L's weeks. */
export function useScope(preset = 0) {
  const [range, setRange] = useState<[number, number]>(PRESETS[preset].range);
  const outlets = useOutletFilter(range);
  const stores = outlets.stores;
  const [a, b] = range;
  const len = b - a + 1;
  const prev: [number, number] | null = a > 0 ? [Math.max(0, a - len), a - 1] : null;
  const label = `${fmtDay(WEEKS[a].start)} – ${fmtDay(new Date(WEEKS[b].start.getTime() + 6 * 86_400_000))}`;
  return { outlets, range, setRange, stores, prev, label };
}
export type Scope = ReturnType<typeof useScope>;

/** The outlet filters and Date chip on their own, for toolbars that hold more (ops' Chargebacks). */
export function ScopeChips({ scope }: { scope: Scope }) {
  return (
    <>
      <OutletFilters scope={scope.outlets} />
      <DateRangeFilter weeks={WEEKS} presets={PRESETS} value={scope.range} onChange={scope.setRange} />
    </>
  );
}

/** Outlets and Date, then anything page-specific, with the covered dates on the right. */
export function ScopeBar({ scope, children }: { scope: Scope; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
      <ScopeChips scope={scope} />
      {children}
      <span className="ml-auto flex items-center gap-2 text-body-sm text-(--color-text-tertiary) tabular-nums">
        <OutletCount scope={scope.outlets} />
        {scope.label}
      </span>
    </div>
  );
}

/** Change against the period before, coloured by whether up is good. */
export function Delta({ now, before, goodWhenUp = true, points = false }: { now: number; before?: number; goodWhenUp?: boolean; points?: boolean }) {
  if (before === undefined) return null;
  const d = points ? (now - before) * 100 : before ? ((now - before) / Math.abs(before)) * 100 : 0;
  if (Math.abs(d) < 0.05) return <span className="text-body-sm text-(--color-text-secondary)">No change</span>;
  return (
    <span className={cn("text-body-sm tabular-nums", d > 0 === goodWhenUp ? "text-(--color-text-success)" : "text-(--color-text-danger)")}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}
      {points ? " pts" : "%"}
    </span>
  );
}

export type Stat = { label: string; value: React.ReactNode; tone?: "success" | "danger"; sub?: React.ReactNode; delta?: React.ReactNode };

/** A row of figures in the P&L cards' tray: grey surround, white tiles. */
export function StatRow({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <section aria-label={label} className="grid gap-1.5 rounded-large bg-(--gray-300) p-1.5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col justify-between gap-3 rounded-medium bg-(--color-background-secondary) p-4">
          <p className="text-body-sm text-(--color-text-secondary)">{s.label}</p>
          <div>
            <p className={cn("text-jumbo-sm tabular-nums", s.tone === "success" ? "text-(--color-text-success)" : s.tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{s.value}</p>
            {(s.sub || s.delta) && (
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-body-sm text-(--color-text-secondary)">
                {s.delta}
                {s.sub && <span>{s.sub}</span>}
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

/** A report section: title and one-line purpose, controls on the right. */
export function Section({ title, sub, actions, children, className }: { title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-large border border-(--color-border-default) bg-(--color-background-secondary)", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>
          {sub && <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** A colour swatch and name, for chart legends. */
export function Key({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
      <span aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} />
      {children}
    </span>
  );
}
