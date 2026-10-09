import { fetchGroup } from "./client";
import type { Balance, Deposit, Dispute, DisputeStatus, Invoice, Payout, SalesSnapshot, SourceConnection, SourceId, StorefrontStatus, StoreOps } from "./types";

export type DashboardData = {
  connections: SourceConnection[];
  sales: SalesSnapshot[];
  disputes: Dispute[];
  storefronts: StorefrontStatus[];
  ops: StoreOps[];
  payouts: Payout[];
  deposits: Deposit[];
  balances: Balance[];
  invoices: Invoice[];
};

// Fans out over every group and merges whatever the connected sources returned.
export async function getDashboardData(): Promise<DashboardData> {
  const groups = await Promise.all((["pos", "accounting", "marketplace", "bank"] as const).map(fetchGroup));
  const results = groups.flat();
  const collect = <K extends "sales" | "disputes" | "storefronts" | "ops" | "payouts" | "deposits" | "balance" | "invoices">(key: K) =>
    results.flatMap((r) => {
      const v = r.data[key];
      return v === undefined ? [] : Array.isArray(v) ? v : [v];
    });
  return {
    connections: results.map((r) => r.connection),
    sales: collect("sales") as SalesSnapshot[],
    disputes: collect("disputes") as Dispute[],
    storefronts: collect("storefronts") as StorefrontStatus[],
    ops: collect("ops") as StoreOps[],
    payouts: collect("payouts") as Payout[],
    deposits: collect("deposits") as Deposit[],
    balances: collect("balance") as Balance[],
    invoices: collect("invoices") as Invoice[],
  };
}

// ---- Selectors ----

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function disputeStats(disputes: Dispute[]) {
  const won = disputes.filter((d) => d.status === "won");
  // "Decided" excludes still-open disputes and auto-refunds (nothing was actually disputed there).
  const decided = disputes.filter((d) => d.status === "won" || d.status === "lost");
  return {
    total: disputes.length,
    disputed: sum(disputes.map((d) => d.amount)),
    recovered: sum(won.map((d) => d.amount)),
    winRate: decided.length ? won.length / decided.length : 0,
  };
}

/** Days a marketplace gives to dispute an error charge (Uber Eats 30, DoorDash 14). Grubhub has no published window. */
export const DISPUTE_WINDOW_DAYS: Partial<Record<SourceId, number>> = { ubereats: 30, doordash: 14 };

/** ISO date the dispute window closes, or undefined when the marketplace has no fixed window. */
export function windowCloses(d: Dispute): string | undefined {
  const days = DISPUTE_WINDOW_DAYS[d.source];
  if (!days) return undefined;
  return new Date(Date.parse(`${d.date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `asOf` until the window closes (0 = today, negative = already closed). */
export const daysLeft = (closes: string, asOf: string) => Math.round((Date.parse(`${closes}T12:00:00Z`) - Date.parse(`${asOf}T12:00:00Z`)) / 86_400_000);

const CHANNEL_NAMES: Record<string, string> = { doordash: "DoorDash", ubereats: "Uber Eats", grubhub: "Grubhub" };

export type CrossTabCell = { count: number; amount: number };
export type CrossTabRow = { key: string; label: string; cells: Record<string, CrossTabCell>; total: CrossTabCell };

const emptyCell = (): CrossTabCell => ({ count: 0, amount: 0 });

/** Groups disputes by `group(d)` (rows) × channel (columns), with a row total. Used for the
 * "Where your chargebacks stand" and "What went wrong" tables — same shape, different grouping. */
function crossTab(disputes: Dispute[], rowOrder: { key: string; label: string }[], group: (d: Dispute) => string): CrossTabRow[] {
  const channels = [...new Set(disputes.map((d) => d.source))];
  return rowOrder.map(({ key, label }) => {
    const rowDisputes = disputes.filter((d) => group(d) === key);
    const cells: Record<string, CrossTabCell> = Object.fromEntries(channels.map((c) => [c, emptyCell()]));
    for (const d of rowDisputes) {
      cells[d.source].count += 1;
      cells[d.source].amount += d.amount;
    }
    return { key, label, cells, total: { count: rowDisputes.length, amount: sum(rowDisputes.map((d) => d.amount)) } };
  });
}

// Order is the story order: what came back, what's in flight, what's gone, what never hit you.
export const STATUS_ROWS = [
  { key: "won", label: "Won back" },
  { key: "open", label: "Being disputed" },
  { key: "lost", label: "Lost" },
  { key: "auto_refunded", label: "App paid it" },
];

export const disputesByStatus = (disputes: Dispute[]) => crossTab(disputes, STATUS_ROWS, (d) => d.status);

export const REASON_ROWS = [
  { key: "Missing item", label: "Missing item" },
  { key: "Made wrong", label: "Made wrong", detail: "wrong drink, size or ingredient" },
  { key: "Wrong order", label: "Wrong order" },
  { key: "Quality complaint", label: "Quality complaint" },
];

export const disputesByReason = (disputes: Dispute[]) => crossTab(disputes, REASON_ROWS, (d) => d.reason);

export type StatusAmounts = Record<DisputeStatus, number>;

const amountsByStatus = (rows: Dispute[]): StatusAmounts => {
  const by = (s: DisputeStatus) => sum(rows.filter((d) => d.status === s).map((d) => d.amount));
  return { won: by("won"), open: by("open"), lost: by("lost"), auto_refunded: by("auto_refunded") };
};

export type StoreBreakdown = { store: string; count: number; amounts: StatusAmounts; winRate: number };

/** Per store: dollars in each state, and the win rate on disputes that have been decided. */
export function disputesByStore(disputes: Dispute[], stores: string[]): StoreBreakdown[] {
  return stores.map((store) => {
    const rows = disputes.filter((d) => d.store === store);
    const decided = rows.filter((d) => d.status === "won" || d.status === "lost");
    return {
      store,
      count: rows.length,
      amounts: amountsByStatus(rows),
      winRate: decided.length ? decided.filter((d) => d.status === "won").length / decided.length : 0,
    };
  });
}

export type DayPoint = { date: string; charged: number; recovered: number };

/** Running totals per day across the period: dollars charged back vs dollars paid back. A won
 * dispute counts as recovered on the day it resolved, so the gap between the lines is real lag. */
export function cumulativeByDay(disputes: Dispute[], start: string, days: number): DayPoint[] {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(t0 + i * 864e5).toISOString().slice(0, 10);
    return {
      date,
      charged: sum(disputes.filter((d) => d.date <= date).map((d) => d.amount)),
      recovered: sum(disputes.filter((d) => d.status === "won" && (d.resolvedDate ?? d.date) <= date).map((d) => d.amount)),
    };
  });
}

export const channelName = (source: string) => CHANNEL_NAMES[source] ?? source;

/** Marketplace payout vs the matching Mercury deposit, per channel. */
export function reconcile(payouts: Payout[], deposits: Deposit[]) {
  const names: Record<string, string> = { doordash: "DoorDash", ubereats: "Uber Eats", grubhub: "Grubhub" };
  return payouts.map((p) => {
    const deposited = sum(deposits.filter((d) => d.reference.toUpperCase().includes(names[p.source].toUpperCase())).map((d) => d.amount));
    return { channel: names[p.source], expected: p.net, deposited, delta: +(deposited - p.net).toFixed(2) };
  });
}

/** Relative change vs the previous period, e.g. 0.077 for +7.7%. */
export const pctChange = (current: number, previous: number) => (previous ? (current - previous) / previous : 0);

export type StoreChannel = { source: SourceId; name: string; gross: number; fees: number; net: number };
export type StoreMoney = { store: string; gross: number; fees: number; net: number; channels: StoreChannel[]; downtimeMinutes: number; lostToDowntime: number };

/** Per store: marketplace sales split by channel, plus downtime. Feeds "Follow your money" and "Your stores". */
export function moneyByStore(payouts: Payout[], storefronts: StorefrontStatus[], stores: string[]): StoreMoney[] {
  return stores.map((store) => {
    const channels = payouts.flatMap((p) =>
      p.byStore.filter((s) => s.store === store).map((s) => ({ source: p.source, name: channelName(p.source), gross: s.gross, fees: s.fees, net: s.net })),
    );
    const fronts = storefronts.filter((s) => s.store === store);
    return {
      store,
      gross: sum(channels.map((c) => c.gross)),
      fees: sum(channels.map((c) => c.fees)),
      net: sum(channels.map((c) => c.net)),
      channels,
      downtimeMinutes: sum(fronts.map((s) => s.downtimeMinutes)),
      lostToDowntime: sum(fronts.map((s) => s.estLostRevenue)),
    };
  });
}

/** Disputes grouped by channel or store, with the totals the Breakdown tables show. */
export function groupDisputes(disputes: Dispute[], by: "source" | "store") {
  const keys = [...new Set(disputes.map((d) => d[by]))];
  return keys.map((key) => {
    const rows = disputes.filter((d) => d[by] === key);
    return { key, ...disputeStats(rows) };
  });
}
