import { LaunchGate } from "@/components/mvp2/launch/LaunchGate";
import { PnlSummary } from "@/components/finance/PnlSummary";

export default function Page() {
  return (
    <LaunchGate page="pnl">
      <PnlSummary />
    </LaunchGate>
  );
}
