"use client";
import { useState } from "react";
import { CircleDashed, CheckCircle2, LayoutDashboard, ShieldAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MvpFrame, latestSync, useTab } from "@/components/mvp/frame";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, Column, Fact, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { HundredBar } from "@/components/finance/parts";
import { DataSources } from "@/components/dashboard/DataSources";
import { StatusBadge } from "@/components/dashboard/primitives";
import { AppName, ReportTable, type TableColumn, type TableFilter } from "@/components/ui/ReportTable";
import { DetailDrawer, DetailList, DrawerSection, Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { TrendChart } from "@/components/dashboard/ChargebackTrend";
import {
  channelName,
  cumulativeByDay,
  daysLeft,
  disputeStage,
  disputeStats,
  disputesByReason,
  disputesByStore,
  DISPUTE_WINDOW_DAYS,
  DISPUTING_SINCE,
  STAGE_LABEL,
  sum,
  windowCloses,
  type DashboardData,
  type DisputeStage,
} from "@/lib/sources/dashboard";
import { forPage } from "@/lib/mvp/insights";
import { insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { fmtCents as fmt, locations } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import type { Dispute, DisputeStatus } from "@/lib/sources/types";

// MVP / Chargebacks: error charges from the delivery apps, with KoreFi's disputes filed for the
// owner automatically. Same language as Profit and Payouts: the AI card, three columns (headline,
// one chart, what's behind it), then the table edge to edge.
//   Summary   what was charged back, what came back, what went wrong; where every $100 went
//   Open      what KoreFi is working, the next deadline, where each one is; the open list
//   Resolved  won, lost, win rate; charged vs won back over time; the decided list

const TABS = [
  { key: "summary", label: "Summary", Icon: LayoutDashboard },
  { key: "open", label: "Open", Icon: CircleDashed },
  { key: "resolved", label: "Resolved", Icon: CheckCircle2 },
] as const;

const STATUSES: DisputeStatus[] = ["won", "open", "lost", "auto_refunded"];
const STAGE_TONE: Record<DisputeStage, "info" | "warning" | "success" | "danger" | "neutral"> = { detected: "info", filed: "info", awaiting: "warning", won: "success", lost: "danger", auto_refunded: "neutral" };
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const key = (d: Dispute) => `${d.source}-${d.id}`;
const ChartLabel = ({ children }: { children: React.ReactNode }) => <p className="mb-2 text-body-sm text-(--color-text-secondary)">{children}</p>;

/** "DoorDash $43.75 · Uber Eats $13.30" for a set of disputes. */
const channelSplit = (rows: Dispute[]) =>
  [...new Set(rows.map((d) => d.source))].map((s) => `${channelName(s)} ${fmt(sum(rows.filter((d) => d.source === s).map((d) => d.amount)))}`).join(" · ") || "none";

/** The automation's steps for one charge, as far as it has got. */
function timeline(d: Dispute): TimelineStep[] {
  const app = channelName(d.source);
  const stage = disputeStage(d, PERIOD.end);
  const steps: TimelineStep[] = [{ label: `${app} charged ${fmt(d.amount)} back`, date: day(d.date), state: "done" }];
  if (stage === "auto_refunded") return [...steps, { label: `${app} refunded the customer itself; nothing was charged to you`, state: "done" }];
  steps.push({ label: "KoreFi found it", date: day(d.date), state: "done" });
  steps.push(stage === "detected" ? { label: "KoreFi files the dispute on the next run", state: "current" } : { label: "KoreFi filed the dispute with the evidence", date: day(plusDays(d.date, 1)), state: "done" });
  if (stage === "filed" || stage === "awaiting") {
    const closes = windowCloses(d);
    const left = closes ? daysLeft(closes, PERIOD.end) : undefined;
    steps.push({ label: `Waiting on ${app}`, state: "current" });
    steps.push({ label: closes ? `${app}'s window closes ${day(closes)}${left !== undefined && left >= 0 ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""}` : `Decision from ${app}`, state: "upcoming" });
  }
  if (stage === "won") steps.push({ label: `Won back ${fmt(d.amount)}`, date: d.resolvedDate ? day(d.resolvedDate) : undefined, state: "done" });
  if (stage === "lost") steps.push({ label: `Lost. ${app} sided with the customer`, state: "failed" });
  return steps;
}

export function ChargebacksView({ data }: { data: DashboardData }) {
  const active = useTab(TABS);
  // `?open=` reopens a chargeback from a copied link.
  const linked = useSearchParams().get("open");
  const [openId, setOpenId] = useState<string | null>(linked);
  const scope = scopeFor(undefined, locations);
  const insights = forPage(insightsFor(data, scope, storeRows(data, scope)), "chargebacks");
  const { disputes } = data;
  const stats = disputeStats(disputes);
  const by = (s: DisputeStatus) => disputes.filter((d) => d.status === s);
  const amounts = Object.fromEntries(STATUSES.map((s) => [s, sum(by(s).map((d) => d.amount))])) as Record<DisputeStatus, number>;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, by(s).length])) as Record<DisputeStatus, number>;
  const splits = Object.fromEntries(STATUSES.map((s) => [s, channelSplit(by(s))])) as Record<DisputeStatus, string>;
  const decided = counts.won + counts.lost;
  const open = by("open").sort((a, b) => b.date.localeCompare(a.date));
  const resolved = disputes.filter((d) => d.status !== "open").sort((a, b) => (b.resolvedDate ?? b.date).localeCompare(a.resolvedDate ?? a.date));
  const cur = disputes.find((d) => key(d) === openId);

  // Table columns, after the Figma table: the order on two lines, the app with its logo, sortable figures.
  const base: TableColumn<Dispute>[] = [
    { key: "what", header: "What happened", cell: (d) => <span className="block max-w-72 truncate" title={d.detail}>{d.detail}</span>, sub: (d) => `${d.reason} · Order ${d.id}`, sort: (d) => d.detail },
    { key: "store", header: "Store", cell: (d) => d.store, sort: (d) => d.store },
    { key: "app", header: "App", cell: (d) => <AppName source={d.source} name={channelName(d.source)} />, sort: (d) => channelName(d.source) },
    { key: "amount", header: "Charged", align: "right", cell: (d) => fmt(d.amount), sort: (d) => d.amount },
  ];
  const filters: TableFilter<Dispute>[] = [
    { key: "store", label: "Store", value: (d) => d.store },
    { key: "app", label: "App", value: (d) => channelName(d.source) },
  ];
  const search = (d: Dispute) => `${d.detail} ${d.reason} ${d.id} ${d.store}`;
  const stageCell = (d: Dispute) => {
    const s = disputeStage(d, PERIOD.end);
    return <StatusBadge tone={STAGE_TONE[s]}>{STAGE_LABEL[s]}</StatusBadge>;
  };
  // Rows open the detail beside the list (docked); prev / next step through the tab's own list.
  const list = active === "resolved" ? resolved : open;
  const at = cur ? list.findIndex((d) => key(d) === openId) : -1;
  const rowProps = { onRowClick: (d: Dispute) => setOpenId(key(d)), selectedKey: openId, rowKey: key, search, searchPlaceholder: "Search orders…", noun: "chargebacks" };
  const windowLeft = (d: Dispute) => {
    const closes = windowCloses(d);
    return closes ? daysLeft(closes, PERIOD.end) : Number.POSITIVE_INFINITY;
  };
  const openColumns: TableColumn<Dispute>[] = [
    ...base,
    { key: "date", header: "Found", cell: (d) => day(d.date), sort: (d) => d.date },
    { key: "stage", header: "Where it is", cell: stageCell, sort: (d) => STAGE_LABEL[disputeStage(d, PERIOD.end)] },
    {
      key: "window",
      header: "App's window",
      sort: windowLeft,
      cell: (d) => {
        const closes = windowCloses(d);
        if (!closes) return "No fixed window";
        const left = daysLeft(closes, PERIOD.end);
        return left < 0 ? "Closed" : `${left} day${left === 1 ? "" : "s"} left`;
      },
    },
  ];
  const resolvedColumns: TableColumn<Dispute>[] = [
    ...base,
    { key: "date", header: "Decided", cell: (d) => day(d.resolvedDate ?? d.date), sort: (d) => d.resolvedDate ?? d.date },
    { key: "stage", header: "Outcome", cell: stageCell, sort: (d) => STAGE_LABEL[disputeStage(d, PERIOD.end)] },
    {
      key: "result",
      header: "For you",
      align: "right",
      sort: (d) => (d.status === "won" ? d.amount : d.status === "lost" ? -d.amount : 0),
      cell: (d) => (d.status === "won" ? <span className="text-(--color-text-success)">+{fmt(d.amount)}</span> : d.status === "lost" ? <span className="text-(--color-text-danger)">−{fmt(d.amount)}</span> : <span className="text-(--color-text-secondary)">$0.00</span>),
    },
  ];

  // ---- Summary figures ----
  const total = disputes.length;
  const ordersDelivered = sum(data.ops.map((o) => o.orders));
  const running = cumulativeByDay(disputes, PERIOD.start, 30);
  const reasons = disputesByReason(disputes).filter((r) => r.total.count > 0).sort((a, b) => b.total.amount - a.total.amount);
  const top = reasons[0];
  const apps = [...new Set(disputes.map((d) => d.source))];
  const appRows = (rows: Dispute[]) => apps.map((s) => ({ key: s, label: channelName(s), value: sum(rows.filter((d) => d.source === s).map((d) => d.amount)) }));
  const stores = [...new Set(disputes.map((d) => d.store))];
  const winRateOf = (rows: Dispute[]) => {
    const dec = rows.filter((d) => d.status === "won" || d.status === "lost");
    return dec.length ? `${pct(dec.filter((d) => d.status === "won").length / dec.length)} · ${dec.filter((d) => d.status === "won").length} of ${dec.length}` : "None decided yet";
  };

  // ---- Open figures ----
  const stageCount = (s: DisputeStage) => open.filter((d) => disputeStage(d, PERIOD.end) === s).length;
  const soonest = open
    .map((d) => ({ d, closes: windowCloses(d) }))
    .filter((x): x is { d: Dispute; closes: string } => !!x.closes)
    .sort((a, b) => a.closes.localeCompare(b.closes))[0];
  const soonestLeft = soonest ? daysLeft(soonest.closes, PERIOD.end) : undefined;
  const banner = <InsightBanner insights={insights} title="What KoreFi sees in your chargebacks" />;

  return (
    <MvpFrame title="Chargebacks" tabs={TABS} active={active} actions={<DataSources syncedAt={latestSync(data.connections, "marketplace")} timezoneNote={PERIOD.timezoneNote} />}>
      {active === "summary" && (
        <>
          {banner}
          <div className={columnsClass(3)}>
            <Column title="Charged back" href="/mvp/chargebacks?tab=open">
              <BigStat label={`Charged back · ${PERIOD.label.toLowerCase()}`} value={fmt(stats.disputed)} sub={`${total} order${total === 1 ? "" : "s"}${ordersDelivered ? ` · ${(((total - counts.auto_refunded) / ordersDelivered) * 100).toFixed(1)}% of delivered orders` : ""}`} />
              <div>
                <ChartLabel>Running total</ChartLabel>
                <Sparkline points={running.map((p) => ({ label: day(p.date), value: p.charged }))} format={fmt} ariaLabel="Charged back, running total by day" />
              </div>
              <ShareBars title="By app" rows={appRows(disputes)} format={fmt} />
            </Column>
            <Column title="Won back" href="/mvp/chargebacks?tab=resolved">
              <BigStat label="Paid back after KoreFi's disputes" value={fmt(stats.recovered)} tone="success" sub={`${pct(stats.winRate)} win rate · ${counts.won} of ${decided} decided`} />
              <div>
                <ChartLabel>Running total</ChartLabel>
                <Sparkline points={running.map((p) => ({ label: day(p.date), value: p.recovered }))} format={fmt} color="var(--chart-won)" ariaLabel="Won back, running total by day" />
              </div>
              <div>
                <Fact label="Being disputed" value={fmt(amounts.open)} hint={`${counts.open} orders KoreFi is still working`} />
                <Fact label="Kept by the apps" value={amounts.lost ? <span className="text-(--color-text-danger)">−{fmt(amounts.lost)}</span> : "None"} />
                <Fact label="App paid it" value={`${counts.auto_refunded} order${counts.auto_refunded === 1 ? "" : "s"}`} hint="The app refunded the customer itself; nothing was charged to you" />
              </div>
            </Column>
            <Column title="What went wrong">
              <BigStat label="Most common" value={top?.label ?? "–"} sub={top ? `${fmt(top.total.amount)} · ${top.total.count} order${top.total.count === 1 ? "" : "s"} · ${pct(top.total.amount / (stats.disputed || 1))} of charges` : "No chargebacks"} />
              <ShareBars title="By reason" rows={reasons.map((r) => ({ key: r.key, label: r.label, value: r.total.amount, hint: channelSplit(disputes.filter((d) => d.reason === r.key)) }))} format={fmt} color="var(--chart-neutral)" />
              <ShareBars title="By store" rows={disputesByStore(disputes, stores).map((s) => ({ key: s.store, label: s.store, value: sum(Object.values(s.amounts)), hint: `${pct(s.winRate)} won` }))} format={fmt} color="var(--chart-neutral)" />
            </Column>
          </div>
          <Panel title="Where every $100 charged back went" sub={`${PERIOD.range} · KoreFi has been filing since ${day(DISPUTING_SINCE)}`}>
            <HundredBar
              total={stats.disputed || 1}
              legendClassName="sm:grid-cols-2 xl:grid-cols-4"
              parts={[
                { key: "won", label: "Won back", value: amounts.won, color: "var(--chart-won)", hint: splits.won },
                { key: "open", label: "Being disputed", value: amounts.open, color: "var(--chart-open)", hint: splits.open },
                { key: "lost", label: "Kept by the apps", value: amounts.lost, color: "var(--chart-lost)", hint: splits.lost },
                { key: "auto", label: "App paid it", value: amounts.auto_refunded, color: "var(--chart-neutral)", hint: splits.auto_refunded },
              ]}
            />
          </Panel>
        </>
      )}

      {active === "open" && (
        <>
          {banner}
          <div className={columnsClass(2)}>
            <Column title="Being disputed">
              <BigStat label={`${counts.open} order${counts.open === 1 ? "" : "s"} KoreFi is working`} value={fmt(amounts.open)} sub="Every eligible charge is disputed automatically within a day, with the order evidence. Nothing for you to do." />
              <ShareBars title="By app" rows={appRows(open)} format={fmt} />
              <ShareBars title="By store" rows={stores.map((st) => ({ key: st, label: st, value: sum(open.filter((d) => d.store === st).map((d) => d.amount)) }))} format={fmt} color="var(--chart-neutral)" />
            </Column>
            <Column title="Where they are">
              <BigStat
                label={soonest ? `Next deadline · ${channelName(soonest.d.source)} · ${soonest.d.detail}` : "Next deadline"}
                value={soonestLeft === undefined ? "None" : soonestLeft <= 0 ? "Today" : `${soonestLeft} day${soonestLeft === 1 ? "" : "s"}`}
                sub={soonest ? `Window closes ${day(soonest.closes)} · already filed by KoreFi` : "No open dispute windows"}
              />
              <div>
                <Fact label="Found, filing next run" value={String(stageCount("detected"))} />
                <Fact label="Filed by KoreFi" value={String(stageCount("filed"))} />
                <Fact label="Waiting on the app" value={String(stageCount("awaiting"))} />
              </div>
              <div>
                <p className="mb-1 text-body-sm text-(--color-text-secondary)">How long each app allows</p>
                {Object.entries(DISPUTE_WINDOW_DAYS).map(([src, n]) => (
                  <Fact key={src} label={channelName(src)} value={`${n} days`} />
                ))}
              </div>
            </Column>
          </div>
          <ReportTable title="Open disputes" columns={openColumns} rows={open} {...rowProps} filters={filters} initialSort={{ key: "window", dir: "asc" }} empty="Nothing in dispute right now." />
        </>
      )}

      {active === "resolved" && (
        <>
          {banner}
          <div className={columnsClass(3)}>
            <Column title="Won back">
              <BigStat label={`${counts.won} order${counts.won === 1 ? "" : "s"} paid back`} value={fmt(amounts.won)} tone="success" />
              <ShareBars title="By app" rows={appRows(by("won"))} format={fmt} color="var(--chart-won)" />
            </Column>
            <Column title="Lost">
              <BigStat label={`${counts.lost} order${counts.lost === 1 ? "" : "s"} the apps kept`} value={amounts.lost ? `−${fmt(amounts.lost)}` : "$0.00"} tone={amounts.lost ? "danger" : undefined} />
              <ShareBars title="By reason" rows={disputesByReason(by("lost")).map((r) => ({ key: r.key, label: r.label, value: r.total.amount }))} format={fmt} color="var(--chart-lost)" />
            </Column>
            <Column title="Win rate">
              <BigStat label="Of disputes the apps decided" value={pct(stats.winRate)} sub={`${counts.won} of ${decided} decided`} />
              <div>
                {apps.map((s) => (
                  <Fact key={s} label={channelName(s)} value={winRateOf(disputes.filter((d) => d.source === s))} />
                ))}
                <Fact label="App paid it" value={`${counts.auto_refunded} · not counted`} hint="The app refunded the customer itself; nothing was disputed" />
              </div>
            </Column>
          </div>
          <Panel title="Charged back vs won back" sub="Running total by day. The gap between the lines is how long the apps take to pay back.">
            <TrendChart points={running} />
          </Panel>
          <ReportTable
            title="Decided this period"
            columns={resolvedColumns}
            rows={resolved}
            {...rowProps}
            filters={[...filters, { key: "outcome", label: "Outcome", value: (d) => STAGE_LABEL[disputeStage(d, PERIOD.end)] }]}
            empty="Nothing decided yet."
          />
        </>
      )}

      <DetailDrawer
        open={!!cur}
        onClose={() => setOpenId(null)}
        onPrev={at > 0 ? () => setOpenId(key(list[at - 1])) : undefined}
        onNext={at >= 0 && at < list.length - 1 ? () => setOpenId(key(list[at + 1])) : undefined}
        icon={ShieldAlert}
        eyebrow={cur && `${channelName(cur.source)} chargeback`}
        title={cur ? fmt(cur.amount) : ""}
        status={cur && <StatusBadge tone={STAGE_TONE[disputeStage(cur, PERIOD.end)]}>{STAGE_LABEL[disputeStage(cur, PERIOD.end)]}</StatusBadge>}
        meta={cur && `${cur.detail} · Order ${cur.id} · ${day(cur.date)}`}
        permalink={cur ? `/mvp/chargebacks?tab=${cur.status === "open" ? "open" : "resolved"}&open=${encodeURIComponent(key(cur))}` : undefined}
      >
        {cur && (
          <>
            <DrawerSection title="Where it is">
              <Timeline steps={timeline(cur)} />
            </DrawerSection>
            <DetailList
              rows={[
                { label: "Store", value: cur.store },
                { label: "Reason", value: cur.reason },
                { label: "Charged", value: fmt(cur.amount) },
                { label: "Status", value: STAGE_LABEL[disputeStage(cur, PERIOD.end)] },
              ]}
            />
            <p className="text-body-sm text-(--color-text-secondary)">
              {cur.status === "open" ? "KoreFi filed this dispute. Nothing is needed from you." : cur.status === "auto_refunded" ? `${channelName(cur.source)} refunded the customer out of its own pocket, so nothing was charged to you.` : cur.status === "won" ? "Paid back by the app after KoreFi's dispute." : "Disputed, but the app sided with the customer."}
            </p>
            <p className="text-body-sm text-(--color-text-tertiary)">Source: {channelName(cur.source)} order-error report.</p>
          </>
        )}
      </DetailDrawer>
    </MvpFrame>
  );
}
