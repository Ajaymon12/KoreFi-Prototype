import { LaunchGate } from "@/components/mvp2/launch/LaunchGate";
import { BalanceSummary } from "@/components/finance/BalanceSummary";

export default function Page() {
  return (
    <LaunchGate page="balance-sheet">
      <BalanceSummary />
    </LaunchGate>
  );
}
