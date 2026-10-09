import { Suspense } from "react";
import { getDashboardData } from "@/lib/sources/dashboard";
import Loading from "../../loading";
import { ChargebackView } from "./ChargebackView";

// The report reads ?store= / ?tab= / ?channel= in the browser (see ChargebackView), so this page itself is
// static: it loads the mock data once and works on any static host such as GitHub Pages.
export default async function Page() {
  const data = await getDashboardData();
  return (
    <Suspense fallback={<Loading />}>
      <ChargebackView data={data} />
    </Suspense>
  );
}
