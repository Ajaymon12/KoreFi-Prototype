"use client";
import { useSyncExternalStore } from "react";
import type { Chargeback, CbStatus } from "@/lib/finance/chargebacks";

// Ops' updates to a chargeback's dispute (Chargebacks → Transactions → Update dispute). Keyed like the
// report's rows (`${app}-${id}`) and laid over the generated chargebacks, so the owner's MVP 2 report
// shows the same outcome. In memory until the admin API exists.

export type DisputeUpdate = {
  status: CbStatus;
  /** What the app paid back when won; the full amount if left blank. */
  recovered?: number;
  /** Why the app declined, when ops know it. */
  reason?: string;
  note: string;
  at: string;
  by: string;
};

export const disputeKey = (c: Pick<Chargeback, "app" | "id">) => `${c.app}-${c.id}`;

let updates: Record<string, DisputeUpdate[]> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: Record<string, DisputeUpdate[]> = {};

/** Every update so far, oldest first per chargeback. */
export function useDisputeUpdates() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => updates,
    () => EMPTY,
  );
}

/** Saves an update. Returns an undo that removes it again. */
export function updateDispute(key: string, u: DisputeUpdate): () => void {
  updates = { ...updates, [key]: [...(updates[key] ?? []), u] };
  emit();
  return () => {
    const list = (updates[key] ?? []).filter((x) => x !== u);
    const rest = { ...updates };
    delete rest[key];
    updates = list.length ? { ...rest, [key]: list } : rest;
    emit();
  };
}

/** The chargebacks with ops' latest update applied to each. */
export function applyUpdates(rows: Chargeback[], all: Record<string, DisputeUpdate[]>): Chargeback[] {
  if (all === EMPTY || Object.keys(all).length === 0) return rows;
  return rows.map((c) => {
    const u = all[disputeKey(c)]?.at(-1);
    if (!u) return c;
    const decided = u.status === "won" || u.status === "lost";
    return {
      ...c,
      status: u.status,
      wonBack: u.status === "won" ? (u.recovered ?? c.amount) : 0,
      decided: decided ? u.at.slice(0, 10) : undefined,
    };
  });
}
