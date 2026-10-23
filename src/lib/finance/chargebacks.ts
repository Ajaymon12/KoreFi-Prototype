import { STORES, type Store } from "./books";
import { reportWeek, type ChannelKey } from "./reports";

// One row per chargeback, for MVP 2's Chargeback Overview and Transactions. Built from the same weekly
// reports as the P&L (reportWeek): each store's, app's and week's chargebacks are split into orders, so
// "Charged back" matches the P&L to the cent. Each order is won at the share that week's report paid back,
// so "Won back" tracks the P&L's money back over any real stretch of weeks. KoreFi disputes every one;
// the owner only sees where each is.
//   disputing   filed by KoreFi, the app hasn't decided yet (a week or two)
//   won         paid back in full
//   lost        the app kept it
//   new         not filed yet (only when ops set it back from the admin; the generator never makes it)

export type AppKey = Exclude<ChannelKey, "instore">;
export type CbStatus = "new" | "disputing" | "won" | "lost";
export type Chargeback = {
  id: string;
  store: Store;
  app: AppKey;
  /** Index into the P&L's WEEKS. */
  week: number;
  date: string;
  amount: number;
  wonBack: number;
  status: CbStatus;
  decided?: string;
  windowCloses?: string;
  reason: string;
  detail: string;
};
export type Week = { year: number; w: number; start: Date };

export const APPS: { key: AppKey; label: string; source: string }[] = [
  { key: "doordash", label: "DoorDash", source: "doordash" },
  { key: "uber", label: "Uber Eats", source: "ubereats" },
  { key: "grubhub", label: "Grubhub", source: "grubhub" },
];
export const appLabel = (k: AppKey) => APPS.find((a) => a.key === k)!.label;
export const STATUS_LABEL: Record<CbStatus, string> = { new: "Not filed yet", disputing: "Being disputed", won: "Won back", lost: "Kept by the app" };
/** The same four states in the words ops use (the dev ops app's Update dispute). */
export const OPS_STATUS_LABEL: Record<CbStatus, string> = { new: "Not disputed", disputing: "Awaiting decision", won: "Won", lost: "Declined" };
/** Days each app allows to dispute a charge; Grubhub has no fixed window. */
export const WINDOW_DAYS: Partial<Record<AppKey, number>> = { doordash: 14, uber: 30 };

const ITEMS = ["Carne asada tacos", "Chicken burrito", "Horchata", "Chips & guacamole", "Elote", "Churros", "Quesabirria plate", "Al pastor bowl"];
const REASONS: { reason: string; detail: (item: string, n: number) => string }[] = [
  { reason: "Missing item", detail: (item, n) => `${n} ${item} missing` },
  { reason: "Wrong item", detail: (item) => `${item} swapped for another dish` },
  { reason: "Order never arrived", detail: () => "Customer says the order never arrived" },
  { reason: "Quality issue", detail: (item) => `${item} cold or spilled` },
  { reason: "Missing whole order", detail: () => "Bag left out of the hand-off" },
];

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1_000_003, 7);
const rand = (seed: string) => (hash(seed) % 10_000) / 10_000;
const hex = (seed: string, n: number) => (hash(seed) * 2654435761 >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, n);

function orderId(app: AppKey, seed: string) {
  if (app === "doordash") return hex(seed, 8);
  if (app === "uber") return `#${hex(seed, 5)}`;
  return `#${2_200_000 + (hash(seed) % 90_000)}`;
}

/** The chargebacks for some stores over a run of weeks; `asOf` is the last day of the last closed week. */
export function chargebacks(weeks: readonly Week[], from: number, to: number, stores: readonly Store[] = STORES): Chargeback[] {
  const last = weeks.length - 1;
  const asOf = weeks[last].start.getTime() + 6 * DAY;
  const out: Chargeback[] = [];
  for (const store of stores) {
    for (let i = from; i <= to; i++) {
      const { year, w, start } = weeks[i];
      const report = reportWeek(store, year, w);
      for (const { key: app } of APPS) {
        const total = report[app].chargebacks;
        if (total < 1) continue;
        const seed = `${store}${app}${year}-${w}`;
        // A week's charges, split into orders of roughly $9–$30.
        const n = Math.max(1, Math.round(total / (12 + 10 * rand(seed))));
        const weights = Array.from({ length: n }, (_, k) => 0.5 + rand(seed + k));
        const sumW = weights.reduce((a, b) => a + b, 0);
        const winShare = report[app].moneyBack / total;
        weights.forEach((wt, k) => {
          const s = seed + k;
          const amount = Math.round((total * wt * 100) / sumW) / 100;
          const date = start.getTime() + Math.floor(rand(s + "d") * 7) * DAY;
          const decidedAt = date + (6 + Math.floor(rand(s + "r") * 8)) * DAY;
          const status: CbStatus = decidedAt > asOf ? "disputing" : rand(s + "won") < winShare ? "won" : "lost";
          const r = REASONS[hash(s + "why") % REASONS.length];
          const days = WINDOW_DAYS[app];
          out.push({
            id: orderId(app, s),
            store,
            app,
            week: i,
            date: iso(date),
            amount,
            wonBack: status === "won" ? amount : 0,
            status,
            decided: status === "disputing" ? undefined : iso(decidedAt),
            windowCloses: days ? iso(date + days * DAY) : undefined,
            reason: r.reason,
            detail: r.detail(ITEMS[hash(s + "item") % ITEMS.length], 1 + (hash(s + "n") % 2)),
          });
        });
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
