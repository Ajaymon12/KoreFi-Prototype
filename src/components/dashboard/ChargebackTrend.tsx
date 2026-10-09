"use client";
import { useRef, useState } from "react";
import { fmtCents } from "@/lib/mockData";
import type { DayPoint } from "@/lib/sources/dashboard";

// Hero chart: dollars charged back vs dollars recovered, running total by day. The plot is a
// stretched SVG (non-scaling strokes) with every label, dot and tooltip in HTML on top, so text
// and dots never distort when the card resizes.

const STEPS = [10, 20, 25, 50, 100, 200, 250, 500, 1000];

/** Monotone cubic through the points: smooth, but never overshoots a flat stretch. */
function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) t[i] = t[i + 1] = 0;
    else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        t[i] = (3 * a * m[i]) / h;
        t[i + 1] = (3 * b * m[i]) / h;
      }
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const w = dx[i] / 3;
    d += ` C${pts[i][0] + w},${pts[i][1] + t[i] * w} ${pts[i + 1][0] - w},${pts[i + 1][1] - t[i + 1] * w} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function TrendChart({ points, axisEvery = 7 }: { points: DayPoint[]; axisEvery?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const n = points.length;
  const peak = Math.max(...points.map((p) => p.charged), 1);
  const step = STEPS.find((s) => Math.ceil(peak / s) <= 5) ?? STEPS.at(-1)!;
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  const line = (key: "charged" | "recovered") => monotonePath(points.map((p, i) => [x(i), y(p[key])]));
  const recoveredLine = line("recovered");

  const move = (e: React.PointerEvent) => {
    const r = plot.current!.getBoundingClientRect();
    setHover(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const hp = hover === null ? null : points[hover];
  const last = points[n - 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-(--color-text-secondary)">
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-(--color-text-secondary)" />
          Charged back <span className="tabular-nums text-(--color-text-primary)">{fmtCents(last.charged)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-(--chart-won)" />
          Recovered <span className="tabular-nums text-(--color-text-primary)">{fmtCents(last.recovered)}</span>
        </span>
      </div>

      <div className="relative h-60 pl-10" role="img" aria-label={`Running total by day. Charged back reached ${fmtCents(last.charged)}; recovered ${fmtCents(last.recovered)}.`}>
        {ticks.map((t) => (
          <span key={t} className="absolute left-0 w-8 -translate-y-1/2 text-right text-body-sm text-(--color-text-secondary) tabular-nums" style={{ top: `calc(${y(t)}% * 0.88 + 0px)` }}>
            ${t}
          </span>
        ))}

        <div ref={plot} className="relative h-[88%] touch-none" onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
          <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="cb-won-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-won)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--chart-won)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line key={t} x1="0" x2="100" y1={y(t)} y2={y(t)} stroke="var(--color-border-default)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={t === 0 ? undefined : "2 4"} />
            ))}
            <path d={`${recoveredLine} L100,100 L0,100 Z`} fill="url(#cb-won-fill)" />
            <path d={line("charged")} fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={recoveredLine} fill="none" stroke="var(--chart-won)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {hp && hover !== null && (
            <>
              <span className="pointer-events-none absolute inset-y-0 w-px bg-(--color-border-darker)" style={{ left: `${x(hover)}%` }} />
              <span className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-circle border-2 border-(--color-background-secondary) bg-(--color-text-secondary)" style={{ left: `${x(hover)}%`, top: `${y(hp.charged)}%` }} />
              <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-circle border-2 border-(--color-background-secondary) bg-(--chart-won)" style={{ left: `${x(hover)}%`, top: `${y(hp.recovered)}%` }} />
              <span
                role="tooltip"
                className="pointer-events-none absolute top-0 z-10 w-40 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-2.5 text-body-sm shadow-md"
                style={{ left: `${x(hover)}%`, transform: `translateX(${hover > n * 0.6 ? "calc(-100% - 12px)" : "12px"})` }}
              >
                <span className="block text-(--color-text-secondary)">{dayLabel(hp.date)}</span>
                <span className="mt-1 flex justify-between gap-3">
                  <span className="text-(--color-text-secondary)">Charged back</span>
                  <span className="tabular-nums text-(--color-text-primary)">{fmtCents(hp.charged)}</span>
                </span>
                <span className="flex justify-between gap-3">
                  <span className="text-(--color-text-secondary)">Recovered</span>
                  <span className="tabular-nums text-(--chart-won)">{fmtCents(hp.recovered)}</span>
                </span>
              </span>
            </>
          )}
        </div>

        <div className="relative mt-2 h-4">
          {points.map((p, i) =>
            i % axisEvery === 0 ? (
              <span key={p.date} className="absolute -translate-x-1/2 whitespace-nowrap text-body-sm text-(--color-text-secondary)" style={{ left: `${x(i)}%` }}>
                {dayLabel(p.date)}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
