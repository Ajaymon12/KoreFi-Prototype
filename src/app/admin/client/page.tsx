"use client";
import { Suspense } from "react";
import { ClientDetails } from "@/components/admin/ClientDetails";

// User workspace → Account: invitation, onboarding, connections and account details.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientDetails tab="overview" />
    </Suspense>
  );
}
