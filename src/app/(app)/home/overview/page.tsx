import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { DataSources } from "@/components/dashboard/DataSources";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { ThingsToKnow } from "@/components/dashboard/overview/Insights";
import { WeeklyBrief } from "@/components/dashboard/overview/WeeklyBrief";
import { FollowYourMoney, YourStores } from "@/components/dashboard/overview/MoneyFlow";
import { OverviewProvider, SimplifySwitch } from "@/components/dashboard/overview/OverviewState";
import { getDashboardData } from "@/lib/sources/dashboard";
import { briefFor, insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { locations, user } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import { cn } from "@/lib/utils";

// Home / Overview: greeting, the weekly brief, the 3 things to know (ranked from every cowork,
// biggest effect on profit first), then "Your numbers": follow your money from sale to what you
// keep, and how each store compares. `?store=` narrows the whole page to one store.
// The page only reports — fixes are carried out from the backend, so nothing here asks the
// owner to act; links open the detailed report.

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: PERIOD.timezone }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

function StoreSwitch({ active }: { active: string | null }) {
  const items = [{ label: "All stores", store: null as string | null }, ...locations.map((s) => ({ label: s, store: s }))];
  return (
    <nav aria-label="Store" className="flex rounded-circle bg-(--color-neutral-lightest) p-0.75">
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.store ? `/home/overview?store=${encodeURIComponent(i.store)}` : "/home/overview"}
          aria-current={active === i.store ? "page" : undefined}
          className={cn(
            "flex h-7.5 items-center rounded-circle px-3 text-body-sm whitespace-nowrap text-(--color-text-secondary) hover:text-(--color-text-primary)",
            active === i.store && "bg-(--color-text-primary) text-(--color-background-secondary) hover:text-(--color-background-secondary)",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function OverviewPage(props: PageProps<"/home/overview">) {
  const { store } = await props.searchParams;
  const scope = scopeFor(typeof store === "string" ? store : undefined, locations);
  const d = await getDashboardData();
  const lastSynced = d.connections.filter((c) => c.connected && c.status !== "error").map((c) => c.lastSyncedAt).sort().at(-1) ?? "";

  const rows = storeRows(d, scope);
  const brief = briefFor(d, scope, rows);
  const insights = insightsFor(d, scope, rows);
  // Connected apps that sent no payout this period still show in the flow, marked as missing.
  const missingApps = d.connections
    .filter((c) => c.group === "marketplace" && c.connected && !d.payouts.some((p) => p.source === c.id))
    .map((c) => ({ source: c.id, name: c.name, status: c.status }));
  const posConnected = d.connections.some((c) => c.group === "pos" && c.connected);

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <>
            <StoreSwitch active={scope.store} />
            <DataSources
              sources={d.connections.filter((c) => c.connected).map((c) => ({ id: c.id, name: c.name, status: c.status }))}
              syncedAt={lastSynced}
              timezoneNote={PERIOD.timezoneNote}
            />
            <DateRangeFilter />
          </>
        }
      />
      <OverviewProvider>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-340 flex-col gap-4 px-6 pb-16">
            <header className="flex flex-wrap items-end justify-between gap-3 pt-6 pb-1.5">
              <div>
                <h2 className="text-page-title text-(--color-text-primary)">
                  {greeting()}, {user.firstName}
                </h2>
                <p className="mt-1 text-body-md text-(--color-text-secondary)">{scope.label}</p>
              </div>
              <SimplifySwitch />
            </header>

            <WeeklyBrief brief={brief} insights={insights} />

            <ThingsToKnow key={scope.label} insights={insights} />

            <FollowYourMoney rows={rows} period={PERIOD.range} missing={missingApps} posConnected={posConnected} />
            {rows.length > 1 && <YourStores rows={rows} />}
          </div>
        </div>
      </OverviewProvider>
    </>
  );
}
