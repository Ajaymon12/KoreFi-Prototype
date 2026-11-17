import { PnlSummary } from "@/components/finance/PnlSummary";
import { PayoutReport } from "@/components/mvp2/PayoutReport";
import { ChargebackReport } from "@/components/mvp2/ChargebackReport";
import { OverviewReport } from "@/components/mvp2/OverviewReport";
import { REPORTS, type ReportId } from "@/lib/mvp3/agents";
import { LAST, PRESETS } from "@/components/finance/PnlStory";

/** The payout agent reports one week every Thursday, so its report opens on that week. */
const PAYOUT_PRESETS = [{ label: "Last week", range: [LAST, LAST] as [number, number] }, ...PRESETS];

// The real /mvp2 reports an agent can open, shared by the chat's canvas and a pinned report's page.
export const REPORT_VIEW: Record<ReportId, () => React.ReactNode> = {
  pnl: () => <PnlSummary title={REPORTS.pnl.title} />,
  payouts: () => <PayoutReport presets={PAYOUT_PRESETS} />,
  chargebacks: () => <ChargebackReport />,
  overview: () => <OverviewReport />,
};
