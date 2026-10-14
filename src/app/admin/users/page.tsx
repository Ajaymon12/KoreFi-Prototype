import { Suspense } from "react";
import { UsersView } from "@/components/admin/UsersView";

// Every customer account KoreFi manages. UsersView reads ?status= / ?data= (Dashboard links), so it
// sits in a Suspense boundary for the static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <UsersView />
    </Suspense>
  );
}
