// Mock accounting data for Finance / P&L and Balance summary. Stands in for the connected
// accounting source (QuickBooks / Xero). Figures are deterministic: the same inputs always give the
// same numbers, so the static export never drifts. Whole dollars throughout.

export const ACCOUNTING_SOURCE = "QuickBooks Online";
export const BOOKS_SYNCED_AT = "2026-10-08T11:38:00Z";

export const STORES = ["Casa Alvarez Kitchen", "Casa Alvarez – Midtown", "Casa Alvarez – Lakeview"] as const;
export type Store = (typeof STORES)[number];

const STORE_SHARE: Record<Store, number> = { "Casa Alvarez Kitchen": 0.46, "Casa Alvarez – Midtown": 0.3, "Casa Alvarez – Lakeview": 0.24 };
// Cost pressure per store, so the by-store view has real differences to show.
const STORE_LABOR: Record<Store, number> = { "Casa Alvarez Kitchen": 1, "Casa Alvarez – Midtown": 1.06, "Casa Alvarez – Lakeview": 0.96 };
const STORE_FOOD: Record<Store, number> = { "Casa Alvarez Kitchen": 1, "Casa Alvarez – Midtown": 1.02, "Casa Alvarez – Lakeview": 1.05 };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const LATEST = { year: 2026, month: 8 }; // Sep 2026, the latest closed month (0-based)

// ───────────────────────── P&L ─────────────────────────

export type Section = "revenue" | "cogs" | "labor" | "opex";
export type Account = { id: string; label: string; section: Section; code: string; base: number; tip?: string };

// `base` is a typical month for the whole group, before store, season and year factors.
export const ACCOUNTS: Account[] = [
  { id: "dine-in", label: "Dine-in & takeout", section: "revenue", code: "4000", base: 74000 },
  { id: "doordash", label: "DoorDash", section: "revenue", code: "4010", base: 21000 },
  { id: "uber", label: "Uber Eats", section: "revenue", code: "4020", base: 14500 },
  { id: "grubhub", label: "Grubhub", section: "revenue", code: "4030", base: 6000 },
  { id: "catering", label: "Catering & other", section: "revenue", code: "4100", base: 5500 },
  { id: "food", label: "Food", section: "cogs", code: "5000", base: 27800 },
  { id: "beverage", label: "Beverage", section: "cogs", code: "5100", base: 5200 },
  { id: "packaging", label: "Packaging", section: "cogs", code: "5200", base: 3300 },
  { id: "wages", label: "Wages", section: "labor", code: "6000", base: 33500 },
  { id: "payroll-tax", label: "Payroll taxes & benefits", section: "labor", code: "6050", base: 6400 },
  { id: "commissions", label: "Marketplace commissions & fees", section: "opex", code: "6200", base: 0, tip: "What DoorDash, Uber Eats and Grubhub keep from each order. Also shown on What you keep." },
  { id: "rent", label: "Rent", section: "opex", code: "6300", base: 11500 },
  { id: "utilities", label: "Utilities", section: "opex", code: "6310", base: 3400 },
  { id: "marketing", label: "Marketing", section: "opex", code: "6400", base: 2600 },
  { id: "repairs", label: "Repairs & maintenance", section: "opex", code: "6500", base: 1900 },
  { id: "other-opex", label: "Other operating costs", section: "opex", code: "6900", base: 3100 },
];

export const SECTION_LABEL: Record<Section, string> = { revenue: "Sales", cogs: "Food & drink costs", labor: "Labor", opex: "Running costs" };
export const MARKETPLACES = ["doordash", "uber", "grubhub"];
const COMMISSION_RATE = 0.235;
// Sales and costs by year, so "vs same period last year" shows growth and food-cost inflation.
const YEAR_SALES: Record<number, number> = { 2024: 0.86, 2025: 0.93, 2026: 1 };
const YEAR_COST: Record<number, number> = { 2024: 0.88, 2025: 0.95, 2026: 1 };

// Small deterministic wobble in [-1, 1].
const wobble = (seed: number) => Math.sin(seed * 12.9898) * 0.5 + Math.sin(seed * 4.1414) * 0.5;
const hash = (s: string) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 1000;
const season = (month: number) => 1 + 0.07 * Math.sin(((month - 2) / 12) * Math.PI * 2);

/** One account, one store, one month (month is 0-based). */
export function monthAmount(acc: Account, store: Store, year: number, month: number): number {
  const noise = 1 + 0.025 * wobble(hash(acc.id + store) + month * 3 + year);
  const sales = STORE_SHARE[store] * season(month) * YEAR_SALES[year] * noise;
  if (acc.id === "commissions") {
    return Math.round(MARKETPLACES.reduce((s, id) => s + monthAmount(ACCOUNTS.find((a) => a.id === id)!, store, year, month), 0) * COMMISSION_RATE);
  }
  if (acc.section === "revenue") return Math.round(acc.base * sales);
  const cost = YEAR_COST[year] * noise;
  if (acc.section === "cogs") return Math.round(acc.base * STORE_SHARE[store] * (0.5 + 0.5 * season(month)) * YEAR_SALES[year] * STORE_FOOD[store] * (acc.id === "food" ? 1.04 : 1) * noise);
  if (acc.section === "labor") return Math.round(acc.base * STORE_SHARE[store] * STORE_LABOR[store] * cost * (0.7 + 0.3 * season(month)));
  // Fixed-ish costs follow the store, not the season.
  return Math.round(acc.base * STORE_SHARE[store] * cost * (0.97 + 0.03 * season(month)));
}

export type PeriodKey = "this-month" | "last-month" | "quarter" | "ytd";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "this-month", label: "September 2026" },
  { key: "last-month", label: "August 2026" },
  { key: "quarter", label: "Q3 2026 (Jul – Sep)" },
  { key: "ytd", label: "Year to date" },
];

/** Inclusive 0-based month range for a period, in the latest year. */
export function periodMonths(key: PeriodKey): [number, number] {
  const m = LATEST.month;
  if (key === "this-month") return [m, m];
  if (key === "last-month") return [m - 1, m - 1];
  if (key === "quarter") return [6, 8];
  return [0, m];
}

export type Pnl = Record<string, number> & { revenue: number; cogs: number; labor: number; opex: number; gross: number; prime: number; operating: number; net: number };

/** Section subtotals and profit lines, from per-account totals. */
function rollup(out: Pnl): Pnl {
  const total = (sec: Section) => ACCOUNTS.filter((a) => a.section === sec).reduce((n, a) => n + out[a.id], 0);
  out.revenue = total("revenue");
  out.cogs = total("cogs");
  out.labor = total("labor");
  out.opex = total("opex");
  out.gross = out.revenue - out.cogs;
  out.prime = out.cogs + out.labor;
  out.operating = out.gross - out.labor - out.opex;
  out.net = out.operating;
  return out;
}

/** Account totals plus section subtotals for the chosen stores and month range. */
export function pnl(stores: readonly Store[], year: number, from: number, to: number): Pnl {
  const out = {} as Pnl;
  for (const acc of ACCOUNTS) {
    let sum = 0;
    for (const s of stores) for (let m = from; m <= to; m++) sum += monthAmount(acc, s, year, m);
    out[acc.id] = sum;
  }
  return rollup(out);
}

// ── Weekly view ──
// Week n (0-based) is days 7n+1 to 7n+7 of the year. Its figures are the month's figures spread over
// the days, with a small deterministic wobble so weeks differ.
const DAY = 86_400_000;
const MON = MONTHS;
export const WEEKS_IN_YEAR = 52;

/** "Jan 1–7" or "Jan 29–Feb 4". */
export function weekLabel(year: number, week: number): string {
  const a = new Date(Date.UTC(year, 0, 1) + week * 7 * DAY);
  const b = new Date(a.getTime() + 6 * DAY);
  const left = `${MON[a.getUTCMonth()]} ${a.getUTCDate()}`;
  return a.getUTCMonth() === b.getUTCMonth() ? `${left}–${b.getUTCDate()}` : `${left}–${MON[b.getUTCMonth()]} ${b.getUTCDate()}`;
}

/** Weeks that have ended by the latest closed month, for a year. */
export function closedWeeks(year: number): number {
  if (year < LATEST.year) return WEEKS_IN_YEAR;
  const monthEnd = Date.UTC(year, LATEST.month + 1, 1);
  return Math.floor((monthEnd - Date.UTC(year, 0, 1)) / DAY / 7);
}

export function pnlWeek(stores: readonly Store[], year: number, week: number): Pnl {
  const start = new Date(Date.UTC(year, 0, 1) + week * 7 * DAY);
  const month = start.getUTCMonth();
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out = {} as Pnl;
  for (const acc of ACCOUNTS) {
    const sales = acc.section === "revenue" || acc.id === "commissions";
    // Seeded per account and store too, so each channel's and each store's weeks have their own shape.
    const f = (s: Store) => (7 / dim) * (1 + (sales ? 0.07 : 0.03) * wobble(week * 7 + year + (sales ? 0 : 3) + (hash(acc.id + s) % 11)));
    out[acc.id] = stores.reduce((n, s) => n + monthAmount(acc, s, year, month) * f(s), 0);
  }
  return rollup(out);
}

/** Like `pnl`, but months may run before January (negative = previous year), for "previous period". */
export function pnlSpan(stores: readonly Store[], year: number, from: number, to: number): Pnl {
  if (from >= 0) return pnl(stores, year, from, to);
  if (to < 0) return pnl(stores, year - 1, from + 12, to + 12);
  const a = pnl(stores, year - 1, from + 12, 11);
  const b = pnl(stores, year, 0, to);
  return Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + b[k]])) as Pnl;
}

export type MonthPoint = { label: string; value: number; compare: number };
/** Net income by month, this year vs last, for the months up to the latest closed one. */
export function netTrend(stores: readonly Store[]): MonthPoint[] {
  return Array.from({ length: LATEST.month + 1 }, (_, m) => ({
    label: MONTHS[m],
    value: pnl(stores, LATEST.year, m, m).net,
    compare: pnl(stores, LATEST.year - 1, m, m).net,
  }));
}

/** One account by month, this year vs last (for the line drawer). */
export function accountTrend(accId: string, stores: readonly Store[]): MonthPoint[] {
  const acc = ACCOUNTS.find((a) => a.id === accId)!;
  const at = (year: number, m: number) => stores.reduce((n, s) => n + monthAmount(acc, s, year, m), 0);
  return Array.from({ length: LATEST.month + 1 }, (_, m) => ({ label: MONTHS[m], value: at(LATEST.year, m), compare: at(LATEST.year - 1, m) }));
}

// ───────────────────────── Balance summary ─────────────────────────

export type BalanceKind = "asset" | "liability" | "equity";
export type BalanceLine = { id: string; label: string; group: string; kind: BalanceKind; code: string; tip?: string };

export const BALANCE_LINES: BalanceLine[] = [
  { id: "checking", label: "Operating checking", group: "Cash & bank", kind: "asset", code: "1000" },
  { id: "savings", label: "Savings reserve", group: "Cash & bank", kind: "asset", code: "1010" },
  { id: "payouts-owed", label: "Marketplace payouts owed to you", group: "Money coming in", kind: "asset", code: "1100", tip: "Delivered orders DoorDash, Uber Eats and Grubhub haven't paid out yet. Accounts receivable in the books." },
  { id: "card-deposits", label: "Card sales in transit", group: "Money coming in", kind: "asset", code: "1110", tip: "Card payments taken but not yet deposited by the processor." },
  { id: "inventory", label: "Inventory on hand", group: "Inventory & equipment", kind: "asset", code: "1200" },
  { id: "equipment", label: "Equipment & buildout (net)", group: "Inventory & equipment", kind: "asset", code: "1500", tip: "Cost less depreciation to date. Fixed assets in the books." },
  { id: "vendor-bills", label: "Vendor bills owed", group: "Bills & taxes owed", kind: "liability", code: "2000", tip: "Accounts payable in the books." },
  { id: "sales-tax", label: "Sales tax to remit", group: "Bills & taxes owed", kind: "liability", code: "2100" },
  { id: "payroll-owed", label: "Payroll and payroll taxes owed", group: "Bills & taxes owed", kind: "liability", code: "2200" },
  { id: "gift-cards", label: "Unredeemed gift cards", group: "Bills & taxes owed", kind: "liability", code: "2300", tip: "Gift card value sold but not yet spent. It's owed to guests until redeemed." },
  { id: "credit-cards", label: "Business credit cards", group: "Loans & cards", kind: "liability", code: "2400" },
  { id: "equipment-loan", label: "Equipment loan", group: "Loans & cards", kind: "liability", code: "2500" },
  { id: "owner-equity", label: "Owner's contributions", group: "Owner's equity", kind: "equity", code: "3000" },
  { id: "retained", label: "Earnings kept from prior years", group: "Owner's equity", kind: "equity", code: "3100", tip: "Retained earnings in the books." },
  { id: "current-earnings", label: "Net income this year so far", group: "Owner's equity", kind: "equity", code: "3900", tip: "Matches Net income on the P&L, year to date." },
];

/** Months since Oct 2024; index 0 is the oldest month we hold. */
export type AsOf = { year: number; month: number };
export const AS_OF_OPTIONS: AsOf[] = Array.from({ length: 12 }, (_, i) => {
  const idx = LATEST.month - i; // newest first
  return idx >= 0 ? { year: LATEST.year, month: idx } : { year: LATEST.year - 1, month: idx + 12 };
});
export const asOfKey = (a: AsOf) => `${a.year}-${a.month}`;
export const asOfLabel = (a: AsOf) => {
  const last = new Date(Date.UTC(a.year, a.month + 1, 0)).getUTCDate();
  return `${MONTHS[a.month]} ${last}, ${a.year}`;
};
const t = (a: AsOf) => (a.year - 2024) * 12 + a.month; // months since Jan 2024

export type Balance = Record<string, number> & { cash: number; assets: number; liabilities: number; equity: number; netWorth: number };

/** Month-end balances. Retained earnings is the balancing figure, as the books close it. */
export function balance(a: AsOf): Balance {
  const n = t(a);
  const w = (k: number) => wobble(n * 7 + k);
  const sales = YEAR_SALES[a.year] * season(a.month);
  const v: Record<string, number> = {
    checking: 80000 + n * 520 + w(1) * 2600,
    savings: 18000 + n * 380,
    "payouts-owed": (41500 / 30) * 7.5 * sales,
    "card-deposits": 5200 * sales + w(2) * 300,
    inventory: 9800 + w(3) * 500,
    equipment: 190000 - n * 1150,
    "vendor-bills": 21500 * YEAR_COST[a.year] + w(4) * 1500,
    "sales-tax": 7600 * sales,
    "payroll-owed": 11200 * YEAR_COST[a.year] + w(5) * 600,
    "gift-cards": 4300 + n * 40,
    "credit-cards": 3800 + w(6) * 900,
    "equipment-loan": Math.max(96000 - n * 1500, 0),
    "owner-equity": 60000,
  };
  const r: Record<string, number> = {};
  for (const k of Object.keys(v)) r[k] = Math.round(v[k]);
  r["current-earnings"] = pnl(STORES, a.year, 0, a.month).net;
  const assets = BALANCE_LINES.filter((l) => l.kind === "asset").reduce((s, l) => s + r[l.id], 0);
  const liabilities = BALANCE_LINES.filter((l) => l.kind === "liability").reduce((s, l) => s + r[l.id], 0);
  r.retained = assets - liabilities - r["owner-equity"] - r["current-earnings"];
  return {
    ...r,
    cash: r.checking + r.savings,
    assets,
    liabilities,
    equity: r["owner-equity"] + r.retained + r["current-earnings"],
    netWorth: assets - liabilities,
  } as Balance;
}

/** Same month-end one year earlier. */
export const yearAgo = (a: AsOf): AsOf => ({ year: a.year - 1, month: a.month });

export function balanceTrend(): MonthPoint[] {
  return [...AS_OF_OPTIONS].reverse().map((a) => {
    const b = balance(a);
    return { label: MONTHS[a.month], value: b.cash, compare: b.netWorth };
  });
}
