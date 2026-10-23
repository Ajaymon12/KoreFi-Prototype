"use client";
import { Suspense } from "react";
import { ClientDetails } from "@/components/admin/ClientDetails";

// User workspace → Outlets: every restaurant and outlet, with add (Google Maps or by hand) and remove.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientDetails tab="outlets" />
    </Suspense>
  );
}
