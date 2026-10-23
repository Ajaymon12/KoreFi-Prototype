import type { Store } from "./books";
import { REPORT_THROUGH, reportWeek } from "./reports";
import type { AppKey } from "./chargebacks";

// Two-way reconciliation of delivery orders between the POS and each app's payout report, for MVP 2's
// Revenue & payout. Delivery orders land in the POS too (tablet or integration), so each side checks the other:
//   POS → app    every delivery order the POS rang up should be in the app's report. If not, the app
//                hasn't paid for it (cancelled after cooking, or missing from the payout).
//   app → POS    every order the app paid for should be in the POS. If not, the POS under-reports sales
//                (an order never keyed in, or the integration dropped it).
// Price differences on orders in both aren't checked: they can't be worked out reliably from the reports.
// The P&L always uses the app's report; each mismatched order comes back with its time and id, so the owner
// can find it in either system.
// Reports are uploaded by hand, weekly (Square's API comes later), and land on different days, so Square can be
// a week past an app's last report for a while. Only days both cover are checked; Square's delivery orders
// after the app's report ends are `waiting`, not mismatches, and get checked when that app's report arrives.
// `through` is the last day checked.
// Mock: the app side is the report the P&L uses (reportWeek), so the totals agree; the gaps each way are a
// small deterministic share of it, in whole orders.

export type Gap = { orders: number; amount: number };
/** One order that doesn't match: `amount` is what the app has (or, for posOnly, what Square has). */
export type Mismatch = { kind: "appOnly" | "posOnly"; store: Store; at: Date; appId: string | null; posId: string | null; amount: number };
export type Recon = { app: AppKey; report: number; pos: number; matched: number; matchedOrders: number; posOnly: Gap; appOnly: Gap; waiting: Gap; through: Date; orders: Mismatch[] };

const TICKET: Record<AppKey, number> = { doordash: 31, uber: 29, grubhub: 34 };
const DAY = 86_400_000;
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1_000_003, 7);
const rand = (seed: string) => (hash(seed) % 10_000) / 10_000;
const cents = (n: number) => Math.round(n * 100) / 100;
/** A random-looking id: each character from a small generator seeded by the order, so ids don't run in sequence. */
const code = (seed: string, len: number, chars: string) => {
  let h = hash(seed) + 1;
  return Array.from({ length: len }, () => {
    h = (h * 48_271) % 2_147_483_647;
    return chars[h % chars.length];
  }).join("");
};
const HEX = "0123456789ABCDEF";
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Order ids as each system prints them.
const APP_ID: Record<AppKey, (seed: string) => string> = {
  doordash: (x) => code(x, 8, HEX),
  uber: (x) => code(x, 5, HEX),
  grubhub: (x) => code(x, 9, "0123456789"),
};
const posId = (seed: string) => code(seed + "sq", 4, ALNUM);

/** One app's orders, both ways, summed over some stores and weeks ({year, w} as in the P&L's WEEKS). */
export function reconcile(app: AppKey, stores: readonly Store[], weeks: readonly { year: number; w: number }[]): Recon {
  let report = 0;
  const gaps = { posOnly: { orders: 0, amount: 0 }, appOnly: { orders: 0, amount: 0 } };
  const waiting = { orders: 0, amount: 0 };
  // The last day both Square and the app's report cover; anything from the day after is waiting.
  const through = new Date(Math.min(REPORT_THROUGH.instore.getTime(), REPORT_THROUGH[app].getTime()));
  const cutoff = through.getTime() + DAY;
  // Days Square has and the app doesn't yet run from the cutoff to the end of Square's report.
  const squareEnd = REPORT_THROUGH.instore.getTime() + DAY;
  const orders: Mismatch[] = [];
  for (const s of stores) {
    for (const { year, w } of weeks) {
      const sales = reportWeek(s, year, w)[app].sales;
      const seed = `${s}${app}${year}-${w}`;
      report += sales;
      const week = Date.UTC(year, 0, 1) + w * 7 * DAY;
      // The week's days past the cutoff that Square covers: Square has their delivery orders, the app doesn't yet.
      const late = Math.max(0, (Math.min(week + 7 * DAY, squareEnd) - Math.max(week, cutoff)) / DAY);
      if (late) {
        const amount = cents((sales * late) / 7);
        waiting.amount += amount;
        waiting.orders += Math.round(amount / TICKET[app]);
      }
      // Roughly one week in three has an order the app didn't pay for, one in eight one the POS missed.
      const add = (kind: Mismatch["kind"], chance: number) => {
        if (rand(seed + kind) > chance) return;
        const n = 1 + (hash(seed + kind + "n") % 2);
        for (let i = 0; i < n; i++) {
          const k = `${seed}${kind}${i}`;
          const amount = cents(TICKET[app] * (0.7 + 0.6 * rand(k + "$")));
          // Lunch or dinner, any day of the week.
          const at = new Date(week + (hash(k + "d") % 7) * DAY + (11 + (hash(k + "h") % 11)) * 3_600_000 + (hash(k + "m") % 60) * 60_000);
          if (at.getTime() >= cutoff) continue;
          orders.push({ kind, store: s, at, appId: kind === "posOnly" ? null : APP_ID[app](k), posId: kind === "appOnly" ? null : posId(k), amount });
          gaps[kind].orders += 1;
          gaps[kind].amount += amount;
        }
      };
      add("posOnly", 0.35);
      add("appOnly", 0.12);
    }
  }
  orders.sort((a, b) => a.at.getTime() - b.at.getTime());
  const matched = report - gaps.appOnly.amount - waiting.amount;
  return { app, report, pos: matched + gaps.posOnly.amount + waiting.amount, matched, matchedOrders: Math.round(matched / TICKET[app]), ...gaps, waiting, through, orders };
}

/** The share of checked orders (not those waiting) that match in both systems. */
export const matchShare = (r: Pick<Recon, "matchedOrders" | "posOnly" | "appOnly">) => {
  const off = r.posOnly.orders + r.appOnly.orders;
  return r.matchedOrders + off ? r.matchedOrders / (r.matchedOrders + off) : 1;
};
