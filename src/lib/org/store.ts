"use client";
import { useMemo, useSyncExternalStore } from "react";
import { toTacoPros } from "./posImport";
import type { OnboardingState, StepKey } from "./types";

// Onboarding answers and the owner's org (brands, locations, connections), remembered per browser
// the same way as Overview's settings (src/components/dashboard/overview/OverviewState.tsx):
// localStorage when available, memory when not. `ready` is false during the server render and
// hydration, so pages can wait for it before redirecting.

const KEY = "kf-onboarding";

export const STEP_ORDER: StepKey[] = ["account", "profile", "business", "pos", "locations", "logos", "delivery", "accounting", "review", "ready"];

export const STEP_HREF: Record<StepKey, string> = {
  account: "/get-started",
  profile: "/get-started/profile",
  business: "/onboarding/business",
  pos: "/onboarding/pos",
  locations: "/onboarding/locations",
  logos: "/onboarding/logos",
  delivery: "/onboarding/delivery",
  accounting: "/onboarding/accounting",
  review: "/onboarding/review",
  ready: "/onboarding/ready",
};

export const EMPTY: OnboardingState = {
  account: { email: "", firstName: "", lastName: "", phone: "", title: "", hasPassword: false, viaGoogle: false },
  org: { name: "", sameAsRestaurant: true, sizeBand: "", types: [] },
  brands: [],
  locations: [],
  connected: [],
  imported: [],
  skipped: [],
  step: "account",
  completed: false,
  scope: { kind: "all" },
};

let memory = "";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const parse = (raw: string): OnboardingState => {
  try {
    if (!raw) return EMPTY;
    const s = { ...EMPTY, ...JSON.parse(raw) };
    // Saved before the email-code step was removed: pick up at "About you" instead.
    if ((s.step as string) === "verify") s.step = "profile";
    return toTacoPros(s);
  } catch {
    return EMPTY;
  }
};
const save = (s: OnboardingState) => {
  memory = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

/** Applies a change to the stored state. Works outside React too. */
export function update(change: Partial<OnboardingState> | ((s: OnboardingState) => Partial<OnboardingState>)) {
  const s = parse(read());
  save({ ...s, ...(typeof change === "function" ? change(s) : change) });
}

/** Records that the owner reached `step`; never moves the bookmark backwards. */
export function reach(step: StepKey) {
  update((s) => (STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(s.step) ? { step } : {}));
}

export function reset() {
  save(EMPTY);
}

export const resumeHref = (s: OnboardingState) => (s.completed ? "/home" : STEP_HREF[s.step]);

export function useOnboarding() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => ({ ready: raw !== null, state: parse(raw ?? "") }), [raw]);
}
