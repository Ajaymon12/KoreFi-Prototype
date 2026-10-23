"use client";
import { Info, LayoutDashboard, Rows3, Sparkles, Store, Table } from "lucide-react";
import { MvpFrame, latestSync, useTab } from "@/components/mvp/frame";
import { DataSources } from "@/components/dashboard/DataSources";
import { BOOKS_SYNCED_AT } from "@/lib/finance/books";
import { dataMode, type DashboardData } from "@/lib/sources/dashboard";
import { forPage } from "@/lib/mvp/insights";
import { insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { locations } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import { Books } from "./Books";
import { AppsOnly } from "./AppsOnly";

// MVP / Profit. With a POS connected: the books' P&L (in-store, website and the apps, then food,
// labour and running costs). Without one: a delivery-only P&L built from the apps' payout, promo
// and chargeback reports. Same views either way: Summary, By channel, By store, Statement, and P&L
// (the Statement's A/B partner: the week told as a story; apps-only falls back to the statement).
// Every view is charts first (after Mercury's Books overview); the figures sit beside them.

export const TABS = [
  { key: "summary", label: "Summary", Icon: LayoutDashboard },
  { key: "channel", label: "By channel", Icon: Rows3 },
  { key: "store", label: "By store", Icon: Store },
  { key: "statement", label: "Statement", Icon: Table },
  { key: "pnl", label: "P&L", Icon: Sparkles },
] as const;
export type ProfitTab = (typeof TABS)[number]["key"];

/** Stacked-bar palette: the headline part in brand, the rest in neutral steps. */
export const PART_COLORS = ["var(--brand-900)", "var(--brand-600)", "var(--gray-900)", "var(--gray-700)", "var(--gray-500)"];

export function PosNote() {
  return (
    <p className="flex items-start gap-2 rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest) px-4 py-3 text-body-md text-(--color-text-secondary)">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>Showing the delivery apps only. In-store and website sales, food and labour costs appear here once your POS and accounting are connected.</span>
    </p>
  );
}

export function ProfitView({ data }: { data: DashboardData }) {
  const active = useTab(TABS);
  const mode = dataMode(data.connections);
  const scope = scopeFor(undefined, locations);
  const insights = forPage(insightsFor(data, scope, storeRows(data, scope)), "profit");
  const sync = mode === "consolidated" ? BOOKS_SYNCED_AT : latestSync(data.connections, "marketplace");

  return (
    <MvpFrame title="Profit" tabs={TABS} active={active} actions={<DataSources syncedAt={sync} timezoneNote={PERIOD.timezoneNote} />}>
      {mode === "consolidated" ? <Books tab={active} insights={insights} /> : <AppsOnly tab={active} data={data} insights={insights} />}
    </MvpFrame>
  );
}
