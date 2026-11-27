"use client";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppName } from "@/components/ui/ReportTable";
import { OutletFilters, OutletUniverse, useOutletFilter } from "@/components/mvp2/OutletFilters";
import { LAST, PRESETS } from "@/components/finance/PnlStory";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import type { Preset } from "@/components/finance/TimelineRange";
import { appLabel, type AppKey } from "@/lib/finance/chargebacks";
import * as FX from "@/lib/mvp3/masaFixture";
import { homeData, periodsFor } from "@/lib/mvp3/home";
import { useAccount } from "./AccountSwitcher";
import { FilterBar, NoOutlets } from "./masaParts";
import { ByApp, HeadlineCards, OutletRanks, OutletTabs, Problems, ReasonGrid, biggestProblems, type EditCard } from "./chargebackOverview";

// Masa Kitchen's pinned Chargebacks dashboard (Overview tab): the agent-journey prototype's sample week (Nov 1–7 in
// lib/mvp3/masaFixture), laid out like Figma "Korefi – Agents" › Pinned dashboard (chargebackOverview.tsx):
// cost / where / won back → biggest problems → chargebacks by outlet → what went wrong → one outlet at a time → by app.
// Every section follows the outlet filter, counted from the week's 33 charges. Report-only: "Edit in chat" points a
// card at the chat, "See N orders" opens Transactions.

export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** The period chip opens on "Last week" (the sample week). Its calendar uses the shared report weeks, which end Sep 30. */
export const PERIODS: Preset[] = [{ label: "Last week", range: [LAST, LAST] }, ...PRESETS];
const SOURCE: Record<AppKey, string> = { doordash: "doordash", uber: "ubereats", grubhub: "grubhub" };

/** `toolbarTo`: put the filters in this element (the dashboard's tab row, as on Home) instead of their own row;
 *  null while it mounts. */
export function MasaChargebacks({ edit = {}, onSeeOrders, download, toolbarTo }: { edit?: EditCard; onSeeOrders?: (outlet: string) => void; download?: React.ReactNode; toolbarTo?: HTMLElement | null }) {
  const { account } = useAccount();
  return (
    <OutletUniverse stores={account.stores}>
      <Body edit={edit} onSeeOrders={onSeeOrders} download={download} toolbarTo={toolbarTo} />
    </OutletUniverse>
  );
}

function Body({ edit, onSeeOrders, download, toolbarTo }: { edit: EditCard; onSeeOrders?: (outlet: string) => void; download?: React.ReactNode; toolbarTo?: HTMLElement | null }) {
  const { account } = useAccount();
  // Dated like Home: the sample week is Nov 1–7, 2026.
  const weeks = useMemo(() => homeData(account.stores).weeks, [account.stores]);
  const [range, setRange] = useState<[number, number]>(PERIODS[0].range);
  const [pick, setPick] = useState<string>(FX.FX_OUTLETS[0].name);
  const detail = useRef<HTMLElement>(null);
  const scope = useOutletFilter(range);
  const rows = FX.FX_OUTLETS.filter((x) => scope.stores.includes(x.store));
  const all = rows.length === FX.FX_OUTLETS.length;
  const ranked = rows.filter((x) => x.charged).sort((a, b) => b.charged - a.charged);
  const sel = ranked.some((x) => x.name === pick) ? pick : (ranked[0]?.name ?? "");
  const apps = (all ? FX.BY_APP : FX.byApp(rows.map((x) => x.name))).map((a) => ({ ...a, name: <AppName source={SOURCE[a.app]} name={appLabel(a.app)} /> }));
  // Picking an outlet anywhere above opens it in "By outlet" and brings that card into view.
  const open = (name: string) => {
    setPick(name);
    requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };

  return (
    <div className="@container space-y-5">
      {toolbarTo === undefined ? (
        <FilterBar scope={scope} end={download}>
          <DateRangeFilter weeks={weeks} presets={periodsFor(weeks)} value={range} onChange={setRange} dates accent />
        </FilterBar>
      ) : (
        toolbarTo &&
        createPortal(
          <>
            <OutletFilters scope={scope} pills={["outlet"]} />
            <DateRangeFilter weeks={weeks} presets={periodsFor(weeks)} value={range} onChange={setRange} dates align="right" accent />
            {download}
          </>,
          toolbarTo,
        )
      )}
      {rows.length === 0 ? (
        <NoOutlets scope={scope} />
      ) : ranked.length === 0 ? (
        <p className="rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-secondary)">No chargebacks this week at {rows.map((x) => x.name).join(", ")}.</p>
      ) : (
        <>
          <HeadlineCards rows={rows} ranked={ranked} all={all} />
          <Problems items={biggestProblems(rows)} onOpen={open} edit={edit} />
          <OutletRanks rows={rows} ranked={ranked} all={all} onOpen={open} edit={edit} />
          <ReasonGrid ranked={ranked} edit={edit} />
          <OutletTabs ranked={ranked} rows={rows} sel={sel} onSelect={setPick} sectionRef={detail} onSeeOrders={onSeeOrders} edit={edit} />
          <ByApp rows={apps} edit={edit} />
        </>
      )}
    </div>
  );
}
