"use client";
import { PnlSummary } from "@/components/finance/PnlSummary";
import { PayoutReport } from "@/components/mvp2/PayoutReport";
import { ChargebackReport } from "@/components/mvp2/ChargebackReport";
import { OverviewReport } from "@/components/mvp2/OverviewReport";
import { OutletUniverse } from "@/components/mvp2/OutletFilters";
import type { Store } from "@/lib/finance/outlets";
import { REPORTS, type ReportId } from "@/lib/mvp3/agents";
import { LAST, PRESETS } from "@/components/finance/PnlStory";
import { useAccount } from "./AccountSwitcher";
import { MasaPayouts } from "./MasaPayouts";

/** The payout agent reports one week every Thursday, so its report opens on that week. */
const PAYOUT_PRESETS = [{ label: "Last week", range: [LAST, LAST] as [number, number] }, ...PRESETS];

// The real /mvp2 reports an agent can open, shared by the chat's canvas and a pinned report's page.
const REPORT_VIEW: Record<ReportId, () => React.ReactNode> = {
  pnl: () => <PnlSummary title={REPORTS.pnl.title} />,
  payouts: () => <PayoutReport presets={PAYOUT_PRESETS} title={REPORTS.payouts.title} pos="Toast" />,
  chargebacks: () => <ChargebackReport />,
  overview: () => <OverviewReport />,
};

/** A report on the open restaurant's outlets only (its filters list just those). `outlets` opens it filtered to
 *  the ones a chat reply was kept to; a new set (or restaurant) starts the report's filters over. */
export function ReportView({ report, outlets }: { report: ReportId; outlets?: readonly Store[] | null }) {
  const { account } = useAccount();
  return (
    <OutletUniverse key={`${account.id}:${outlets?.join("|") ?? ""}`} stores={account.stores} initial={outlets ?? undefined}>
      {report === "payouts" && account.teamPinned ? <MasaPayouts /> : REPORT_VIEW[report]()}
    </OutletUniverse>
  );
}
