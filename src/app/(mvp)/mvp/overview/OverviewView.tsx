"use client";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { MvpFrame, latestSync } from "@/components/mvp/frame";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, Column, Fact, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { DataSources } from "@/components/dashboard/DataSources";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { DeltaChip, StatusBadge } from "@/components/dashboard/primitives";
import { HundredBar, pct, usd } from "@/components/finance/parts";
import { dataMode, disputeStats, disputesByReason, payoutStatus, payoutWeeks, sum, type DashboardData } from "@/lib/sources/dashboard";
import { briefFor, insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { promoStats, promoTrend, promosByApp } from "@/lib/sources/promos";
import { LATEST, MONTHS, STORES, closedWeeks, pnl, pnlWeek, weekLabel } from "@/lib/finance/books";
import { fmtCents as fmt, locations, user } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";

// MVP / Overview, after Mercury's Books overview: the week's findings first, then one column per
// report (Profit, Payouts, Chargebacks, Promos) with its headline number, one chart and what's
// behind it, each linking to its page; then the stores. Report only: nothing asks the owner to act.

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: PERIOD.timezone }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const ChartLabel = ({ children }: { children: React.ReactNode }) => <p className="mb-2 text-body-sm text-(--color-text-secondary)">{children}</p>;

export function OverviewView({ data }: { data: DashboardData }) {
  const scope = scopeFor(undefined, locations);
  const rows = storeRows(data, scope);
  const insights = insightsFor(data, scope, rows);
  const brief = briefFor(data, scope, rows);
  const mode = dataMode(data.connections);
  const weeks = payoutWeeks(data.payouts, data.ops, PERIOD.start);

  // Delivery apps
  const gross = sum(data.payouts.map((p) => p.gross));
  const net = sum(data.payouts.map((p) => p.net));
  const lost = sum(data.disputes.filter((d) => d.status === "lost").map((d) => d.amount));

  // Profit: the books' latest closed month with a POS, the apps' payouts without one.
  const { year, month } = LATEST;
  const cur = pnl(STORES, year, month, month);
  const prev = pnl(STORES, year, month - 1, month - 1);
  const closed = closedWeeks(year);
  const bookWeeks = Array.from({ length: 12 }, (_, i) => closed - 12 + i).map((w) => ({ label: weekLabel(year, w), value: pnlWeek(STORES, year, w).net }));

  // Payouts
  const payouts = data.payouts.map((p) => ({ app: p.source, name: data.connections.find((c) => c.id === p.source)?.name ?? p.source, payout: p, ...payoutStatus(p, data.deposits) }));
  const landed = sum(payouts.map((p) => p.deposited));
  const toLand = sum(payouts.map((p) => (p.status === "due" ? p.payout.net : p.status === "short" ? -p.delta : 0)));

  // Chargebacks
  const open = data.disputes.filter((d) => d.status === "open");
  const stats = disputeStats(data.disputes);
  const won = data.disputes.filter((d) => d.status === "won");
  const decided = data.disputes.filter((d) => d.status === "won" || d.status === "lost").length;

  // Promos
  const promos = promoStats(data.promos);
  const trend = promoTrend(data.promos);

  return (
    <MvpFrame title="Overview" actions={<><DataSources syncedAt={latestSync(data.connections)} timezoneNote={PERIOD.timezoneNote} /><DateRangeFilter /></>}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1">
        <div>
          <h1 className="text-page-title text-(--color-text-primary)">
            {greeting()}, {user.firstName}
          </h1>
          <p className="mt-1 text-body-md text-(--color-text-secondary)">
            {scope.label}, {PERIOD.range}
            {mode === "3pd-only" && " · delivery apps only until your POS is connected"}
          </p>
        </div>
        {/* The weekly brief, as a compact pill: what lands on WhatsApp and email this week. */}
        <Link href="/mvp/brief" className="group flex max-w-full items-center gap-2.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) py-1.5 pr-3 pl-1.5 text-body-md outline-none hover:border-(--color-border-darker) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          <span className="grid size-7 shrink-0 place-items-center rounded-circle bg-(--brand-200) text-(--color-primary)">
            <Mail className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 truncate text-(--color-text-primary)">
            <span className="text-(--color-text-secondary)">{brief.eyebrow} · </span>
            {brief.headline}
          </span>
          <ArrowRight className="size-4 shrink-0 text-(--color-text-secondary) transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </header>

      <InsightBanner insights={insights.slice(0, 3)} title="What KoreFi sees this week" />

      <div className={columnsClass(2)}>
        <Column title="Profit" href="/mvp/profit">
          {mode === "consolidated" ? (
            <>
              <BigStat label={`Net profit · ${MONTHS[month]} ${year}`} value={usd(cur.net)} now={cur.net} before={prev.net} vs={`${MONTHS[month - 1]} ${year}`} tone={cur.net < 0 ? "danger" : undefined} sub={`${pct(cur.revenue ? cur.net / cur.revenue : 0)} margin on ${usd(cur.revenue)} of sales`} />
              <div>
                <ChartLabel>Net profit by week</ChartLabel>
                <Sparkline points={bookWeeks} format={usd} ariaLabel="Net profit by week, last 12 weeks" />
              </div>
              <div>
                <Fact label="Sales" value={usd(cur.revenue)} />
                <Fact label="Food, labor & running costs" value={`−${usd(cur.cogs + cur.labor + cur.opex)}`} />
              </div>
            </>
          ) : (
            <>
              <BigStat label="Paid to you by the apps" value={fmt(net - lost)} tone="success" sub={`${Math.round((gross ? (net - lost) / gross : 0) * 100)}¢ of every $1 sold · ${PERIOD.label.toLowerCase()}`} />
              <div>
                <ChartLabel>Paid to you by week</ChartLabel>
                <Sparkline points={weeks.map((w) => ({ label: w.label, value: w.net }))} format={fmt} ariaLabel="Paid to you by week" />
              </div>
              <div>
                <Fact label="App sales" value={fmt(gross)} />
                <Fact label="Platform costs" value={`−${fmt(gross - net + lost)}`} />
              </div>
            </>
          )}
        </Column>

        <Column title="Payouts" href="/mvp/payouts">
          <BigStat label="Reached your bank" value={fmt(landed)} tone={toLand ? undefined : "success"} sub={toLand ? `${fmt(toLand)} still to land · KoreFi is on it` : "Every payout landed"} />
          <div>
            <ChartLabel>Of every $100 the apps paid out</ChartLabel>
            <HundredBar
              total={net || 1}
              legendClassName="grid-cols-2"
              parts={[
                { key: "landed", label: "In your bank", value: landed, color: "var(--brand-900)" },
                { key: "toland", label: "Still to land", value: toLand, color: "var(--chart-lost)" },
              ]}
            />
          </div>
          <div>
            {payouts.map((p) => (
              <Fact
                key={p.app}
                label={p.name}
                value={<StatusBadge tone={p.status === "landed" ? "success" : p.status === "short" ? "danger" : "warning"}>{p.status === "landed" ? "Landed" : p.status === "short" ? "Short · KoreFi is reviewing" : "Due"}</StatusBadge>}
              />
            ))}
          </div>
        </Column>
      </div>

      <div className={columnsClass(2)}>
        <Column title="Chargebacks" href="/mvp/chargebacks">
          <BigStat label="Being disputed by KoreFi" value={fmt(sum(open.map((d) => d.amount)))} sub={open.length ? `${open.length} order${open.length === 1 ? "" : "s"} · filed automatically, nothing for you to do` : "Nothing open right now"} />
          <div>
            <Fact label="Won back" value={<span className="text-(--color-text-success)">+{fmt(stats.recovered)}</span>} hint={`${won.length} orders`} />
            <Fact label="Win rate" value={`${pct(stats.winRate, 0)} · ${won.length} of ${decided} decided`} />
            <Fact label="Kept by the apps" value={lost ? <span className="text-(--color-text-danger)">−{fmt(lost)}</span> : "None"} />
          </div>
          <ShareBars title="What went wrong" rows={disputesByReason(data.disputes).map((r) => ({ key: r.key, label: r.label, value: r.total.amount }))} format={fmt} max={4} color="var(--chart-neutral)" />
        </Column>

        <Column title="Promos" href="/mvp/promos">
          <BigStat label="Return on promos & ads" value={promos.spend ? `$${promos.perDollar.toFixed(2)}` : "–"} tone={promos.perDollar >= 3 ? "success" : promos.spend && promos.perDollar < 1 ? "danger" : undefined} sub={promos.spend ? `in sales per $1 · ${fmt(promos.spend)} spent, ${promos.newCustomers} first-time customers` : "No promos running"} />
          {trend.length > 0 && (
            <div>
              <ChartLabel>Promo spend by week</ChartLabel>
              <Sparkline points={trend.map((v, i) => ({ label: weeks[i]?.label ?? `Week ${i + 1}`, value: v }))} format={fmt} ariaLabel="Promo spend by week" />
            </div>
          )}
          <ShareBars title="Sales from promos, by app" rows={promosByApp(data.promos).map((a) => ({ key: a.source, label: `${a.app} · $${a.perDollar.toFixed(2)} per $1`, value: a.sales }))} format={fmt} />
        </Column>
      </div>

      <section aria-label="Your stores" className="space-y-3">
        <h2 className="px-1 text-subtitle-lg text-(--color-text-primary)">Your stores</h2>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => {
            const openHere = open.filter((d) => d.store === r.store);
            // A store's app sales by week, from the apps' daily reports.
            const storeWeeks = weeks.map((w) => ({ label: w.label, value: sum(data.ops.filter((o) => o.store === r.store).flatMap((o) => o.daily.filter((d) => d.date >= w.start && d.date <= w.end).map((d) => d.sales))) }));
            return (
              <Panel key={r.store} className="flex flex-col gap-5">
                <BigStat label={r.store} value={fmt(r.net)} sub={`paid to you by the apps · ${fmt(r.gross)} in app sales`} />
                <Sparkline points={storeWeeks} format={fmt} ariaLabel={`${r.store} app sales by week`} />
                <div>
                  <Fact label="Sales vs the period before" value={<DeltaChip value={r.change} />} />
                  <Fact label="Chargebacks" value={openHere.length ? <StatusBadge tone="warning">{openHere.length} being disputed</StatusBadge> : <StatusBadge tone="success">None open</StatusBadge>} />
                  <Fact label="Closed on the apps" value={r.downtimeMinutes ? `${r.downtimeMinutes} min · ~${fmt(r.lostToDowntime)} missed` : "Never"} />
                </div>
              </Panel>
            );
          })}
        </div>
      </section>
    </MvpFrame>
  );
}
