"use client";
import { useId } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/dashboard/ChargebackCharts";
import { ChangePct } from "@/components/finance/parts";

// Chart pieces for the MVP reports, after Mercury's Books overview: a big number with its change,
// a sparkline for the trend, paired bars for money in vs out, and ranked rows with a thin bar for
// "where it came from". The headline series is always the brand colour; everything around it is
// neutral or a soft red, so the eye lands on the main number first.

export const BRAND = "var(--color-primary-solid)";

/** A bordered surface for a group of charts; the same card every MVP report builds on. */
export function Panel({ title, sub, actions, className, children }: { title?: string; sub?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-5", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>}
            {sub && <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** The bordered multi-column surface the Summary tabs use. Literal class strings, so Tailwind sees them. */
export const columnsClass = (layout: 2 | 3 | "2-3" = 3) =>
  cn(
    "grid rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-5 py-1 max-xl:divide-y max-xl:divide-(--color-border-default) xl:divide-x xl:divide-(--color-border-default)",
    layout === 3 && "xl:grid-cols-3",
    layout === 2 && "xl:grid-cols-2",
    layout === "2-3" && "xl:grid-cols-[2fr_3fr]",
  );
export const COLUMNS_CLASS = columnsClass(3);

/** One report column: title with a link to its detail tab, then stacked rows. */
export function Column({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5 px-5 py-4 first:pl-0 last:pr-0 max-xl:px-0 max-xl:py-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-subtitle-lg text-(--color-text-primary)">{title}</h2>
        {href && (
          <Link href={href} aria-label={`Open ${title}`} className="grid size-7 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)">
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** The headline figure: label, big number, change vs the period before, one line of context. */
export function BigStat({ label, value, now, before, vs, goodWhenUp = true, sub, tone }: { label: string; value: string; now?: number; before?: number; vs?: string; goodWhenUp?: boolean; sub?: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <div>
      <p className="text-body-sm text-(--color-text-secondary)">{label}</p>
      <p className={cn("mt-1 text-jumbo-sm tabular-nums", tone === "danger" ? "text-(--color-text-danger)" : tone === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{value}</p>
      {now !== undefined && before !== undefined && (
        <p className="mt-1.5 text-body-sm text-(--color-text-secondary)">
          <ChangePct now={now} before={before} goodWhenUp={goodWhenUp} /> vs {vs ?? "the period before"}
        </p>
      )}
      {sub && <p className="mt-1 text-body-sm text-(--color-text-secondary)">{sub}</p>}
    </div>
  );
}

/** A quiet key/value row (Mercury's "Net margin · −72%"). */
export function Fact({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div title={hint} className="flex items-center justify-between gap-3 border-b border-(--color-border-default) py-2.5 text-body-md last:border-b-0">
      <span className="text-(--color-text-secondary)">{label}</span>
      <span className="tabular-nums text-(--color-text-primary)">{value}</span>
    </div>
  );
}

export type Point = { label: string; value: number };

/** Smooth path through the points (Catmull-Rom → cubic Béziers) in a 0–100 × 0–40 box. */
function smoothPath(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i ? [xs[i - 1], ys[i - 1]] : [xs[i], ys[i]];
    const p1 = [xs[i], ys[i]];
    const p2 = [xs[i + 1], ys[i + 1]];
    const p3 = i + 2 < n ? [xs[i + 2], ys[i + 2]] : p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Trend line with a soft wash under it. Hover a point for its figure. */
export function Sparkline({ points, format, ariaLabel, color = BRAND, className }: { points: Point[]; format: (n: number) => string; ariaLabel: string; color?: string; className?: string }) {
  const id = useId();
  if (!points.length) return null;
  // Scale to the data's own range (not zero) so a steady series still shows its movement, with a
  // little headroom either side so the line never touches the edges.
  const hi = Math.max(...points.map((p) => p.value));
  const lo = Math.min(...points.map((p) => p.value));
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.25;
  const max = hi + pad;
  const min = lo - pad;
  const span = max - min || 1;
  const xs = points.map((_, i) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100));
  const ys = points.map((p) => 38 - ((p.value - min) / span) * 34);
  const line = smoothPath(xs, ys);
  const last = points.length - 1;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative h-28" role="img" aria-label={ariaLabel}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${xs[last]},40 L${xs[0]},40 Z`} fill={`url(#${id}-wash)`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* End marker, in HTML so it never stretches. */}
        <span aria-hidden className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-circle border-2 border-(--color-background-secondary)" style={{ left: `${xs[last]}%`, top: `${(ys[last] / 40) * 100}%`, background: color }} />
        <div className="absolute inset-0 flex">
          {points.map((p, i) => (
            <Tip key={i} align={i === 0 ? "left" : i === last ? "right" : "center"} className="group/pt relative flex-1" content={<><span className="block text-(--color-text-secondary)">{p.label}</span><span className="tabular-nums">{format(p.value)}</span></>}>
              <span aria-hidden className="absolute inset-y-0 left-1/2 hidden w-px bg-(--color-border-darker) group-hover/pt:block" />
            </Tip>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-body-sm text-(--color-text-secondary)">
        <span>{points[0].label}</span>
        {points.length > 2 && <span>{points[Math.floor(last / 2)].label}</span>}
        <span>{points[last].label}</span>
      </div>
    </div>
  );
}

export type InOut = { label: string; in: number; out: number };

/** Money in beside money out, one pair per period (Mercury's "Cash in vs out"). In is brand, out a soft red. */
export function InOutBars({ periods, inLabel, outLabel, format, ariaLabel, outTone = "danger" }: { periods: InOut[]; inLabel: string; outLabel: string; format: (n: number) => string; ariaLabel: string; /** "neutral" when the second series is a comparison, not a cost. */ outTone?: "danger" | "neutral" }) {
  const max = Math.max(...periods.flatMap((p) => [p.in, p.out]), 1);
  const h = (v: number) => `${(Math.max(v, 0) / max) * 100}%`;
  const outColor = outTone === "danger" ? "var(--chart-lost)" : "var(--chart-neutral)";
  const inStyle = { background: "linear-gradient(to top, var(--brand-200), var(--brand-700))", borderTop: "2px solid var(--brand-1000)" };
  const outStyle = { background: `linear-gradient(to top, color-mix(in srgb, ${outColor} 6%, transparent), color-mix(in srgb, ${outColor} 38%, transparent))`, borderTop: `2px solid ${outColor}` };
  return (
    <div>
      <div className="flex h-36 items-end gap-2" role="img" aria-label={ariaLabel}>
        {periods.map((p) => (
          <Tip
            key={p.label}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-[3px]"
            content={
              <>
                <span className="block font-medium">{p.label}</span>
                <span className="flex justify-between gap-4"><span className="text-(--color-text-secondary)">{inLabel}</span><span className="tabular-nums">{format(p.in)}</span></span>
                <span className="flex justify-between gap-4"><span className="text-(--color-text-secondary)">{outLabel}</span><span className="tabular-nums">{format(p.out)}</span></span>
              </>
            }
          >
            <span className="block w-full max-w-[22px] rounded-t-[3px]" style={{ height: h(p.in), ...inStyle }} />
            <span className="block w-full max-w-[22px] rounded-t-[3px]" style={{ height: h(p.out), ...outStyle }} />
          </Tip>
        ))}
      </div>
      {/* Axis: the start of each period ("Aug 13" for "Aug 13–19"), on at most four of the bars. */}
      <div className="mt-2 flex gap-2 text-body-sm text-(--color-text-secondary)">
        {periods.map((p, i) => (
          <span key={p.label} className="min-w-0 flex-1 text-center whitespace-nowrap">
            {i % Math.ceil(periods.length / 4) === 0 ? p.label.split(/\s?[–-]\s?/)[0] : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-body-sm text-(--color-text-secondary)">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-(--brand-900)" />{inLabel}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: outColor }} />{outLabel}</span>
      </div>
    </div>
  );
}

export type ShareRow = { key: string; label: string; value: number; hint?: string };

/** Ranked rows with a thin bar: label, amount and share of the whole (Mercury's "By ledger account"). */
export function ShareBars({ title, rows, format, color = BRAND, max: maxRows = 8, className }: { title?: string; rows: ShareRow[]; format: (n: number) => string; color?: string; max?: number; className?: string }) {
  const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, maxRows);
  const total = rows.reduce((a, r) => a + Math.max(r.value, 0), 0) || 1;
  const top = sorted[0]?.value || 1;
  return (
    <div className={className}>
      {title && <p className="mb-1 text-body-sm text-(--color-text-secondary)">{title}</p>}
      <ul>
        {sorted.map((r) => {
          const share = r.value / total;
          return (
            <li key={r.key} title={r.hint} className="border-b border-(--color-border-default) py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3 text-body-md">
                <span className="min-w-0 truncate text-(--color-text-primary)">{r.label}</span>
                <span className="shrink-0 tabular-nums text-(--color-text-primary)">
                  {format(r.value)} <span className="text-body-sm text-(--color-text-secondary)">{share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`}</span>
                </span>
              </div>
              <div className="mt-1.5 h-[3px] w-full rounded-circle bg-(--color-neutral-light)">
                <span className="block h-full rounded-circle" style={{ width: `${(r.value / top) * 100}%`, background: color }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
