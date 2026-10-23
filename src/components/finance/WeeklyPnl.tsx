"use client";
import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { SelectControl } from "@/components/ui/Select";
import { DetailDrawer, DetailList } from "@/components/ui/DetailDrawer";
import { StatementTable, type StmtColumn, type StmtRow } from "@/components/finance/StatementTable";
import { cn } from "@/lib/utils";
import { ACCOUNTING_SOURCE, ACCOUNTS, LATEST, MONTHS, SECTION_LABEL, STORES, WEEKS_IN_YEAR, closedWeeks, pnlWeek, weekLabel, type Pnl, type Section, type Store } from "@/lib/finance/books";
import { PnlChart } from "./PnlChart";
import { StoreFilter } from "./PnlView";
import { ChangePct, Segmented, downloadCsv, pct, usd } from "./parts";

// MVP / Profit / Statement: the P&L week by week.
//   md and up  the Mercury-style report: revenue/expenses/net bars, a toolbar and the statement with
//              one column per week plus Total. The weeks are a window (4, 8 or 13 wide) that ends in a
//              chosen month and pages back with ‹ ›, so any week is two clicks away, never a long scroll.
//   phones     one screen, no scrolling: pick a week (the title is a picker over every week), read net
//              profit and the four lines that make it. Tap a line for its accounts.

const YEARS = [2026, 2025, 2024];
const SPANS = [
  { key: "4", label: "4 weeks" },
  { key: "8", label: "8 weeks" },
  { key: "13", label: "13 weeks" },
] as const;
type Span = (typeof SPANS)[number]["key"];
const DAY = 86_400_000;
/** The week (0-based) a date falls in; weeks run seven days from Jan 1. */
const weekOf = (year: number, t: number) => Math.floor((t - Date.UTC(year, 0, 1)) / DAY / 7);
/** The month a week starts in. */
const monthOfWeek = (year: number, w: number) => new Date(Date.UTC(year, 0, 1) + w * 7 * DAY).getUTCMonth();
const STRIP_WEEKS = 8;
const expenses = (p: Pnl) => p.cogs + p.labor + p.opex;
const num2 = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WeeklyPnl() {
  const [year, setYear] = useState(LATEST.year);
  const [stores, setStores] = useState<Store[]>([...STORES]);
  return (
    <>
      <div className="hidden md:block">
        <WeeklyReport year={year} setYear={setYear} stores={stores} setStores={setStores} />
      </div>
      <div className="md:hidden">
        <WeekGlance year={year} stores={stores} />
      </div>
    </>
  );
}

// ───────────────────────── Desktop: the full report ─────────────────────────

function WeeklyReport({ year, setYear, stores, setStores }: { year: number; setYear: (y: number) => void; stores: Store[]; setStores: (s: Store[]) => void }) {
  const closed = closedWeeks(year);
  const [span, setSpan] = useState<Span>("8");
  const [end, setEnd] = useState(closed - 1); // the last week in the window
  const [selected, setSelected] = useState<string | null>(null);
  const n = Number(span);
  const last = Math.min(Math.max(end, Math.min(n, closed) - 1), closed - 1);
  const shown = Array.from({ length: Math.min(n, closed) }, (_, i) => last - Math.min(n, closed) + 1 + i);
  const months = MONTHS.slice(0, monthOfWeek(year, closed - 1) + 1);
  // "Through Aug" ends the window on the last week that starts in August.
  const throughMonth = (m: number) => setEnd(Math.min(closed - 1, weekOf(year, Date.UTC(year, m + 1, 1) - 1)));
  const data = shown.map((w) => pnlWeek(stores, year, w));
  const total = (get: (p: Pnl) => number) => data.reduce((n, p) => n + get(p), 0);

  const columns: StmtColumn[] = [...shown.map((w) => ({ key: `w${w}`, header: weekLabel(year, w) })), { key: "total", header: "Total" }];
  const cells = (get: (p: Pnl) => number) => [...data.map((p) => num2(get(p))), num2(total(get))];
  const line = (id: string, label: string, kind?: StmtRow["kind"], tip?: string): StmtRow => ({ id, label, tip, kind, cells: cells((p) => p[id]) });
  const group = (sec: Section): StmtRow => ({
    id: sec,
    label: sec === "revenue" ? SECTION_LABEL[sec] : `Less: ${SECTION_LABEL[sec].toLowerCase()}`,
    cells: cells((p) => p[sec]),
    children: ACCOUNTS.filter((a) => a.section === sec).map((a) => line(a.id, a.label, "line", a.tip)),
  });
  const rows: StmtRow[] = [group("revenue"), group("cogs"), line("gross", "Gross profit", "subtotal"), group("labor"), group("opex"), line("net", "Net profit", "total")];

  const bars = shown.map((w, i) => ({ label: weekLabel(year, w), short: `W${w + 1}`, revenue: data[i].revenue, expenses: expenses(data[i]), net: data[i].net }));
  const sel = selected ? ACCOUNTS.find((a) => a.id === selected) : undefined;
  const revenue = total((p) => p.revenue);

  const exportCsv = () => {
    const out: (string | number)[][] = [["Line", ...shown.map((w) => `${weekLabel(year, w)} ${year}`), "Total"]];
    const walk = (rs: StmtRow[], depth = 0) =>
      rs.forEach((r) => {
        out.push([`${"  ".repeat(depth)}${r.label}`, ...r.cells.map((c) => String(c))]);
        if (r.children) walk(r.children, depth + 1);
      });
    walk(rows);
    downloadCsv(`pnl-weekly-${year}.csv`, out);
  };

  const divider = <span aria-hidden className="h-6 w-px shrink-0 bg-(--color-border-default)" />;
  const stepBtn = "grid size-8 shrink-0 place-items-center rounded-circle text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-40 disabled:hover:bg-transparent";
  const day = (w: number, d: number) => {
    const t = new Date(Date.UTC(year, 0, 1) + (w * 7 + d) * DAY);
    return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`;
  };
  const range = `${day(shown[0], 0)} – ${day(last, 6)}`;

  return (
    <>
      <PnlChart bars={bars} />

      <section className="-mx-4 mt-6 border-y border-(--color-border-default) bg-(--color-background-secondary)">
        <div className="flex h-14 items-center gap-2 border-b border-(--color-border-default) px-4">
          <StoreFilter value={stores} onChange={setStores} />
          {divider}
          <div className="w-28 shrink-0">
            <SelectControl
              aria-label="Year"
              value={String(year)}
              onChange={(e) => {
                const y = Number(e.target.value);
                setYear(y);
                setEnd(closedWeeks(y) - 1);
              }}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {divider}
          <div className="w-36 shrink-0">
            <SelectControl aria-label="Through month" value={String(monthOfWeek(year, last))} onChange={(e) => throughMonth(Number(e.target.value))} options={months.map((m, i) => ({ value: String(i), label: `Through ${m}` })).reverse()} />
          </div>
          <Segmented label="Weeks shown" options={[...SPANS]} value={span} onChange={setSpan} />
          {divider}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button type="button" aria-label={`Previous ${n} weeks`} disabled={shown[0] === 0} onClick={() => setEnd(Math.max(Math.min(n, closed) - 1, last - n))} className={stepBtn}>
              <ChevronLeft className="size-4" />
            </button>
            <p className="truncate text-body-md text-(--color-text-primary) tabular-nums" aria-live="polite">
              {range}
              <span className="ml-2 text-body-sm text-(--color-text-secondary)">
                W{shown[0] + 1}–W{last + 1}
              </span>
            </p>
            <button type="button" aria-label={`Next ${n} weeks`} disabled={last >= closed - 1} onClick={() => setEnd(Math.min(closed - 1, last + n))} className={stepBtn}>
              <ChevronRight className="size-4" />
            </button>
            {last < closed - 1 && (
              <button type="button" onClick={() => setEnd(closed - 1)} className="ml-1 h-7 shrink-0 rounded-medium px-2 text-menu-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                Latest
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Download report"
            title="Download report"
            onClick={exportCsv}
            className="grid size-9 shrink-0 place-items-center rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
          >
            <Download className="size-4" />
          </button>
        </div>
        <StatementTable caption="Profit and loss by week" columns={columns} rows={rows} onSelect={setSelected} selectedId={selected} flush defaultOpen />
      </section>
      <p className="mt-3 px-1 text-body-sm text-(--color-text-tertiary)">Source: {ACCOUNTING_SOURCE}. Weeks run seven days from Jan 1. Select a line for its weekly figures.</p>

      <DetailDrawer open={!!sel} onClose={() => setSelected(null)} eyebrow={sel ? SECTION_LABEL[sel.section] : undefined} title={sel?.label ?? ""} meta={sel ? `${ACCOUNTING_SOURCE} · account ${sel.code}` : undefined}>
        {sel && (
          <DetailList
            title={`${year}, by week`}
            rows={[
              ...shown.map((w, i) => ({ label: weekLabel(year, w), value: usd(data[i][sel.id]) })),
              { label: "Total", value: <b className="font-semibold">{usd(total((p) => p[sel.id]))}</b> },
              { label: "Share of sales", value: pct(revenue ? total((p) => p[sel.id]) / revenue : 0) },
            ]}
          />
        )}
      </DetailDrawer>
    </>
  );
}

// ───────────────────────── Phones: one week at a glance ─────────────────────────

const GLANCE: { id: Section | "net"; label: string; sign: string }[] = [
  { id: "revenue", label: "Sales", sign: "" },
  { id: "cogs", label: "Food & drink", sign: "−" },
  { id: "labor", label: "Labor", sign: "−" },
  { id: "opex", label: "Running costs", sign: "−" },
];

function WeekGlance({ year, stores }: { year: number; stores: Store[] }) {
  const closed = closedWeeks(year);
  const [week, setWeek] = useState(closed - 1);
  const [open, setOpen] = useState<Section | null>(null);
  const w = Math.min(week, closed - 1);
  const cur = pnlWeek(stores, year, w);
  const prev = w > 0 ? pnlWeek(stores, year, w - 1) : pnlWeek(stores, year - 1, WEEKS_IN_YEAR - 1);
  const margin = cur.revenue ? cur.net / cur.revenue : 0;
  // The latest eight weeks; stepping back past them slides the window so the chosen week stays in it.
  const stripStart = Math.max(0, Math.min(w, closed - STRIP_WEEKS));
  const stripWeeks = Array.from({ length: Math.min(STRIP_WEEKS, closed) }, (_, i) => stripStart + i);
  const stripData = stripWeeks.map((k) => pnlWeek(stores, year, k).net);
  const peak = Math.max(1, ...stripData.map(Math.abs));
  const hasLoss = stripData.some((n) => n < 0);

  const stepBtn = "grid size-9 place-items-center rounded-circle border border-(--color-border-default) text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-40";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous week" disabled={w === 0} onClick={() => setWeek(w - 1)} className={stepBtn}>
          <ChevronLeft className="size-4" />
        </button>
        {/* The title is a native picker over every week (a wheel on phones), so going back months is one tap. */}
        <label className="relative rounded-medium px-3 py-0.5 text-center focus-within:outline-2 focus-within:outline-(--color-focus-primary)">
          <span className="flex items-center justify-center gap-1 text-subtitle-md text-(--color-text-primary)" aria-live="polite">
            {weekLabel(year, w)}
            <ChevronDown aria-hidden className="size-4 text-(--color-text-secondary)" />
          </span>
          <span className="block text-body-sm text-(--color-text-secondary)">
            Week {w + 1}, {year}
            {w === closed - 1 && " · latest"}
          </span>
          <select aria-label="Week" value={w} onChange={(e) => setWeek(Number(e.target.value))} className="absolute inset-0 cursor-pointer opacity-0">
            {Array.from({ length: closed }, (_, i) => closed - 1 - i).map((k) => (
              <option key={k} value={k}>
                W{k + 1} · {weekLabel(year, k)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="Next week" disabled={w >= closed - 1} onClick={() => setWeek(w + 1)} className={stepBtn}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <section aria-label="Net profit" className="rounded-large border border-(--color-brand-lightest) bg-linear-to-r from-(--brand-200) to-(--color-background-secondary) px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-body-sm text-(--color-text-secondary)">Net profit</p>
            <p className={cn("text-jumbo-md tabular-nums", cur.net < 0 ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{usd(cur.net)}</p>
            <p className="text-body-sm text-(--color-text-secondary)">
              {pct(margin)} margin · <ChangePct now={cur.net} before={prev.net} /> vs last week
            </p>
          </div>
          {/* Last eight weeks of net profit; tap a bar to read that week. */}
          <div role="group" aria-label="Net profit, recent weeks" className="flex h-14 shrink-0 items-stretch gap-1">
            {stripWeeks.map((k, i) => {
              const v = stripData[i];
              const h = Math.max(3, (Math.abs(v) / peak) * (hasLoss ? 28 : 56));
              const bar = <span className={cn("block w-2.5 rounded-[2px]", v < 0 ? "bg-(--chart-lost)" : "bg-(--brand-900)", k !== w && "opacity-35")} style={{ height: h }} />;
              // With a loss in view the zero line sits in the middle: profits rise above it, losses hang below.
              return (
                <button key={k} type="button" aria-label={`${weekLabel(year, k)}: ${usd(v)}`} aria-pressed={k === w} onClick={() => setWeek(k)} className="flex w-2.5 flex-col rounded-small p-0 outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                  <span className="flex flex-1 flex-col justify-end">{v >= 0 && bar}</span>
                  {hasLoss && <span className="flex flex-1 flex-col justify-start">{v < 0 && bar}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <ul className="divide-y divide-(--gray-300) overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
        {GLANCE.map((g) => {
          const v = cur[g.id];
          const share = cur.revenue ? v / cur.revenue : 0;
          return (
            <li key={g.id}>
              <button type="button" onClick={() => setOpen(g.id as Section)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-body-md text-(--color-text-primary)">{g.label}</span>
                    <span className="text-body-md text-(--color-text-primary) tabular-nums">
                      {g.sign}
                      {usd(v)}
                    </span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-circle bg-(--gray-200)">
                      <span className="block h-full rounded-circle" style={{ width: `${Math.min(100, share * 100)}%`, background: g.id === "revenue" ? "var(--brand-900)" : "var(--chart-neutral)" }} />
                    </span>
                    <span className="w-24 text-right text-body-sm text-(--color-text-secondary) tabular-nums">
                      {g.id === "revenue" ? <ChangePct now={v} before={prev[g.id]} /> : `${pct(share)} of sales`}
                    </span>
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-(--color-text-tertiary)" />
              </button>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between bg-(--color-neutral-light) px-4 py-2.5 font-semibold">
          <span className="text-body-md text-(--color-text-primary)">Net profit</span>
          <span className={cn("text-body-md tabular-nums", cur.net < 0 ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{usd(cur.net)}</span>
        </li>
      </ul>
      <p className="px-1 text-body-sm text-(--color-text-tertiary)">Source: {ACCOUNTING_SOURCE}. The full statement by week is on a larger screen.</p>

      <DetailDrawer open={!!open} onClose={() => setOpen(null)} eyebrow={weekLabel(year, w)} title={open ? SECTION_LABEL[open] : ""} meta={ACCOUNTING_SOURCE}>
        {open && (
          <DetailList
            title="By account"
            rows={[
              ...ACCOUNTS.filter((a) => a.section === open).map((a) => ({ label: a.label, value: usd(cur[a.id]) })),
              { label: "Total", value: <b className="font-semibold">{usd(cur[open])}</b> },
              { label: "Last week", value: usd(prev[open]) },
            ]}
          />
        )}
      </DetailDrawer>
    </div>
  );
}
