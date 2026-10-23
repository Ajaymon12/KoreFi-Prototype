"use client";
import { useSyncExternalStore } from "react";

// The owner's own figures for the costs KoreFi never receives (food and staff, the prime cost), used to estimate
// profit. Remembered per browser (same pattern as src/lib/brief/prefs.ts), per scope: "all" applies to
// every store, a store name overrides it for that store. Fixed amounts are per store, per month.
// Until the owner sets anything, typical restaurant figures stand in and the page says so.

const KEY = "kf-cost-settings";

export type CostKey = "food" | "staff";
export type CostMode = "pct" | "month";
export type CostSetting = { mode: CostMode; value: number };
export type CostSettings = Record<CostKey, CostSetting>;
export type Source = "store" | "all" | "typical";

export const COSTS: { key: CostKey; label: string; hint: string; typical: string; modes: CostMode[] }[] = [
  { key: "food", label: "Food & drink", hint: "Ingredients, drinks and packaging", typical: "28–35% of sales", modes: ["pct"] },
  { key: "staff", label: "Staff", hint: "Wages, payroll tax and benefits, owner pay if you take it", typical: "25–35% of sales", modes: ["pct", "month"] },
];

export const TYPICAL: CostSettings = { food: { mode: "pct", value: 30 }, staff: { mode: "pct", value: 30 } };

type Stored = Record<string, CostSettings>;

let memory = "";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const parse = (raw: string): Stored => {
  try {
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
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

/** Save settings for a scope ("all" or a store); null goes back to the fallback. */
export function saveCostSettings(scope: string, s: CostSettings | null) {
  const all = parse(read());
  if (s) all[scope] = s;
  else delete all[scope];
  memory = JSON.stringify(all);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  listeners.forEach((l) => l());
}

export function useCostSettings(): Stored {
  return parse(useSyncExternalStore(subscribe, read, () => ""));
}

/** A store's settings and where they came from: its own, the all-stores ones, or typical. */
export function settingsFor(stored: Stored, store: string): { s: CostSettings; source: Source } {
  if (stored[store]) return { s: stored[store], source: "store" };
  if (stored.all) return { s: stored.all, source: "all" };
  return { s: TYPICAL, source: "typical" };
}

/** "30% of sales" or "$8,000 a month". */
export const settingText = (c: CostSetting) => (c.mode === "pct" ? `${c.value}% of sales` : `$${Math.round(c.value).toLocaleString("en-US")} a month`);
