"use client";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, COLUMNS_CLASS, Column, Fact, InOutBars, MiniTrend, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { AppName, ReportTable, TableFrame, type TableColumn } from "@/components/ui/ReportTable";
import { StatementTable, type StmtColumn, type StmtRow } from "@/components/finance/StatementTable";
import { ExportButton, HundredBar, downloadCsv, pct } from "@/components/finance/parts";
import { channelName, moneyByStore, payoutWeeks, sum, type DashboardData, type PayoutWeek } from "@/lib/sources/dashboard";
import type { Insight } from "@/lib/sources/overview";
import type { Payout, SourceId } from "@/lib/sources/types";
import { fmtCents as fmt, locations } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import { PART_COLORS, PosNote, type ProfitTab } from "./ProfitView";

// Profit without a POS: a delivery-only P&L from the apps' payout, marketing and order-error
// reports. Same four views as the books version, built from the same chart pieces and tables
// (edge to edge, sortable, a small trend line per row).

type AppLine = { source: SourceId; app: string; gross: number; fees: number; promos: number; lost: number; net: number; paid: number };

function appLines(data: DashboardData): AppLine[] {
  return data.payouts.map((p: Payout) => {
    const promos = sum(data.promos.filter((x) => x.source === p.source).map((x) => x.spend));
    const lost = sum(data.disputes.filter((d) => d.source === p.source && d.status === "lost").map((d) => d.amount));
    return { source: p.source, app: channelName(p.source), gross: p.gross, fees: p.fees - promos, promos, lost, net: p.net, paid: p.net - lost };
  });
}

/** An app's sales in each week, scaled from the week's estimated net payout. */
const weeklyGross = (l: AppLine, weeks: PayoutWeek[]) => weeks.map((w) => ({ label: w.label, value: l.net ? ((w.byChannel.find((c) => c.source === l.source)?.net ?? 0) * l.gross) / l.net : 0 }));

const Source = ({ children }: { children: React.ReactNode }) => <p className="px-1 text-body-sm text-(--color-text-tertiary)">{children}</p>;
const ChartLabel = ({ children }: { children: React.ReactNode }) => <p className="mb-2 text-body-sm text-(--color-text-secondary)">{children}</p>;
const shortStore = (s: string) => s.replace("Casa Alvarez", "").replace(/^[\s–-]+/, "") || s;

export function AppsOnly({ tab, data, insights }: { tab: ProfitTab; data: DashboardData; insights: Insight[] }) {
  const lines = appLines(data);
  const total = (k: keyof Omit<AppLine, "source" | "app">) => sum(lines.map((l) => l[k]));
  const gross = total("gross");
  const share = (n: number) => pct(gross ? n / gross : 0);
  const weeks = payoutWeeks(data.payouts, data.ops, PERIOD.start);
  const platform = total("fees") + total("promos") + total("lost");
  const stores = moneyByStore(data.payouts, data.storefronts, locations);
  const banner = <InsightBanner insights={insights} title="What KoreFi sees this period" />;

  if (tab === "summary") {
    return (
      <>
        <PosNote />
        {banner}
        <div className={COLUMNS_CLASS}>
          <Column title="App sales" href="/mvp/profit?tab=channel">
            <BigStat label={`Total app sales · ${PERIOD.label.toLowerCase()}`} value={fmt(gross)} sub={`${lines.length} app${lines.length === 1 ? "" : "s"} reporting · ${PERIOD.range}`} />
            <div>
              <ChartLabel>Sales by week</ChartLabel>
              <Sparkline points={weeks.map((w) => ({ label: w.label, value: w.gross }))} format={fmt} ariaLabel="App sales by week" />
            </div>
            <ShareBars title="By app" rows={lines.map((l) => ({ key: l.source, label: l.app, value: l.gross }))} format={fmt} />
          </Column>
          <Column title="Platform costs" href="/mvp/profit?tab=statement">
            <BigStat label="Commissions, fees, promos and chargebacks" value={`−${fmt(platform)}`} sub={`${share(platform)} of app sales`} />
            <div>
              <Fact label="Commissions & fees" value={share(total("fees"))} />
              <Fact label="Promos & ads" value={share(total("promos"))} />
              <Fact label="Chargebacks lost" value={share(total("lost"))} hint="After KoreFi's disputes" />
            </div>
            <ShareBars title="By app" rows={lines.map((l) => ({ key: l.source, label: l.app, value: l.fees + l.promos + l.lost }))} format={fmt} color="var(--chart-neutral)" />
          </Column>
          <Column title="Paid to you" href="/mvp/profit?tab=store">
            <BigStat label="After every platform cost" value={fmt(total("paid"))} tone="success" sub={`${Math.round((gross ? total("paid") / gross : 0) * 100)}¢ of every $1 sold`} />
            <div>
              <ChartLabel>App sales vs platform costs by week</ChartLabel>
              <InOutBars periods={weeks.map((w) => ({ label: w.label, in: w.gross, out: w.gross - w.net }))} inLabel="App sales" outLabel="Platform costs" format={fmt} ariaLabel="App sales and platform costs by week" />
            </div>
            <ShareBars title="By store" rows={stores.map((s) => ({ key: s.store, label: s.store, value: s.net }))} format={fmt} />
          </Column>
        </div>
        <Source>Source: DoorDash, Uber Eats and Grubhub payout, marketing and order-error reports. Weeks are estimated from each app&apos;s daily sales.</Source>
      </>
    );
  }

  if (tab === "channel") {
    const appColumns: TableColumn<AppLine>[] = [
      { key: "app", header: "App", cell: (l) => <AppName source={l.source} name={l.app} />, sort: (l) => l.app },
      { key: "gross", header: "Sales", align: "right", cell: (l) => fmt(l.gross), sub: (l) => `${share(l.gross)} of app sales`, sort: (l) => l.gross },
      { key: "trend", header: "By week", cell: (l) => <MiniTrend values={weeklyGross(l, weeks).map((w) => w.value)} label={`${l.app} sales by week`} /> },
      { key: "fees", header: "Commissions & fees", align: "right", cell: (l) => `−${fmt(l.fees)}`, sort: (l) => l.fees },
      { key: "promos", header: "Promos & ads", align: "right", cell: (l) => (l.promos ? `−${fmt(l.promos)}` : "None"), sort: (l) => l.promos },
      { key: "lost", header: "Chargebacks lost", align: "right", cell: (l) => (l.lost ? `−${fmt(l.lost)}` : "None"), sort: (l) => l.lost },
      { key: "paid", header: "Paid to you", align: "right", cell: (l) => <b className="font-semibold">{fmt(l.paid)}</b>, sub: (l) => `${Math.round((l.paid / (l.gross || 1)) * 100)}¢ of every $1`, sort: (l) => l.paid },
    ];
    return (
      <>
        <PosNote />
        {banner}
        <Panel title="Where every $100 of app sales came from" sub={PERIOD.range}>
          <HundredBar total={gross} parts={lines.map((l, i) => ({ key: l.source, label: l.app, value: l.gross, color: PART_COLORS[i] }))} />
        </Panel>
        <ReportTable title="By app" description={PERIOD.range} columns={appColumns} rows={lines} rowKey={(l) => l.source} noun="apps" initialSort={{ key: "gross", dir: "desc" }} />
        <Source>Grubhub has no payout report yet; it appears here once KoreFi uploads it.</Source>
      </>
    );
  }

  if (tab === "store") {
    // A store's app sales by week, summed over the apps' daily reports.
    const storeWeeks = (store: string) => weeks.map((w) => ({ label: w.label, value: sum(data.ops.filter((o) => o.store === store).flatMap((o) => o.daily.filter((d) => d.date >= w.start && d.date <= w.end).map((d) => d.sales))) }));
    type St = (typeof stores)[number];
    const storeColumns: TableColumn<St>[] = [
      { key: "store", header: "Store", cell: (r) => r.store, sort: (r) => r.store },
      { key: "gross", header: "App sales", align: "right", cell: (r) => fmt(r.gross), sub: (r) => `${share(r.gross)} of app sales`, sort: (r) => r.gross },
      { key: "trend", header: "By week", cell: (r) => <MiniTrend values={storeWeeks(r.store).map((w) => w.value)} label={`${r.store} app sales by week`} /> },
      { key: "fees", header: "Commissions & fees", align: "right", cell: (r) => `−${fmt(r.fees)}`, sort: (r) => r.fees },
      { key: "byApp", header: "Paid by app", cell: (r) => r.channels.map((c) => `${c.name} ${fmt(c.net)}`).join(" · ") },
      { key: "net", header: "Paid to you", align: "right", cell: (r) => <b className="font-semibold text-(--color-text-success)">{fmt(r.net)}</b>, sort: (r) => r.net },
    ];
    return (
      <>
        <PosNote />
        {banner}
        <div className={columnsClass(2)}>
          <Column title="App sales vs platform costs by store">
            <InOutBars periods={stores.map((s) => ({ label: shortStore(s.store), in: s.gross, out: s.fees }))} inLabel="App sales" outLabel="Platform costs" format={fmt} ariaLabel="App sales and platform costs by store" />
          </Column>
          <Column title="Paid to you by store">
            <ShareBars rows={stores.map((s) => ({ key: s.store, label: s.store, value: s.net }))} format={fmt} />
          </Column>
        </div>
        <ReportTable title="By store" description={PERIOD.range} columns={storeColumns} rows={stores} rowKey={(r) => r.store} noun="stores" initialSort={{ key: "net", dir: "desc" }} />
        <Source>Promos and chargebacks are reported per app, not per store, so store figures stop at commissions and fees.</Source>
      </>
    );
  }

  // Statement: one column per week, then the period total.
  const inWeek = (date: string, w: PayoutWeek) => date >= w.start && date <= w.end;
  const weekPromos = (source: SourceId, i: number) => sum(data.promos.filter((p) => p.source === source).map((p) => p.weeklySpend[i] ?? 0));
  const weekLost = (source: SourceId, w: PayoutWeek) => sum(data.disputes.filter((d) => d.source === source && d.status === "lost" && inWeek(d.date, w)).map((d) => d.amount));
  const columns: StmtColumn[] = [...weeks.map((w) => ({ key: w.start, header: w.label })), { key: "total", header: "Total" }];
  const money = (xs: number[], negative = false) => [...xs, sum(xs)].map((n) => (negative && n ? `−${fmt(n)}` : fmt(n)));
  const perApp = (f: (source: SourceId, i: number) => number) => lines.map((l) => ({ app: l.app, source: l.source, values: weeks.map((_, i) => f(l.source, i)) }));
  const groupOf = (id: string, label: string, parts: ReturnType<typeof perApp>, negative = true): StmtRow => ({
    id,
    label,
    cells: money(weeks.map((_, i) => sum(parts.map((p) => p.values[i]))), negative),
    children: parts.map((p) => ({ id: `${id}-${p.source}`, label: p.app, cells: money(p.values, negative) })),
  });
  const net = perApp((s, i) => weeks[i].byChannel.find((c) => c.source === s)?.net ?? 0);
  const grossBy = perApp((s, i) => weeklyGross(lines.find((x) => x.source === s)!, weeks)[i].value);
  const promos = perApp(weekPromos);
  const fees = perApp((s, i) => grossBy.find((g) => g.source === s)!.values[i] - net.find((g) => g.source === s)!.values[i] - weekPromos(s, i));
  const lost = perApp((s, i) => weekLost(s, weeks[i]));
  const paid = weeks.map((w) => w.net - sum(lines.map((l) => weekLost(l.source, w))));
  const rows: StmtRow[] = [
    groupOf("sales", "App sales", grossBy, false),
    groupOf("fees", "Less: commissions & fees", fees),
    groupOf("promos", "Less: promos & ads", promos),
    groupOf("lost", "Less: chargebacks lost", lost),
    { id: "paid", label: "Paid to you", cells: money(paid), kind: "total" },
  ];
  const exportCsv = () => {
    const out: (string | number)[][] = [["Line", ...columns.map((c) => c.header)]];
    const walk = (rs: StmtRow[], depth = 0) =>
      rs.forEach((r) => {
        out.push([`${"  ".repeat(depth)}${r.label}`, ...r.cells.map(String)]);
        if (r.children) walk(r.children, depth + 1);
      });
    walk(rows);
    downloadCsv("delivery-profit-by-week.csv", out);
  };
  return (
    <>
      <PosNote />
      <div className={columnsClass(3)}>
        <Column title="App sales">
          <BigStat label={PERIOD.range} value={fmt(gross)} sub={`${lines.length} apps reporting`} />
        </Column>
        <Column title="Platform costs">
          <BigStat label="Commissions, fees, promos and chargebacks" value={`−${fmt(platform)}`} sub={`${share(platform)} of app sales`} />
        </Column>
        <Column title="Paid to you">
          <BigStat label="After every platform cost" value={fmt(total("paid"))} tone="success" sub={`${Math.round((gross ? total("paid") / gross : 0) * 100)}¢ of every $1`} />
        </Column>
      </div>
      <TableFrame title="Delivery profit & loss by week" description={`${PERIOD.range}. Open a line for each app.`} toolbar={<div className="ml-auto"><ExportButton onClick={exportCsv} /></div>}>
        <StatementTable caption={`Delivery profit & loss by week, ${PERIOD.range}`} columns={columns} rows={rows} flush />
      </TableFrame>
      <Source>Weekly figures are spread from each app&apos;s period payout by its daily sales. Promos and chargebacks are on the day they were charged.</Source>
    </>
  );
}
