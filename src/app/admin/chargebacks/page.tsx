"use client";
import { Suspense } from "react";
import { OpsChargebacks } from "@/components/admin/OpsChargebacks";
import { ClientEmpty } from "@/components/admin/ClientEmpty";
import { useClient } from "@/lib/admin/client";

// User workspace → Ops view → Chargebacks: the user's disputes to work (status tabs, one toolbar,
// deadlines, bulk actions). The owner's report with charts is in User's view.
export default function Page() {
  const { client } = useClient();
  if (!client) return null;
  if (client.data === "none") return <ClientEmpty client={client} title="Chargebacks" />;
  return (
    <Suspense fallback={null}>
      <OpsChargebacks a={client} key={client.id} />
    </Suspense>
  );
}
