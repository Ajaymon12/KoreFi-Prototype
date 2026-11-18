import { OUTLETS, type Store } from "@/lib/finance/outlets";
import { LAST } from "@/components/finance/PnlStory";
import type { AppKey, CbStatus, Chargeback } from "@/lib/finance/chargebacks";
import type { OutletDive } from "./outletDive";

// Masa Kitchen's pinned Chargebacks dashboard, word for word from the agent-journey prototype (artifact "KoreFi Agent
// Journeys", journey 3): the same week (Nov 1–7), outlets, figures, findings and sentences, so what the founders signed
// off is what the owner sees. It is a fixed sample week, not computed from the mock reports. Switched on for the
// account whose dashboards the KoreFi team pinned (seedFor in AgentsProvider); every other account stays on live figures.

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
export const WRONG: [string, number][] = [["Missing item", 15], ["Wrong item", 8], ["Food quality", 6], ["Never arrived", 4]];

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
  text: "The KoreFi team reviews each dispute before filing. All of these are inside the apps' deadlines: 14 days from the order on DoorDash, 30 days on Uber Eats and Grubhub. You'll see the result in next Thursday's review.",
  source: "Dispute status from the KoreFi team's filing log",
};
export const DENIED = {
  title: `$${CBST.denied} was denied`,
  text: `Both were food-quality claims. The apps rarely refund those without a photo from the customer. $${CBST.wait} more is awaiting the apps' decision.`,
  source: "From each app's dispute decisions",
};

// ───────── 3PD Payouts (journey 5 of the prototype: the week mid-week) ─────────

export const PAY_APP = { dd: "DoorDash", ue: "Uber Eats", gh: "Grubhub" } as const;
export type PayKey = keyof typeof PAY_APP;
