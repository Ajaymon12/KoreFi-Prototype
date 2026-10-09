"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Any address that doesn't exist (old bookmarks, removed pages, mistyped links) goes straight to
// the dashboard instead of showing a 404. The redirect happens in the browser: calling redirect()
// from a server-rendered not-found page makes Next's dev timing code throw on every other page.
export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/home/overview");
  }, [router]);
  return null;
}
