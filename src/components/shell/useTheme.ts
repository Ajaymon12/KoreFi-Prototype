"use client";
import { useSyncExternalStore } from "react";

// App theme: the owner's choice ("light" | "dark" | "system"), remembered in localStorage, and
// the resolved light/dark the shell renders. Server render and first paint are light; the saved
// choice applies right after hydration. If storage is blocked the choice lasts for the session.

export type Theme = "light" | "dark" | "system";
const KEY = "korefi-theme";
const listeners = new Set<() => void>();
let memory: Theme = "light";

const read = (): Theme => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "system" || t === "light" ? t : memory;
  } catch {
    return memory;
  }
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

const query = "(prefers-color-scheme: dark)";
const subscribeSystem = (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function setTheme(t: Theme) {
  memory = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Storage unavailable: keep the in-memory choice.
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia(query).matches, () => false);
  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  return { theme, resolved, setTheme };
}
