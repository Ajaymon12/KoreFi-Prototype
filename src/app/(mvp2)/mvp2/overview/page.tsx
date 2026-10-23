import { LaunchGate } from "@/components/mvp2/launch/LaunchGate";
import { OverviewReport } from "@/components/mvp2/OverviewReport";

export default function Page() {
  return (
    <LaunchGate page="overview">
      <OverviewReport />
    </LaunchGate>
  );
}
