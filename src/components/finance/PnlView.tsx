"use client";
import { useMemo, useRef, useState } from "react";
import { Download, ListFilter } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { DataSources } from "@/components/dashboard/DataSources";
import { SelectControl } from "@/components/ui/Select";
import { DetailDrawer, DetailList } from "@/components/ui/DetailDrawer";
import { StatementTable, type StmtRow, type StmtColumn } from "@/components/finance/StatementTable";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { PERIOD } from "@/lib/period";
import { cn } from "@/lib/utils";
import { ACCOUNTING_SOURCE, ACCOUNTS, BOOKS_SYNCED_AT, LATEST, MONTHS, SECTION_LABEL, STORES, closedWeeks, pnl, pnlWeek, weekLabel, type Pnl, type Section, type Store } from "@/lib/finance/books";
import { PnlChart } from "./PnlChart";
import { downloadCsv, pct, usd } from "./parts";

type Freq = "weekly" | "monthly";
const RECENT_WEEKS = 12;
const YEARS = [2026, 2025, 2024];
const expenses = (p: Pnl) => p.cogs + p.labor + p.opex;

// Finance / P&L: revenue, expenses and net profit as bars, a net profit highlight, then a toolbar
// (store, frequency, year, which periods) and the statement using the design-system StatementTable.
// Weekly is the default view; select a line for its detail panel.

type Period = { key: string; chip: string; label: string; short: string; tip: string; get: (stores: readonly Store[]) => Pnl };
function periodsFor(freq: Freq, year: number): Period[] {
  if (freq === "weekly") {
    return Array.from({ length: closedWeeks(year) }, (_, i) => {
      const label = weekLabel(year, i);
      return { key: `w${i}`, chip: `W${i + 1}`, label, short: `W${i + 1}`, tip: `W${i + 1}: ${label}`, get: (st) => pnlWeek(st, year, i) };
    });
  }
  const last = year === LATEST.year ? LATEST.month : 11; // only closed months
  return Array.from({ length: last + 1 }, (_, m) => ({ key: `m${m}`, chip: MONTHS[m], label: `${MONTHS[m]} ${year}`, short: MONTHS[m], tip: `${MONTHS[m]} ${year}`, get: (st) => pnl(st, year, m, m) }));
}
/** Weekly opens on the latest weeks only; monthly shows the whole year. null = every period. */
const defaultPick = (freq: Freq, all: Period[]) => (freq === "weekly" && all.length > RECENT_WEEKS ? all.slice(-RECENT_WEEKS).map((p) => p.key) : null);

export function StoreFilter({ value, onChange }: { value: Store[]; onChange: (v: Store[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const narrowed = value.length < STORES.length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          narrowed && "border-(--color-border-darker)",
        )}
      >
        <ListFilter className="size-4 text-(--color-text-secondary)" />
        Filters
        {narrowed && <span className="grid size-5 place-items-center rounded-circle bg-(--color-text-primary) text-body-sm text-(--color-background-secondary)">{value.length}</span>}
      </button>
      {open && (
        <div role="group" aria-label="Stores" className="absolute top-full left-0 z-20 mt-1 w-64 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-2 shadow-[0_8px_24px_rgb(0_0_0/0.10)]">
          <p className="px-2 py-1 text-body-sm text-(--color-text-secondary)">Stores</p>
          {STORES.map((s) => {
            const on = value.includes(s);
            return (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded-medium px-2 py-1.5 text-body-md hover:bg-(--color-neutral-lightest)">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on ? value.filter((v) => v !== s) : STORES.filter((x) => x === s || value.includes(x));
                    if (next.length) onChange(next);
                  }}
                  className="size-4 accent-(--color-text-primary)"
                />
                {s}
              </label>
            );
          })}
          {narrowed && (
            <button type="button" onClick={() => onChange([...STORES])} className="mt-1 w-full rounded-medium px-2 py-1.5 text-left text-body-sm text-(--color-text-clickable) hover:bg-(--color-neutral-lightest)">
              Show all stores
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Format a number as comma-separated with 2 decimal places (like 340,435.90). */
const num2 = (n: number) => {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `−${formatted}` : formatted;
};

export function PnlView() {
  const [freq, setFreq] = useState<Freq>("weekly");
  const [year, setYear] = useState(LATEST.year);
  const [stores, setStores] = useState<Store[]>([...STORES]);
  // null = every period of the year is shown; otherwise the keys the user kept.
  const [picked, setPicked] = useState<string[] | null>(() => defaultPick("weekly", periodsFor("weekly", LATEST.year)));
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => periodsFor(freq, year), [freq, year]);
  const shown = picked ? all.filter((p) => picked.includes(p.key)) : all;
  const data = useMemo(() => shown.map((p) => p.get(stores)), [shown, stores]);
  const sum = (get: (p: Pnl) => number) => data.reduce((n, p) => n + get(p), 0);

  const toggle = (key: string) => {
    const cur = picked ?? all.map((p) => p.key);
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    if (next.length) setPicked(next.length === all.length ? null : next);
  };

  // Build StatementTable columns: one per visible period, plus Total
  const columns: StmtColumn[] = [
    ...shown.map((p) => ({ key: p.key, header: p.label })),
    { key: "total", header: "Total" },
  ];

  // Build the statement rows using the StatementTable StmtRow format
  const makeLine = (id: string, label: string, get: (p: Pnl) => number, kind?: StmtRow["kind"], tip?: string): StmtRow => {
    const values = data.map(get);
    const total = values.reduce((a, b) => a + b, 0);
    return {
      id,
      label,
      tip,
      cells: [...values.map((v) => num2(v)), num2(total)],
      kind: kind ?? "line",
    };
  };

  const makeGroup = (sec: Section): StmtRow => {
    const children = ACCOUNTS.filter((a) => a.section === sec).map((a) => makeLine(a.id, a.label, (p) => p[a.id], "line", a.tip));
    const values = data.map((p) => p[sec]);
    const total = values.reduce((a, b) => a + b, 0);
    return {
      id: sec,
      label: sec === "revenue" ? SECTION_LABEL[sec] : `Less: ${SECTION_LABEL[sec].toLowerCase()}`,
      cells: [...values.map((v) => num2(v)), num2(total)],
      children,
    };
  };

  const stmtRows: StmtRow[] = [
    makeGroup("revenue"),
    makeGroup("cogs"),
    makeLine("gross", "Gross profit", (p) => p.gross, "subtotal"),
    makeGroup("labor"),
    makeGroup("opex"),
    makeLine("net", "Net profit", (p) => p.net, "total"),
  ];

  const bars = shown.map((p, i) => ({ label: p.tip, short: p.short, revenue: data[i].revenue, expenses: expenses(data[i]), net: data[i].net }));

  const sel = selected ? ACCOUNTS.find((a) => a.id === selected) : undefined;
  const totalRevenue = sum((p) => p.revenue);

  const exportCsv = () => {
    const out: (string | number)[][] = [["Line", ...shown.map((p) => `${p.tip} ${year}`), "Total"]];
    const walk = (rs: StmtRow[], depth = 0) =>
      rs.forEach((r) => {
        // cells are ReactNodes (strings here), cast to string for CSV
        out.push([`${"  ".repeat(depth)}${r.label}`, ...r.cells.map((c) => String(c))]);
        if (r.children) walk(r.children, depth + 1);
      });
    walk(stmtRows);
    downloadCsv(`pnl-${freq}-${year}.csv`, out);
  };

  const iconBtn = "grid size-9 place-items-center rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

  const netTotal = sum((p) => p.net);
  const expTotal = sum(expenses);
  const margin = totalRevenue ? netTotal / totalRevenue : 0;
  const span = freq === "weekly" ? `${shown.length} week${shown.length === 1 ? "" : "s"}` : `${shown.length} month${shown.length === 1 ? "" : "s"}`;
  const divider = <span aria-hidden className="h-6 w-px shrink-0 bg-(--color-border-default)" />;

  return (
    <>
      <PageHeader title="Profit & Loss" actions={<DataSources syncedAt={BOOKS_SYNCED_AT} timezoneNote={PERIOD.timezoneNote} />} />

      <div className="relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
        <div className="space-y-4 px-6 pt-5 pb-4">
          <PnlChart bars={bars} />

          <section aria-label="Net profit" className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-large border border-(--color-brand-lightest) bg-linear-to-r from-(--brand-200) to-(--color-background-secondary) px-5 py-4">
            <div>
              <p className="text-body-sm text-(--color-text-secondary)">Net profit · {span}</p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
                <span className={cn("text-jumbo-md tabular-nums", netTotal < 0 ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{usd(netTotal)}</span>
                <span className={cn("inline-flex h-6 items-center rounded-small px-2 text-body-sm tabular-nums", netTotal < 0 ? "bg-(--color-danger-lightest) text-(--color-text-danger)" : "bg-(--color-success-lightest) text-(--color-text-success)")}>
                  {pct(margin)} margin
                </span>
              </p>
            </div>
            <dl className="flex gap-8 text-body-md tabular-nums">
              <div>
                <dt className="text-body-sm text-(--color-text-secondary)">Revenue</dt>
                <dd className="text-subtitle-md text-(--color-text-primary)">{usd(totalRevenue)}</dd>
              </div>
              <div>
                <dt className="text-body-sm text-(--color-text-secondary)">Expenses</dt>
                <dd className="text-subtitle-md text-(--color-text-primary)">{usd(expTotal)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Toolbar */}
        <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-y border-(--color-border-default) bg-(--color-background-secondary) px-6">
          <StoreFilter value={stores} onChange={setStores} />
          {divider}
          <div className="w-36 shrink-0">
            <SelectControl
              aria-label="Frequency"
              value={freq}
              onChange={(e) => {
                const f = e.target.value as Freq;
                setFreq(f);
                setPicked(defaultPick(f, periodsFor(f, year)));
              }}
              options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
            />
          </div>
          {divider}
          <div className="w-28 shrink-0">
            <SelectControl
              aria-label="Year"
              value={String(year)}
              onChange={(e) => {
                const y = Number(e.target.value);
                setYear(y);
                setPicked(defaultPick(freq, periodsFor(freq, y)));
              }}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {divider}
          <div role="group" aria-label={freq === "weekly" ? "Weeks" : "Months"} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
            {all.map((p) => {
              const on = !picked || picked.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  title={p.tip}
                  onClick={() => toggle(p.key)}
                  className={cn(
                    "h-8 shrink-0 rounded-circle px-3.5 text-body-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                    on ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)",
                  )}
                >
                  {p.chip}
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Download report" title="Download report" onClick={exportCsv} className={iconBtn}>
            <Download className="size-4" />
          </button>
        </div>

        {/* Statement table using design-system StatementTable */}
        <div className="px-2">
          <StatementTable
            caption="Profit and loss by period"
            columns={columns}
            rows={stmtRows}
            onSelect={setSelected}
            selectedId={selected}
            flush
          />
        </div>
        <p className="px-6 py-4 text-body-sm text-(--color-text-secondary)">Source: {ACCOUNTING_SOURCE}. All figures shown with two decimal places.</p>
      </div>

      <DetailDrawer open={!!sel} onClose={() => setSelected(null)} eyebrow={sel ? SECTION_LABEL[sel.section] : undefined} title={sel?.label ?? ""} meta={sel ? `${ACCOUNTING_SOURCE} · account ${sel.code}` : undefined}>
        {sel && (
          <DetailList
            title={`${year}, ${freq}`}
            rows={[
              ...shown.map((p, i) => ({ label: p.tip, value: usd(data[i][sel.id]) })),
              { label: "Total", value: <b className="font-semibold">{usd(sum((p) => p[sel.id]))}</b> },
              { label: "Share of revenue", value: pct(totalRevenue ? sum((p) => p[sel.id]) / totalRevenue : 0) },
            ]}
          />
        )}
      </DetailDrawer>
    </>
  );
}
