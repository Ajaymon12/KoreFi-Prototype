"use client";
import { useState } from "react";
import { CircleDashed, CheckCircle2, Clock, LayoutDashboard, ShieldCheck, Table } from "lucide-react";
import { MvpFrame, latestSync, useTab } from "@/components/mvp/frame";
import { MvpInsights } from "@/components/mvp/MvpInsights";
import { DataSources } from "@/components/dashboard/DataSources";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { DataTable, StatusBadge, type Column } from "@/components/dashboard/primitives";
import { DetailDrawer, DetailList, DrawerSection, Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { TrendChart } from "@/components/dashboard/ChargebackTrend";
import { MoneyFlowBar, RankedBars, StatusLegend, StoreCompare, WinRing, type BarRow } from "@/components/dashboard/ChargebackCharts";
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
// owner automatically. Open = what is being worked and where each one is; Resolved = what came
// back and what did not; Breakdown = by store, app and reason.

const TABS = [
  { key: "open", label: "Open", Icon: CircleDashed },
  { key: "resolved", label: "Resolved", Icon: CheckCircle2 },
  { key: "breakdown", label: "Breakdown", Icon: Table },
] as const;

const STATUSES: DisputeStatus[] = ["won", "open", "lost", "auto_refunded"];
const STAGE_TONE: Record<DisputeStage, "info" | "warning" | "success" | "danger" | "neutral"> = { detected: "info", filed: "info", awaiting: "warning", won: "success", lost: "danger", auto_refunded: "neutral" };
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const key = (d: Dispute) => `${d.source}-${d.id}`;

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
  const [openId, setOpenId] = useState<string | null>(null);
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

  const base: Column<Dispute>[] = [
    { key: "what", header: "What happened", cell: (d) => <span className="block max-w-72 truncate" title={d.detail}>{d.detail}</span> },
    { key: "store", header: "Store", cell: (d) => d.store },
    { key: "app", header: "App", cell: (d) => channelName(d.source) },
    { key: "amount", header: "Charged", align: "right", cell: (d) => fmt(d.amount) },
  ];
  const stageCell = (d: Dispute) => {
    const s = disputeStage(d, PERIOD.end);
    return <StatusBadge tone={STAGE_TONE[s]}>{STAGE_LABEL[s]}</StatusBadge>;
  };
  const details = (d: Dispute) => (
    <button type="button" onClick={() => setOpenId(key(d))} className="text-body-sm text-(--color-text-clickable) hover:underline">
      Details
    </button>
  );
  const openColumns: Column<Dispute>[] = [
    ...base,
    { key: "date", header: "Found", cell: (d) => day(d.date) },
    { key: "stage", header: "Where it is", cell: stageCell },
    {
      key: "window",
      header: "App's window",
      cell: (d) => {
        const closes = windowCloses(d);
        if (!closes) return "No fixed window";
        const left = daysLeft(closes, PERIOD.end);
        return left < 0 ? "Closed" : `${left} day${left === 1 ? "" : "s"} left`;
      },
    },
    { key: "open", header: "", align: "right", cell: details },
  ];
  const resolvedColumns: Column<Dispute>[] = [
    ...base,
    { key: "date", header: "Decided", cell: (d) => day(d.resolvedDate ?? d.date) },
    { key: "stage", header: "Outcome", cell: stageCell },
    {
      key: "result",
      header: "For you",
      align: "right",
      cell: (d) => (d.status === "won" ? <span className="text-(--color-text-success)">+{fmt(d.amount)}</span> : d.status === "lost" ? <span className="text-(--color-text-danger)">−{fmt(d.amount)}</span> : <span className="text-(--color-text-secondary)">$0.00</span>),
    },
    { key: "open", header: "", align: "right", cell: details },
  ];

  return (
    <MvpFrame title="Chargebacks" tabs={TABS} active={active} basePath="/mvp/chargebacks" actions={<DataSources syncedAt={latestSync(data.connections, "marketplace")} timezoneNote={PERIOD.timezoneNote} />}>
      {active === "open" && (
        <>
          <StatStrip
            stats={[
              { label: "Being disputed", value: fmt(amounts.open), sub: `${counts.open} order${counts.open === 1 ? "" : "s"} · KoreFi is on it`, tone: counts.open ? "warning" : "default" },
              { label: "Filed by KoreFi", value: String(open.filter((d) => disputeStage(d, PERIOD.end) !== "detected").length), sub: `${open.filter((d) => disputeStage(d, PERIOD.end) === "detected").length} found today, filing next run` },
              { label: "Won back this period", value: fmt(stats.recovered), sub: `${counts.won} order${counts.won === 1 ? "" : "s"}`, tone: "success" },
              { label: "Win rate", value: pct(stats.winRate), sub: `${counts.won} of ${decided} decided` },
            ]}
          />
          <DashCard>
            <CardTitle title="How KoreFi handles these for you" />
            <ul className="mt-3 grid gap-3 text-body-md text-(--color-text-primary) md:grid-cols-3">
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
                <span>Every eligible charge is disputed automatically, on every store, with the order evidence attached. You don&apos;t need to do anything.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
                <span>Each app only accepts disputes for so long: {Object.entries(DISPUTE_WINDOW_DAYS).map(([s, n]) => `${channelName(s)} ${n} days`).join(", ")}. KoreFi files within a day.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <LayoutDashboard className="mt-0.5 size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
                <span>Filing since {day(DISPUTING_SINCE)}. Earlier charges aren&apos;t counted here.</span>
              </li>
            </ul>
          </DashCard>
          <DashCard>
            <CardTitle title="Open disputes" />
            <div className="mt-2">
              <DataTable columns={openColumns} rows={open} rowKey={key} empty="Nothing in dispute right now." />
            </div>
          </DashCard>
          <MvpInsights insights={insights} />
        </>
      )}

      {active === "resolved" && (
        <>
          <StatStrip
            stats={[
              { label: "Won back", value: fmt(amounts.won), sub: `${counts.won} order${counts.won === 1 ? "" : "s"}`, tone: "success" },
              { label: "Lost", value: `−${fmt(amounts.lost)}`, sub: `${counts.lost} order${counts.lost === 1 ? "" : "s"} · the app sided with the customer`, tone: amounts.lost ? "danger" : "default" },
              { label: "App paid it", value: String(counts.auto_refunded), sub: "refunded by the app, nothing charged to you" },
              { label: "Win rate", value: pct(stats.winRate), sub: `${counts.won} of ${decided} decided` },
            ]}
          />
          <DashCard>
            <CardTitle title="Charged back vs won back" />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">Running total by day. The gap between the lines is how long the apps take to pay back.</p>
            <div className="mt-4">
              <TrendChart points={cumulativeByDay(disputes, PERIOD.start, 30)} />
            </div>
          </DashCard>
          <DashCard>
            <CardTitle title="Decided this period" />
            <div className="mt-2">
              <DataTable columns={resolvedColumns} rows={resolved} rowKey={key} empty="Nothing decided yet." />
            </div>
          </DashCard>
          <MvpInsights insights={insights} />
        </>
      )}

      {active === "breakdown" && (
        <>
          <DashCard>
            <CardTitle title="Where every charged-back dollar went" />
            <div className="mt-4">
              <MoneyFlowBar amounts={amounts} counts={counts} splits={splits} />
            </div>
          </DashCard>
          <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <DashCard>
              <CardTitle title="Win rate" />
              <div className="mt-4 grid place-items-center">
                <WinRing rate={stats.winRate} won={counts.won} decided={decided} />
              </div>
              <p className="mt-3 text-center text-body-sm text-(--color-text-secondary)">Disputes still open and charges the app paid are not counted.</p>
            </DashCard>
            <DashCard>
              <CardTitle title="By store" />
              <div className="mt-4 space-y-3">
                <StatusLegend />
                <StoreCompare stores={disputesByStore(disputes, [...new Set(disputes.map((d) => d.store))])} />
              </div>
            </DashCard>
          </div>
          <DashCard>
            <CardTitle title="What went wrong" />
            <div className="mt-4">
              <RankedBars rows={disputesByReason(disputes).map<BarRow>((r) => ({ key: r.key, label: r.label, amount: r.total.amount, count: r.total.count, detail: channelSplit(disputes.filter((d) => d.reason === r.key)) }))} />
            </div>
          </DashCard>
        </>
      )}

      <DetailDrawer open={!!cur} onClose={() => setOpenId(null)} eyebrow={cur && `${channelName(cur.source)} chargeback`} title={cur?.detail ?? ""} meta={cur && `Order ${cur.id} · ${day(cur.date)}`}>
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
