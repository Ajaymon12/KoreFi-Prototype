"use client";
import { useSyncExternalStore } from "react";

// Feature launches announced to owners who already use KoreFi: a one-time popup (WhatsNew) and a "New"
// tag on the page's sidebar link until they've opened it. The two are tracked apart ("popup:id" once the
// popup is closed either way, "visit:id" once the page is opened), so "Later" keeps the sidebar tag.
// What a browser has seen is kept like the rest of the mock's state (src/lib/org/store.ts):
// localStorage when available, memory when not.
// To announce a launch, add it here (newest first) with an id that's never reused.

export type Announcement = {
  id: string;
  /** The page it launches; opening it counts as seen and clears the sidebar tag. */
  href: string;
  eyebrow: string;
  title: string;
  /** One short line; the motion carries the rest. */
  body: string;
  /** A short looping clip of the feature (public/whats-new, made in design/), and a still of it for
   *  reduced motion and while the clip loads. */
  media: { video: string; poster: string };
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "pnl-summary-2026-10",
    href: "/mvp2/pnl",
    eyebrow: "P&L Summary",
    title: "Your P&L, split by channel",
    body: "See what every app keeps from each $1, and what's left for you.",
    media: { video: "/whats-new/pnl.mp4", poster: "/whats-new/pnl-poster.jpg" },
  },
];

const KEY = "kf-seen-announcements";
let memory = "[]";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function markSeen(id: `${"popup" | "visit"}:${string}`) {
  const seen = new Set<string>(JSON.parse(read()));
  if (seen.has(id)) return;
  seen.add(id);
  memory = JSON.stringify([...seen]);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  listeners.forEach((l) => l());
}

/** Ids this browser has seen; null during the server render, so nothing flashes before it's known. */
export function useSeen(): Set<string> | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return raw === null ? null : new Set(JSON.parse(raw));
}

/** Sidebar links to launched pages the owner hasn't opened yet. */
export function useNewHrefs(): Set<string> {
  const seen = useSeen();
  return new Set(seen ? ANNOUNCEMENTS.filter((a) => !seen.has(`visit:${a.id}`)).map((a) => a.href) : []);
}

/** Forget what this browser has seen, so every launch pops up again (WhatsNew's ?whatsnew). */
export function resetSeen() {
  memory = "[]";
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}
