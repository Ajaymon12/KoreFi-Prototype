"use client";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, Store } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageTabs } from "@/components/shell/PageTabs";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DataSources } from "@/components/dashboard/DataSources";
import { DataTable, type Column } from "@/components/dashboard/primitives";
import { ChannelFilter, HBars } from "@/components/dashboard/OpsCharts";
import type { DashboardData } from "@/lib/sources/dashboard";
import { channelsIn, forStore, parseChannel, pickChannel, qualityTotals, storesIn } from "@/lib/sources/ops";
import { minVsPrev, pct1, ptsVsPrev, vsPrev } from "@/lib/sources/format";
import { fmtCents as fmt } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import type { Dispute, StoreOps } from "@/lib/sources/types";

const TABS = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "stores", label: "By store", Icon: Store },
];

type Row = { store: string } & ReturnType<typeof qualityTotals>;

const COLUMNS: Column<Row>[] = [
  { key: "store", header: "Store", cell: (r) => r.store },
  { key: "inaccurate", header: "Inaccurate", align: "right", cell: (r) => `${r.inaccurate} · ${pct1(r.inaccurateRate)}` },
  { key: "charges", header: "Error charges", align: "right", cell: (r) => fmt(r.errorCharges) },
  { key: "unfulfilled", header: "Unfulfilled", align: "right", cell: (r) => pct1(r.unfulfilledRate) },
  { key: "wait", header: "Avoidable wait", align: "right", cell: (r) => `${r.wait.toFixed(1)} min` },
];

// Operations / Order quality: how often the stores get orders wrong and what it costs, per
// Lunchbox's Operations Quality dashboard. Grubhub is left out (it does not report these), so it
// only appears once connected. A report: KoreFi's team handles every fix.
export function OrderQualityView({ data }: { data: DashboardData }) {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? undefined;
  const ch = sp.get("channel") ?? undefined;
  const active = tab === "stores" ? "stores" : "overview";
  const { ops, disputes, connections } = data;
  const channel = parseChannel(typeof ch === "string" ? ch : undefined, ops);
  const rows = pickChannel(ops, channel);
  const marketplaces = connections.filter((c) => c.group === "marketplace" && c.connected);
  const syncedAt = marketplaces.filter((m) => m.status !== "error").map((m) => m.lastSyncedAt).sort().at(-1) ?? "";

  return (
    <>
      <PageHeader title="Order quality" />
      <PageTabs tabs={TABS} active={active} basePath="/operations/order-quality" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <DataSources syncedAt={syncedAt} timezoneNote={PERIOD.timezoneNote} />
        <ChannelFilter basePath="/operations/order-quality" channels={channelsIn(ops)} active={channel} params={active === "stores" ? { tab: "stores" } : {}} />
        {active === "overview" ? <Overview rows={rows} disputes={disputes} /> : <ByStore rows={rows} disputes={disputes} />}
      </div>
    </>
  );
}

function Overview({ rows, disputes }: { rows: StoreOps[]; disputes: Dispute[] }) {
  const q = qualityTotals(rows, disputes);
  const better = (now: number, before: number) => (now > before ? "warning" : "default") as "warning" | "default";
  return (
    <>
      <StatStrip
        stats={[
          { label: "Inaccurate orders", value: pct1(q.inaccurateRate), sub: `${q.inaccurate} of ${q.orders} orders · ${ptsVsPrev(q.inaccurateRate, q.previousInaccurateRate)}`, tone: better(q.inaccurateRate, q.previousInaccurateRate) },
          { label: "Error charges", value: fmt(q.errorCharges), sub: `${vsPrev(q.errorChange)} (${fmt(q.previousErrorCharges)})`, tone: q.errorChange > 0 ? "warning" : "default" },
          { label: "Unfulfilled orders", value: pct1(q.unfulfilledRate), sub: `${q.unfulfilled} cancelled by the store · ${ptsVsPrev(q.unfulfilledRate, q.previousUnfulfilledRate)}`, tone: better(q.unfulfilledRate, q.previousUnfulfilledRate) },
          { label: "Avoidable wait", value: `${q.wait.toFixed(1)} min`, sub: `Ready to driver pickup · ${minVsPrev(q.wait, q.previousWait)}`, tone: better(q.wait, q.previousWait) },
        ]}
      />
      <p className="text-body-sm text-(--color-text-secondary)">
        Inaccurate orders are orders with a missing or wrong item. Error charges are what the apps charged back for them. Grubhub is not included; it does not report order quality.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashCard>
          <CardTitle title="What went wrong" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Error charges by issue, largest first.</p>
          <div className="mt-4">
            <HBars tone="lost" rows={q.issues.map((i) => ({ key: i.reason, label: i.reason, value: i.cost, display: fmt(i.cost), detail: `${i.count} order${i.count === 1 ? "" : "s"}` }))} />
          </div>
        </DashCard>
        <DashCard>
          <CardTitle title="Avoidable wait by store" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Average minutes an order sat ready before the driver picked it up.</p>
          <div className="mt-4">
            <HBars
              rows={storesIn(rows)
                .map((store) => ({ store, ...qualityTotals(forStore(rows, store), disputes) }))
                .sort((a, b) => b.wait - a.wait)
                .map((r) => ({ key: r.store, label: r.store, value: r.wait, display: `${r.wait.toFixed(1)} min` }))}
            />
          </div>
        </DashCard>
      </div>
    </>
  );
}

function ByStore({ rows, disputes }: { rows: StoreOps[]; disputes: Dispute[] }) {
  const stores: Row[] = storesIn(rows).map((store) => ({ store, ...qualityTotals(forStore(rows, store), disputes) })).sort((a, b) => b.errorCharges - a.errorCharges);
  return (
    <DashCard>
      <CardTitle title="By store" />
      <p className="mt-1 text-body-sm text-(--color-text-secondary)">Stores with the most error charges first.</p>
      <div className="mt-2">
        <DataTable columns={COLUMNS} rows={stores} rowKey={(r) => r.store} empty="No order-quality data for this period." />
      </div>
    </DashCard>
  );
}
