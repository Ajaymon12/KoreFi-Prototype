"use client";
import { useSyncExternalStore } from "react";

// Mock sign-in for the prototype: remembers the email used on /login. Anyone on the KoreFi ops
// domain (@karboncard.com) is an admin and lands on /admin.

const KEY = "kf-session";
const listeners = new Set<() => void>();
let memory = "";

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const write = (email: string) => {
  memory = email;
  try {
    if (email) localStorage.setItem(KEY, email);
    else localStorage.removeItem(KEY);
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

export const isAdminEmail = (email: string) => /@karboncard\.com$/i.test(email.trim());
export const signIn = (email: string) => write(email.trim().toLowerCase());
export const signOut = () => write("");

/** `ready` is false during the server render and hydration, so guards can wait before redirecting. */
export function useSession() {
  const email = useSyncExternalStore(subscribe, read, () => "");
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ready, email, isAdmin: isAdminEmail(email) };
}
