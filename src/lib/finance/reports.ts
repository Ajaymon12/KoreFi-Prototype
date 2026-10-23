import { pnlWeek, type Store } from "./books";

// What the reports KoreFi's ops team uploads give us, week by week, per store and channel: orders, sales,
// card fees (in store), app commission, app promos, chargebacks and the money won back on them. Nothing
// else: food and staff never arrive, so the P&L estimates them from the owner's cost settings.
// Mock: sales follow the books' mock so every page agrees; the rest are each provider's typical rates
// with a small deterministic wobble.

export type ChannelKey = "instore" | "doordash" | "uber" | "grubhub";
// Sales = gross − discounts − refunds + service charges (only Square splits it). commission includes
// processingFee, promos includes ads: the P&L shows each line's parts when it is opened.
export type ChannelReport = {
  orders: number;
  sales: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  serviceCharges: number;
  cardFees: number;
  commission: number;
  processingFee: number;
  promos: number;
  ads: number;
  chargebacks: number;
  moneyBack: number;
};

export const REPORT_SOURCES: { provider: string; report: string; covers: string }[] = [
  { provider: "Square", report: "Sales summary", covers: "In-store and website sales, card fees" },
  { provider: "DoorDash", report: "Payout", covers: "Sales, commission, promos, chargebacks" },
  { provider: "Uber Eats", report: "Payout", covers: "Sales, commission, promos, chargebacks" },
  { provider: "Grubhub", report: "Transaction + Adjustment", covers: "Sales, commission, promos, chargebacks" },
];
/** Which report columns make each P&L line, per channel: Square is the POS, the apps are 3PD. Lines a
 *  channel doesn't have are left out. Shown under each line so owners can trace every figure. */
export const REPORT_FIELDS: Record<"orders" | "sales" | "cardFees" | "commission" | "promos" | "chargebacks" | "moneyIn", Partial<Record<ChannelKey, string>>> = {
  orders: { instore: "count of Payment rows", doordash: "count of Order rows", uber: "count of Order rows", grubhub: "count of Order rows" },
  sales: { instore: "Net Sales + Service Charges + Partial Refunds", doordash: "Subtotal", uber: "Sales (excl. tax)", grubhub: "Subtotal" },
  cardFees: { instore: "Fees" },
  commission: { doordash: "Commission + Payment processing fee", uber: "Marketplace fee", grubhub: "Commission + Processing fee" },
  promos: { doordash: "Customer discounts (funded by you) + Marketing fees", uber: "Promotions on items + Ad spend", grubhub: "Restaurant-funded promotions" },
  chargebacks: { doordash: "Error charges + Adjustments", uber: "Order error adjustments", grubhub: "Adjustments" },
  moneyIn: { instore: "Sales + Fees", doordash: "Net total − Subtotal tax passed to merchant", uber: "Total payout − Tax remitted by Uber", grubhub: "Net deposit − Tax passed to merchant" },
};
export const REPORTS_UPLOADED = "Oct 6, 2026";
/** How often ops uploads each source: every report weekly, by hand, until Square's API is connected. Kept per
 *  source so a source that changes cadence (Square, once its API lands) shows it. */
export const REPORT_CADENCE: Record<ChannelKey, "Daily" | "Weekly"> = { instore: "Weekly", doordash: "Weekly", uber: "Weekly", grubhub: "Weekly" };
/** The last day each uploaded report covers. Every report runs to Sunday, but uploads land on different days,
 *  so one source can be a week ahead for a while; the POS ⇄ 3PD check only compares the days both cover. */
export const REPORT_THROUGH: Record<ChannelKey, Date> = {
  instore: new Date(Date.UTC(2026, 8, 27)),
  doordash: new Date(Date.UTC(2026, 8, 27)),
  uber: new Date(Date.UTC(2026, 8, 27)),
  grubhub: new Date(Date.UTC(2026, 8, 27)),
};

const wobble = (seed: number) => Math.sin(seed * 12.9898) * 0.5 + Math.sin(seed * 4.1414) * 0.5;
const hash = (s: string) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 997;

// Rates as a share of that channel's sales: [commission, promos, chargebacks]. Plans differ by app.
const APP_RATES: Record<Exclude<ChannelKey, "instore">, [number, number, number]> = {
  doordash: [0.23, 0.022, 0.011],
  uber: [0.27, 0.012, 0.009],
  grubhub: [0.2, 0.006, 0.007],
};
const CARD_FEE = 0.026;
// Payment processing the apps charge on top of commission (Uber Eats folds it into its marketplace fee).
const PROCESSING: Record<Exclude<ChannelKey, "instore">, number> = { doordash: 0.03, uber: 0, grubhub: 0.0305 };
// Average ticket per channel, to count orders from sales.
const TICKET: Record<ChannelKey, number> = { instore: 11.5, doordash: 24.5, uber: 26, grubhub: 28 };

// Every page sums the same store-weeks many times over (34 outlets × each week × cards, table, menus), so each is
// worked out once. Callers only read the reports.
const cache = new Map<string, Record<ChannelKey, ChannelReport>>();

export function reportWeek(store: Store, year: number, week: number): Record<ChannelKey, ChannelReport> {
  const key = `${store}|${year}|${week}`;
  let r = cache.get(key);
  if (!r) cache.set(key, (r = buildWeek(store, year, week)));
  return r;
}

function buildWeek(store: Store, year: number, week: number): Record<ChannelKey, ChannelReport> {
  const p = pnlWeek([store], year, week);
  const seed = (k: string) => hash(k + store) + week * 7 + year;
  const n = (k: string, spread: number) => 1 + spread * wobble(seed(k));
  const instore = p["dine-in"] + p.catering;
  const app = (key: Exclude<ChannelKey, "instore">, account: string): ChannelReport => {
    const sales = p[account];
    const [c, pr, cb] = APP_RATES[key];
    const chargebacks = sales * cb * n(key + "cb", 0.6);
    // Promos run some weeks, not others; about a third of what's spent is ads.
    const promos = Math.max(0, sales * pr * (0.4 + 1.2 * wobble(seed(key + "p"))));
    return {
      orders: Math.round((sales / TICKET[key]) * n(key + "o", 0.05)),
      sales,
      grossSales: sales,
      discounts: 0,
      refunds: 0,
      serviceCharges: 0,
      cardFees: 0,
      commission: sales * c * n(key + "c", 0.02),
      processingFee: sales * PROCESSING[key],
      promos,
      ads: promos * (0.3 + 0.1 * wobble(seed(key + "ad"))),
      chargebacks,
      moneyBack: chargebacks * (0.55 + 0.15 * wobble(seed(key + "mb"))),
    };
  };
  // In store, Square's net sales: gross less discounts, comps and refunds (no service charges here).
  const discounts = instore * 0.05 * n("disc", 0.15);
  const refunds = instore * 0.0013 * n("ref", 0.8);
  return {
    instore: {
      orders: Math.round((instore / TICKET.instore) * n("o", 0.05)),
      sales: instore,
      grossSales: instore + discounts + refunds,
      discounts,
      refunds,
      serviceCharges: 0,
      cardFees: instore * CARD_FEE * n("card", 0.04),
      commission: 0,
      processingFee: 0,
      promos: 0,
      ads: 0,
      chargebacks: 0,
      moneyBack: 0,
    },
    doordash: app("doordash", "doordash"),
    uber: app("uber", "uber"),
    grubhub: app("grubhub", "grubhub"),
  };
}
