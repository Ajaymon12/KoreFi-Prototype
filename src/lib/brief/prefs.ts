"use client";
import { useSyncExternalStore } from "react";

// How the owner wants the weekly brief delivered, remembered per browser (same pattern as the
// onboarding store, src/lib/org/store.ts). The prototype never sends anything: KoreFi sets
// delivery up from these during onboarding.

const KEY = "kf-brief-prefs";

export type BriefSection = "profit" | "payouts" | "chargebacks" | "promos";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BriefPrefs = {
  whatsapp: boolean;
  email: boolean;
  phone: string;
  emailAddress: string;
  day: Weekday;
  /** "08:00", 24-hour, in the reporting timezone. */
  time: string;
  include: Record<BriefSection, boolean>;
};

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

export const TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "18:00"];

export const SECTIONS: { key: BriefSection; label: string; hint: string }[] = [
  { key: "profit", label: "Profit", hint: "Sales and what you kept" },
  { key: "payouts", label: "Payouts", hint: "What reached your bank" },
  { key: "chargebacks", label: "Chargebacks", hint: "Disputes KoreFi is working" },
  { key: "promos", label: "Promos", hint: "Which ones paid" },
];

export const DEFAULT_PREFS: BriefPrefs = {
  whatsapp: true,
  email: true,
  phone: "",
  emailAddress: "",
  day: "mon",
  time: "08:00",
  include: { profit: true, payouts: true, chargebacks: true, promos: true },
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
const parse = (raw: string): BriefPrefs => {
  try {
    if (!raw) return DEFAULT_PREFS;
    const s = JSON.parse(raw) as Partial<BriefPrefs>;
    return { ...DEFAULT_PREFS, ...s, include: { ...DEFAULT_PREFS.include, ...(s.include ?? {}) } };
  } catch {
    return DEFAULT_PREFS;
  }
};
const save = (p: BriefPrefs) => {
  memory = JSON.stringify(p);
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

export function updatePrefs(change: Partial<BriefPrefs> | ((p: BriefPrefs) => Partial<BriefPrefs>)) {
  const p = parse(read());
  save({ ...p, ...(typeof change === "function" ? change(p) : change) });
}

const snapshot = () => read();
const serverSnapshot = () => "";

/** The saved preferences; `ready` is false until the browser copy has been read. */
export function useBriefPrefs(): { ready: boolean; prefs: BriefPrefs } {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ready, prefs: parse(raw) };
}

/** "Mondays at 8:00 AM" */
export const scheduleLabel = (p: BriefPrefs) => {
  const [h, m] = p.time.split(":").map(Number);
  const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${WEEKDAYS.find((d) => d.value === p.day)?.label ?? "Monday"}s at ${t}`;
};
