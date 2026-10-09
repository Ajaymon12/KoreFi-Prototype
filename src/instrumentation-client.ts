import { NAV_START_EVENT } from "@/lib/navEvents";

// Runs before hydration. Next calls onRouterTransitionStart for every App Router navigation —
// <Link> clicks, router.push/replace and back/forward — so the top progress bar
// (src/components/shell/RouteProgress.tsx) can start the moment a page switch begins.
export function onRouterTransitionStart(url: string) {
  window.dispatchEvent(new CustomEvent(NAV_START_EVENT, { detail: url }));
}
