"use client";
import { useSyncExternalStore } from "react";
import { NOW } from "./accounts";

// The ops person's day on the Dashboard: which of today's tasks they've ticked off, and a log of what
// they've done (seeded with the last few days, then everything done in this session). In memory until
// the admin API exists.

export type ActivityKind = "dispute" | "upload" | "invite" | "outlet" | "data";
export type Activity = { id: string; at: string; kind: ActivityKind; text: string; who?: string; amount?: number };

const h = (daysAgo: number, hour: number, min = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

/** What "you" did before today. */
const SEED: Activity[] = [
  { id: "s1", at: h(1, 17, 40), kind: "dispute", text: "Filed 7 DoorDash disputes", who: "Taco Fiesta", amount: 84.3 },
  { id: "s2", at: h(1, 16, 5), kind: "upload", text: "Uploaded Uber Eats payouts for September", who: "Burger Bliss" },
  { id: "s3", at: h(1, 14, 22), kind: "dispute", text: "Marked 3 disputes won", who: "Pasta Paradise", amount: 41.2 },
  { id: "s4", at: h(1, 11, 10), kind: "invite", text: "Resent the invite", who: "Smokehouse 51" },
  { id: "s5", at: h(1, 10, 2), kind: "outlet", text: "Added 2 outlets from Google Maps", who: "Dumpling Society" },
  { id: "s6", at: h(2, 18, 15), kind: "dispute", text: "Filed 5 Uber Eats disputes", who: "Sushi Haven", amount: 62.75 },
  { id: "s7", at: h(2, 15, 30), kind: "upload", text: "Mapped 3 locations in a Toast export", who: "EggHolic" },
  { id: "s8", at: h(2, 12, 0), kind: "data", text: "Asked for fresh POS reports", who: "Cedar & Salt" },
  { id: "s9", at: h(3, 16, 45), kind: "dispute", text: "Filed 9 DoorDash disputes", who: "Kapoor Hospitality", amount: 118.4 },
  { id: "s10", at: h(4, 11, 20), kind: "upload", text: "Uploaded DoorDash payouts for September", who: "Harbor Oyster Co." },
];

/** Last 7 days before today, as the report shows them (seeded; today's work is added on top). */
export const WEEK_BEFORE = { filed: 46, wonBack: 412.6, uploads: 9, wentLive: 2 };

let done = new Set<string>();
let log: Activity[] = SEED;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDone() {
  return useSyncExternalStore(subscribe, () => done, () => done);
}
export function useActivity() {
  return useSyncExternalStore(subscribe, () => log, () => SEED);
}

let seq = 0;
/** Records something done now. Returns an undo that removes it. */
export function logActivity(a: Omit<Activity, "id" | "at">): () => void {
  const entry: Activity = { ...a, id: `a${++seq}`, at: new Date().toISOString() };
  log = [entry, ...log];
  emit();
  return () => {
    log = log.filter((x) => x !== entry);
    emit();
  };
}

/** Ticks a task off (or back on). */
export function setDone(id: string, on: boolean) {
  const next = new Set(done);
  if (on) next.add(id);
  else next.delete(id);
  done = next;
  emit();
}

/** Today's entries: after midnight of the real clock, so this session's work. */
export const isToday = (a: Activity) => !a.id.startsWith("s");
