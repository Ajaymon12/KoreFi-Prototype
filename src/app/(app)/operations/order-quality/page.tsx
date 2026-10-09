import { Suspense } from "react";
import { getDashboardData } from "@/lib/sources/dashboard";
import Loading from "../../loading";
import { OrderQualityView } from "./OrderQualityView";

// The report reads ?store= / ?tab= / ?channel= in the browser (see OrderQualityView), so this page itself is
// static: it loads the mock data once and works on any static host such as GitHub Pages.
export default async function Page() {
  const data = await getDashboardData();
  return (
    <Suspense fallback={<Loading />}>
      <OrderQualityView data={data} />
    </Suspense>
  );
}
