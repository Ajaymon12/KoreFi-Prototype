import { PageHeader } from "@/components/shell/PageHeader";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DataSources } from "@/components/dashboard/DataSources";
import { DataTable, StatusBadge, type Column } from "@/components/dashboard/primitives";
import { ChannelFilter, HBars } from "@/components/dashboard/OpsCharts";
import { channelName, getDashboardData, sum } from "@/lib/sources/dashboard";
import { channelsIn, downtimeTotals, forStore, parseChannel, pickChannel, qualityTotals, storesIn } from "@/lib/sources/ops";
import { minVsPrev, pct2 } from "@/lib/sources/format";
import { fmt } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import type { StorefrontStatus } from "@/lib/sources/types";

const columns: Column<StorefrontStatus>[] = [
  { key: "store", header: "Store", cell: (s) => s.store },
  { key: "channel", header: "Channel", cell: (s) => channelName(s.source) },
  { key: "status", header: "Status", cell: (s) => (s.online ? <StatusBadge tone="success">Online</StatusBadge> : <StatusBadge tone="danger">Paused</StatusBadge>) },
  { key: "cause", header: "Cause", cell: (s) => s.cause ?? "-" },
  { key: "minutes", header: "Downtime", align: "right", cell: (s) => (s.downtimeMinutes ? `${s.downtimeMinutes} min` : "-") },
  { key: "lost", header: "Est. lost revenue", align: "right", cell: (s) => (s.estLostRevenue ? fmt(s.estLostRevenue) : "-") },
];

// Operations / Wait & downtime: how much of the open hours each store was offline, which day is
// worst, and the wait between "ready" and driver pickup. A report: KoreFi's team brings stores
// back online, so there is no action here.
export default async function Page(props: PageProps<"/operations/wait-and-downtime">) {
  const { channel: ch } = await props.searchParams;
  const { ops, storefronts, disputes, connections } = await getDashboardData();
  const channel = parseChannel(typeof ch === "string" ? ch : undefined, ops);
  const rows = pickChannel(ops, channel);
  const fronts = channel === "all" ? storefronts : storefronts.filter((s) => s.source === channel);
  const d = downtimeTotals(rows);
  const q = qualityTotals(rows, disputes);
  const lost = sum(fronts.map((s) => s.estLostRevenue));
  const paused = fronts.filter((s) => !s.online).length;
  const marketplaces = connections.filter((c) => c.group === "marketplace" && c.connected);
  const syncedAt = marketplaces.filter((m) => m.status !== "error").map((m) => m.lastSyncedAt).sort().at(-1) ?? "";

  return (
    <>
      <PageHeader title="Wait & downtime" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <DataSources sources={marketplaces.map((m) => ({ id: m.id, name: m.name, status: m.status }))} syncedAt={syncedAt} timezoneNote={PERIOD.timezoneNote} />
        <ChannelFilter basePath="/operations/wait-and-downtime" channels={channelsIn(ops)} active={channel} />

        <StatStrip
          stats={[
            { label: "Downtime", value: pct2(d.pct), sub: `${d.minutes} min offline during open hours · ${minVsPrev(d.minutes, d.previous).replace(" min", " min")}`, tone: d.minutes > d.previous ? "warning" : "default" },
            { label: "Worst day", value: d.worstDay ?? "None", sub: d.worstDay ? `${Math.max(...d.byWeekday.map((x) => x.minutes))} min offline` : "No downtime this period" },
            { label: "Paused right now", value: String(paused), sub: `${fronts.length} storefronts`, tone: paused ? "warning" : "default" },
            { label: "Est. lost revenue", value: fmt(lost), sub: "From the time offline" },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <DashCard>
            <CardTitle title="Downtime by store" />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">Share of open hours each store was offline.</p>
            <div className="mt-4">
              <HBars
                tone="lost"
                rows={storesIn(rows)
                  .map((store) => ({ store, ...downtimeTotals(forStore(rows, store)) }))
                  .sort((a, b) => b.pct - a.pct)
                  .map((r) => ({ key: r.store, label: r.store, value: r.minutes, display: pct2(r.pct), detail: `${r.minutes} min · before ${pct2(r.previousPct)}` }))}
              />
            </div>
          </DashCard>
          <DashCard>
            <CardTitle title="Downtime by weekday" />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">Which days stores go offline most.</p>
            <div className="mt-4">
              <HBars tone="lost" rows={d.byWeekday.map((x) => ({ key: x.day, label: x.day, value: x.minutes, display: `${x.minutes} min` }))} />
            </div>
          </DashCard>
        </div>

        <DashCard>
          <CardTitle title="Avoidable wait" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">
            Average gap between an order being ready and the driver picking it up: {q.wait.toFixed(1)} min ({minVsPrev(q.wait, q.previousWait)}).
          </p>
          <div className="mt-4">
            <HBars
              rows={storesIn(rows)
                .map((store) => ({ store, ...qualityTotals(forStore(rows, store), disputes) }))
                .sort((a, b) => b.wait - a.wait)
                .map((r) => ({ key: r.store, label: r.store, value: r.wait, display: `${r.wait.toFixed(1)} min` }))}
            />
          </div>
        </DashCard>

        <DashCard>
          <CardTitle title="Storefront status" />
          <div className="mt-2">
            <DataTable columns={columns} rows={fronts} rowKey={(s) => `${s.source}-${s.store}`} empty="No storefront data from connected marketplaces." />
          </div>
        </DashCard>
      </div>
    </>
  );
}
