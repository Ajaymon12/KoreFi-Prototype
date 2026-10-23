import { Suspense } from "react";
import { ChargebackReport } from "@/components/mvp2/ChargebackReport";
import { LaunchGate } from "@/components/mvp2/launch/LaunchGate";
import Loading from "../loading";

// Overview and Transactions are ?tab= views of one report (the sidebar links both); read in the browser.
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <LaunchGate page="chargebacks">
        <ChargebackReport />
      </LaunchGate>
    </Suspense>
  );
}
