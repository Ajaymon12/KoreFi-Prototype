"use client";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, COLUMNS_CLASS, Column, Fact, InOutBars, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { StatementTable, type StmtColumn, type StmtRow } from "@/components/finance/StatementTable";
import { ExportButton, HundredBar, downloadCsv, pct } from "@/components/finance/parts";
import { channelName, moneyByStore, payoutWeeks, sum, type DashboardData, type PayoutWeek } from "@/lib/sources/dashboard";
import type { Insight } from "@/lib/sources/overview";
import type { Payout, SourceId } from "@/lib/sources/types";
import { fmtCents as fmt, locations } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import { PART_COLORS, PosNote, type ProfitTab } from "./ProfitView";

// Profit without a POS: a delivery-only P&L from the apps' payout, marketing and order-error
// reports. Same four views as the books version, built from the same chart pieces.

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
    return (
      <>
        <PosNote />
        {banner}
        <Panel title="Where every $100 of app sales came from" sub={PERIOD.range}>
          <HundredBar total={gross} parts={lines.map((l, i) => ({ key: l.source, label: l.app, value: l.gross, color: PART_COLORS[i] }))} />
        </Panel>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {lines.map((l) => (
            <Panel key={l.source} className="flex flex-col gap-5">
              <BigStat label={l.app} value={fmt(l.gross)} sub={`${share(l.gross)} of app sales · ${PERIOD.label.toLowerCase()}`} />
              <Sparkline points={weeklyGross(l, weeks)} format={fmt} ariaLabel={`${l.app} sales by week`} />
              <div>
                <Fact label="Commissions & fees" value={`−${fmt(l.fees)}`} />
                <Fact label="Promos & ads" value={l.promos ? `−${fmt(l.promos)}` : "None"} />
                <Fact label="Chargebacks lost" value={l.lost ? `−${fmt(l.lost)}` : "None"} hint="After KoreFi's disputes" />
                <Fact label="Paid to you" value={<b className="font-semibold">{fmt(l.paid)}</b>} />
                <Fact label="Of every $1" value={`${Math.round((l.paid / (l.gross || 1)) * 100)}¢`} />
              </div>
            </Panel>
          ))}
        </div>
        <Source>Grubhub has no payout report yet; it appears here once KoreFi uploads it.</Source>
      </>
    );
  }

  if (tab === "store") {
    // A store's app sales by week, summed over the apps' daily reports.
    const storeWeeks = (store: string) => weeks.map((w) => ({ label: w.label, value: sum(data.ops.filter((o) => o.store === store).flatMap((o) => o.daily.filter((d) => d.date >= w.start && d.date <= w.end).map((d) => d.sales))) }));
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
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {stores.map((s) => (
            <Panel key={s.store} className="flex flex-col gap-5">
              <BigStat label={s.store} value={fmt(s.net)} tone="success" sub={`paid to you · ${share(s.gross)} of app sales`} />
              <Sparkline points={storeWeeks(s.store)} format={fmt} ariaLabel={`${s.store} app sales by week`} />
              <div>
                <Fact label="App sales" value={fmt(s.gross)} />
                <Fact label="Commissions & fees" value={`−${fmt(s.fees)}`} />
                {s.channels.map((c) => (
                  <Fact key={c.source} label={`${c.name} paid`} value={fmt(c.net)} />
                ))}
              </div>
            </Panel>
          ))}
        </div>
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
      <Panel title="Delivery profit & loss by week" sub={PERIOD.range} actions={<ExportButton onClick={exportCsv} />} className="space-y-5">
        <div className="grid gap-5 border-b border-(--color-border-default) pb-5 sm:grid-cols-3">
          <BigStat label="App sales" value={fmt(gross)} sub={`${lines.length} apps reporting`} />
          <BigStat label="Platform costs" value={`−${fmt(platform)}`} sub={`${share(platform)} of app sales`} />
          <BigStat label="Paid to you" value={fmt(total("paid"))} tone="success" sub={`${Math.round((gross ? total("paid") / gross : 0) * 100)}¢ of every $1`} />
        </div>
        <div className="-mx-5 -mb-5">
          <StatementTable caption={`Delivery profit & loss by week, ${PERIOD.range}`} columns={columns} rows={rows} />
        </div>
      </Panel>
      <Source>Weekly figures are spread from each app&apos;s period payout by its daily sales. Promos and chargebacks are on the day they were charged.</Source>
    </>
  );
}
