"use client";
import { usePathname } from "next/navigation";

/** The current path without a trailing slash. The GitHub Pages build uses `trailingSlash: true`, so there
 *  usePathname() gives "/mvp3/home/"; every /mvp3 comparison ("/mvp3/home", "/mvp3") expects none. */
export function usePath() {
  const p = usePathname();
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}
