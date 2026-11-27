import { OUTLETS, type Store } from "@/lib/finance/outlets";
import { LAST } from "@/components/finance/PnlStory";
import type { AppKey, CbStatus, Chargeback } from "@/lib/finance/chargebacks";
import type { OutletDive } from "./outletDive";

// Masa Kitchen's pinned Chargebacks dashboard, word for word from the agent-journey prototype (artifact "KoreFi Agent
// Journeys", journey 3): the same week (Nov 1–7), outlets, figures, findings and sentences, so what the founders signed
// off is what the owner sees. It is a fixed sample week, not computed from the mock reports. Switched on for the
// account whose dashboards KoreFi pinned (seedFor in AgentsProvider); every other account stays on live figures.

let on = false;
export const setMasaFixture = (v: boolean) => {
  on = v;
};
export const masaFixture = () => on;

const store = (name: string) => OUTLETS.find((o) => o.name === name)!.store as Store;

export const WEEK = "Nov 1–7";
export const LIMIT = 1;
export const USUAL = 325;
export const CBST = { won: 216, wait: 41, denied: 28, todo: 112 };
export const DISPUTED = CBST.won + CBST.wait + CBST.denied;
export const WON_SHARE = Math.round((CBST.won / DISPUTED) * 100);

/** Outlet, short name as the prototype writes it, delivery sales, charged back, orders with errors, usual orders, won back. */
export type FxOutlet = { store: Store; name: string; sales: number; charged: number; errors: number; usual: number; won: number };
const o = (full: string, name: string, sales: number, charged: number, errors: number, usual: number, won: number): FxOutlet => ({ store: store(full), name, sales, charged, errors, usual, won });
export const FX_OUTLETS: FxOutlet[] = [
  o("Damen & Chicago", "Damen", 11540, 150, 14, 8, 85),
  o("Oak Park", "Oak Park", 10220, 92, 7, 6, 50),
  o("Montrose & N Elston", "Montrose", 9710, 68, 5, 5, 38),
  o("Chicago & Halsted", "Halsted", 9170, 55, 4, 5, 28),
  o("Gurnee", "Gurnee", 8000, 32, 3, 3, 15),
  o("Niles", "Niles", 7400, 0, 0, 1, 0),
  o("Hyde Park", "Hyde Park", 6900, 0, 0, 1, 0),
];
export const rate = (x: FxOutlet) => (x.charged / x.sales) * 100;
export const rateLabel = (x: FxOutlet) => `${rate(x).toFixed(1)}%`;
export const charged = FX_OUTLETS.reduce((n, x) => n + x.charged, 0);
export const errors = FX_OUTLETS.reduce((n, x) => n + x.errors, 0);
export const flagged = FX_OUTLETS.filter((x) => rate(x) > LIMIT);
export const fine = FX_OUTLETS.filter((x) => x.charged > 0 && !flagged.includes(x));
export const zero = FX_OUTLETS.filter((x) => !x.charged);
export const totalSales = FX_OUTLETS.reduce((n, x) => n + x.sales, 0);

export const BY_APP: { app: AppKey; orders: number; charged: number; won: number }[] = [
  { app: "doordash", orders: 20, charged: 248, won: 139 },
  { app: "uber", orders: 10, charged: 112, won: 62 },
  { app: "grubhub", orders: 3, charged: 37, won: 15 },
];
/** Chargebacks per week, the 11 weeks before the sample week (around the usual $325), then the sample week. */
export const WEEKLY = [335, 300, 340, 285, 320, 330, 305, 325, 345, 300, 365, 397];
export const WRONG: [string, number][] =[["Missing item", 15], ["Wrong item", 8], ["Food quality", 6], ["Never arrived", 4]];

// Damen's 14 charges: day, app, item, reason, amount, status
const DAMEN: [string, "dd" | "ue" | "gh", string, string, number, string][] = [
  ["Sun, Nov 1", "dd", "Burrito bowl", "Missing item", 12.5, "Won"],
  ["Mon, Nov 2", "ue", "Chips & Queso", "Missing item", 6.5, "Won"],
  ["Tue, Nov 3", "dd", "Steak taco plate", "Wrong item", 14, "Won"],
  ["Tue, Nov 3", "ue", "Horchata", "Missing item", 4.5, "Won"],
  ["Wed, Nov 4", "dd", "Chips & Queso", "Missing item", 6.5, "Won"],
  ["Wed, Nov 4", "dd", "Burrito bowl", "Missing item", 12.5, "Won"],
  ["Wed, Nov 4", "ue", "Quesadilla", "Wrong item", 11, "Awaiting decision"],
  ["Thu, Nov 5", "dd", "Family taco pack", "Missing item", 24, "Won"],
  ["Thu, Nov 5", "dd", "Chips & Queso", "Missing item", 6.5, "Still to dispute"],
  ["Thu, Nov 5", "gh", "Carnitas bowl", "Food quality", 13.5, "Denied"],
  ["Fri, Nov 6", "dd", "Steak taco plate", "Wrong item", 14, "Still to dispute"],
  ["Fri, Nov 6", "ue", "Burrito bowl", "Food quality", 12.5, "Still to dispute"],
  ["Sat, Nov 7", "dd", "Horchata", "Missing item", 4.5, "Won"],
  ["Sat, Nov 7", "dd", "Carnitas bowl", "Food quality", 7.5, "Still to dispute"],
];
const APP: Record<"dd" | "ue" | "gh", AppKey> = { dd: "doordash", ue: "uber", gh: "grubhub" };
const STATUS: Record<string, CbStatus> = { Won: "won", "Awaiting decision": "disputing", "Still to dispute": "new", Denied: "lost" };

const damen = FX_OUTLETS[0];
const damenOrders: Chargeback[] = DAMEN.map(([day, app, item, reason, amount, status], i) => ({
  id: `fx-damen-${i}`,
  store: damen.store,
  app: APP[app],
  week: LAST,
  date: `2026-11-0${Number(day.split(" ").pop())}`,
  amount,
  wonBack: status === "Won" ? amount : 0,
  status: STATUS[status],
  reason,
  item,
  detail: "",
}));

/** What the agent says about Damen, and what its manager's sheet says to fix. */
export const DAMEN_WHY = {
  text: "6 of them were on Wednesday and Thursday, its usual worst days. 8 were missing items. Chips & Queso was left out 3 times, which is new (2 complaints in all of October).",
  source: "From the app adjustment reports, matched to Damen's Toast orders",
};
export const DAMEN_DIVE: OutletDive = {
  store: damen.store,
  name: damen.name,
  week: WEEK,
  orders: damenOrders,
  n: damen.errors,
  usual: damen.usual,
  charged: damen.charged,
  won: damen.won,
  open: damenOrders.filter((c) => c.status === "disputing" || c.status === "new").reduce((n, c) => n + c.amount, 0),
  rate: rate(damen),
  findings: [DAMEN_WHY.text],
  fixes: [
    { title: "Wednesday and Thursday", body: "6 of 14 errors were on these two days. Add a second bag check on those shifts." },
    { title: "Missing items: 8 of 14", body: "Count items into the bag against the ticket before sealing." },
    { title: "Chips & Queso left out 3 times", body: "New this week. Check where sides are packed." },
  ],
  fx: true,
};

/** The sheet's own fix lines (the manager's page words them a little shorter). */
export const SHEET_FIXES = [
  { title: "Wednesday and Thursday", body: "6 of 14 errors. Add a second bag check on those shifts." },
  { title: "Missing items: 8 of 14", body: "Count items into the bag against the ticket." },
  { title: "Chips & Queso left out 3 times", body: "Check where sides are packed." },
];

export const STILL_TO_DISPUTE = {
  title: `$${CBST.todo} is not filed yet`,
  text: "KoreFi reviews each dispute before filing. All of these are inside the apps' deadlines: 14 days from the order on DoorDash, 30 days on Uber Eats and Grubhub. You'll see the result in next Thursday's review.",
  source: "Dispute status from KoreFi's filing log",
};
export const DENIED = {
  title: `$${CBST.denied} was denied`,
  text: `Both were food-quality claims. The apps rarely refund those without a photo from the customer. $${CBST.wait} more is awaiting the apps' decision.`,
  source: "From each app's dispute decisions",
};

// ───────── Every charge of the week (leadership flows, 2026-11-20) ─────────
// All 33 orders, so the dashboard's charges table can filter to "Still to dispute". They add up to every figure above:
// outlets ($397 / $216), apps (DoorDash 20 · $248 · $139, Uber Eats 10 · $112 · $62, Grubhub 3 · $37 · $15), What went
// wrong (15 / 8 / 6 / 4), and statuses (won $216, awaiting $41, denied $28 on 2 orders, still to dispute $112 on 9).

export type FxCharge = { outlet: string; day: string; app: AppKey; item: string; reason: string; amount: number; status: string };
const c = (outlet: string, day: string, app: "dd" | "ue" | "gh", item: string, reason: string, amount: number, status: string): FxCharge => ({ outlet, day, app: APP[app], item, reason, amount, status });
export const CHARGES: FxCharge[] = [
  ...DAMEN.map(([day, app, item, reason, amount, status]) => c("Damen", day, app, item, reason, amount, status)),
  c("Oak Park", "Mon, Nov 2", "dd", "Burrito bowl", "Missing item", 12.5, "Won"),
  c("Oak Park", "Tue, Nov 3", "dd", "Chips & Queso", "Missing item", 6.5, "Won"),
  c("Oak Park", "Wed, Nov 4", "dd", "Steak taco plate", "Wrong item", 14, "Won"),
  c("Oak Park", "Thu, Nov 5", "ue", "Quesadilla", "Wrong item", 17, "Won"),
  c("Oak Park", "Fri, Nov 6", "ue", "Horchata", "Missing item", 5, "Still to dispute"),
  c("Oak Park", "Sat, Nov 7", "dd", "Family taco pack", "Never arrived", 15.5, "Still to dispute"),
  c("Oak Park", "Sat, Nov 7", "ue", "Family taco pack", "Food quality", 21.5, "Awaiting decision"),
  c("Montrose", "Sun, Nov 1", "ue", "Burrito bowl", "Missing item", 12.5, "Won"),
  c("Montrose", "Tue, Nov 3", "dd", "Steak taco plate", "Wrong item", 14, "Won"),
  c("Montrose", "Wed, Nov 4", "dd", "Chips & Queso", "Missing item", 7, "Won"),
  c("Montrose", "Thu, Nov 5", "ue", "Horchata", "Missing item", 4.5, "Won"),
  c("Montrose", "Fri, Nov 6", "dd", "Family taco pack", "Never arrived", 30, "Still to dispute"),
  c("Halsted", "Mon, Nov 2", "dd", "Quesadilla", "Wrong item", 11, "Won"),
  c("Halsted", "Wed, Nov 4", "ue", "Burrito bowl", "Food quality", 17, "Won"),
  c("Halsted", "Thu, Nov 5", "dd", "Carnitas bowl", "Food quality", 14.5, "Denied"),
  c("Halsted", "Sat, Nov 7", "dd", "Burrito bowl", "Never arrived", 12.5, "Still to dispute"),
  c("Gurnee", "Tue, Nov 3", "gh", "Steak taco plate", "Wrong item", 15, "Won"),
  c("Gurnee", "Fri, Nov 6", "dd", "Chips & Queso", "Missing item", 8.5, "Still to dispute"),
  c("Gurnee", "Sat, Nov 7", "gh", "Burrito bowl", "Never arrived", 8.5, "Awaiting decision"),
];
export const TODO = CHARGES.filter((x) => x.status === "Still to dispute");
/** The same 33 orders as table rows, for the dashboard's Transactions tab, so its "Not Disputed" filter shows the 9
 *  orders ($112) the chat names. Order IDs are made up per app, in the style of each app's portal. */
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const orderId = (app: AppKey, i: number) => {
  let n = (i + 7) * 2654435761;
  let s = "";
  for (let k = 0; k < 4; k++) {
    s += ID_CHARS[Math.abs(n) % ID_CHARS.length];
    n = Math.floor(n / ID_CHARS.length) + k * 97;
  }
  return `${app === "doordash" ? "DD" : app === "uber" ? "UE" : "GH"}-${s}`;
};
export const CHARGE_ROWS: Chargeback[] = CHARGES.map((x, i) => ({
  id: orderId(x.app, i),
  store: FX_OUTLETS.find((f) => f.name === x.outlet)!.store,
  app: x.app,
  week: LAST,
  date: `2026-11-0${Number(x.day.split(" ").pop())}`,
  amount: x.amount,
  wonBack: x.status === "Won" ? x.amount : 0,
  status: STATUS[x.status],
  reason: x.reason === "Food quality" ? "Quality issue" : x.reason === "Never arrived" ? "Order never arrived" : x.reason,
  item: x.item,
  detail: x.item,
}));

export const DENIED_ORDERS = CHARGES.filter((x) => x.status === "Denied");

/** "Which items at Damen?": how often each dish came up in Damen's 14 charges, most first. */
export const DAMEN_ITEMS: [string, number][] = Object.entries(
  DAMEN.reduce<Record<string, number>>((m, [, , item]) => ({ ...m, [item]: (m[item] ?? 0) + 1 }), {}),
).sort((a, b) => b[1] - a[1]);

// ───────── 3PD Payouts: the complete week, emailed Fri, Nov 13 (leadership flows, 2026-11-20) ─────────
// A 2-way check: Toast orders against each app's report and payout. Bank deposits are not checked.

export const PAY_APP = { dd: "DoorDash", ue: "Uber Eats", gh: "Grubhub" } as const;
export type PayKey = keyof typeof PAY_APP;

export const PAY_LIMIT = 30;
export type PayRow = { app: PayKey; orders: number; paidOn: string; sales: number; commission: number; rate: number; promos: number; ads: number; chargebacks: number; paid: number; up: number; trend: number[] };
export const PAY: PayRow[] = [
  { app: "dd", orders: 1322, paidOn: "Thu, Nov 12", sales: 34400, commission: 7568, rate: 22, promos: 960, ads: 0, chargebacks: 109, paid: 25763, up: 640, trend: [75, 75, 75, 75] },
  { app: "ue", orders: 804, paidOn: "Mon, Nov 9", sales: 20900, commission: 5643, rate: 27, promos: 790, ads: 580, chargebacks: 50, paid: 13837, up: 1120, trend: [69, 68, 68, 66] },
  { app: "gh", orders: 294, paidOn: "Wed, Nov 11", sales: 7640, commission: 1528, rate: 20, promos: 110, ads: 0, chargebacks: 22, paid: 5980, up: 200, trend: [78, 78, 78, 78] },
];
export const PAID = PAY.reduce((n, x) => n + x.paid, 0);
export const PAY_SALES = PAY.reduce((n, x) => n + x.sales, 0);
export const PAID_UP = PAY.reduce((n, x) => n + x.up, 0);
/** What each app kept, as a share of its sales (Uber Eats 34%). */
export const kept = (x: PayRow) => Math.round(((x.sales - x.paid) / x.sales) * 100);
/** What the apps kept overall, as the email writes it (27.6%). */
export const KEPT_ALL = `${(((PAY_SALES - PAID) / PAY_SALES) * 100).toFixed(1)}%`;
export const ORDERS = { toast: 2420, paid: 2416, unpaid: 4 };

export type Unmatched = { id: string; outlet: string; day: string; app: PayKey; amount: number; status: "Claimed" | "Needs you" };
export const UNMATCHED: Unmatched[] = [
  { id: "DD 4BGF", outlet: "Damen", day: "Sat, Nov 7", app: "dd", amount: 31.4, status: "Claimed" },
  { id: "DD 26Y7", outlet: "Montrose", day: "Fri, Nov 6", app: "dd", amount: 27.85, status: "Claimed" },
  { id: "DD HS8V", outlet: "Halsted", day: "Tue, Nov 3", app: "dd", amount: 36.2, status: "Claimed" },
  { id: "UE 9QX4", outlet: "Oak Park", day: "Sat, Nov 7", app: "ue", amount: 24.1, status: "Needs you" },
];
export const UNPAID = UNMATCHED.reduce((n, x) => n + x.amount, 0);
export const usd2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ───────── The Overview's week review (Eggholic review layout, 2026-11-20) ─────────
// Everything below is counted from CHARGES, so it follows the outlet filter and adds up to the figures above.

export const REASONS = ["Missing item", "Wrong item", "Food quality", "Never arrived"] as const;
/** The sample week runs Sun, Nov 1 to Sat, Nov 7. */
export const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const dayIndex = (day: string) => Number(day.split(" ").pop()) - 1;
const chargesAt = (names: readonly string[]) => CHARGES.filter((x) => names.includes(x.outlet));
const sum = (xs: FxCharge[]) => xs.reduce((n, x) => n + x.amount, 0);
const most = <T,>(xs: T[]) => {
  const m = new Map<T, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** Dispute status of these outlets' charges, in $: won, awaiting, denied, still to dispute. */
export function statusFor(names: readonly string[]) {
  const xs = chargesAt(names);
  const of = (s: string) => sum(xs.filter((x) => x.status === s));
  const won = of("Won"), wait = of("Awaiting decision"), denied = of("Denied"), todo = of("Still to dispute");
  return { won, wait, denied, todo, disputed: won + wait + denied };
}
/** Orders per reason at one outlet, in REASONS order. */
export const reasonsFor = (outlet: string) => REASONS.map((r) => CHARGES.filter((x) => x.outlet === outlet && x.reason === r).length);
/** Orders per day (Sun–Sat) at one outlet. */
/** Order hour (24h) of each charge, by its place in CHARGES. The sample has no real times, so these are a fixed
 *  pattern weighted to the lunch and dinner rushes (11 AM–10 PM, the kitchens' hours). */
const HOUR_PATTERN = [19, 12, 18, 13, 20, 19, 12, 18, 21, 13, 19, 17, 12, 20, 18, 11, 19, 14, 12, 18, 20, 13, 19, 21, 12, 18, 16, 19, 13, 20, 12, 18, 19];
export const hourOf = (x: FxCharge) => HOUR_PATTERN[CHARGES.indexOf(x) % HOUR_PATTERN.length];
/** The kitchen's shifts, by the hour they start. */
export const SHIFTS = [
  { label: "Lunch", from: 11, to: 15 },
  { label: "Afternoon", from: 15, to: 17 },
  { label: "Dinner", from: 17, to: 21 },
  { label: "Late", from: 21, to: 23 },
] as const;
export const OPEN_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;
/** "11a", "12p", "7p". */
export const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
/** Orders per shift at one outlet, in SHIFTS order. */
export function shiftsFor(outlet: string) {
  const hs = CHARGES.filter((x) => x.outlet === outlet).map(hourOf);
  return SHIFTS.map((s) => hs.filter((h) => h >= s.from && h < s.to).length);
}
/** Orders per hour at one outlet, in OPEN_HOURS order. */
export function hoursFor(outlet: string) {
  const hs = CHARGES.filter((x) => x.outlet === outlet).map(hourOf);
  return OPEN_HOURS.map((h) => hs.filter((x) => x === h).length);
}
export function daysFor(outlet: string) {
  const d = WEEK_DAYS.map(() => 0);
  CHARGES.filter((x) => x.outlet === outlet).forEach((x) => d[dayIndex(x.day)]++);
  return d;
}
/** Items charged back at one outlet, most first, with the reason given most often. */
export function itemsFor(outlet: string) {
  const xs = CHARGES.filter((x) => x.outlet === outlet);
  return most(xs.map((x) => x.item)).map(([item, n]) => ({ item, n, reason: most(xs.filter((x) => x.item === item).map((x) => x.reason))[0][0] }));
}
/** The item charged back most often across these outlets, and where (null unless it came up 3+ times at 2+ outlets). */
export function repeatItem(names: readonly string[]) {
  const xs = chargesAt(names);
  const top = most(xs.map((x) => x.item))[0];
  if (!top || top[1] < 3) return null;
  const at = most(xs.filter((x) => x.item === top[0]).map((x) => x.outlet)).map(([outlet, n]) => ({ outlet, n }));
  if (at.length < 2) return null;
  const why = most(xs.filter((x) => x.item === top[0]).map((x) => x.reason)).map(([r, n]) => ({ r, n }));
  return { item: top[0], n: top[1], at, why };
}
/** Orders, charged back and won back per app, for these outlets. */
export function byApp(names: readonly string[]) {
  const xs = chargesAt(names);
  return (["doordash", "uber", "grubhub"] as AppKey[])
    .map((app) => {
      const a = xs.filter((x) => x.app === app);
      return { app, orders: a.length, charged: Math.round(sum(a)), won: Math.round(sum(a.filter((x) => x.status === "Won"))) };
    })
    .filter((a) => a.orders > 0);
}
/** The outlets most of the money comes from: biggest first until they cover 75%, at most 3. */
export function focusOutlets(rows: readonly FxOutlet[]) {
  const total = rows.reduce((n, x) => n + x.charged, 0);
  const out: FxOutlet[] = [];
  let cum = 0;
  for (const x of [...rows].filter((r) => r.charged).sort((a, b) => b.charged - a.charged)) {
    if (out.length >= 3 || cum >= 0.75 * total) break;
    out.push(x);
    cum += x.charged;
  }
  return out;
}

// ───────── Home › At a glance (Figma "Korefi – Agents" › Home · scenarios, 2026-11-27) ─────────
// The weekly agent runs behind the Home page, 13 weeks oldest first, ending on the sample week (Nov 1–7). The sample
// week matches the figures above (charged $397, won $216, paid $45,580, $119.55 / 4 orders unmatched); the weeks
// before follow the Figma "Last 4 weeks" frame ($176,500 paid, $1,387 charged, $843 won, $239.10 / 9 orders) and the
// 13-week chargeback tile ($2,758 won of $4,299).

export const HOME_SERIES = {
  charged: [352, 335, 300, 340, 285, 320, 330, 305, 345, 330, 300, 360, 397],
  won: [220, 215, 190, 225, 180, 210, 230, 200, 245, 205, 192, 230, 216],
  paid: [42100, 42800, 41900, 43300, 42600, 43800, 42400, 43100, 44200, 43900, 43400, PAID - PAID_UP, PAID],
  unmatched: [64.2, 41.75, 88.1, 22.4, 57.3, 35.85, 70.6, 46.15, 81.9, 38.4, 52.9, 28.25, UNPAID],
  unmatchedOrders: [3, 2, 4, 1, 3, 2, 3, 2, 4, 2, 2, 1, ORDERS.unpaid],
};
/** Each outlet's in-store and website sales in the sample week (the Non-3PD bars on Home › Breakdown › By outlet). */
export const HOME_INSTORE: Record<string, number> = { Damen: 15260, "Oak Park": 14880, Montrose: 14590, Halsted: 13230, Gurnee: 13800, Niles: 13200, "Hyde Park": 13000 };
/** When each live agent last ran, as the Home cards write it (payouts are emailed Friday). */
export const HOME_RAN = { chargebacks: "Thu 8:00 AM", payouts: "Fri 8:00 AM" } as const;
