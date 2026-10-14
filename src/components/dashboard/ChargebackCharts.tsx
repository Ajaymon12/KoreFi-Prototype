import { cn } from "@/lib/utils";
import { fmtCents as fmt } from "@/lib/mockData";
import type { DisputeStatus } from "@/lib/sources/types";
import type { StatusAmounts, StoreBreakdown } from "@/lib/sources/dashboard";

// Chargeback visuals. Hand-built HTML/SVG (the app has no chart library); every mark has a hover /
// focus tooltip, and labels always carry the number so colour is never the only cue.

export const STATUS_META: Record<DisputeStatus, { label: string; color: string }> = {
  won: { label: "Won back", color: "bg-(--chart-won)" },
  open: { label: "Being disputed", color: "bg-(--chart-open)" },
  lost: { label: "Lost", color: "bg-(--chart-lost)" },
  auto_refunded: { label: "App paid it", color: "bg-(--chart-neutral)" },
};
const ORDER: DisputeStatus[] = ["won", "open", "lost", "auto_refunded"];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const total = (a: StatusAmounts) => a.won + a.open + a.lost + a.auto_refunded;

/** Hover/focus tooltip around any mark. */
export function Tip({ content, className, children, style, align = "center" }: { content: React.ReactNode; className?: string; children?: React.ReactNode; style?: React.CSSProperties; align?: "left" | "center" | "right" }) {
  return (
    <span tabIndex={0} className={cn("group/tip relative outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", className)} style={style}>
      {children}
      <span
        role="tooltip"
        className={cn("pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-56 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 py-1.5 text-body-sm text-(--color-text-primary) shadow-md group-hover/tip:block group-focus/tip:block", align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2")}
      >
        {content}
      </span>
    </span>
  );
}

export function Swatch({ status }: { status: DisputeStatus }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-circle", STATUS_META[status].color)} />;
}

export function StatusLegend({ statuses = ORDER }: { statuses?: DisputeStatus[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-(--color-text-secondary)">
      {statuses.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <Swatch status={s} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}

/** One pill-segmented bar = every dollar charged back, split by where it ended up. */
export function MoneyFlowBar({ amounts, counts, splits }: { amounts: StatusAmounts; counts: Record<DisputeStatus, number>; splits: Record<DisputeStatus, string> }) {
  const sum = total(amounts);
  const shown = ORDER.filter((s) => amounts[s] > 0);
  return (
    <div className="space-y-5">
      <div className="flex h-3.5 w-full gap-1">
        {shown.map((s) => (
          <Tip
            key={s}
            className={cn("h-full rounded-circle", STATUS_META[s].color)}
            style={{ width: `${(amounts[s] / sum) * 100}%` }}
            content={
              <>
                <span className="block font-medium">
                  {STATUS_META[s].label} · {fmt(amounts[s])}
                </span>
                <span className="block text-(--color-text-secondary)">
                  {counts[s]} order{counts[s] === 1 ? "" : "s"} · {splits[s]}
                </span>
              </>
            }
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-(--color-border-default)">
        {ORDER.map((s) => (
          <div key={s} className="space-y-1 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <dt className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
              <Swatch status={s} />
              {STATUS_META[s].label}
            </dt>
            <dd className="text-subtitle-lg text-(--color-text-primary) tabular-nums">{fmt(amounts[s])}</dd>
            <dd className="text-body-sm text-(--color-text-secondary) tabular-nums">
              {sum ? pct(amounts[s] / sum) : "0%"} · {counts[s]} order{counts[s] === 1 ? "" : "s"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Share of decided disputes that were won. */
export function WinRing({ rate, won, decided }: { rate: number; won: number; decided: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <Tip content={`${won} won of ${decided} decided`} className="block w-fit">
      <svg viewBox="0 0 100 100" className="size-40" role="img" aria-label={`Win rate ${pct(rate)}: ${won} of ${decided} decided disputes won`}>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-(--chart-track)" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * rate} ${c}`} transform="rotate(-90 50 50)" className="stroke-(--chart-won)" />
        <text x="50" y="47" textAnchor="middle" dominantBaseline="central" className="fill-(--color-text-primary) text-[22px] font-medium tabular-nums">
          {pct(rate)}
        </text>
        <text x="50" y="65" textAnchor="middle" className="fill-(--color-text-secondary) text-[8px]">
          win rate
        </text>
      </svg>
    </Tip>
  );
}

export type BarRow = { key: string; label: string; amount: number; count: number; detail: string };

/** Ranked horizontal bars, one series, longest first, with each row's share of the whole. */
export function RankedBars({ rows }: { rows: BarRow[] }) {
  const sorted = [...rows].filter((r) => r.count > 0).sort((a, b) => b.amount - a.amount);
  const max = Math.max(...sorted.map((r) => r.amount), 1);
  const sum = sorted.reduce((a, r) => a + r.amount, 0) || 1;
  return (
    <ul className="space-y-4">
      {sorted.map((r) => (
        <li key={r.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body-md text-(--color-text-primary)">{r.label}</span>
            <span className="text-body-md tabular-nums text-(--color-text-primary)">
              {fmt(r.amount)} <span className="text-body-sm text-(--color-text-secondary)">· {pct(r.amount / sum)}</span>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-circle bg-(--chart-track)">
            <Tip content={`${r.count} order${r.count === 1 ? "" : "s"} · ${r.detail}`} className="block h-full rounded-circle bg-(--chart-series)" style={{ width: `${(r.amount / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const initial = (store: string) => store.replace("Casa Alvarez", "").replace(/^[\s–-]+/, "").trim().charAt(0) || store.charAt(0);

/** Store vs store on one shared scale; win rate is the headline. */
export function StoreCompare({ stores }: { stores: StoreBreakdown[] }) {
  const max = Math.max(...stores.map((s) => total(s.amounts)), 1);
  return (
    <ul className="space-y-3">
      {stores.map((s) => {
        const shown = ORDER.filter((k) => s.amounts[k] > 0);
        return (
          <li key={s.store} className="space-y-3 rounded-large bg-(--color-neutral-lightest) p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-circle bg-(--color-background-secondary) text-menu-sm text-(--color-text-primary) shadow-sm">{initial(s.store)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md text-(--color-text-primary)">{s.store}</p>
                <p className="text-body-sm tabular-nums text-(--color-text-secondary)">
                  {fmt(total(s.amounts))} · {s.count} orders
                </p>
              </div>
              <p className="text-right">
                <span className="block text-subtitle-lg tabular-nums text-(--color-text-primary)">{pct(s.winRate)}</span>
                <span className="block text-body-sm text-(--color-text-secondary)">won</span>
              </p>
            </div>
            <div className="flex h-2.5 gap-1" style={{ width: `${(total(s.amounts) / max) * 100}%` }}>
              {shown.map((k) => (
                <Tip key={k} content={`${STATUS_META[k].label} · ${fmt(s.amounts[k])}`} className={cn("h-full rounded-circle", STATUS_META[k].color)} style={{ width: `${(s.amounts[k] / total(s.amounts)) * 100}%` }} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
