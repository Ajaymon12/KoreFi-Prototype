"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { usd } from "./parts";

// Revenue, expenses and net profit for each period: three bars per group on a shared zero line.
// Brand orange for revenue, red for expenses, neutral for net profit. Bars are a soft gradient wash with a solid cap, so the height reads first and the colour second.
// Net profit hangs below the line when it is a loss. Hover or focus a group for its figures.

export type PnlBar = { label: string; short: string; revenue: number; expenses: number; net: number };

const SERIES = [
  { key: "revenue", label: "Revenue", color: "var(--brand-900)" },
  { key: "expenses", label: "Expenses", color: "var(--chart-lost)" },
  { key: "net", label: "Net profit", color: "var(--color-text-secondary)" },
] as const;

const H = 200;
const PAD_TOP = 8;
const LABEL_H = 28;

export function PnlChart({ bars }: { bars: PnlBar[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const plotH = H - PAD_TOP - LABEL_H;
  const up = Math.max(1, ...bars.flatMap((b) => [b.revenue, b.expenses, b.net]));
  const down = Math.min(0, ...bars.map((b) => b.net));
  const scale = plotH / (up - down);
  const zero = PAD_TOP + up * scale;
  const group = w / Math.max(1, bars.length);
  const barW = Math.max(2, Math.min(36, (group - 8) / 3 - 1));
  const every = Math.ceil(44 / Math.max(1, group)); // label every n-th group so they never overlap

  return (
    <section aria-label="Revenue, expenses and net profit by period">
      <ul className="mb-3 flex flex-wrap items-center gap-4 text-body-sm text-(--color-text-secondary)">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-circle" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={box} className="relative w-full" style={{ height: H }}>
        {w > 0 && (
          <svg width={w} height={H} role="group" aria-label="Bar chart">
            <defs>
              {SERIES.map((s) => (
                <g key={s.key}>
                  <linearGradient id={`pnl-${s.key}-pos`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id={`pnl-${s.key}-neg`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.02" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.32" />
                  </linearGradient>
                </g>
              ))}
            </defs>
            <line x1={0} x2={w} y1={zero} y2={zero} stroke="var(--color-border-darker)" strokeWidth="1.25" />
            {bars.map((b, i) => {
              const x0 = i * group + (group - barW * 3 - 4) / 2;
              const showLabel = i % every === 0;
              return (
                <g
                  key={b.label}
                  tabIndex={0}
                  role="img"
                  aria-label={`${b.label}: revenue ${usd(b.revenue)}, expenses ${usd(b.expenses)}, net profit ${usd(b.net)}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                >
                  <rect x={i * group} y={0} width={group} height={H - LABEL_H} fill={hover === i ? "var(--color-neutral-lightest)" : "transparent"} opacity={0.6} rx={6} />
                  {SERIES.map((s, k) => {
                    const v = b[s.key];
                    const h = Math.max(1.5, Math.abs(v) * scale);
                    const y = v >= 0 ? zero - h : zero;
                    const x = x0 + k * (barW + 2);
                    return (
                      <g key={s.key}>
                        <rect x={x} y={y} width={barW} height={h} fill={`url(#pnl-${s.key}-${v < 0 ? "neg" : "pos"})`} />
                        <rect x={x} y={v >= 0 ? y : y + h - 1.5} width={barW} height={1.5} fill={s.color} />
                      </g>
                    );
                  })}
                  {showLabel && (
                    <text x={i * group + group / 2} y={H - 8} textAnchor="middle" className="fill-(--color-text-secondary) text-[11px]">
                      {b.short}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && bars[hover] && (
          <div
            role="presentation"
            className="pointer-events-none absolute top-0 z-10 w-44 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-2.5 text-body-sm shadow-[0_8px_24px_rgb(0_0_0/0.10)]"
            style={{ left: Math.min(Math.max(0, hover * group + group / 2 - 88), Math.max(0, w - 176)) }}
          >
            <p className="mb-1 font-medium text-(--color-text-primary)">{bars[hover].label}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="flex items-center gap-1.5 text-(--color-text-secondary)">
                  <span aria-hidden className="size-2 rounded-circle" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-(--color-text-primary)">{usd(bars[hover][s.key])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
