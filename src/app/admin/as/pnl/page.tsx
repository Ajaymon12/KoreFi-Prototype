import { PnlSummary } from "@/components/finance/PnlSummary";
import { UserViewGate } from "@/components/admin/UserViewGate";

// User's view → P&L Summary, as the user sees it (MVP 2).
export default function Page() {
  return (
    <UserViewGate title="P&L Summary">
      <PnlSummary />
    </UserViewGate>
  );
}
