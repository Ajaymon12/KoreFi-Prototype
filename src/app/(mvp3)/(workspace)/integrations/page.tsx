import { Suspense } from "react";
import { IntegrationsDirectory } from "@/components/mvp3/IntegrationsDirectory";
import { fetchConnections } from "@/lib/sources/client";

// MVP 3 / Integrations: a ChatGPT-style directory of what the agents read from. ?app=<id> opens one integration;
// a query param, not a segment, so the static GitHub Pages export still works.
export default async function Page() {
  const connections = await fetchConnections();
  return (
    <Suspense>
      <IntegrationsDirectory connections={connections} />
    </Suspense>
  );
}
