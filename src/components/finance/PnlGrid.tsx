"use client";
import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// The P&L as a spreadsheet-style grid: one column per period plus a Total, the label column pinned
// on the left, hairlines between every cell. Group rows open and close with a caret; result rows
// (gross profit, net profit) are bold. Numbers right-aligned, negatives with a minus.

export type GridRow = {
  id: string;
  label: string;
  /** One number per period column; the Total column is their sum. */
  values: number[];
  children?: GridRow[];
  kind?: "line" | "group" | "result";
  /** Lines that can open the detail drawer. */
  selectable?: boolean;
};

const num = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export function PnlGrid({
  periods,
  rows,
  open,
  onToggle,
  onSelect,
  selectedId,
}: {
  periods: string[];
  rows: GridRow[];
  open: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const cell = "h-9 border-b border-l border-(--color-border-default) px-3 text-right whitespace-nowrap tabular-nums";
  const totalCell = "sticky right-0 z-10 h-9 min-w-32 border-b border-l border-(--color-border-darker) bg-(--color-background-secondary) px-3 text-right font-semibold whitespace-nowrap tabular-nums";

  const render = (r: GridRow, depth: number): React.ReactNode => {
    const group = !!r.children?.length;
    const expanded = group && open[r.id] !== false;
    const result = r.kind === "result";
    const total = r.values.reduce((a, b) => a + b, 0);
    const selected = selectedId === r.id;
    const click = group ? () => onToggle(r.id) : r.selectable ? () => onSelect(r.id) : undefined;
    return (
      <Fragment key={r.id}>
        <tr
          onClick={click}
          className={cn(
            "group/row text-body-md text-(--color-text-primary)",
            (group || r.selectable) && "cursor-pointer hover:[&>*]:bg-(--color-neutral-lightest)",
            result && "font-semibold [&>*]:bg-(--color-neutral-lightest)",
            selected && "[&>*]:bg-(--color-brand-light)",
          )}
        >
          <th
            scope="row"
            className={cn("sticky left-0 z-10 h-9 min-w-64 border-b border-(--color-border-default) bg-(--color-background-secondary) px-2 text-left font-normal", (group || result) && "font-medium", result && "font-semibold")}
          >
            <span className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
              {group ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${r.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(r.id);
                  }}
                  className="grid size-6 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                >
                  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ) : (
                <span aria-hidden className="size-6 shrink-0" />
              )}
              <span className={cn(r.selectable && "group-hover/row:underline")}>{r.label}</span>
            </span>
          </th>
          {r.values.map((v, i) => (
            <td key={i} className={cell}>
              {num(v)}
            </td>
          ))}
          <td className={cn(totalCell, result && "bg-(--color-neutral-lightest)", selected && "bg-(--color-brand-light)")}>{num(total)}</td>
        </tr>
        {expanded && r.children!.map((c) => render(c, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="border-y border-(--color-border-default)">
      <table className="w-full min-w-full border-separate border-spacing-0">
        <caption className="sr-only">Profit and loss by period</caption>
        <thead>
          <tr className="text-body-md text-(--color-text-secondary)">
            <th scope="col" className="sticky top-(--pnl-bar) left-0 z-30 h-9 min-w-64 border-b border-(--color-border-default) bg-(--color-background-secondary) px-3 text-left font-normal">
              <span className="sr-only">Line</span>
            </th>
            {periods.map((p) => (
              <th key={p} scope="col" className="sticky top-(--pnl-bar) z-20 h-9 min-w-28 border-b border-l border-(--color-border-default) bg-(--color-background-secondary) px-3 text-right font-normal whitespace-nowrap">
                {p}
              </th>
            ))}
            <th scope="col" className="sticky top-(--pnl-bar) right-0 z-30 h-9 min-w-32 border-b border-l border-(--color-border-darker) bg-(--color-background-secondary) px-3 text-right font-semibold whitespace-nowrap text-(--color-text-primary)">
              Total
            </th>
          </tr>
        </thead>
        <tbody>{rows.map((r) => render(r, 0))}</tbody>
      </table>
    </div>
  );
}
