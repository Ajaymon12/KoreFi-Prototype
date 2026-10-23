"use client";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { PnlLaunch } from "@/components/finance/PnlLaunch";
import { useActiveRestaurant } from "@/lib/org/scope";
import { BalanceLaunch, ChargebacksLaunch, OverviewLaunch, PayoutsLaunch } from "./pages";

// Wraps a report page: while the restaurant picked in the switcher is waiting for its first reports
// (Brand.awaitingReports) it shows that page's launch state, under the page's own header, instead of
// the report, so no page shows $0 everywhere. Pages are server components, so they name themselves
// and the gate picks the launch.

const LAUNCH = {
  pnl: { title: "P&L Summary", Launch: PnlLaunch },
  overview: { title: "Overview", Launch: OverviewLaunch },
  payouts: { title: "3PD Payouts", Launch: PayoutsLaunch },
  "balance-sheet": { title: "Balance Sheet", Launch: BalanceLaunch },
  chargebacks: { title: null, Launch: ChargebacksLaunch },
} satisfies Record<string, { title: string | null; Launch: (p: { restaurant: string }) => React.ReactNode }>;

export function LaunchGate({ page, children }: { page: keyof typeof LAUNCH; children: React.ReactNode }) {
  const { brand, awaiting } = useActiveRestaurant();
  if (!brand || !awaiting) return <>{children}</>;
  const { title, Launch } = LAUNCH[page];
  return (
    <>
      {title ? <PageHeader title={title} /> : <ChargebacksHeader />}
      <Launch restaurant={brand.name} />
    </>
  );
}

/** Chargebacks' title follows its tab, as ChargebackReport's does (the page is already in Suspense). */
function ChargebacksHeader() {
  const transactions = useSearchParams().get("tab") === "transactions";
  return <PageHeader title={transactions ? "Chargeback Transactions" : "Chargeback Overview"} />;
}
