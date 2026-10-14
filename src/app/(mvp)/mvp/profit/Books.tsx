"use client";
import { useMemo, useState } from "react";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, COLUMNS_CLASS, Column, Fact, InOutBars, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { StatementTable, type StmtColumn, type StmtRow } from "@/components/finance/StatementTable";
import { ChangeBoth, ExportButton, HundredBar, downloadCsv, pct, usd, vsLastYear } from "@/components/finance/parts";
import { SelectControl } from "@/components/ui/Select";
import { DetailDrawer, DetailList } from "@/components/ui/DetailDrawer";
import { ACCOUNTING_SOURCE, ACCOUNTS, LATEST, MONTHS, PERIODS, SECTION_LABEL, STORES, accountTrend, closedWeeks, periodMonths, pnl, pnlSpan, pnlWeek, weekLabel, type PeriodKey, type Pnl, type Section } from "@/lib/finance/books";
import { sum } from "@/lib/sources/dashboard";
import type { Insight } from "@/lib/sources/overview";
import { PART_COLORS, type ProfitTab } from "./ProfitView";

// Profit with a POS connected: the books. Four views on the same figures:
//   Summary    three columns, Sales · Costs · Profit
//   By channel one card per channel, its sales trend and what the apps keep
//   By store   store against store, then one card per store
//   Statement  the P&L for a chosen period, every line opening its monthly trend

const costs = (p: Pnl) => p.cogs + p.labor + p.opex;
const CHANNELS: { key: string; label: string; accounts: string[]; app?: boolean }[] = [
  { key: "instore", label: "In-store & takeout", accounts: ["dine-in"] },
  { key: "web", label: "Website & catering", accounts: ["catering"] },
  { key: "doordash", label: "DoorDash", accounts: ["doordash"], app: true },
  { key: "uber", label: "Uber Eats", accounts: ["uber"], app: true },
  { key: "grubhub", label: "Grubhub", accounts: ["grubhub"], app: true },
];
const RECENT_WEEKS = 12;

const Source = ({ children }: { children: React.ReactNode }) => <p className="px-1 text-body-sm text-(--color-text-tertiary)">{children}</p>;
const ChartLabel = ({ children }: { children: React.ReactNode }) => <p className="mb-2 text-body-sm text-(--color-text-secondary)">{children}</p>;

export function Books({ tab, insights }: { tab: ProfitTab; insights: Insight[] }) {
  const { year, month } = LATEST;
  const cur = pnl(STORES, year, month, month);
  const prev = month > 0 ? pnl(STORES, year, month - 1, month - 1) : pnl(STORES, year - 1, 11, 11);
  const lastYear = pnl(STORES, year - 1, month, month);
  const label = `${MONTHS[month]} ${year}`;
  const prevLabel = month > 0 ? `${MONTHS[month - 1]} ${year}` : `Dec ${year - 1}`;
  const ofSales = (n: number) => pct(cur.revenue ? n / cur.revenue : 0);
  // The last twelve closed weeks, for every trend line.
  const closed = closedWeeks(year);
  const weeks = Array.from({ length: RECENT_WEEKS }, (_, i) => closed - RECENT_WEEKS + i).map((w) => ({ label: weekLabel(year, w), p: pnlWeek(STORES, year, w) }));

  if (tab === "statement") return <Statement />;

  if (tab === "summary") {
    const byAccount = (sections: Section[]) => ACCOUNTS.filter((a) => sections.includes(a.section)).map((a) => ({ key: a.id, label: a.label, value: cur[a.id], hint: a.tip }));
    const byStore = STORES.map((s) => ({ key: s, label: s, value: pnl([s], year, month, month).net }));
    return (
      <>
        <InsightBanner insights={insights} title={`What KoreFi sees in ${MONTHS[month]}`} />
        <div className={COLUMNS_CLASS}>
          <Column title="Sales" href="/mvp/profit?tab=channel">
            <BigStat label={`Total sales · ${label}`} value={usd(cur.revenue)} now={cur.revenue} before={prev.revenue} vs={prevLabel} sub={vsLastYear(cur.revenue, lastYear.revenue)} />
            <div>
              <ChartLabel>Sales by week</ChartLabel>
              <Sparkline points={weeks.map((w) => ({ label: w.label, value: w.p.revenue }))} format={usd} ariaLabel="Sales by week, last 12 weeks" />
            </div>
            <ShareBars title="By channel" rows={byAccount(["revenue"])} format={usd} />
          </Column>
          <Column title="Costs" href="/mvp/profit?tab=statement">
            <BigStat label={`Total costs · ${label}`} value={usd(costs(cur))} now={costs(cur)} before={costs(prev)} vs={prevLabel} goodWhenUp={false} sub={`${ofSales(costs(cur))} of sales`} />
            <div>
              <Fact label="Food & drink" value={ofSales(cur.cogs)} hint="Food, beverage and packaging as a share of sales" />
              <Fact label="Labor" value={ofSales(cur.labor)} hint="Wages, payroll taxes and benefits as a share of sales" />
              <Fact label="Running costs" value={ofSales(cur.opex)} hint="Rent, utilities, marketplace commissions and other operating costs as a share of sales" />
            </div>
            <ShareBars title="By account" rows={byAccount(["cogs", "labor", "opex"])} format={usd} color="var(--chart-neutral)" />
          </Column>
          <Column title="Profit" href="/mvp/profit?tab=store">
            <BigStat label={`Net profit · ${label}`} value={usd(cur.net)} now={cur.net} before={prev.net} vs={prevLabel} tone={cur.net < 0 ? "danger" : undefined} sub={`${ofSales(cur.net)} margin · ${pct(prev.revenue ? prev.net / prev.revenue : 0)} in ${prevLabel}`} />
            <div>
              <ChartLabel>Sales vs costs by week</ChartLabel>
              <InOutBars periods={weeks.slice(-8).map((w) => ({ label: w.label, in: w.p.revenue, out: costs(w.p) }))} inLabel="Sales" outLabel="Costs" format={usd} ariaLabel="Sales and costs by week, last 8 weeks" />
            </div>
            <ShareBars title="By store" rows={byStore} format={usd} />
          </Column>
        </div>
        <Source>Source: {ACCOUNTING_SOURCE}. Whole dollars. The Statement tab has every week and month.</Source>
      </>
    );
  }

  if (tab === "channel") {
    const appSales = sum(CHANNELS.filter((c) => c.app).flatMap((c) => c.accounts.map((a) => cur[a])));
    const channels = CHANNELS.map((c) => {
      const at = (p: Pnl) => sum(c.accounts.map((a) => p[a]));
      const sales = at(cur);
      // Marketplace commissions are one account in the books; split it across the apps by their sales.
      const fees = c.app && appSales ? (cur.commissions * sales) / appSales : 0;
      return { ...c, sales, before: at(prev), fees, after: sales - fees, share: cur.revenue ? sales / cur.revenue : 0, trend: weeks.map((w) => ({ label: w.label, value: at(w.p) })) };
    });
    return (
      <>
        <InsightBanner insights={insights} title={`What KoreFi sees in ${MONTHS[month]}`} />
        <Panel title="Where every $100 of sales came from" sub={`${label} · in-store first, then the website and the delivery apps`}>
          <HundredBar total={cur.revenue} parts={channels.map((c, i) => ({ key: c.key, label: c.label, value: c.sales, color: PART_COLORS[i] }))} />
        </Panel>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {channels.map((c) => (
            <Panel key={c.key} className="flex flex-col gap-5">
              <BigStat label={c.label} value={usd(c.sales)} now={c.sales} before={c.before} vs={prevLabel} sub={`${pct(c.share)} of sales`} />
              <Sparkline points={c.trend} format={usd} ariaLabel={`${c.label} sales by week`} />
              <div>
                {c.app ? (
                  <>
                    <Fact label="Commissions & fees" value={`−${usd(c.fees)}`} hint="This channel's share of the marketplace commissions account" />
                    <Fact label="After platform costs" value={usd(c.after)} />
                    <Fact label="Of every $1" value={`${Math.round((c.after / (c.sales || 1)) * 100)}¢`} />
                  </>
                ) : (
                  <>
                    <Fact label="Platform costs" value="None" />
                    <Fact label="After platform costs" value={usd(c.sales)} />
                  </>
                )}
              </div>
            </Panel>
          ))}
        </div>
        <Source>Marketplace commissions are split across the apps in proportion to their sales. Food, labour and running costs are not split by channel.</Source>
      </>
    );
  }

  // By store
  const stores = STORES.map((s) => {
    const p = pnl([s], year, month, month);
    const b = month > 0 ? pnl([s], year, month - 1, month - 1) : pnl([s], year - 1, 11, 11);
    const trend = Array.from({ length: RECENT_WEEKS }, (_, i) => closed - RECENT_WEEKS + i).map((w) => ({ label: weekLabel(year, w), value: pnlWeek([s], year, w).net }));
    return { store: s, sales: p.revenue, costs: costs(p), net: p.net, before: b.net, margin: p.revenue ? p.net / p.revenue : 0, trend };
  });
  return (
    <>
      <InsightBanner insights={insights} title={`What KoreFi sees in ${MONTHS[month]}`} />
      <div className={columnsClass(2)}>
        <Column title="Sales vs costs by store">
          <InOutBars periods={stores.map((s) => ({ label: s.store.replace("Casa Alvarez", "").replace(/^[\s–-]+/, "") || s.store, in: s.sales, out: s.costs }))} inLabel="Sales" outLabel="Costs" format={usd} ariaLabel="Sales and costs by store" />
        </Column>
        <Column title="Net profit by store">
          <ShareBars rows={stores.map((s) => ({ key: s.store, label: s.store, value: s.net }))} format={usd} />
        </Column>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {stores.map((s) => (
          <Panel key={s.store} className="flex flex-col gap-5">
            <BigStat label={s.store} value={usd(s.net)} now={s.net} before={s.before} vs={prevLabel} tone={s.net < 0 ? "danger" : undefined} sub={`${pct(s.margin)} margin · net profit, ${label}`} />
            <Sparkline points={s.trend} format={usd} ariaLabel={`${s.store} net profit by week`} />
            <div>
              <Fact label="Sales" value={usd(s.sales)} />
              <Fact label="Costs" value={`−${usd(s.costs)}`} />
              <Fact label="Share of group profit" value={pct(cur.net ? s.net / cur.net : 0)} />
            </div>
          </Panel>
        ))}
      </div>
      <Source>Source: {ACCOUNTING_SOURCE}. Rent and other fixed costs are the books&apos; per-store figures.</Source>
    </>
  );
}

// ───────────────────────── Statement ─────────────────────────

/** The period before, for "vs": the month before, the quarter before, or the same months last year. */
function previousOf(key: PeriodKey): { p: Pnl; label: string } {
  const { year } = LATEST;
  const [from, to] = periodMonths(key);
  if (key === "ytd") return { p: pnl(STORES, year - 1, from, to), label: `${MONTHS[from]} – ${MONTHS[to]} ${year - 1}` };
  if (key === "quarter") return { p: pnlSpan(STORES, year, from - 3, to - 3), label: `Q${Math.floor((from - 3) / 3) + 1} ${year} (${MONTHS[from - 3]} – ${MONTHS[to - 3]})` };
  const m = from - 1;
  return { p: pnlSpan(STORES, year, m, m), label: `${MONTHS[(m + 12) % 12]} ${m < 0 ? year - 1 : year}` };
}

function Statement() {
  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [selected, setSelected] = useState<string | null>(null);
  const { year } = LATEST;
  const [from, to] = periodMonths(period);
  const cur = useMemo(() => pnl(STORES, year, from, to), [year, from, to]);
  const before = useMemo(() => previousOf(period), [period]);
  const label = PERIODS.find((p) => p.key === period)!.label;
  const ofSales = (n: number) => pct(cur.revenue ? n / cur.revenue : 0);

  const cells = (id: string, goodWhenUp = true): React.ReactNode[] => [usd(cur[id]), usd(before.p[id]), <ChangeBoth key="c" now={cur[id]} before={before.p[id]} goodWhenUp={goodWhenUp} />, ofSales(cur[id])];
  const group = (sec: Section): StmtRow => ({
    id: sec,
    label: sec === "revenue" ? SECTION_LABEL[sec] : `Less: ${SECTION_LABEL[sec].toLowerCase()}`,
    cells: cells(sec, sec === "revenue"),
    children: ACCOUNTS.filter((a) => a.section === sec).map((a) => ({ id: a.id, label: a.label, tip: a.tip, cells: cells(a.id, sec === "revenue") })),
  });
  const columns: StmtColumn[] = [{ key: "now", header: label }, { key: "before", header: before.label, muted: true }, { key: "change", header: "Change" }, { key: "share", header: "% of sales", muted: true }];
  const rows: StmtRow[] = [group("revenue"), group("cogs"), { id: "gross", label: "Gross profit", cells: cells("gross"), kind: "subtotal" }, group("labor"), group("opex"), { id: "net", label: "Net profit", cells: cells("net"), kind: "total" }];

  const sel = selected ? ACCOUNTS.find((a) => a.id === selected) : undefined;
  const trend = sel ? accountTrend(sel.id, STORES) : [];

  const exportCsv = () => {
    const out: (string | number)[][] = [["Line", label, before.label, "% of sales"]];
    const walk = (rs: StmtRow[], depth = 0) =>
      rs.forEach((r) => {
        out.push([`${"  ".repeat(depth)}${r.label}`, Math.round(cur[r.id]), Math.round(before.p[r.id]), ofSales(cur[r.id])]);
        if (r.children) walk(r.children, depth + 1);
      });
    walk(rows);
    downloadCsv(`profit-${period}.csv`, out);
  };

  return (
    <>
      <Panel
        title="Profit & loss"
        sub={`${label} against ${before.label}. Open a group for its accounts; select a line for its monthly trend.`}
        actions={
          <>
            <div className="w-48">
              <SelectControl aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} className="h-8 text-menu-sm" />
            </div>
            <ExportButton onClick={exportCsv} />
          </>
        }
        className="space-y-5"
      >
        <div className="grid gap-5 border-b border-(--color-border-default) pb-5 sm:grid-cols-3">
          <BigStat label="Sales" value={usd(cur.revenue)} now={cur.revenue} before={before.p.revenue} vs={before.label} />
          <BigStat label="Costs" value={usd(costs(cur))} now={costs(cur)} before={costs(before.p)} vs={before.label} goodWhenUp={false} sub={`${ofSales(costs(cur))} of sales`} />
          <BigStat label="Net profit" value={usd(cur.net)} now={cur.net} before={before.p.net} vs={before.label} tone={cur.net < 0 ? "danger" : undefined} sub={`${ofSales(cur.net)} margin`} />
        </div>
        <div className="-mx-5 -mb-5">
          <StatementTable caption={`Profit & loss, ${label}`} columns={columns} rows={rows} onSelect={setSelected} selectedId={selected} />
        </div>
      </Panel>
      <Source>Source: {ACCOUNTING_SOURCE}. Whole dollars. Costs that fall as sales fall count as good news; sales that rise count as good news.</Source>

      <DetailDrawer open={!!sel} onClose={() => setSelected(null)} eyebrow={sel ? SECTION_LABEL[sel.section] : undefined} title={sel?.label ?? ""} meta={sel ? `${ACCOUNTING_SOURCE} · account ${sel.code}` : undefined}>
        {sel && (
          <>
            <div>
              <p className="text-jumbo-md text-(--color-text-primary) tabular-nums">{usd(cur[sel.id])}</p>
              <p className="mt-1.5 text-body-sm text-(--color-text-secondary)">
                {label} · <ChangeBoth now={cur[sel.id]} before={before.p[sel.id]} goodWhenUp={sel.section === "revenue"} /> vs {before.label}
              </p>
            </div>
            <div>
              <ChartLabel>By month, {year}</ChartLabel>
              <Sparkline points={trend.map((t) => ({ label: t.label, value: t.value }))} format={usd} ariaLabel={`${sel.label} by month`} />
            </div>
            <DetailList
              title="Figures"
              rows={[
                { label: label, value: usd(cur[sel.id]) },
                { label: before.label, value: usd(before.p[sel.id]) },
                { label: `Same months ${year - 1}`, value: usd(pnl(STORES, year - 1, from, to)[sel.id]) },
                { label: "Share of sales", value: ofSales(cur[sel.id]) },
              ]}
            />
            {sel.tip && <p className="text-body-sm text-(--color-text-secondary)">{sel.tip}</p>}
          </>
        )}
      </DetailDrawer>
    </>
  );
}
