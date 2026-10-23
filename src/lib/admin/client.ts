"use client";
import { useSyncExternalStore } from "react";
import { useAccounts } from "./store";

// The client ops are working in. Like the dev ops app, every client page (Overview, Chargebacks,
// File uploads, Client details) is scoped to one client; it's kept here rather than in the URL so new
// clients work in the static export. Same pattern as ./session.ts.

const KEY = "kf-admin-client";
const RECENT = "kf-admin-recent-users";
const MAX_RECENT = 5;
const listeners = new Set<() => void>();
let memory = "";
let recentMemory: string[] = [];

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => (e.key === KEY || e.key === RECENT) && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

export const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? "null") ?? recentMemory;
  } catch {
    return recentMemory;
  }
};

/** Opens a client: it becomes the scope of every client page and moves to the top of Recent. */
export function selectClient(id: string) {
  memory = id;
  recentMemory = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(KEY, id);
    localStorage.setItem(RECENT, JSON.stringify(recentMemory));
  } catch {}
  listeners.forEach((l) => l());
}

export function clearClient() {
  memory = "";
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

/** `ready` is false during the server render and hydration, so guards can wait before redirecting. */
export function useClient() {
  const id = useSyncExternalStore(subscribe, read, () => "");
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const client = useAccounts().find((a) => a.id === id) ?? null;
  return { ready, client };
}

let recentSnap = "";
let recentList: string[] = [];
/** Recently opened client ids, newest first. */
export function useRecentClients() {
  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = JSON.stringify(readRecent());
      if (raw !== recentSnap) {
        recentSnap = raw;
        recentList = JSON.parse(raw);
      }
      return recentList;
    },
    () => recentList,
  );
}
