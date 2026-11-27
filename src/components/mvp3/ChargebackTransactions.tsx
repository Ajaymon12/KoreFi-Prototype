"use client";
import { useEffect, useMemo, useState, type RefObject } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { ChargebackTransactions as Table } from "@/components/mvp2/ChargebackReport";
import { OutletCount, OutletFilters, OutletUniverse, useOutletFilter } from "@/components/mvp2/OutletFilters";
import { FilterChip } from "@/components/ui/FilterChip";
import type { TableColumn } from "@/components/ui/ReportTable";
import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import { APPS, appLabel, chargebacks, type AppKey, type Chargeback } from "@/lib/finance/chargebacks";
import { applyUpdates, disputeKey, useDisputeUpdates } from "@/lib/admin/disputes";
import { dashStores, type Dashboard } from "@/lib/mvp3/dashboards";
import { asset } from "@/lib/asset";
import * as FX from "@/lib/mvp3/masaFixture";
import { cn } from "@/lib/utils";
import { useAccount } from "./AccountSwitcher";
import { NoOutlets } from "./masaParts";
import type { Store } from "@/lib/finance/outlets";
import { PERIODS } from "./MasaChargebacks";
import { useAgents } from "./AgentsProvider";
import { saveBlob, xlsx } from "@/lib/xlsx";
import { shortStore } from "@/lib/finance/outlets";

// The Chargebacks dashboard's Transactions tab: every charged-back order, one row each. One filter row (Search, Outlet,
// Status, period); the table under it has no toolbar of its own. Columns follow the ops
// sheet: Order ID (pinned, opens the order in the app), In-Window, Error Date, Chargeback, Recovered, Status, Category,
// Subcategory, Note, laid out like the /mvp2 P&L table (hairline grid, short grey header). A row opens the /mvp2 report's detail drawer. Report-only, no dispute editing for owners.
// IN THE APP ONLY: the order list is never put in the weekly email or its PDF/Excel attachments (lib/mvp3/emails,
// ReportPreview). Those stay totals by outlet.

/** The last day of the last closed week: what "still in the window" is measured against. */
const AS_OF = new Date(WEEKS[LAST].start.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
const money = (n: number) => `$${n.toFixed(2)}`;
const PORTAL: Record<AppKey, string> = {
  doordash: "https://merchant-portal.doordash.com",
  uber: "https://merchants.ubereats.com",
  grubhub: "https://restaurant.grubhub.com",
};
/** The app's reason, as the ops sheet files it. */
const CATEGORY: Record<string, [string, string]> = {
  "Missing item": ["Inaccurate", "Missing Item"],
  "Wrong item": ["Incorrect", "Wrong Item"],
  "Order never arrived": ["Missing", "Never Delivered"],
  "Quality issue": ["Quality", "Food Quality"],
  "Missing whole order": ["Missing", "Whole Order Missing"],
};
const category = (c: Chargeback) => CATEGORY[c.reason] ?? [c.reason, c.reason];

/** Filed in time, or can still be filed. Grubhub has no fixed window. */
const inWindow = (c: Chargeback) => c.status !== "new" || !c.windowCloses || c.windowCloses >= AS_OF;
function statusText(c: Chargeback) {
  if (c.status === "won") return c.wonBack < c.amount ? "Won (Partial)" : "Won";
  if (c.status === "lost") return "Declined";
  if (c.status === "disputing") return "Disputed (Awaiting Decision)";
  return inWindow(c) ? "Not Disputed" : "Not Disputed (Window Missed)";
}

const COLUMNS: TableColumn<Chargeback>[] = [
  {
    key: "order",
    header: "Order ID",
    pinLeft: true,
    sort: (c) => c.id,
    cell: (c) => {
      const app = APPS.find((a) => a.key === c.app)!;
      return (
        <span className="inline-flex items-center gap-2">
          <Image src={asset(`/dashboard/${app.source}.png`)} alt={app.label} width={16} height={16} unoptimized className="size-4 shrink-0 rounded-[2px] object-cover" />
          <a
            href={PORTAL[c.app]}
            target="_blank"
            rel="noreferrer"
            title={`Open in ${appLabel(c.app)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-body-sm text-(--blue-900) underline underline-offset-2 hover:opacity-80"
          >
            {c.id}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </span>
      );
    },
  },
  { key: "window", header: "In-Window", sort: (c) => (inWindow(c) ? 1 : 0), cell: (c) => (inWindow(c) ? "Yes" : "No") },
  { key: "date", header: "Error Date", sort: (c) => c.date, cell: (c) => <span className="tabular-nums">{c.date}</span> },
  { key: "amount", header: "Chargeback", align: "right", sort: (c) => c.amount, cell: (c) => <span className="tabular-nums">{money(c.amount)}</span> },
  { key: "back", header: "Recovered", align: "right", sort: (c) => c.wonBack, cell: (c) => <span className="tabular-nums">{money(c.wonBack)}</span> },
  {
    key: "status",
    header: "Status",
    sort: statusText,
    cell: (c) => <span className={cn(c.status === "new" || c.status === "lost" ? "text-(--color-text-secondary)" : c.status === "won" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{statusText(c)}</span>,
  },
  { key: "category", header: "Category", sort: (c) => category(c)[0], cell: (c) => category(c)[0] },
  { key: "sub", header: "Subcategory", sort: (c) => category(c)[1], cell: (c) => category(c)[1] },
  { key: "note", header: "Note", sort: (c) => c.detail, cell: (c) => <span className="block max-w-72 truncate" title={c.detail}>{c.detail}</span> },
];

/** The dashboard header's Download button on Transactions: the orders as filtered right now, as an Excel sheet. */
export type ExportRef = RefObject<(() => void) | null>;
function downloadOrders(rows: Chargeback[], file: string) {
  const head = ["Order ID", "App", "Outlet", "In-Window", "Error Date", "Chargeback", "Recovered", "Status", "Category", "Subcategory", "Note"];
  const body = rows.map((c) => [c.id, appLabel(c.app), shortStore(c.store), inWindow(c) ? "Yes" : "No", c.date, c.amount, c.wonBack, statusText(c), category(c)[0], category(c)[1], c.detail]);
  saveBlob(xlsx("Transactions", head, body, [14, 11, 18, 10, 12, 12, 12, 26, 12, 20, 36]), file);
}

const permalinkFor = (d: Dashboard) => (c: Chargeback) => `/dashboard?id=${encodeURIComponent(d.id)}&tab=transactions&open=${encodeURIComponent(disputeKey(c))}`;

export function ChargebackTransactions({ d, exportRef }: { d: Dashboard; exportRef?: ExportRef }) {
  const { account } = useAccount();
  const file = `${account.name} ${d.title} transactions.xlsx`.replace(/\s+/g, "-").toLowerCase();
  // Masa's team-pinned dashboard opens on last week across the account, like its Overview. A dashboard the owner built
  // opens on its own weeks, outlets and apps, so the orders add up to its Overview.
  if (d.pinnedBy === "team" && FX.masaFixture()) return <Orders d={d} stores={account.stores} initial={PERIODS[0].range} fixture exportRef={exportRef} file={file} />;
  return <Orders d={d} stores={dashStores(d.config)} initial={[Math.max(0, LAST - d.config.weeks + 1), LAST]} apps={d.config.apps} exportRef={exportRef} file={file} />;
}

/** One filter row: Search, Outlet, Status, then the period; "N of M outlets" on the right while filtered. */
type Exporting = { exportRef?: ExportRef; file: string };
function Orders({ d, stores, initial, apps = [], fixture = false, exportRef, file }: { d: Dashboard; stores: readonly Store[]; initial: [number, number]; apps?: AppKey[]; fixture?: boolean } & Exporting) {
  return (
    <OutletUniverse stores={stores}>
      <OrdersBody d={d} initial={initial} apps={apps} fixture={fixture} exportRef={exportRef} file={file} />
    </OutletUniverse>
  );
}

function OrdersBody({ d, initial, apps, fixture, exportRef, file }: { d: Dashboard; initial: [number, number]; apps: AppKey[]; fixture: boolean } & Exporting) {
  const [range, setRange] = useState<[number, number]>(initial);
  const scope = useOutletFilter(range);
  const updates = useDisputeUpdates();
  const appKey = apps.join();
  const rows = useMemo(() => {
    // Masa's sample week (Nov 1–7, the "Last week" preset) lists the fixture's 33 orders, the same ones the chat and
    // Overview count; other weeks fall back to the mock reports.
    const sample = fixture && range[0] === LAST && range[1] === LAST;
    const all = sample ? FX.CHARGE_ROWS.filter((c) => scope.stores.includes(c.store)) : chargebacks(WEEKS, range[0], range[1], scope.stores);
    return applyUpdates(apps.length ? all.filter((c) => apps.includes(c.app)) : all, updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, scope.stores, updates, appKey, fixture]);
  const [query, setQuery] = useState("");
  // A chat reply ("What was denied?") filters the orders to that status.
  const { canvasView } = useAgents();
  const fromChat = canvasView === "todo" ? "Not Disputed" : canvasView === "denied" ? "Declined" : null;
  const [status, setStatus] = useState<string | null>(fromChat);
  const [seen, setSeen] = useState(fromChat);
  if (fromChat !== seen) {
    setSeen(fromChat);
    if (fromChat) setStatus(fromChat);
  }
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (c) => (!q || `${c.id} ${c.store} ${c.reason} ${c.detail} ${appLabel(c.app)} ${category(c).join(" ")}`.toLowerCase().includes(q)) && (!status || statusText(c) === status),
  );
  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = () => downloadOrders(shown, file);
    return () => {
      exportRef.current = null;
    };
  });
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 w-[217px] items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--gray-200) px-2.5 focus-within:border-(--color-focus-primary)">
          <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, notes…"
            aria-label="Search orders, notes"
            className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
          />
        </label>
        <OutletFilters scope={scope} pills={["outlet"]} panel={false} />
        <FilterChip label="Status" options={[...new Set(rows.map(statusText))].sort()} value={status} onChange={setStatus} />
        <DateRangeFilter weeks={WEEKS} presets={PERIODS} value={range} onChange={setRange} />
        <span className="ml-auto flex items-center gap-2 text-body-sm text-(--color-text-tertiary) tabular-nums">
          <OutletCount scope={scope} />
        </span>
      </div>
      {scope.stores.length === 0 ? <NoOutlets scope={scope} /> : <Rows d={d} rows={shown} />}
    </>
  );
}

function Rows({ d, rows }: { d: Dashboard; rows: Chargeback[] }) {
  const updates = useDisputeUpdates();
  const linked = useSearchParams().get("open");
  return (
    <div className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
      <Table rows={rows} linked={linked} ops={false} updates={updates} permalink={permalinkFor(d)} columns={COLUMNS} toolbar={false} grid className="" tableClassName="mx-0 border-y-0" />
    </div>
  );
}
