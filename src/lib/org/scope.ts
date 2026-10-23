"use client";
import { useOnboarding } from "./store";
import type { Brand, Location, Scope } from "./types";

/** The scope as the picker shows it: stale ids fall back to "all", and an owner with a single
 * restaurant is always "inside" it (there's nothing to choose at the restaurant level). */
export function effectiveScope(scope: Scope, live: Location[], restaurantIds: string[]): Scope {
  const valid: Scope =
    scope.kind === "location" ? (live.some((l) => l.id === scope.id) ? scope : { kind: "all" }) : scope.kind === "brand" ? (restaurantIds.includes(scope.id) ? scope : { kind: "all" }) : scope;
  return valid.kind === "all" && restaurantIds.length === 1 ? { kind: "brand", id: restaurantIds[0] } : valid;
}

/** The demo restaurant for showing feature launches to the team: it counts as already reporting even
 *  when added from the switcher, and the "What's new" popup (components/mvp2/WhatsNew) shows on every
 *  page load while it's picked, however often it's closed. */
const DEMO = ["nonna's slice"];
export const isDemoRestaurant = (name: string) => DEMO.includes(name.trim().toLowerCase().replace(/’/g, "'"));

/** The restaurant the TopBar switcher is on (none for "All restaurants" or before setup), and whether
 * it's still waiting for its first reports, in which case report pages show their launch state. */
export function useActiveRestaurant(): { ready: boolean; brand: Brand | null; awaiting: boolean } {
  const { ready, state } = useOnboarding();
  const live = state.locations.filter((l) => l.included);
  const restaurants = state.brands.filter((b) => live.some((l) => l.brandId === b.id));
  if (!ready || !state.completed || !live.length) return { ready, brand: null, awaiting: false };
  const scope = effectiveScope(state.scope, live, restaurants.map((b) => b.id));
  const id = scope.kind === "brand" ? scope.id : scope.kind === "location" ? live.find((l) => l.id === scope.id)?.brandId : null;
  const brand = restaurants.find((b) => b.id === id) ?? null;
  return { ready, brand, awaiting: !!brand?.awaitingReports && !isDemoRestaurant(brand.name) };
}
