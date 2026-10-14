import { Suspense } from "react";
import { getDashboardData } from "@/lib/sources/dashboard";
import Loading from "../loading";
import { ChargebacksView } from "./ChargebacksView";

// Static: loads the mock data once; the view reads ?tab= in the browser.
export default async function Page() {
  const data = await getDashboardData();
  return (
    <Suspense fallback={<Loading />}>
      <ChargebacksView data={data} />
    </Suspense>
  );
}
