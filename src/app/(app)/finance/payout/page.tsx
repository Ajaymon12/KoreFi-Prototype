import { PageHeader } from "@/components/shell/PageHeader";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { DataTable, FreshnessStamp, StatusBadge, type Column } from "@/components/dashboard/primitives";
import { getDashboardData, reconcile, sum } from "@/lib/sources/dashboard";
import { fmt } from "@/lib/mockData";

type Row = ReturnType<typeof reconcile>[number];

const columns: Column<Row>[] = [
  { key: "channel", header: "Channel", cell: (r) => r.channel },
  { key: "expected", header: "Expected", align: "right", cell: (r) => fmt(r.expected) },
  { key: "received", header: "Received", align: "right", cell: (r) => fmt(r.deposited) },
  {
    key: "status",
    header: "Status",
    cell: (r) => (r.delta === 0 ? <StatusBadge tone="success">Received</StatusBadge> : <StatusBadge tone="danger">Missing {fmt(Math.abs(r.delta))}</StatusBadge>),
  },
];

// Finance / Payouts: what each delivery app owes you vs what has reached the bank. The cause of any
// gap is on Reconciliation; KoreFi follows up, so there is nothing for the owner to click here.
export default async function Page() {
  const { payouts, deposits, connections } = await getDashboardData();
  const rows = reconcile(payouts, deposits);
  const missing = Math.abs(sum(rows.map((r) => Math.min(r.delta, 0))));
  const mercury = connections.find((c) => c.id === "mercury");
  return (
    <>
      <PageHeader title="Payouts" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {mercury?.connected ? <FreshnessStamp at={mercury.lastSyncedAt} label="Mercury synced" /> : <StatusBadge tone="neutral">Mercury not connected</StatusBadge>}
        <div className="grid gap-4 sm:grid-cols-3">
          <DashCard><CardTitle title="Expected" value={fmt(sum(rows.map((r) => r.expected)))} /></DashCard>
          <DashCard><CardTitle title="Received" value={fmt(sum(rows.map((r) => r.deposited)))} /></DashCard>
          <DashCard><CardTitle title="Missing" value={fmt(missing)} /></DashCard>
        </div>
        <DashCard>
          <CardTitle title="Payouts by delivery app" />
          <div className="mt-2">
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.channel} empty="No payouts yet." />
          </div>
        </DashCard>
      </div>
    </>
  );
}
