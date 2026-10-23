import { Suspense } from "react";
import { ClientsHome } from "@/components/admin/ClientsHome";

// Ops home: needs attention across clients, recently opened, and every client. ClientsHome reads
// ?status= / ?data=, so it sits in a Suspense boundary for the static export. Dummy data.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientsHome />
    </Suspense>
  );
}
