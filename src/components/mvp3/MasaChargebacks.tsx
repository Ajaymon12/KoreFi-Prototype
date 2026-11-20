"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { OutletUniverse, useOutletFilter } from "@/components/mvp2/OutletFilters";
import { LAST, PRESETS, WEEKS } from "@/components/finance/PnlStory";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import type { Preset } from "@/components/finance/TimelineRange";
import { appLabel, type AppKey } from "@/lib/finance/chargebacks";
import * as FX from "@/lib/mvp3/masaFixture";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { FilterBar, NoOutlets, TableCard } from "./masaParts";
import { HeadlineCards, OutletRanks, OutletTabs, Problems, ReasonGrid, biggestProblems } from "./chargebackOverview";

// Masa Kitchen's pinned Chargebacks dashboard (Overview tab): the agent-journey prototype's sample week (Nov 1–7 in
// lib/mvp3/masaFixture), laid out like the Eggholic chargeback review (chargebackOverview.tsx): cost / where / won back →
// biggest problems → outlets ranked → what went wrong → one outlet at a time → by app. Every section follows the outlet
// filter, counted from the week's 33 charges. Report-only, except "Ask why", which asks the agent.

export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** The period chip opens on "Last week" (the sample week). Its calendar uses the shared report weeks, which end Sep 30. */
export const PERIODS: Preset[] = [{ label: "Last week", range: [LAST, LAST] }, ...PRESETS];
const SOURCE: Record<AppKey, string> = { doordash: "doordash", uber: "ubereats", grubhub: "grubhub" };

const APP_COLUMNS: TableColumn<ReturnType<typeof FX.byApp>[number]>[] = [
  { key: "app", header: "App", cell: (a) => <AppName source={SOURCE[a.app]} name={appLabel(a.app)} /> },
  { key: "orders", header: "Orders", align: "right", cell: (a) => a.orders },
  { key: "charged", header: "Charged back", align: "right", cell: (a) => usd(a.charged) },
  { key: "won", header: "Won back", align: "right", cell: (a) => usd(a.won) },
];

export function MasaChargebacks() {
  const { account } = useAccount();
  return (
    <OutletUniverse stores={account.stores}>
      <Body />
    </OutletUniverse>
  );
}

function Body() {
  const { active, ask, send } = useAgents();
  const router = useRouter();
  const [range, setRange] = useState<[number, number]>(PERIODS[0].range);
  const [pick, setPick] = useState<string>(FX.FX_OUTLETS[0].name);
  const detail = useRef<HTMLElement>(null);
  const scope = useOutletFilter(range);
  const rows = FX.FX_OUTLETS.filter((x) => scope.stores.includes(x.store));
  const all = rows.length === FX.FX_OUTLETS.length;
  const ranked = rows.filter((x) => x.charged).sort((a, b) => b.charged - a.charged);
  const sel = ranked.some((x) => x.name === pick) ? pick : (ranked[0]?.name ?? "");
  // In the dashboard's own chat the answer lands there; from the full page there is no chat open, so one starts.
  const askWhy = (q: string) => {
    if (active?.dashboard === "dash-chargebacks") return send(q);
    ask(q);
    router.push("/mvp3");
  };
  // Picking an outlet anywhere above opens it in "By outlet" and brings that card into view.
  const open = (name: string) => {
    setPick(name);
    requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };

  return (
    <div className="@container space-y-4">
      <FilterBar scope={scope}>
        <DateRangeFilter weeks={WEEKS} presets={PERIODS} value={range} onChange={setRange} />
      </FilterBar>
      {rows.length === 0 ? (
        <NoOutlets scope={scope} />
      ) : ranked.length === 0 ? (
        <p className="rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-secondary)">No chargebacks this week at {rows.map((x) => x.name).join(", ")}.</p>
      ) : (
        <>
          <HeadlineCards rows={rows} ranked={ranked} all={all} />
          <Problems items={biggestProblems(rows)} onOpen={open} onAsk={askWhy} />
          <OutletRanks rows={rows} ranked={ranked} all={all} sel={sel} onOpen={open} />
          <ReasonGrid ranked={ranked} onOpen={open} />
          <OutletTabs ranked={ranked} rows={rows} sel={sel} onSelect={setPick} sectionRef={detail} />
          <TableCard title="By app">
            <ReportTable columns={APP_COLUMNS} rows={all ? FX.BY_APP : FX.byApp(rows.map((x) => x.name))} rowKey={(a) => a.app} noun="apps" />
          </TableCard>
        </>
      )}
    </div>
  );
}
