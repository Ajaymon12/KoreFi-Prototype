import { Suspense } from "react";
import { DashboardPage } from "@/components/mvp3/DashboardPage";

// /mvp3/dashboard?id=dash-chargebacks: a dashboard pinned to the sidebar. A query param so the static export still works.
export default function Page() {
  return (
    <Suspense>
      <DashboardPage />
    </Suspense>
  );
}
