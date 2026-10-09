import { PageHeader } from "@/components/shell/PageHeader";
import { IntegrationsClient } from "@/components/integrations/IntegrationsClient";
import { fetchConnections } from "@/lib/sources/client";
import { SHOWN_GROUPS } from "@/lib/sources/catalog";

// Where dashboard data comes from. Owners connect their POS, accounting and bank here; delivery
// apps are connected by the KoreFi team, so they are not listed. Connection state is simulated
// (src/lib/sources/connections.ts).
export default async function Page() {
  const connections = (await fetchConnections()).filter((c) => SHOWN_GROUPS.includes(c.group));
  return (
    <>
      <PageHeader title="Integrations" />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
        <IntegrationsClient connections={connections} />
      </div>
    </>
  );
}
