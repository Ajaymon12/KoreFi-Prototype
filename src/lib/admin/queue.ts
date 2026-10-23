"use client";
import { useMemo } from "react";
import { WEEKS } from "@/components/finance/PnlStory";
import { chargebacks, daysBetween, type Chargeback } from "@/lib/finance/chargebacks";
import type { Account } from "./accounts";
import { applyUpdates, useDisputeUpdates, type DisputeUpdate } from "./disputes";
import { useAccounts } from "./store";

// Chargebacks as ops see them, per user. Every user with data runs on the prototype's one set of demo
// outlets, so each gets its own slice of the generated chargebacks (a share of the rows, order ids
// salted with the user) and the newest ones aren't filed yet: that's the queue ops work from. The
// Dashboard's Overview and the user workspace's Chargebacks both read it, so their numbers match.

const DAY = 86_400_000;
const LAST = WEEKS.length - 1;
/** The prototype's "today" for chargebacks: the last day of the last closed week. */
export const AS_OF = new Date(WEEKS[LAST].start.getTime() + 6 * DAY).toISOString().slice(0, 10);
/** Weeks the Dashboard looks back over (open items are all inside this). */
export const RECENT_WEEKS = 4;

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1_000_003, 7);
const rand = (s: string) => (hash(s) % 10_000) / 10_000;
const hex = (s: string, n: number) => (((hash(s) * 2654435761) >>> 0).toString(16).toUpperCase().padStart(8, "0") + (hash(s + "x") >>> 0).toString(16).toUpperCase()).slice(0, n);

function saltedId(c: Chargeback, accountId: string) {
  const s = `${accountId}${c.id}`;
  if (c.app === "doordash") return hex(s, 8);
  if (c.app === "uber") return `#${hex(s, 5)}`;
  return `#${2_200_000 + (hash(s) % 90_000)}`;
}

/** One user's chargebacks from the generated rows: their share, their ids, and the not-yet-filed ones. */
export function accountChargebacks(accountId: string, rows: Chargeback[]): Chargeback[] {
  const keep = 0.3 + 0.5 * rand(accountId);
  // Each user's own amounts and days, so their queues don't all lead with the same order.
  const scale = 0.7 + 0.8 * rand(`${accountId}scale`);
  return rows
    .filter((c) => rand(`${accountId}:${c.app}:${c.id}`) < keep)
    .map((c) => {
      const id = saltedId(c, accountId);
      const shift = Math.floor(rand(`${id}shift`) * 5) * DAY;
      const date = new Date(Date.parse(c.date) - shift).toISOString().slice(0, 10);
      const windowCloses = c.windowCloses && new Date(Date.parse(c.windowCloses) - shift).toISOString().slice(0, 10);
      const amount = Math.round(c.amount * scale * (0.8 + 0.4 * rand(`${id}amt`)) * 100) / 100;
      // KoreFi files within a few days; the most recent undecided ones are still waiting to be filed.
      const unfiled = c.status === "disputing" && daysBetween(date, AS_OF) <= 13 && rand(`${accountId}${id}file`) < 0.5;
      return { ...c, id, date, windowCloses, amount, wonBack: c.wonBack ? amount * (c.wonBack / c.amount) : 0, status: unfiled ? "new" : c.status };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const daysLeft = (c: Chargeback) => (c.windowCloses ? daysBetween(AS_OF, c.windowCloses) : null);

export type UserQueue = {
  account: Account;
  rows: Chargeback[];
  toFile: Chargeback[];
  awaiting: Chargeback[];
  /** To file with 3 days or less left (or already past). */
  urgent: Chargeback[];
  wonBack: number;
  charged: number;
  winRate: number | null;
  nextDeadline: number | null;
};

const sum = (rows: Chargeback[], get: (c: Chargeback) => number = (c) => c.amount) => rows.reduce((n, c) => n + get(c), 0);

export function userQueue(account: Account, updates: Record<string, DisputeUpdate[]>): UserQueue {
  const rows = applyUpdates(accountChargebacks(account.id, chargebacks(WEEKS, LAST - RECENT_WEEKS + 1, LAST)), updates);
  const toFile = rows.filter((c) => c.status === "new").sort((a, b) => (daysLeft(a) ?? 999) - (daysLeft(b) ?? 999));
  const decided = rows.filter((c) => c.status === "won" || c.status === "lost");
  const lefts = toFile.map(daysLeft).filter((d): d is number => d !== null);
  return {
    account,
    rows,
    toFile,
    awaiting: rows.filter((c) => c.status === "disputing"),
    urgent: toFile.filter((c) => (daysLeft(c) ?? 999) <= 3),
    wonBack: sum(rows, (c) => c.wonBack),
    charged: sum(rows),
    winRate: decided.length ? decided.filter((c) => c.status === "won").length / decided.length : null,
    nextDeadline: lefts.length ? Math.min(...lefts) : null,
  };
}

/** Every user with data, and their chargeback queue over the last few weeks. */
export function useQueues() {
  const accounts = useAccounts();
  const updates = useDisputeUpdates();
  return useMemo(() => accounts.filter((a) => a.data !== "none" && a.status !== "suspended").map((a) => userQueue(a, updates)), [accounts, updates]);
}
