"use client";
import { Suspense } from "react";
import { ChargebackReport } from "@/components/mvp2/ChargebackReport";
import { useClient } from "@/lib/admin/client";
import { UserViewGate } from "@/components/admin/UserViewGate";

// User's view → Chargebacks (Overview / Transactions): the owner's report, read-only, with this user's
// chargebacks and ops' updates, but none of the ops controls.
export default function Page() {
  const { client } = useClient();
  if (!client) return null;
  return (
    <UserViewGate title="Chargebacks">
      <Suspense fallback={null}>
        <ChargebackReport accountId={client.id} key={client.id} />
      </Suspense>
    </UserViewGate>
  );
}
