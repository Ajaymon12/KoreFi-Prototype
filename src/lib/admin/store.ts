"use client";
import { useSyncExternalStore } from "react";
import { ACCOUNTS as SEED, NOW, type Account } from "./accounts";
import type { ProviderId } from "./data";

// In-memory account list shared by Users and Dashboard so onboarding someone shows up in both.
// Prototype only: resets on reload until the admin API exists.

let accounts: Account[] = SEED;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

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
  };
  accounts = [account, ...accounts];
  emit();
  return account;
}

export const emailTaken = (list: Account[], email: string) => list.some((a) => a.email.toLowerCase() === email.trim().toLowerCase());

/** The single-use link the customer lands on to set a password and start onboarding. */
export const inviteLink = (a: Pick<Account, "id">) => `https://app.korefi.com/invite/${a.id}`;
