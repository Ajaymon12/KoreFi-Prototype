import { Suspense } from "react";
import { getDashboardData } from "@/lib/sources/dashboard";
import Loading from "../loading";
import { OverviewView } from "./OverviewView";

// Static: loads the mock data once, so it works on any static host such as GitHub Pages.
export default async function Page() {
  const data = await getDashboardData();
  return (
    <Suspense fallback={<Loading />}>
      <OverviewView data={data} />
    </Suspense>
  );
}
