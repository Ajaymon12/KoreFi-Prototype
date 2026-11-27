import { PnlSummary } from "@/components/finance/PnlSummary";

// MVP 3 / P&L: /mvp2's P&L Summary as a page of its own (no State pill), beside Agents in the sidebar.
export default function Page() {
  return <PnlSummary hideState weekly title="P&L" />;
}
