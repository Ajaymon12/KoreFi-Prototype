"use client";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, COLUMNS_CLASS, Column, Fact, InOutBars, MiniTrend, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { WeeklyPnl } from "@/components/finance/WeeklyPnl";
import { PnlStory } from "@/components/finance/PnlStory";
import { ChangePct, HundredBar, pct, usd, vsLastYear } from "@/components/finance/parts";
import { ACCOUNTING_SOURCE, ACCOUNTS, LATEST, MONTHS, STORES, closedWeeks, pnl, pnlWeek, weekLabel, type Pnl, type Section } from "@/lib/finance/books";
import { shortStore } from "@/lib/finance/outlets";
import { sum } from "@/lib/sources/dashboard";
import type { Insight } from "@/lib/sources/overview";
import { PART_COLORS, type ProfitTab } from "./ProfitView";

// Profit with a POS connected: the books. Four views on the same figures:
//   Summary    three columns, Sales · Costs · Profit
//   By channel where every $100 came from, then a table of channels (trend, change, what the apps keep)
//   By store   store against store, then a table of stores
//   Statement  the P&L week by week (WeeklyPnl): bars and a statement on desktop, one glanceable
//              week on phones
//   P&L        the same week as a story (PnlStory), for A/B against Statement
// Tables are the MVP's: edge to edge, sortable, a small trend line per row (Figma 1431:28101).

const costs = (p: Pnl) => p.cogs + p.labor + p.opex;
const CHANNELS: { key: string; label: string; accounts: string[]; app?: string }[] = [
  { key: "instore", label: "In-store & takeout", accounts: ["dine-in"] },
  { key: "web", label: "Website & catering", accounts: ["catering"] },
  { key: "doordash", label: "DoorDash", accounts: ["doordash"], app: "doordash" },
  { key: "uber", label: "Uber Eats", accounts: ["uber"], app: "ubereats" },
  { key: "grubhub", label: "Grubhub", accounts: ["grubhub"], app: "grubhub" },
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

  if (tab === "statement") return <WeeklyPnl />;
  if (tab === "pnl") return <PnlStory />;

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
    type Ch = (typeof channels)[number];
    const channelColumns: TableColumn<Ch>[] = [
      { key: "label", header: "Channel", cell: (c) => <AppName source={c.app ?? c.key} name={c.label} />, sub: (c) => (c.app ? "Delivery app" : "Direct"), sort: (c) => c.label },
      { key: "sales", header: "Sales", align: "right", cell: (c) => usd(c.sales), sub: (c) => <><ChangePct now={c.sales} before={c.before} /> vs {MONTHS[(month + 11) % 12]}</>, sort: (c) => c.sales },
      { key: "share", header: "Share", align: "right", cell: (c) => pct(c.share), sort: (c) => c.share },
      { key: "trend", header: "Last 12 weeks", cell: (c) => <MiniTrend values={c.trend.map((t) => t.value)} label={`${c.label} sales by week`} /> },
      { key: "fees", header: "Commissions & fees", align: "right", cell: (c) => (c.app ? `−${usd(c.fees)}` : "None"), sort: (c) => c.fees },
      { key: "after", header: "After platform costs", align: "right", cell: (c) => usd(c.after), sub: (c) => `${Math.round((c.after / (c.sales || 1)) * 100)}¢ of every $1`, sort: (c) => c.after },
    ];
    return (
      <>
        <InsightBanner insights={insights} title={`What KoreFi sees in ${MONTHS[month]}`} />
        <Panel title="Where every $100 of sales came from" sub={`${label} · in-store first, then the website and the delivery apps`}>
          <HundredBar total={cur.revenue} parts={channels.map((c, i) => ({ key: c.key, label: c.label, value: c.sales, color: PART_COLORS[i] }))} />
        </Panel>
        <ReportTable
          title="Sales by channel"
          description={`${label}. Marketplace commissions are split across the apps in proportion to their sales.`}
          columns={channelColumns}
          rows={channels}
          rowKey={(c) => c.key}
          noun="channels"
          initialSort={{ key: "sales", dir: "desc" }}
        />
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
  type St = (typeof stores)[number];
  const storeColumns: TableColumn<St>[] = [
    { key: "store", header: "Store", cell: (r) => r.store, sort: (r) => r.store },
    { key: "sales", header: "Sales", align: "right", cell: (r) => usd(r.sales), sort: (r) => r.sales },
    { key: "costs", header: "Costs", align: "right", cell: (r) => `−${usd(r.costs)}`, sort: (r) => r.costs },
    { key: "net", header: "Net profit", align: "right", cell: (r) => <span className={r.net < 0 ? "text-(--color-text-danger)" : undefined}>{usd(r.net)}</span>, sub: (r) => <><ChangePct now={r.net} before={r.before} /> vs {MONTHS[(month + 11) % 12]}</>, sort: (r) => r.net },
    { key: "margin", header: "Margin", align: "right", cell: (r) => pct(r.margin), sort: (r) => r.margin },
    { key: "trend", header: "Net profit, 12 weeks", cell: (r) => <MiniTrend values={r.trend.map((t) => t.value)} label={`${r.store} net profit by week`} /> },
    { key: "share", header: "Share of group profit", align: "right", cell: (r) => pct(cur.net ? r.net / cur.net : 0), sort: (r) => r.net },
  ];
  return (
    <>
      <InsightBanner insights={insights} title={`What KoreFi sees in ${MONTHS[month]}`} />
      <div className={columnsClass(2)}>
        <Column title="Sales vs costs by store">
          <InOutBars periods={stores.map((s) => ({ label: shortStore(s.store), in: s.sales, out: s.costs }))} inLabel="Sales" outLabel="Costs" format={usd} ariaLabel="Sales and costs by store" />
        </Column>
        <Column title="Net profit by store">
          <ShareBars rows={stores.map((s) => ({ key: s.store, label: s.store, value: s.net }))} format={usd} />
        </Column>
      </div>
      <ReportTable title="Profit by store" description={label} columns={storeColumns} rows={stores} rowKey={(r) => r.store} noun="stores" initialSort={{ key: "net", dir: "desc" }} />
      <Source>Source: {ACCOUNTING_SOURCE}. Rent and other fixed costs are the books&apos; per-store figures.</Source>
    </>
  );
}
