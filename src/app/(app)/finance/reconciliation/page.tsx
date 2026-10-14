import { PageHeader } from "@/components/shell/PageHeader";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { DataTable, FreshnessStamp, StatusBadge, type Column } from "@/components/dashboard/primitives";
import { getDashboardData, reconcile, sum } from "@/lib/sources/dashboard";
import { fmt } from "@/lib/mockData";

type Row = ReturnType<typeof reconcile>[number];

const columns: Column<Row>[] = [
  { key: "channel", header: "Channel", cell: (r) => r.channel },
  { key: "expected", header: "Marketplace payout", align: "right", cell: (r) => fmt(r.expected) },
  { key: "deposited", header: "Mercury deposit", align: "right", cell: (r) => fmt(r.deposited) },
  { key: "delta", header: "Difference", align: "right", cell: (r) => (r.delta === 0 ? "$0" : fmt(r.delta)) },
  {
    key: "status",
    header: "Status",
    cell: (r) => (r.delta === 0 ? <StatusBadge tone="success">Matched</StatusBadge> : <StatusBadge tone="danger">Short {fmt(Math.abs(r.delta))} · KoreFi is reviewing</StatusBadge>),
  },
];

// Finance / Reconciliation: marketplace payouts reconciled against what actually landed in Mercury.
export default async function Page() {
  const { payouts, deposits, connections } = await getDashboardData();
  const rows = reconcile(payouts, deposits);
  const unmatched = sum(rows.map((r) => Math.min(r.delta, 0)));
  const mercury = connections.find((c) => c.id === "mercury");
  return (
    <>
      <PageHeader title="Reconciliation" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {mercury?.connected ? <FreshnessStamp at={mercury.lastSyncedAt} label="Mercury synced" /> : <StatusBadge tone="neutral">Mercury not connected</StatusBadge>}
        <DashCard>
          <CardTitle title="Unreconciled" value={fmt(Math.abs(unmatched))} />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Marketplace payout minus the deposit that reached your bank.</p>
        </DashCard>
        <DashCard>
          <CardTitle title="Marketplace payouts vs bank deposits" />
          <div className="mt-2">
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.channel} empty="No payouts to reconcile yet." />
          </div>
        </DashCard>
      </div>
    </>
  );
}
