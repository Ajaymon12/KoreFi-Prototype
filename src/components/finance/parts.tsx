"use client";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/dashboard/ChargebackCharts";
import type { MonthPoint } from "@/lib/finance/books";

// Small pieces shared by the P&L and Balance summary pages.

/** Whole dollars with a true minus sign. */
export const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}`;

/** "$ change" cell. `goodWhenUp` is false for costs, where an increase is the worse outcome. */
export function ChangeAmount({ now, before, goodWhenUp = true }: { now: number; before: number; goodWhenUp?: boolean }) {
  const d = now - before;
  if (Math.abs(d) < 1) return <span className="text-(--color-text-secondary)">–</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  return (
    <span className={good ? "text-(--color-text-success)" : "text-(--color-text-danger)"}>
      {signed(d)}${Math.abs(Math.round(d)).toLocaleString("en-US")}
    </span>
  );
}

export function ChangePct({ now, before, goodWhenUp = true }: { now: number; before: number; goodWhenUp?: boolean }) {
  if (!before) return <span className="text-(--color-text-secondary)">–</span>;
  const d = (now - before) / Math.abs(before);
  if (Math.abs(d) < 0.0005) return <span className="text-(--color-text-secondary)">0.0%</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  return (
    <span className={good ? "text-(--color-text-success)" : "text-(--color-text-danger)"}>
      {signed(d)}
      {Math.abs(d * 100).toFixed(1)}%
    </span>
  );
}

/** One cell for "vs last year": "+$1,200 · +8.2%" in a single colour, so the eye reads one thing. */
export function ChangeBoth({ now, before, goodWhenUp = true }: { now: number; before: number; goodWhenUp?: boolean }) {
  const d = now - before;
  if (Math.abs(d) < 1) return <span className="text-(--color-text-secondary)">No change</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  const p = before ? ` · ${signed(d)}${Math.abs((d / Math.abs(before)) * 100).toFixed(1)}%` : "";
  const Arrow = d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center justify-end gap-1", good ? "text-(--color-text-success)" : "text-(--color-text-danger)")}>
      <Arrow aria-hidden className="size-3.5" />
      {signed(d)}${Math.abs(Math.round(d)).toLocaleString("en-US")}
      {p}
    </span>
  );
}

export type HundredPart = { key: string; label: string; value: number; color: string; hint?: string };

/** "Where every $100 of sales went": one stacked bar, then each part with its dollars per $100. */
export function HundredBar({ parts, total, legendClassName = "sm:grid-cols-2 xl:grid-cols-5" }: { parts: HundredPart[]; total: number; /** Legend columns; fewer in a narrow card. */ legendClassName?: string }) {
  const per = (v: number) => (total ? (Math.max(v, 0) / total) * 100 : 0);
  return (
    <div>
      <div className="flex h-9 gap-0.5 overflow-hidden rounded-medium" role="img" aria-label={`Where every $100 of sales went: ${parts.map((p) => `${p.label} $${per(p.value).toFixed(0)}`).join(", ")}`}>
        {parts.map((p) => (
          <Tip key={p.key} className="flex h-full items-center justify-center" style={{ width: `${per(p.value)}%`, background: p.color }} content={<>{p.label}: ${per(p.value).toFixed(2)} of every $100</>}>
            {per(p.value) >= 9 && <span className="text-body-sm font-medium text-white tabular-nums">${per(p.value).toFixed(0)}</span>}
          </Tip>
        ))}
      </div>
      <ul className={cn("mt-4 grid gap-x-6 gap-y-2.5", legendClassName)}>
        {parts.map((p) => (
          <li key={p.key} className="min-w-0">
            <p className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: p.color }} />
              <span className="truncate">{p.label}</span>
            </p>
            <p className="text-body-lg text-(--color-text-primary) tabular-nums">${per(p.value).toFixed(0)}<span className="text-body-sm text-(--color-text-secondary)"> per $100</span></p>
            {p.hint && <p className="text-body-sm text-(--color-text-secondary)">{p.hint}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sentence for a stat tile: "+8.2% vs same period last year". */
export function vsLastYear(now: number, before: number, label = "same period last year") {
  if (!before) return `No ${label} to compare`;
  const d = (now - before) / Math.abs(before);
  return `${signed(d)}${Math.abs(d * 100).toFixed(1)}% vs ${label}`;
}

/** Quiet download button; exports are reads, not owner tasks. */
export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-menu-sm text-(--color-text-secondary) outline-none transition-colors hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
    >
      <Download className="size-3.5" />
      Export CSV
    </button>
  );
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** Segmented control for a small fixed set of choices. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 items-center rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "h-full rounded-small px-2.5 text-menu-sm whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
            value === o.key ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const compact = (n: number) => (Math.abs(n) >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${n}`);

/** Round the top of the scale up to a tidy number and split it into four steps. */
function niceScale(max: number) {
  const raw = Math.max(max, 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  return { step, top: step * 4 };
}

/** Grouped monthly bars: dashed gridlines with a $ axis, rounded tops, two series side by side and a
 *  legend top-right. Hovering a month dims the rest and opens a card with both numbers. Hand-built
 *  (no chart library), like the other charts here. */
export function MonthBars({ points, valueLabel, compareLabel, ariaLabel }: { points: MonthPoint[]; valueLabel: string; compareLabel: string; ariaLabel: string }) {
  const { step, top } = niceScale(Math.max(...points.flatMap((p) => [p.value, p.compare])));
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const bar = (v: number) => ({ height: `${(Math.max(v, 0) / top) * 100}%` });
  return (
    <div>
      <div className="mb-4 flex justify-end gap-4 text-body-sm text-(--color-text-secondary)">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-(--chart-series)" />
          {valueLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-(--chart-track)" />
          {compareLabel}
        </span>
      </div>
      <div className="flex gap-2">
        <div aria-hidden className="relative h-48 w-9 shrink-0 text-body-sm text-(--color-text-secondary) tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="group/bars relative h-48" role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <span key={t} aria-hidden className="absolute inset-x-0 border-t border-dashed border-(--color-border-default)" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="relative flex h-full items-end gap-1.5 px-1">
              {points.map((p, i) => (
                <Tip
                  key={p.label}
                  align={i < 3 ? "left" : i >= points.length - 3 ? "right" : "center"}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-[3px] transition-opacity group-hover/bars:[&:not(:hover)]:opacity-40"
                  content={
                    <>
                      <span className="block font-medium">{p.label}</span>
                      <span className="mt-1 flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-(--color-text-secondary)"><span className="size-2 rounded-[2px] bg-(--chart-series)" />{valueLabel}</span>
                        <span className="tabular-nums">{usd(p.value)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-(--color-text-secondary)"><span className="size-2 rounded-[2px] bg-(--chart-track)" />{compareLabel}</span>
                        <span className="tabular-nums">{usd(p.compare)}</span>
                      </span>
                    </>
                  }
                >
                  <span className="block w-full max-w-[18px] rounded-t-[4px] bg-(--chart-series)" style={bar(p.value)} />
                  <span className="block w-full max-w-[18px] rounded-t-[4px] bg-(--chart-track)" style={bar(p.compare)} />
                </Tip>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-1.5 px-1 text-body-sm text-(--color-text-secondary)">
            {points.map((p) => (
              <span key={p.label} className="flex-1 text-center">
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
