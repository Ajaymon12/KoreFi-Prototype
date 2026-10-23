import { BalanceSummary } from "@/components/finance/BalanceSummary";
import { UserViewGate } from "@/components/admin/UserViewGate";

// User's view → Balance Sheet, as the user sees it (MVP 2).
export default function Page() {
  return (
    <UserViewGate title="Balance Sheet">
      <BalanceSummary />
    </UserViewGate>
  );
}
