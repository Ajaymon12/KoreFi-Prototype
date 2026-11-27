"use client";
import { usePathname } from "next/navigation";

/** The current path without a trailing slash. The GitHub Pages build uses `trailingSlash: true`, so there
 *  usePathname() gives "/home/"; every path comparison ("/home", "/agents") expects none. */
export function usePath() {
  const p = usePathname();
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}
