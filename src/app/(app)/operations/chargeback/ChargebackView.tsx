"use client";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, Table } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageTabs } from "@/components/shell/PageTabs";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DataSources } from "@/components/dashboard/DataSources";
import { ChargebackList, type GroupBy } from "@/components/dashboard/ChargebackList";
import { TrendChart } from "@/components/dashboard/ChargebackTrend";
import { MoneyFlowBar, RankedBars, StatusLegend, StoreCompare, WinRing, type BarRow } from "@/components/dashboard/ChargebackCharts";
import {
  channelName,
  cumulativeByDay,
  disputeStats,
  disputesByReason,
  disputesByStore,
  DISPUTE_WINDOW_DAYS,
  daysLeft,
  windowCloses,
  sum,
} from "@/lib/sources/dashboard";
import { chargebackRows } from "@/lib/sources/ledger";
import { fmtCents as fmt } from "@/lib/mockData";
import type { DashboardData } from "@/lib/sources/dashboard";
import { PERIOD } from "@/lib/period";
import type { Dispute, DisputeStatus } from "@/lib/sources/types";

const TABS = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "breakdown", label: "Breakdown", Icon: Table },
];

const STATUSES: DisputeStatus[] = ["won", "open", "lost", "auto_refunded"];
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** "DoorDash $43.75 · Uber Eats $13.30" for a set of disputes. */
const channelSplit = (rows: Dispute[]) =>
  [...new Set(rows.map((d) => d.source))].map((s) => `${channelName(s)} ${fmt(sum(rows.filter((d) => d.source === s).map((d) => d.amount)))}`).join(" · ") || "none";

// Operations / Chargeback. Overview = the story and where it comes from; Breakdown = a ClickUp-style
// list of every chargeback, grouped by status / store / app / reason. State lives in `?tab=&group=`.
export function ChargebackView({ data }: { data: DashboardData }) {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? undefined;
  const group = sp.get("group") ?? undefined;
  const active = tab === "breakdown" ? "breakdown" : "overview";
  const groupBy: GroupBy = group === "store" || group === "app" || group === "reason" ? group : "status";

  const { disputes, connections } = data;
  const marketplaces = connections.filter((c) => c.group === "marketplace" && c.connected);
  const syncedAt = marketplaces.filter((m) => m.status !== "error").map((m) => m.lastSyncedAt).sort().at(-1) ?? "";

  return (
    <>
      <PageHeader title="Chargeback" />
      <PageTabs tabs={TABS} active={active} basePath="/operations/chargeback" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <DataSources sources={marketplaces.map((m) => ({ id: m.id, name: m.name, status: m.status }))} syncedAt={syncedAt} timezoneNote={PERIOD.timezoneNote} />
        {active === "overview" ? <Overview disputes={disputes} /> : <ChargebackList rows={chargebackRows(disputes)} groupBy={groupBy} basePath="/operations/chargeback" />}
      </div>
    </>
  );
}

function Overview({ disputes }: { disputes: Dispute[] }) {
  const stats = disputeStats(disputes);
  const by = (s: DisputeStatus) => disputes.filter((d) => d.status === s);
  const amounts = Object.fromEntries(STATUSES.map((s) => [s, sum(by(s).map((d) => d.amount))])) as Record<DisputeStatus, number>;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, by(s).length])) as Record<DisputeStatus, number>;
  const splits = Object.fromEntries(STATUSES.map((s) => [s, channelSplit(by(s))])) as Record<DisputeStatus, string>;
  const decided = counts.won + counts.lost;
  // Soonest filing deadline across disputes KoreFi is still working (informational only).
  const soonest = by("open").map((d) => ({ d, closes: windowCloses(d) })).filter((x): x is { d: Dispute; closes: string } => !!x.closes).sort((a, b) => a.closes.localeCompare(b.closes))[0];
  const left = soonest ? daysLeft(soonest.closes, PERIOD.end) : undefined;

  return (
    <>
      <StatStrip
        stats={[
          { label: "Charged back", value: fmt(stats.disputed), sub: `${stats.total} orders · ${PERIOD.range}` },
          { label: "Won back", value: fmt(stats.recovered), sub: `${counts.won} orders`, tone: "success" },
          { label: "Win rate", value: pct(stats.winRate), sub: `${counts.won} of ${decided} decided` },
          { label: "Being disputed", value: fmt(amounts.open), sub: left === undefined ? "KoreFi is on it" : `KoreFi is on it · next window closes in ${Math.max(left, 0)} day${left === 1 ? "" : "s"}`, tone: amounts.open ? "warning" : "default" },
        ]}
      />

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
          <p className="mt-2 text-center text-body-sm text-(--color-text-secondary)">
            Filing windows: {Object.entries(DISPUTE_WINDOW_DAYS).map(([s, n]) => `${channelName(s)} ${n} days`).join(" · ")}. KoreFi files before they close.
          </p>
        </DashCard>
        <DashCard>
          <CardTitle title="Charged back vs won back" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Running total by day. The gap between the lines is how long the apps take to pay back.</p>
          <div className="mt-4">
            <TrendChart points={cumulativeByDay(disputes, PERIOD.start, 30)} />
          </div>
        </DashCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashCard>
          <CardTitle title="By store" />
          <div className="mt-4 space-y-3">
            <StatusLegend />
            <StoreCompare stores={disputesByStore(disputes, [...new Set(disputes.map((d) => d.store))])} />
          </div>
        </DashCard>
        <DashCard>
          <CardTitle title="What went wrong" />
          <div className="mt-4">
            <RankedBars
              rows={disputesByReason(disputes).map<BarRow>((r) => ({ key: r.key, label: r.label, amount: r.total.amount, count: r.total.count, detail: channelSplit(disputes.filter((d) => d.reason === r.key)) }))}
            />
          </div>
        </DashCard>
      </div>
    </>
  );
}
