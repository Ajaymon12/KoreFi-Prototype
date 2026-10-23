"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Users became Clients (/admin); old links land there. Client-side because the static export has no redirects().
export default function Page() {
  const router = useRouter();
  useEffect(() => router.replace(`/admin${window.location.search}`), [router]);
  return null;
}
