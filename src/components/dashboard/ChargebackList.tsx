import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleDashed, CircleSlash, Layers, Receipt, Store, Tag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCents as fmt } from "@/lib/mockData";
import { StatusBadge } from "./primitives";
import type { LedgerRow } from "./LedgerTable";

// ClickUp-style list view: a toolbar ("Group: Status"), then collapsible groups, each with a
// coloured pill + count, over Name / Store / Date / Amount / Status columns. Grouping is a URL
// param, so the whole list is server-rendered and the groups open/close with <details>.

export type GroupBy = "status" | "store" | "app" | "reason";

const GROUPS: { key: GroupBy; label: string; Icon: LucideIcon }[] = [
  { key: "status", label: "Status", Icon: Layers },
  { key: "store", label: "Store", Icon: Store },
  { key: "app", label: "App", Icon: Receipt },
  { key: "reason", label: "Reason", Icon: Tag },
];

// Status pills use the chart tokens, so a status has one colour everywhere.
const STATUS_PILL: Record<string, { label: string; className: string; Icon: LucideIcon }> = {
  won: { label: "Won back", className: "bg-(--chart-won)", Icon: CheckCircle2 },
  open: { label: "Being disputed", className: "bg-(--chart-open)", Icon: CircleDashed },
  lost: { label: "Lost", className: "bg-(--chart-lost)", Icon: CircleSlash },
  auto_refunded: { label: "App paid it", className: "bg-(--chart-neutral)", Icon: CheckCircle2 },
};
const STATUS_ORDER = ["won", "open", "lost", "auto_refunded"];

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const COLS = "grid grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-3";

const keyOf = (r: LedgerRow, by: GroupBy) => (by === "status" ? r.tabs[0] : by === "store" ? r.store : by === "app" ? r.app : (r.reason ?? "Other"));

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-[18px] shrink-0 items-center rounded-small bg-(--color-neutral-light) px-1.5 text-body-sm text-(--color-text-secondary)">{children}</span>;
}

function Amount({ row }: { row: LedgerRow }) {
  const abs = fmt(Math.abs(row.amount));
  if (!row.signed) return <span>{abs}</span>;
  return row.amount >= 0 ? <span className="text-(--color-text-success)">+{abs}</span> : <span className="text-(--color-text-danger)">−{abs}</span>;
}

export function ChargebackList({ rows, groupBy, basePath }: { rows: LedgerRow[]; groupBy: GroupBy; basePath: string }) {
  const keys = [...new Set(rows.map((r) => keyOf(r, groupBy)))];
  const total = (k: string) => rows.filter((r) => keyOf(r, groupBy) === k).reduce((a, r) => a + Math.abs(r.amount), 0);
  const ordered = groupBy === "status" ? STATUS_ORDER.filter((k) => keys.includes(k)) : keys.sort((a, b) => total(b) - total(a));
  const grouping = GROUPS.find((g) => g.key === groupBy)!;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 items-center gap-1.5 rounded-circle bg-(--brand-200) px-3 text-menu-md text-(--color-text-primary) [&>svg]:size-3.5 [&>svg]:text-(--color-primary-solid)">
          <grouping.Icon aria-hidden />
          Group: {grouping.label}
        </span>
        <div role="group" aria-label="Group by" className="flex items-center gap-1">
          {GROUPS.filter((g) => g.key !== groupBy).map(({ key, label, Icon }) => (
            <Link
              key={key}
              href={`${basePath}?tab=breakdown&group=${key}`}
              className="flex h-7 items-center gap-1.5 rounded-circle border border-(--color-border-default) px-3 text-menu-md text-(--color-text-secondary) transition-colors hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) [&>svg]:size-3.5"
            >
              <Icon aria-hidden />
              {label}
            </Link>
          ))}
        </div>
        <span className="ml-auto text-body-sm text-(--color-text-secondary) tabular-nums">
          {rows.length} chargebacks · {fmt(rows.reduce((a, r) => a + Math.abs(r.amount), 0))}
        </span>
      </div>

      {/* Groups */}
      <div className="space-y-5">
        {ordered.map((k) => {
          const inGroup = rows.filter((r) => keyOf(r, groupBy) === k);
          const pill = groupBy === "status" ? STATUS_PILL[k] : undefined;
          return (
            <details key={k} open className="group/g">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 outline-none [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                <ChevronDown className="size-4 text-(--color-text-secondary) transition-transform -rotate-90 group-open/g:rotate-0" aria-hidden />
                {pill ? (
                  <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-small px-2 text-menu-sm tracking-wide text-(--color-text-inverse-primary) uppercase [&>svg]:size-3.5", pill.className)}>
                    <pill.Icon aria-hidden />
                    {pill.label}
                  </span>
                ) : (
                  <span className="inline-flex h-6 items-center rounded-small bg-(--color-neutral-light) px-2 text-menu-sm tracking-wide text-(--color-text-primary) uppercase">{k}</span>
                )}
                <span className="text-body-sm text-(--color-text-secondary) tabular-nums">{inGroup.length}</span>
                <span className="ml-auto text-body-sm text-(--color-text-secondary) tabular-nums">{fmt(total(k))}</span>
              </summary>

              <div className={cn(COLS, "border-b border-(--color-border-default) px-2 py-1.5 text-body-sm text-(--color-text-secondary)")}>
                <span>Name</span>
                <span>Store</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span>Status</span>
              </div>
              <ul>
                {inGroup.map((r) => (
                  <li key={r.id} className={cn(COLS, "min-h-11 border-b border-(--color-border-default) px-2 py-2 text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-lightest)")}>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local marketplace logo */}
                      <img src={r.logo} alt="" className="size-[18px] shrink-0 rounded-[2px] object-cover" />
                      <span className="truncate">{r.title}</span>
                      {r.reason && groupBy !== "reason" && <Chip>{r.reason}</Chip>}
                      {groupBy !== "app" && <Chip>{r.app}</Chip>}
                    </span>
                    <span className="truncate text-(--color-text-secondary)">{r.store}</span>
                    <span className="text-(--color-text-secondary) tabular-nums">{day(r.date)}</span>
                    <span className="text-right tabular-nums">
                      <Amount row={r} />
                    </span>
                    <span>
                      <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
        {rows.length === 0 && <p className="py-6 text-center text-body-md text-(--color-text-secondary)">No chargebacks in this period.</p>}
      </div>
    </div>
  );
}
