import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD } from "@/lib/period";
import type { Definition } from "@/lib/metrics";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-(--color-success-lightest) text-(--color-success-darkest)",
  warning: "bg-(--color-warning-lightest) text-(--color-warning-darkest)",
  danger: "bg-(--color-danger-lightest) text-(--color-danger-darkest)",
  info: "bg-(--color-info-lightest) text-(--color-info-darkest)",
  neutral: "bg-(--color-neutral-lightest) text-(--color-text-secondary)",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-5 items-center rounded-small px-2 text-body-sm whitespace-nowrap", TONES[tone])}>{children}</span>;
}

/** "Synced Oct 8, 6:38 AM CDT" provenance stamp, shown in the reporting timezone (competitor pattern: freshness builds trust). */
export function FreshnessStamp({ at, label = "Synced" }: { at: string; label?: string }) {
  if (!at) return <span className="text-body-sm text-(--color-text-secondary)">Not connected</span>;
  const text = new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: PERIOD.timezone, timeZoneName: "short" });
  return (
    <span className="text-body-sm text-(--color-text-secondary)">
      {label} {text}
    </span>
  );
}

export type Column<T> = { key: string; header: string; align?: "left" | "right"; cell: (row: T) => React.ReactNode };

/** Simple table. Put actions in the last column: dashboards here are consoles, not reports. */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: string }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-body-md text-(--color-text-secondary)">{empty ?? "Nothing to show."}</p>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="text-body-sm text-(--color-text-secondary)">
          {columns.map((c) => (
            <th key={c.key} className={cn("p-2 font-normal", c.align === "right" ? "text-right" : "text-left")}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-body-md text-(--color-text-primary) tabular-nums">
        {rows.map((row) => (
          <tr key={rowKey(row)} className="h-11 border-t border-(--color-border-default)">
            {columns.map((c) => (
              <td key={c.key} className={cn("p-2", c.align === "right" ? "text-right" : "text-left")}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "+7.7%" change chip vs the previous period (every headline number carries a baseline). */
export function DeltaChip({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex h-5 items-center gap-0.5 rounded-small px-1.5 text-body-sm tabular-nums", up ? TONES.success : TONES.danger)}>
      <Icon className="size-3" />
      {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}

/** Small provider chip showing which source a number came from. */
export function SourceChip({ name, status = "healthy" }: { name: string; status?: "healthy" | "syncing" | "error" }) {
  const dot = status === "error" ? "bg-(--color-danger-default)" : status === "syncing" ? "bg-(--color-info-default)" : "bg-(--color-success-default)";
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-small border border-(--color-border-default) px-1.5 text-body-sm text-(--color-text-secondary)">
      <span className={cn("size-1.5 rounded-circle", dot)} />
      {name}
    </span>
  );
}

/** Info icon that reveals a metric's formula, scope and sources on hover or keyboard focus. */
export function DefinitionTip({ definition }: { definition: Definition }) {
  return (
    <span className="group/def relative inline-flex">
      <button type="button" aria-label={`Definition of ${definition.name}`} className="grid size-5 place-items-center rounded-circle text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
        <Info className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-6 left-0 z-10 hidden w-64 space-y-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-3 text-body-sm text-(--color-text-secondary) shadow-md group-focus-within/def:block group-hover/def:block"
      >
        <span className="block font-medium text-(--color-text-primary)">{definition.name}</span>
        <span className="block">{definition.formula}</span>
        <span className="block">{definition.scope}</span>
        <span className="block text-(--color-text-primary)">Sources: {definition.sources.join(", ")}</span>
      </span>
    </span>
  );
}
