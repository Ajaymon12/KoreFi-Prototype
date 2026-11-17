import { PnlSummary } from "@/components/finance/PnlSummary";
import { PayoutReport } from "@/components/mvp2/PayoutReport";
import { ChargebackReport } from "@/components/mvp2/ChargebackReport";
import { OverviewReport } from "@/components/mvp2/OverviewReport";
import type { ReportId } from "@/lib/mvp3/agents";

// The real /mvp2 reports an agent can open, shared by the chat's canvas and a pinned report's page.
export const REPORT_VIEW: Record<ReportId, () => React.ReactNode> = {
  pnl: () => <PnlSummary />,
  payouts: () => <PayoutReport />,
  chargebacks: () => <ChargebackReport />,
  overview: () => <OverviewReport />,
};
