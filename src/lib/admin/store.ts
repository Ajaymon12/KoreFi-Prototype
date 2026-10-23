"use client";
import { useSyncExternalStore } from "react";
import { ACCOUNTS as SEED, NOW, type Account, type AccountRestaurant, type AdminOutlet } from "./accounts";
import type { ProviderId } from "./data";

// In-memory account list shared by Users and Dashboard so onboarding someone shows up in both.
// Prototype only: resets on reload until the admin API exists.

let accounts: Account[] = SEED;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The current list, for lookups outside React (e.g. lib/admin/data's user()). */
export const getAccounts = () => accounts;

export function useAccounts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => accounts,
    () => SEED,
  );
}

export type NewCustomer = {
  name: string;
  email: string;
  company: string;
  role: Account["role"];
  outlets: number;
  pos?: ProviderId;
  delivery: ProviderId[];
};

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Creates an `invited` account that has never signed in. Returns it so the caller can open it. */
export function inviteCustomer(c: NewCustomer): Account {
  const account: Account = {
    ...c,
    id: `${slug(c.name)}-${accounts.length + 1}`,
    status: "invited",
    step: "business",
    lastActive: null,
    joined: NOW.toISOString().slice(0, 10),
    data: "none",
    openChargebacks: 0,
    restaurants: [{ id: `${slug(c.name)}-${slug(c.company)}`, name: c.company, outlets: [] }],
  };
  accounts = [account, ...accounts];
  emit();
  return account;
}

export const emailTaken = (list: Account[], email: string) => list.some((a) => a.email.toLowerCase() === email.trim().toLowerCase());

/** The single-use link the customer lands on to set a password and start onboarding. */
export const inviteLink = (a: Pick<Account, "id">) => `https://app.korefi.com/invite/${a.id}`;

/** Suspends or reactivates an account. Returns an undo that restores the previous status. */
export function setAccountStatus(id: string, status: Account["status"]): () => void {
  const before = accounts.find((a) => a.id === id)?.status;
  accounts = accounts.map((a) => (a.id === id ? { ...a, status } : a));
  emit();
  return () => {
    if (!before) return;
    accounts = accounts.map((a) => (a.id === id ? { ...a, status: before } : a));
    emit();
  };
}

// ---------- Outlets (ops: Users → account → Outlets) ----------

const total = (rs: AccountRestaurant[]) => rs.reduce((n, r) => n + r.outlets.length, 0);
function patch(id: string, fn: (rs: AccountRestaurant[]) => AccountRestaurant[]) {
  accounts = accounts.map((a) => {
    if (a.id !== id) return a;
    const restaurants = fn(a.restaurants);
    return { ...a, restaurants, outlets: total(restaurants) };
  });
  emit();
}

/** Adds outlets to a restaurant, creating the restaurant first when it's new. */
export function addOutlets(accountId: string, restaurant: Omit<AccountRestaurant, "outlets">, outlets: AdminOutlet[]) {
  patch(accountId, (rs) => (rs.some((r) => r.id === restaurant.id) ? rs.map((r) => (r.id === restaurant.id ? { ...r, outlets: [...r.outlets, ...outlets] } : r)) : [...rs, { ...restaurant, outlets }]));
}

/** Removes one outlet. Returns an undo that puts it back where it was. */
export function removeOutlet(accountId: string, outletId: string): () => void {
  let undo = () => {};
  patch(accountId, (rs) =>
    rs.map((r) => {
      const i = r.outlets.findIndex((o) => o.id === outletId);
      if (i < 0) return r;
      const gone = r.outlets[i];
      undo = () => patch(accountId, (now) => now.map((x) => (x.id === r.id ? { ...x, outlets: [...x.outlets.slice(0, i), gone, ...x.outlets.slice(i)] } : x)));
      return { ...r, outlets: r.outlets.filter((o) => o.id !== outletId) };
    }),
  );
  return undo;
}
