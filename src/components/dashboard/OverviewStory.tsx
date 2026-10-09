import { useId } from "react";
import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/Money";
import { DeltaChip } from "./primitives";

// Overview in the Mercury Home layout: a hero figure with its chart beside the accounts it comes
// from, then Money in / Money out, then the activity ledger (LedgerTable.tsx). Report only —
// nothing here asks the owner to act.

export function SectionHeading({ title, caption, children }: { title: string; caption?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-subtitle-lg text-(--color-text-primary)">{title}</h2>
        {caption && <p className="text-body-sm text-(--color-text-secondary)">{caption}</p>}
      </div>
      {children}
    </div>
  );
}

const Panel = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={cn("rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-5", className)}>{children}</section>
);

/** Hero: one big number, its change, two supporting figures, and the weekly shape behind it. */
export function HeroCard({
  label,
  value,
  delta,
  caption,
  figures,
  weeks,
}: {
  label: string;
  value: number;
  delta: number;
  caption: string;
  figures: { label: string; value: React.ReactNode }[];
  weeks: { label: string; value: number }[];
}) {
  const fill = useId();
  const max = Math.max(...weeks.map((w) => w.value));
  const min = Math.min(...weeks.map((w) => w.value));
  const span = max - min || 1;
  const pts = weeks.map((w, i) => [(i / (weeks.length - 1)) * 100, 36 - ((w.value - min) / span) * 28] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-body-md text-(--color-text-secondary)">{label}</p>
          <Money value={value} className="mt-1.5 block text-jumbo-md text-(--color-text-primary)" />
          <p className="mt-2 flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
            <DeltaChip value={delta} />
            {caption}
          </p>
        </div>
        <dl className="flex gap-6">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="text-body-sm text-(--color-text-secondary)">{f.label}</dt>
              <dd className="mt-0.5 text-subtitle-sm text-(--color-text-primary) tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-auto">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-32 w-full"
          role="img"
          aria-label={`${label} by week: ${weeks.map((w) => `${w.label} $${Math.round(w.value).toLocaleString("en-US")}`).join(", ")}`}
        >
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,40 L0,40 Z`} fill={`url(#${fill})`} />
          <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <div className="mt-2 flex justify-between text-body-sm text-(--color-text-secondary)">
          {weeks.map((w) => (
            <span key={w.label}>{w.label}</span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export type AccountRow = { name: string; sub: string; logo?: string; amount?: number; problem?: string };

/** Where the money sits and where it comes from: bank first, then each app. */
export function AccountsCard({ rows }: { rows: AccountRow[] }) {
  return (
    <Panel className="flex flex-col">
      <h3 className="text-subtitle-sm text-(--color-text-primary)">Accounts</h3>
      <ul className="mt-2 divide-y divide-(--color-border-default)">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 py-3">
            {r.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo} alt="" className="size-8 shrink-0 rounded-circle border border-(--color-border-default)" />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-circle bg-(--color-neutral-lightest) text-(--color-text-primary)">
                <Landmark className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-md text-(--color-text-primary)">{r.name}</p>
              <p className={cn("truncate text-body-sm", r.problem ? "text-(--color-text-danger)" : "text-(--color-text-secondary)")}>{r.problem ?? r.sub}</p>
            </div>
            {r.amount !== undefined ? <Money value={r.amount} className="text-body-md text-(--color-text-primary)" /> : <span className="text-body-md text-(--color-text-tertiary)">—</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export type MovementRow = { label: string; sub: string; logo: string; amount: number };

/** Money in or Money out for the period: the total, then what made it up. */
export function MovementCard({ title, total, direction, rows }: { title: string; total: number; direction: "in" | "out"; rows: MovementRow[] }) {
  return (
    <Panel>
      <p className="flex items-center gap-1.5 text-body-md text-(--color-text-secondary)">
        {direction === "in" ? <ArrowUpRight className="size-4 text-(--color-text-success)" /> : <ArrowDownRight className="size-4 text-(--color-text-danger)" />}
        {title}
      </p>
      <Money value={direction === "in" ? total : -total} tone={direction === "in" ? "success" : "default"} className="mt-1 block text-subtitle-lg" />
      <ul className="mt-4 space-y-3 border-t border-(--color-border-default) pt-4">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.logo} alt="" className="size-7 shrink-0 rounded-medium border border-(--color-border-default)" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-md text-(--color-text-primary)">{r.label}</p>
              <p className="truncate text-body-sm text-(--color-text-secondary)">{r.sub}</p>
            </div>
            <Money value={direction === "in" ? r.amount : -r.amount} className="text-body-md text-(--color-text-primary)" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Two-segment bar: DoorDash share vs Uber Eats share of a store's delivery sales. */
export function SplitBar({ a, className }: { a: number; className?: string }) {
  return (
    <span className={cn("flex h-1.5 w-24 overflow-hidden rounded-circle bg-(--color-neutral-light)", className)}>
      <span className="h-full bg-(--color-primary)" style={{ width: `${a * 100}%` }} />
    </span>
  );
}
