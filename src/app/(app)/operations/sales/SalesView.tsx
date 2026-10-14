"use client";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, Table } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageTabs } from "@/components/shell/PageTabs";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DataSources } from "@/components/dashboard/DataSources";
import { DataTable, type Column } from "@/components/dashboard/primitives";
import { ChannelFilter, DailyBars, HBars, HourBars } from "@/components/dashboard/OpsCharts";
import type { DashboardData } from "@/lib/sources/dashboard";
import { channelsIn, dailyTotals, forStore, hourlyTotals, parseChannel, pickChannel, salesTotals, storesIn } from "@/lib/sources/ops";
import { pct1, vsPrev } from "@/lib/sources/format";
import { fmtCents as fmt } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import type { StoreOps } from "@/lib/sources/types";

const TABS = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "breakdown", label: "Breakdown", Icon: Table },
];

type StoreRow = { store: string } & ReturnType<typeof salesTotals>;

const COLUMNS: Column<StoreRow>[] = [
  { key: "store", header: "Store", cell: (r) => r.store },
  { key: "sales", header: "Sales", align: "right", cell: (r) => fmt(r.sales) },
  { key: "orders", header: "Orders", align: "right", cell: (r) => r.orders.toLocaleString("en-US") },
  { key: "ticket", header: "Avg ticket", align: "right", cell: (r) => fmt(r.avgTicket) },
  { key: "canceled", header: "Canceled", align: "right", cell: (r) => `${r.canceled} · ${pct1(r.cancelRate)}` },
  { key: "change", header: "vs previous", align: "right", cell: (r) => `${r.salesChange >= 0 ? "+" : "−"}${Math.abs(r.salesChange * 100).toFixed(1)}%` },
];

// Finance / Sales: what the delivery apps sold, in the report shape of Lunchbox's Sales & Analysis.
// Overview = headline numbers, daily trend, busiest hours, top items. Breakdown = per store.
// Subtotal excludes cancelled orders and tax. `?channel=` narrows everything to one app.
export function SalesView({ data }: { data: DashboardData }) {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? undefined;
  const ch = sp.get("channel") ?? undefined;
  const active = tab === "breakdown" ? "breakdown" : "overview";
  const { ops, connections } = data;
  const channel = parseChannel(typeof ch === "string" ? ch : undefined, ops);
  const rows = pickChannel(ops, channel);
  const marketplaces = connections.filter((c) => c.group === "marketplace" && c.connected);
  const syncedAt = marketplaces.filter((m) => m.status !== "error").map((m) => m.lastSyncedAt).sort().at(-1) ?? "";
  const params: Record<string, string> = active === "breakdown" ? { tab: "breakdown" } : {};

  return (
    <>
      <PageHeader title="Sales" />
      <PageTabs tabs={TABS} active={active} basePath="/operations/sales" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <DataSources syncedAt={syncedAt} timezoneNote={PERIOD.timezoneNote} />
        <ChannelFilter basePath="/operations/sales" channels={channelsIn(ops)} active={channel} params={params} />
        {active === "overview" ? <Overview rows={rows} /> : <Breakdown rows={rows} />}
      </div>
    </>
  );
}

function Overview({ rows }: { rows: StoreOps[] }) {
  const t = salesTotals(rows);
  const days = dailyTotals(rows);
  return (
    <>
      <StatStrip
        stats={[
          { label: "Total sales", value: fmt(t.sales), sub: `${vsPrev(t.salesChange)} · avg ticket ${fmt(t.avgTicket)}` },
          { label: "Delivered orders", value: t.orders.toLocaleString("en-US"), sub: vsPrev(t.ordersChange) },
          { label: "Items sold", value: t.itemsSold.toLocaleString("en-US"), sub: vsPrev(t.itemsChange) },
          { label: "Orders canceled", value: String(t.canceled), sub: `${pct1(t.cancelRate)} of orders · ${vsPrev(t.canceledChange)}`, tone: t.canceledChange > 0 ? "warning" : "default" },
        ]}
      />
      <p className="text-body-sm text-(--color-text-secondary)">Sales are the subtotal of delivered orders, before tax and without cancelled orders. {PERIOD.range}.</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashCard>
          <CardTitle title="Orders per day" />
          <div className="mt-4">
            <DailyBars points={days.map((d) => ({ date: d.date, value: d.orders, previous: d.previousOrders }))} format={(n) => String(n)} unit="orders" />
          </div>
        </DashCard>
        <DashCard>
          <CardTitle title="Cancellations per day" />
          <div className="mt-4">
            <DailyBars points={days.map((d) => ({ date: d.date, value: d.canceled }))} format={(n) => String(n)} unit="canceled" tone="lost" />
          </div>
        </DashCard>
      </div>

      <DashCard>
        <CardTitle title="Busiest hours" />
        <p className="mt-1 text-body-sm text-(--color-text-secondary)">Delivered orders by hour of day, all days in the period.</p>
        <div className="mt-4">
          <HourBars hours={hourlyTotals(rows)} />
        </div>
      </DashCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashCard>
          <CardTitle title="Top-selling items" />
          <div className="mt-4">
            <HBars rows={t.topSold.slice(0, 5).map((i) => ({ key: i.item, label: i.item, value: i.n, display: `${i.n} sold` }))} />
          </div>
        </DashCard>
        <DashCard>
          <CardTitle title="Most-canceled items" />
          <div className="mt-4">
            <HBars tone="lost" rows={t.topCanceled.slice(0, 5).map((i) => ({ key: i.item, label: i.item, value: i.n, display: `${i.n} canceled` }))} />
          </div>
        </DashCard>
      </div>
    </>
  );
}

function Breakdown({ rows }: { rows: StoreOps[] }) {
  const stores = storesIn(rows).map((store) => ({ store, ...salesTotals(forStore(rows, store)) })).sort((a, b) => b.sales - a.sales);
  const items = salesTotals(rows);
  return (
    <>
      <DashCard>
        <CardTitle title="By store" />
        <p className="mt-1 text-body-sm text-(--color-text-secondary)">Ranked by sales. Each store is compared with the previous period of the same length.</p>
        <div className="mt-2">
          <DataTable columns={COLUMNS} rows={stores} rowKey={(r) => r.store} empty="No marketplace sales for this period." />
        </div>
      </DashCard>
      <DashCard>
        <CardTitle title="By item" />
        <div className="mt-2">
          <DataTable
            columns={[
              { key: "item", header: "Item", cell: (r) => r.item },
              { key: "sold", header: "Sold", align: "right", cell: (r) => r.sold },
              { key: "canceled", header: "Canceled", align: "right", cell: (r) => r.canceled || "-" },
            ]}
            rows={items.topSold.map((i) => ({ item: i.item, sold: i.n, canceled: items.topCanceled.find((c) => c.item === i.item)?.n ?? 0 }))}
            rowKey={(r) => r.item}
            empty="No item data."
          />
        </div>
      </DashCard>
    </>
  );
}
