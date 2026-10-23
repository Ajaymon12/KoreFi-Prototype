"use client";
import { Fragment, useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Financial statement as one real <table>, read top to bottom like arithmetic:
//   group rows (chevron beside the label) open to show their lines,
//   result rows (Gross profit, Profit) are the answer so far: bold, ruled above, tinted.
// Everything starts closed, so the first view is the whole story in a handful of rows; "Expand all"
// opens the detail. Lines show a › on hover to say they open a detail panel.

export type StmtRow = {
  id: string;
  label: string;
  tip?: string;
  /** One node per value column (after the label). */
  cells: React.ReactNode[];
  /** Present on a group: its own cells are the subtotal, children show when expanded. */
  children?: StmtRow[];
  /** "subtotal" and "total" are results, "heading" is a quiet ratio row. */
  kind?: "line" | "subtotal" | "total" | "heading";
  muted?: boolean;
};

export type StmtColumn = { key: string; header: string; /** Softer text, for context columns like "% of sales". */ muted?: boolean };

const groupIds = (rows: StmtRow[]): string[] => rows.flatMap((r) => (r.children?.length ? [r.id, ...groupIds(r.children)] : []));

export function StatementTable({
  caption,
  columns,
  rows,
  onSelect,
  selectedId,
  flush = false,
  defaultOpen = false,
}: {
  caption: string;
  columns: StmtColumn[];
  rows: StmtRow[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  /** The MVP table look (ReportTable): grey 42px header with "Expand all" in it, hairline rows, 16px edges. */
  flush?: boolean;
  /** Start with every group open (the weekly P&L reads like a full report). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => (defaultOpen ? Object.fromEntries(groupIds(rows).map((id) => [id, true])) : {}));
  const ids = groupIds(rows);
  const allOpen = ids.length > 0 && ids.every((id) => open[id]);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const toggleAll = () => setOpen(allOpen ? {} : Object.fromEntries(ids.map((id) => [id, true])));

  const renderRow = (row: StmtRow, depth: number): React.ReactNode => {
    const group = !!row.children?.length;
    const expanded = group && !!open[row.id];
    const kind = row.kind ?? "line";
    const result = kind === "subtotal" || kind === "total";
    const selectable = !group && !!onSelect && kind === "line";
    const selected = selectedId === row.id;

    return (
      <>
        <tr
          className={cn(
            cn("group/row text-body-md text-(--color-text-primary) [&>*]:border-t", flush ? "[&>*]:border-(--gray-300) first:[&>*]:border-t-0" : "[&>*]:border-(--color-border-default)"),
            kind === "subtotal" && "[&>*]:border-t-(--color-border-darker) [&>*]:bg-(--color-neutral-lightest)",
            kind === "total" && "[&>*]:border-t-(--color-border-darker) [&>*]:bg-(--color-neutral-light)",
            group && "hover:[&>*]:bg-(--color-neutral-lightest)/70",
            selectable && "hover:[&>*]:bg-(--color-neutral-lightest)/70",
            selected && "[&>*]:bg-(--color-brand-light)",
            (group || selectable) && "cursor-pointer",
          )}
          onClick={group ? () => toggle(row.id) : selectable ? () => onSelect!(row.id) : undefined}
        >
          <th scope="row" className={cn("h-11 px-3 text-left font-normal", flush && "h-12 pl-4", (group || result) && "font-medium", kind === "total" && "font-semibold", row.muted && "text-(--color-text-secondary)")}>
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 22 }}>
              {group ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${row.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(row.id);
                  }}
                  className="-ml-1 grid size-6 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                >
                  <ChevronRight className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-90")} />
                </button>
              ) : (
                <span aria-hidden className="size-5 shrink-0" />
              )}
              <span className={cn(selectable && "group-hover/row:underline")}>{row.label}</span>
              {row.tip && (
                <span title={row.tip} className="inline-flex text-(--color-text-secondary)">
                  <Info className="size-3.5" aria-label={row.tip} />
                </span>
              )}
            </div>
          </th>
          {row.cells.map((c, i) => (
            <td key={columns[i].key} className={cn("h-11 px-3 text-right whitespace-nowrap tabular-nums", columns[i].muted && !result && !group && "text-(--color-text-secondary)", (group || result) && "font-medium", kind === "total" && "font-semibold")}>
              {c}
            </td>
          ))}
          <td className={cn("w-7 pr-2 text-right text-(--color-text-secondary)", flush && "pr-4")}>{selectable && <ChevronRight aria-hidden className="ml-auto size-4 opacity-0 group-hover/row:opacity-100" />}</td>
        </tr>
        {expanded && row.children!.map((c) => <Fragment key={c.id}>{renderRow(c, depth + 1)}</Fragment>)}
      </>
    );
  };

  const expandAll = ids.length > 0 && (
    <button
      type="button"
      onClick={toggleAll}
      className="h-7 rounded-medium px-2 text-menu-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
    >
      {allOpen ? "Collapse all" : "Expand all"}
    </button>
  );

  return (
    <div>
      {!flush && ids.length > 0 && (
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="h-7 rounded-medium px-2 text-menu-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className={cn("text-body-sm text-(--color-text-secondary)", flush && "bg-(--gray-200) [&>*]:border-y [&>*]:border-(--gray-300)")}>
              <th scope="col" className={cn("h-9 px-3 text-left font-normal", flush && "h-[42px] pl-3")}>
                {flush && expandAll ? expandAll : <span className="sr-only">Line</span>}
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("h-9 px-3 text-right font-normal whitespace-nowrap", flush && "h-[42px]")}>
                  {c.header}
                </th>
              ))}
              <th scope="col" className="w-7">
                <span className="sr-only">Open detail</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>{renderRow(r, 0)}</Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
