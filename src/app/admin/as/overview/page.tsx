import { OverviewReport } from "@/components/mvp2/OverviewReport";
import { UserViewGate } from "@/components/admin/UserViewGate";

// User's view → Overview: the user's own Overview, exactly as they see it (MVP 2).
export default function Page() {
  return (
    <UserViewGate title="Overview">
      <OverviewReport pnlHref="/admin/as/pnl" />
    </UserViewGate>
  );
}
