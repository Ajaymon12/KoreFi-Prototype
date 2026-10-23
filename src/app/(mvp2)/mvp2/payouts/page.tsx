import { LaunchGate } from "@/components/mvp2/launch/LaunchGate";
import { PayoutReport } from "@/components/mvp2/PayoutReport";

export default function Page() {
  return (
    <LaunchGate page="payouts">
      <PayoutReport />
    </LaunchGate>
  );
}
