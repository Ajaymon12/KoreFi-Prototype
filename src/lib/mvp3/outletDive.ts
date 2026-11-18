import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { APPS, chargebacks, type Chargeback } from "@/lib/finance/chargebacks";
import { reportWeek } from "@/lib/finance/reports";
import { shortStore, type Store } from "@/lib/finance/outlets";
import { DAMEN_DIVE, masaFixture } from "./masaFixture";

// MVP 3 / Chargebacks, one outlet: "Why is Damen high?" Everything the agent says about an outlet's last week
// comes from the same chargebacks() as the dashboard, so the orders listed here add up to the figure the owner
// saw there. The one-page sheet for the store manager is built from the same facts, with no amounts on it.

const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const sum = (xs: Chargeback[], k: "amount" | "wonBack" = "amount") => xs.reduce((n, c) => n + c[k], 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export type Fix = { title: string; body: string };
export type OutletDive = {
  store: Store;
  name: string;
  /** "Sep 17–23" */
  week: string;
  /** Every order charged back last week, newest first. */
  orders: Chargeback[];
  n: number;
  /** The weekly average over the 12 weeks before. */
  usual: number;
  charged: number;
  won: number;
  /** Not decided yet. */
  open: number;
  /** Charged back as a share of the outlet's delivery-app sales that week, in percent. */
  rate: number;
  /** What the agent found, one sentence each: the chat reply and the panel say the same things. */
  findings: string[];
  fixes: Fix[];
  /** Masa Kitchen's pinned sample week (masaFixture): its tiles read "Still to dispute" and its status words are the prototype's. */
  fx?: boolean;
};

const cache = new Map<Store, OutletDive>();

export function outletDive(store: Store): OutletDive {
  if (masaFixture() && store === DAMEN_DIVE.store) return DAMEN_DIVE;
  const hit = cache.get(store);
  if (hit) return hit;
  const wk = WEEKS[LAST];
  const orders = chargebacks(WEEKS, LAST, LAST, [store]);
  const history = chargebacks(WEEKS, LAST - 12, LAST - 1, [store]);
  const n = orders.length;
  const usual = Math.round(history.length / 12);
  const appSales = APPS.reduce((t, a) => t + reportWeek(store, wk.year, wk.w)[a.key].sales, 0);
  const charged = sum(orders);

  // The two weekdays this outlet is usually worst on, from the 12 weeks before.
  const perDay = DAY_NAME.map((_, d) => history.filter((c) => dow(c.date) === d).length);
  const worst = perDay
    .map((count, d) => ({ d, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.d - b.d)
    .slice(0, 2)
    .map((x) => x.d)
    .sort((a, b) => a - b);
  const onWorst = orders.filter((c) => worst.includes(dow(c.date)));
  const worstNames = worst.map((d) => DAY_NAME[d]);

  const count = (key: (c: Chargeback) => string) => {
    const m = new Map<string, number>();
    orders.forEach((c) => m.set(key(c), (m.get(key(c)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const [topReason] = count((c) => c.reason);
  const [topItem] = count((c) => c.item);
  const missing = orders.filter((c) => c.reason.startsWith("Missing")).length;

  const findings: string[] = [];
  const fixes: Fix[] = [];
  if (n) {
    if (onWorst.length >= 2 && onWorst.length / n >= 0.3) {
      findings.push(`${onWorst.length} of them were on ${list(worstNames)}, its usual worst ${worst.length === 1 ? "day" : "days"}.`);
      fixes.push({ title: list(worstNames), body: `${onWorst.length} of ${n} errors were on ${worst.length === 1 ? "this day" : "these days"}. Add a second bag check on ${worst.length === 1 ? "that shift" : "those shifts"}.` });
    }
    if (missing >= 2) {
      findings.push(`${missing} were missing items.`);
      fixes.push({ title: `Missing items: ${missing} of ${n}`, body: "Count items into the bag against the ticket before sealing it." });
    } else if (topReason && topReason[1] >= 2) {
      findings.push(`${topReason[1]} were "${topReason[0].toLowerCase()}".`);
      fixes.push({ title: `${topReason[0]}: ${topReason[1]} of ${n}`, body: "Check the ticket against the bag at hand-off." });
    }
    if (topItem && topItem[1] >= 2) {
      findings.push(`${topItem[0]} was the one dish charged back more than once (${topItem[1]} times).`);
      fixes.push({ title: `${topItem[0]} charged back ${topItem[1]} times`, body: "Check where it is packed, and that it goes in every bag it is on." });
    }
    if (!fixes.length) {
      findings.push("The errors are spread across the week and across dishes, with no repeat.");
      fixes.push({ title: "No single cause", body: "The errors are spread across the week. Keep an eye on the next report before changing anything." });
    }
  }

  const dive: OutletDive = {
    store,
    name: shortStore(store),
    week: wk.label,
    orders,
    n,
    usual,
    charged,
    won: sum(orders, "wonBack"),
    open: sum(orders.filter((c) => c.status === "disputing" || c.status === "new")),
    rate: appSales ? (charged / appSales) * 100 : 0,
    findings,
    fixes,
  };
  cache.set(store, dive);
  return dive;
}

/** "up from its usual 3", "down from its usual 5", "the same as its usual 4". */
export const versusUsual = (n: number, usual: number) => (n > usual ? `up from its usual ${usual}` : n < usual ? `down from its usual ${usual}` : `the same as its usual ${usual}`);

const topCache = new Map<string, Store | null>();
/** The outlet most worth asking about: the one furthest above its usual week of errors (most money charged back breaks
 *  a tie), or null when nobody had a chargeback last week. */
export function topOutlet(stores: readonly Store[]): Store | null {
  if (masaFixture() && stores.includes(DAMEN_DIVE.store)) return DAMEN_DIVE.store;
  const key = `${stores.length}:${stores[0]}:${stores[stores.length - 1]}`;
  if (topCache.has(key)) return topCache.get(key)!;
  const last = new Map<Store, { n: number; amount: number }>();
  for (const c of chargebacks(WEEKS, LAST, LAST, stores)) {
    const r = last.get(c.store) ?? { n: 0, amount: 0 };
    last.set(c.store, { n: r.n + 1, amount: r.amount + c.amount });
  }
  const before = new Map<Store, number>();
  for (const c of chargebacks(WEEKS, LAST - 12, LAST - 1, stores)) before.set(c.store, (before.get(c.store) ?? 0) + 1);
  const top = [...last.entries()]
    .map(([store, r]) => ({ store, over: r.n - (before.get(store) ?? 0) / 12, amount: r.amount }))
    .sort((a, b) => b.over - a.over || b.amount - a.amount)[0];
  const out = top ? top.store : null;
  topCache.set(key, out);
  return out;
}

export const orderCount = (n: number) => plural(n, "order");
