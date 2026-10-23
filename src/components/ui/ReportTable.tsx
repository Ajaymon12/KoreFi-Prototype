"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/Checkbox";
import { asset } from "@/lib/asset";
import { FilterChip } from "./FilterChip";
import { InStoreMark } from "./InStoreMark";
import { SquareMark } from "./SquareMark";

// The MVP's table (Figma KoreFi 1431:28101 "File uploads", with Mercury's Transactions as the
// reference): an optional title, a toolbar band (search, filter chips, an action on the right),
// a grey header row with sortable columns, white rows split by hairlines with an optional grey
// second line per cell, a "View ›" action when rows open a detail, and a footer with
// "Showing 1–10 of 25 …" and page numbers. Report only: nothing in it changes data.

export type TableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  cell: (row: T) => React.ReactNode;
  /** Grey second line under the value (Figma: "2,940 rows", "Priya Shah · 2 outlets"). */
  sub?: (row: T) => React.ReactNode;
  /** Makes the column sortable by this value. */
  sort?: (row: T) => number | string;
  /** Tailwind width class for the column, e.g. "w-40". */
  width?: string;
  /** Pin the column to the right edge while the table scrolls sideways (a row's action). */
  pinRight?: boolean;
};

export type TableFilter<T> = { key: string; label: string; value: (row: T) => string };

type Props<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  title?: string;
  description?: string;
  /** Text a row is searched by; turns on the search field. */
  search?: (row: T) => string;
  searchPlaceholder?: string;
  /** Single-choice filter chips; options come from the rows. */
  filters?: TableFilter<T>[];
  /** Right side of the toolbar (Figma: "Upload Report"). */
  actions?: React.ReactNode;
  /** Rows per page; pages only show when there are more rows than this. */
  pageSize?: number;
  /** What the rows are, for "Showing 1–10 of 25 disputes". */
  noun?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Rows open a detail: the whole row is clickable and ends in "View ›". */
  onRowClick?: (row: T) => void;
  /** The row whose detail is open, highlighted while it is. */
  selectedKey?: string | null;
  empty?: string;
  /** Extra chips in the toolbar, between the search and the filters (e.g. Outlets, Date, Apps). */
  chips?: React.ReactNode;
  /** false hides the "View ›" column a clickable row gets (when a row has its own action column). */
  viewColumn?: boolean;
  /** Fill the parent's height: toolbar and footer stay put, rows scroll under a sticky header. */
  fill?: boolean;
  /** Extra classes per row, e.g. a tint for urgent ones. */
  rowClassName?: (row: T) => string | undefined;
  /** Checkbox per row (and select-all for the page) for bulk actions; the caller holds the keys. */
  selection?: { keys: Set<string>; onChange: (keys: Set<string>) => void; label: (row: T) => string };
  className?: string;
};

/** A right-pinned cell: opaque, with a soft edge so rows sliding under it read as covered. */
const PIN = "sticky right-0 z-[1] bg-inherit shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.12)]";

type Sort = { key: string; dir: "asc" | "desc" } | null;

export function ReportTable<T>({ columns, rows, rowKey, title, description, search, searchPlaceholder = "Search…", filters = [], actions, pageSize = 10, noun = "rows", initialSort, onRowClick, selectedKey, empty = "Nothing to show.", selection, chips, viewColumn = true, fill = false, rowClassName, className }: Props<T>) {
  const showView = !!onRowClick && viewColumn;
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Record<string, string | null>>({});
  const [sort, setSort] = useState<Sort>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => (!q || !search || search(r).toLowerCase().includes(q)) && filters.every((f) => !chosen[f.key] || f.value(r) === chosen[f.key]));
    const col = sort && columns.find((c) => c.key === sort.key);
    if (sort && col?.sort) {
      const by = col.sort;
      out = [...out].sort((a, b) => {
        const x = by(a);
        const y = by(b);
        const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.dir === "asc" ? d : -d;
      });
    }
    return out;
  }, [rows, query, search, filters, chosen, sort, columns]);

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  // Keep the open row in view: when the selection moves to a row on another page, go to that page.
  const [seenSel, setSeenSel] = useState(selectedKey);
  let current = Math.min(page, pages - 1);
  if (selectedKey !== seenSel) {
    setSeenSel(selectedKey);
    const at = selectedKey ? shown.findIndex((r) => rowKey(r) === selectedKey) : -1;
    if (at >= 0 && Math.floor(at / pageSize) !== current) {
      current = Math.floor(at / pageSize);
      setPage(current);
    }
  }
  const start = current * pageSize;
  const visible = shown.slice(start, start + pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));
    setPage(0);
  };
  const hasToolbar = !!search || filters.length > 0 || !!actions || !!chips;
  const allPicked = !!selection && visible.length > 0 && visible.every((r) => selection.keys.has(rowKey(r)));
  const somePicked = !!selection && visible.some((r) => selection.keys.has(rowKey(r)));
  const togglePage = () => {
    if (!selection) return;
    const next = new Set(selection.keys);
    for (const r of visible) {
      if (allPicked) next.delete(rowKey(r));
      else next.add(rowKey(r));
    }
    selection.onChange(next);
  };
  const toggleRow = (key: string) => {
    if (!selection) return;
    const next = new Set(selection.keys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };
  const filtered = !!query || Object.values(chosen).some(Boolean);

  return (
    <section className={cn(fill ? "flex min-h-0 flex-1 flex-col bg-(--color-background-secondary)" : "-mx-4 border-y border-(--color-border-default) bg-(--color-background-secondary)", className)}>
      {title && (
        <header className="px-4 pt-4 pb-1">
          <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>
          {description && <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{description}</p>}
        </header>
      )}

      {hasToolbar && (
        <div className={cn("flex flex-wrap items-center gap-2 border-b border-(--color-border-default) px-4 py-3", title && "pt-2")}>
          {search && (
            <label className="flex h-8 w-[217px] items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--gray-200) px-2.5 focus-within:border-(--color-focus-primary)">
              <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
              />
            </label>
          )}
          {search && (filters.length > 0 || chips) && <span aria-hidden className="mx-0.5 h-6 w-px bg-(--color-border-default)" />}
          {chips}
          {filters.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              options={[...new Set(rows.map(f.value))].sort()}
              value={chosen[f.key] ?? null}
              onChange={(v) => {
                setChosen((c) => ({ ...c, [f.key]: v }));
                setPage(0);
              }}
            />
          ))}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className={cn(fill ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto", hasToolbar && !fill && "mt-4")}>
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className={cn("h-[42px] border-b border-(--gray-300) bg-(--gray-200) text-body-sm text-(--color-text-secondary)", !hasToolbar && title && "border-t", fill && "sticky top-0 z-[2] shadow-[0_1px_0_var(--gray-300)] [&>th]:bg-(--gray-200)")}>
              {selection && (
                <th scope="col" className="w-px pr-1 pl-4">
                  <Checkbox aria-label="Select all on this page" checked={allPicked} mixed={!allPicked && somePicked} onChange={togglePage} />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key ? sort.dir : null;
                const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
                return (
                  <th key={c.key} scope="col" aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : undefined} className={cn("px-3 font-normal first:pl-4 last:pr-4", c.align === "right" ? "text-right" : "text-left", c.width, c.pinRight && PIN)}>
                    {c.sort ? (
                      // Label then icon, always (Figma: "File ⇅", Mercury: "Amount ⇅"); tighter on right-aligned figures so the icon stays with its own column.
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center rounded-small outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", c.align === "right" ? "gap-1.5" : "gap-3", active && "text-(--color-text-primary)")}>
                        {c.header}
                        <Icon aria-hidden className="size-3" />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {showView && (
                <th scope="col" className="w-24 px-3 pr-4 text-right font-normal">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="text-body-md text-(--color-text-primary) tabular-nums">
            {visible.map((row) => {
              const key = rowKey(row);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  onClick={onRowClick && (() => onRowClick(row))}
                  onKeyDown={
                    onRowClick &&
                    ((e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      onRowClick(row);
                    })
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={onRowClick ? selected : undefined}
                  className={cn(
                    "group/tr border-b border-(--gray-300) bg-(--color-background-secondary) last:border-b-0",
                    onRowClick && "cursor-pointer outline-none transition-colors hover:bg-(--gray-200) focus-visible:bg-(--gray-200) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus-primary)",
                    rowClassName?.(row),
                    (selected || selection?.keys.has(key)) && "bg-(--brand-200) hover:bg-(--brand-200)",
                  )}
                >
                  {selection && (
                    <td className="w-px pr-1 pl-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${selection.label(row)}`} checked={selection.keys.has(key)} onChange={() => toggleRow(key)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("h-[52px] px-3 py-3 first:pl-4 last:pr-4", c.align === "right" ? "text-right" : "text-left", c.width, c.pinRight && PIN)}>
                      {c.cell(row)}
                      {c.sub && <div className="mt-1 text-body-sm text-(--color-text-secondary)">{c.sub(row)}</div>}
                    </td>
                  ))}
                  {showView && (
                    <td className="px-3 pr-4 text-right">
                      <span className={cn("inline-flex items-center gap-1 text-(--color-text-secondary) transition-colors group-hover/tr:text-(--color-text-primary)", selected && "text-(--color-text-primary)")}>
                        View
                        <ChevronRight aria-hidden className="size-3.5 transition-transform group-hover/tr:translate-x-0.5" />
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="border-t border-(--gray-300) py-8 text-center text-body-md text-(--color-text-secondary)">{filtered ? "Nothing matches these filters." : empty}</p>}
      </div>

      {shown.length > 0 && (
        <footer className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-(--gray-300) px-4", fill ? "shrink-0 py-2.5" : "py-4")}>
          <p className="text-body-md text-(--color-text-primary)">
            Showing {start + 1}–{start + visible.length} of {shown.length} {noun}
          </p>
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-1">
              <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid size-6 place-items-center rounded-small text-(--brand-1100) outline-none hover:bg-(--gray-200) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:text-(--color-text-tertiary) disabled:hover:bg-transparent">
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Page ${i + 1}`}
                  aria-current={i === current ? "page" : undefined}
                  onClick={() => setPage(i)}
                  className={cn("grid h-6 min-w-6 place-items-center rounded-small px-1.5 text-body-md text-(--color-text-primary) tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", i === current ? "bg-(--brand-300)" : "bg-(--gray-200) hover:bg-(--gray-400)")}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid size-6 place-items-center rounded-small text-(--brand-1100) outline-none hover:bg-(--gray-200) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:text-(--color-text-tertiary) disabled:hover:bg-transparent">
                <ChevronRight className="size-4" />
              </button>
            </nav>
          )}
        </footer>
      )}
    </section>
  );
}

/** The same edge-to-edge frame as ReportTable — title, toolbar band, then any table — for tables
 *  ReportTable can't express (the expandable P&L statement). */
export function TableFrame({ title, description, toolbar, children }: { title?: string; description?: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="-mx-4 border-y border-(--color-border-default) bg-(--color-background-secondary)">
      {title && (
        <header className="px-4 pt-4 pb-1">
          <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>
          {description && <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{description}</p>}
        </header>
      )}
      {toolbar && <div className={cn("flex flex-wrap items-center gap-2 border-b border-(--color-border-default) px-4 py-3", title && "pt-2")}>{toolbar}</div>}
      <div className={cn(toolbar && "mt-4")}>{children}</div>
    </section>
  );
}

/** A delivery app with its logo (Figma's Provider column). */
export function AppName({ source, name }: { source: string; name: string }) {
  const known = ["doordash", "ubereats", "grubhub"].includes(source);
  return (
    <span className="inline-flex items-center gap-3">
      {source === "instore" ? (
        <InStoreMark size={18} />
      ) : source === "square" ? (
        <SquareMark size={18} />
      ) : known ? (
        <Image src={asset(`/dashboard/${source}.png`)} alt="" width={18} height={18} unoptimized className="size-[18px] shrink-0 rounded-[2px] object-cover" />
      ) : (
        <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-small bg-(--color-text-primary) text-[10px] font-medium text-(--color-background-secondary)">
          {name.charAt(0)}
        </span>
      )}
      {name}
    </span>
  );
}
