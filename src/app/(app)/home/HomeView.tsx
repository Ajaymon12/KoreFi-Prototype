"use client";
import { PageHeader } from "@/components/shell/PageHeader";
import { DataSources } from "@/components/dashboard/DataSources";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { InsightFeed } from "@/components/dashboard/overview/InsightFeed";
import type { DashboardData } from "@/lib/sources/dashboard";
import { insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { locations, user } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";

// Home: AI insights for the whole platform (all stores, every cowork), ranked by what matters.
// Report only — fixes are carried out from the backend, so nothing here asks the owner to act.

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: PERIOD.timezone }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export function HomeView({ data }: { data: DashboardData }) {
  const scope = scopeFor(undefined, locations);
  const insights = insightsFor(data, scope, storeRows(data, scope));
  const lastSynced = data.connections.filter((c) => c.connected && c.status !== "error").map((c) => c.lastSyncedAt).sort().at(-1) ?? "";

  return (
    <>
      <PageHeader
        title="Home"
        actions={
          <>
            <DataSources syncedAt={lastSynced} timezoneNote={PERIOD.timezoneNote} />
            <DateRangeFilter />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-240 flex-col gap-6 px-6 pb-16">
          <header className="pt-6">
            <h1 className="text-page-title text-(--color-text-primary)">
              {greeting()}, {user.firstName}
            </h1>
            <p className="mt-1 text-body-md text-(--color-text-secondary)">
              What changed across {scope.label.toLowerCase()}, {PERIOD.range}
            </p>
          </header>
          <InsightFeed insights={insights} />
        </div>
      </div>
    </>
  );
}
