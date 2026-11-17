import { Coins, ShieldCheck, WandSparkles, type LucideIcon } from "lucide-react";
import { LAST, WEEKS, totals, type Totals } from "@/components/finance/PnlStory";
import { TYPICAL } from "@/lib/finance/costSettings";
import { STORES, shortStore, type Store } from "@/lib/finance/outlets";
import { APPS, appLabel, chargebacks, type AppKey } from "@/lib/finance/chargebacks";
import { reconcile, type Recon } from "@/lib/finance/reconcile";
import type { Automation } from "./dashboards";

// MVP 3: KoreFi as always-on agents (after ChatGPT Dots, docs/chatgpt-dots-market-research.md).
// Each agent watches one part of the business, posts an update when something changes, and answers
// questions in a chat. Every figure comes from the same Taco Pros reports as /mvp2, so an agent's
// number matches the report it opens. Agents only report: the KoreFi team does every fix.

export type AgentId = "finance" | "operations" | "growth";
export type ReportId = "pnl" | "payouts" | "chargebacks" | "overview";

export type Agent = {
  id: AgentId;
  name: string;
  Icon: LucideIcon;
  watches: string;
  schedule: string;
  status: "watching" | "learning";
};

export const AGENTS: Agent[] = [
  { id: "finance", name: "Finance agent", Icon: Coins, watches: "P&L, payouts and deposits across your outlets", schedule: "Checks daily · P&L every morning", status: "watching" },
  { id: "operations", name: "Operations agent", Icon: ShieldCheck, watches: "Chargebacks and the disputes the KoreFi team files", schedule: "Checks every new delivery-app report", status: "watching" },
  { id: "growth", name: "Growth agent", Icon: WandSparkles, watches: "Menu prices against nearby restaurants", schedule: "First report in about 2 weeks", status: "learning" },
];
export const agentOf = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

export const REPORTS: Record<ReportId, { title: string; sub: string }> = {
  pnl: { title: "Daily P&L", sub: "Last 4 weeks · all outlets" },
  payouts: { title: "3PD Payouts", sub: "DoorDash, Uber Eats, Grubhub" },
  chargebacks: { title: "Chargeback Overview", sub: "Last 13 weeks · all apps" },
  overview: { title: "Overview", sub: "Revenue by outlet" },
};

// ───────── Figures ─────────

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;
const set = () => TYPICAL;
const t = (stores: readonly Store[], from: number, to: number): Totals => totals(stores, from, to, set);

export const WEEK_LABEL = WEEKS[LAST].label;

let cache: ReturnType<typeof build> | null = null;
export const snapshot = () => (cache ??= build());

// The outlets the figures cover: the account picked in the /mvp3 switcher (lib/mvp3/accounts). Taco Pros by default.
let stores: readonly Store[] = STORES;
export function setAccountStores(next: readonly Store[]) {
  if (next === stores) return;
  stores = next;
  cache = null;
}
const n = () => stores.length;

function build() {
  const week = t(stores, LAST, LAST);
  const prev = t(stores, LAST - 1, LAST - 1);
  const month = t(stores, LAST - 3, LAST);
  const outlets = stores.map((s) => ({ store: s, all: t([s], LAST - 3, LAST).all })).sort((a, b) => a.all.profit / (a.all.sales || 1) - b.all.profit / (b.all.sales || 1));

  // The Chargeback report opens on its 13-week preset (useScope(1)), so the agent counts the same span.
  const cbs = chargebacks(WEEKS, LAST - 12, LAST, stores);
  const sumOf = (xs: typeof cbs, k: "amount" | "wonBack") => xs.reduce((n, c) => n + c[k], 0);
  const won = cbs.filter((c) => c.status === "won");
  const disputing = cbs.filter((c) => c.status === "disputing" || c.status === "new");
  const byStore = new Map<string, { n: number; amount: number }>();
  for (const c of cbs) {
    const r = byStore.get(c.store) ?? { n: 0, amount: 0 };
    byStore.set(c.store, { n: r.n + 1, amount: r.amount + c.amount });
  }
  const topCb = [...byStore.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 4);

  const weeks = WEEKS.slice(LAST - 3, LAST + 1);
  const recons = APPS.map((a) => reconcile(a.key, stores, weeks));
  const worstRecon = [...recons].sort((a, b) => b.appOnly.amount + b.posOnly.amount - (a.appOnly.amount + a.posOnly.amount))[0];

  return { week, prev, month, outlets, cbs, won, disputing, sumOf, topCb, recons, worstRecon };
}

// ───────── Messages ─────────

export type Stat = { label: string; value: string; tone?: "success" | "danger" };
export type Row = { label: string; sub?: string; value: string; tone?: "success" | "danger" };
export type AgentReply = {
  agent: AgentId;
  title: string;
  lines: string[];
  stats?: Stat[];
  rows?: Row[];
  /** What the agent did to get there, shown as a collapsible work log. */
  work: string[];
  report?: ReportId;
  /** A dashboard the agent built or changed (lib/mvp3/dashboards), opened in the canvas. */
  dashboard?: string;
  /** A schedule the owner set in the chat, confirmed as a card. */
  automation?: Automation;
  followUps?: string[];
};

export function weeklyPnl(): AgentReply {
  const { week, prev, outlets } = snapshot();
  const change = prev.all.moneyIn ? (week.all.moneyIn - prev.all.moneyIn) / prev.all.moneyIn : 0;
  const fees = week.all.commission + week.all.promos + week.all.cardFees;
  return {
    agent: "finance",
    title: `You kept ${usd(week.all.moneyIn)} after fees last week`,
    lines: [
      `Sales were ${usd(week.all.sales)} across ${n()} outlets, and the apps and card processors took ${usd(fees)}. That's ${pct(change)} on the week before.`,
      `${shortStore(outlets[0].store)} kept the smallest share of its sales as profit over the last 4 weeks. I'll keep an eye on it.`,
    ],
    stats: [
      { label: "Sales", value: usd(week.all.sales) },
      { label: "Net after fees", value: usd(week.all.moneyIn) },
      { label: "Profit (estimate)", value: usd(week.all.profit) },
    ],
    work: [`Read ${n()} Square sales summaries`, `Read ${n() * 3} delivery-app payout reports`, "Applied your food and staff cost settings", "Compared with the week before"],
    report: "pnl",
    followUps: ["Which outlets made the least?", "How much did the apps take in fees?"],
  };
}

export function chargebackUpdate(): AgentReply {
  const { cbs, won, disputing, sumOf } = snapshot();
  return {
    agent: "operations",
    title: `${won.length} disputes won, ${usd(sumOf(won, "wonBack"))} back`,
    lines: [
      `The apps charged back ${cbs.length} orders over the last 13 weeks. The KoreFi team disputed them and is still waiting on ${disputing.length}. There's nothing you need to do.`,
    ],
    stats: [
      { label: "Charged back", value: usd(sumOf(cbs, "amount")), tone: "danger" },
      { label: "Won back", value: usd(sumOf(won, "wonBack")), tone: "success" },
      { label: "Being disputed", value: usd(sumOf(disputing, "amount")) },
    ],
    work: ["Read new DoorDash, Uber Eats and Grubhub adjustments", "Matched each chargeback to its order", "Checked dispute status with the KoreFi team"],
    report: "chargebacks",
    followUps: ["Which outlets get the most chargebacks?", "Why do orders get charged back?"],
  };
}

export function chargebackOutlets(): AgentReply {
  const { topCb } = snapshot();
  return {
    agent: "operations",
    title: `${shortStore(topCb[0][0])} has the most chargebacks`,
    lines: ["These outlets had the most money charged back over the last 13 weeks. Missing items are the most common reason."],
    rows: topCb.map(([s, r]) => ({ label: shortStore(s), sub: `${r.n} orders`, value: usd(-r.amount), tone: "danger" })),
    work: ["Grouped chargebacks by outlet", "Ranked by amount"],
    report: "chargebacks",
    followUps: ["How did we do last week?"],
  };
}

/** The Thursday payout update: one week, every app side by side (matched, in Square only, in the app only). */
export function payoutReply(recons: Recon[], week: string): AgentReply {
  const sum = (f: (r: Recon) => number) => recons.reduce((n, r) => n + f(r), 0);
  const off = (r: Recon) => r.posOnly.orders + r.appOnly.orders;
  const offAmt = (r: Recon) => r.posOnly.amount + r.appOnly.amount;
  const orders = sum(off);
  const worst = [...recons].sort((a, b) => offAmt(b) - offAmt(a))[0];
  return {
    agent: "finance",
    title: orders ? `${orders} delivery orders don't match Square` : "Every payout matched Square",
    lines: [
      orders
        ? `Week of ${week}, all 3 apps compared with Square. ${appLabel(worst.app as AppKey)} had the most orders on only one side (${off(worst)} orders, ${usd(offAmt(worst))}). The KoreFi team is checking these with the apps.`
        : `Week of ${week}: every DoorDash, Uber Eats and Grubhub order matched its Square record and payout.`,
    ],
    stats: [
      { label: "Matched", value: usd(sum((r) => r.matched)), tone: "success" },
      { label: "In Square only", value: usd(sum((r) => r.posOnly.amount)), tone: "danger" },
      { label: "In app only", value: usd(sum((r) => r.appOnly.amount)) },
    ],
    // Platform by platform: what matched, and what's on only one side.
    rows: recons.map((r) => ({
      label: appLabel(r.app as AppKey),
      sub: off(r) ? `${usd(r.matched)} matched · ${r.posOnly.orders} in Square only (${usd(r.posOnly.amount)}) · ${r.appOnly.orders} in app only (${usd(r.appOnly.amount)})` : `${usd(r.matched)} matched · nothing off`,
      value: off(r) ? `${off(r)} off` : "All matched",
      tone: off(r) ? "danger" : "success",
    })),
    work: ["Read the week's Square delivery orders", "Read the payout report from DoorDash, Uber Eats and Grubhub", "Matched every order to its payout line", "Compared the 3 apps"],
    report: "payouts",
    followUps: ["How did we do last week?", "Which delivery app pays me more?"],
  };
}

export function payoutCheck(): AgentReply {
  return payoutReply(APPS.map((a) => reconcile(a.key, stores, [WEEKS[LAST]])), WEEK_LABEL);
}

export function worstOutlets(): AgentReply {
  const { outlets } = snapshot();
  return {
    agent: "finance",
    title: "Your 4 lowest-earning outlets",
    lines: ["Profit as a share of sales over the last 4 weeks, after fees and your food and staff estimates. Same ranking as the Daily P&L dashboard."],
    rows: outlets.slice(0, 4).map((o) => ({ label: shortStore(o.store), sub: `${usd(o.all.profit)} profit on ${usd(o.all.sales)}`, value: `${(o.all.profit / (o.all.sales || 1) * 100).toFixed(1)}%`, tone: o.all.profit < 0 ? "danger" : undefined })),
    work: [`Built a P&L for each of ${n()} outlets`, "Ranked them by profit"],
    report: "pnl",
    followUps: ["How much did the apps take in fees?"],
  };
}

export function feesByApp(): AgentReply {
  const { month } = snapshot();
  const rows: Row[] = APPS.map((a) => {
    const c = month.cols[a.key];
    const take = c.commission + c.promos + c.chargebacksNet;
    return { label: a.label, sub: `${c.sales ? Math.round((take / c.sales) * 100) : 0}% of its sales`, value: usd(-take), tone: "danger" };
  });
  const best = APPS.map((a) => ({ a, c: month.cols[a.key] })).sort((x, y) => y.c.moneyIn / (y.c.sales || 1) - x.c.moneyIn / (x.c.sales || 1))[0];
  return {
    agent: "finance",
    title: `${best.a.label} leaves you the most per order`,
    lines: ["What each app took over the last 4 weeks in commission, promotions and chargebacks."],
    rows,
    work: ["Read payout reports from all 3 apps", "Split out commission, promos and chargebacks"],
    report: "payouts",
    followUps: ["Which outlets made the least?"],
  };
}

export function growthLearning(): AgentReply {
  return {
    agent: "growth",
    title: "I'm still learning your menu",
    lines: ["I'm comparing your menu prices with restaurants near each outlet. My first pricing report will be ready in about 2 weeks, and I'll post it here."],
    work: ["Read your Square menu", `Found restaurants near ${n()} outlets`],
  };
}

/** A first-time account has no reports yet, so it's answered on the Taco Pros sample, and says so. */

/** A typed question → the agent and the reply that answers it. Prototype only: no model. */
export function answer(q: string): AgentReply {
  const s = q.toLowerCase();
  if (/(charge ?back|dispute|refund)/.test(s)) return /(outlet|store|where|most)/.test(s) ? chargebackOutlets() : chargebackUpdate();
  if (/(payout|deposit|bank|missing|match|reconcil)/.test(s)) return payoutCheck();
  if (/(fee|commission|which app|pays? me more|promo)/.test(s)) return feesByApp();
  if (/(worst|least|lowest|best|outlet|store|location)/.test(s)) return worstOutlets();
  if (/(price|menu|pricing|competitor|growth)/.test(s)) return growthLearning();
  return weeklyPnl();
}

export const SUGGESTIONS = ["Run Chargeback recovery", "How did we do last week?", "Did every payout match Square?", "Which delivery app pays me more?"];

// ───────── Seeded threads (what the agents posted while you were away) ─────────

export type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; reply: AgentReply; at?: string }
  | { id: string; role: "agent"; pending: true; agent: AgentId; work: string[]; done: number };

/** `hidden`: kept out of Recent chats (Taco Pros' seeded chats back its pinned dashboards); joins the list once the owner replies. */
export type Thread = { id: string; title: string; agent: AgentId; at: string; unread: boolean; messages: Message[]; workflow?: string; dashboard?: string; hidden?: boolean };

export function seedThreads(): Thread[] {
  const pnl = weeklyPnl();
  const cb = chargebackUpdate();
  const pay = payoutCheck();
  return [
    { id: "weekly", title: `Weekly P&L · ${WEEK_LABEL}`, agent: "finance", at: "8:00 AM", unread: true, messages: [{ id: "w1", role: "agent", reply: pnl, at: "8:00 AM" }] },
    {
      id: "cb",
      title: "Chargebacks · last 13 weeks",
      agent: "operations",
      at: "Yesterday",
      unread: true,
      messages: [
        { id: "c1", role: "agent", reply: cb, at: "Yesterday" },
        { id: "c2", role: "user", text: "Which outlets get the most chargebacks?" },
        { id: "c3", role: "agent", reply: chargebackOutlets() },
      ],
    },
    { id: "payout", title: `Payouts by app · ${WEEK_LABEL}`, agent: "finance", at: "Thu", unread: false, messages: [{ id: "p1", role: "agent", reply: pay, at: "Thu 8:00 AM" }] },
  ];
}

// ───────── Folders (the home groups what each agent does) ─────────

/** live: running on your reports. idle: set up but not live yet; the first Run makes it live. */
export type SkillState = "live" | "learning" | "idle";
export type Skill = { id: string; name: string; blurb: string; state: SkillState; cadence: string; access: string[]; thread?: string };
export type Folder = { agent: AgentId; label: string; hue: string; skills: Skill[] };

const APPS_3PD = ["DoorDash", "Uber Eats", "Grubhub"];
const INV = "Inventory and supplier bills";

// Chargebacks, payouts and channel P&L are live; every other agent is idle (not live) until someone runs it. The Reconciliation, Labor and Inventory lists follow the founders' priority workbook
// (Book.pdf), in its priority order; the cross-module views (daily P&L, benchmark, budget vs actual) sit in Finance.
export const FOLDERS: Folder[] = [
  {
    agent: "operations",
    label: "Operations",
    hue: "#F2784B",
    skills: [{ id: "chargebacks", name: "Chargeback recovery", blurb: "Finds every error charge on your delivery apps, disputes it for you, and shows which items and locations cause repeats.", state: "live", cadence: "Email every Thursday", access: APPS_3PD, thread: "cb" }],
  },
  {
    agent: "finance",
    label: "Reconciliation",
    hue: "#6C74E6",
    skills: [
      { id: "payouts", name: "Payout reconciliation", blurb: "Checks every order the delivery apps report against your POS. Flags orders that are missing, wrong in amount or paid short.", state: "live", cadence: "Email every Thursday", access: [...APPS_3PD, "POS"], thread: "payout" },
      { id: "journal-entries", name: "Auto journal entries", blurb: "Turns matched orders into accounting entries automatically and shows where the gaps are.", state: "idle", cadence: "Daily, 8:00 AM", access: [...APPS_3PD, "POS", "QuickBooks"] },
      { id: "three-way-recon", name: "3-way reconciliation", blurb: "Adds the bank: confirms the money the apps owe you for delivered orders actually reached your account.", state: "idle", cadence: "Every Friday, after the week's payouts", access: [...APPS_3PD, "POS", "Bank account"] },
    ],
  },
  {
    agent: "finance",
    label: "Finance",
    hue: "#8E6CE6",
    skills: [
      // Id kept as "channel-pnl": its runs, the Daily P&L dashboard (REPORTS.pnl) and the seeded chat are wired to it.
      { id: "channel-pnl", name: "Daily operational P&L", blurb: "Each day's P&L by channel, item and store, so you see what made money yesterday.", state: "idle", cadence: "Email daily, 8:00 AM", access: [...APPS_3PD, "POS"], thread: "weekly" },
      { id: "benchmark", name: "Store benchmark", blurb: "Compares your stores on the same measures, from sales kept to labor and food cost.", state: "idle", cadence: "Every Monday, 8:00 AM", access: [...APPS_3PD, "POS"] },
      { id: "budget-actual", name: "Budget vs actual", blurb: "Compares what you planned to spend with what you actually spent, for every cost.", state: "idle", cadence: "Monthly, 1st at 8:00 AM", access: ["POS", "QuickBooks"] },
    ],
  },
  {
    agent: "operations",
    label: "Labor",
    hue: "#E6A23C",
    skills: [
      { id: "labor-forecast", name: "Labor forecast", blurb: "Tells you how many staff to have each day and shift, based on past sales and past staffing.", state: "idle", cadence: "Every Monday, 8:00 AM", access: ["POS", "Payroll"] },
      { id: "labor-leakage", name: "Labor leakage", blurb: "Shows which days or weeks you were overstaffed for your sales, and what the extra hours cost.", state: "idle", cadence: "Every Monday, 8:00 AM", access: ["POS", "Payroll"] },
      { id: "schedule", name: "Schedule generation", blurb: "Builds the weekly shift schedule from the forecast, your labor target and compliance rules.", state: "idle", cadence: "Every Thursday, 8:00 AM", access: ["POS", "Payroll"] },
      { id: "payroll", name: "Payroll disbursement", blurb: "Works out staff pay from approved hours, including leave and overtime, ready to release.", state: "idle", cadence: "Every Friday, after the week's payouts", access: ["Payroll", "Bank account"] },
    ],
  },
  {
    agent: "operations",
    label: "Inventory",
    hue: "#3CA6C2",
    skills: [
      { id: "consumption", name: "Consumption tracking", blurb: "Turns sales into ingredients used, so you see where cost and waste go. Also checks every supplier bill.", state: "idle", cadence: "Every Monday, 8:00 AM", access: ["POS", INV] },
      { id: "inventory-forecast", name: "Inventory forecast", blurb: "Tells you how much of each ingredient to have each week, based on sales and your recipes.", state: "idle", cadence: "Every Thursday, 8:00 AM", access: ["POS", INV] },
      { id: "auto-ordering", name: "Auto ordering", blurb: "Drafts supplier orders by comparing the forecast with what is on hand.", state: "idle", cadence: "Every Thursday, 8:00 AM", access: ["POS", INV] },
      { id: "price-variance", name: "Price discovery", blurb: "Shows where you pay more than you should for an ingredient, and which suppliers offer better prices.", state: "idle", cadence: "Monthly, 1st at 8:00 AM", access: [INV] },
    ],
  },
  {
    agent: "growth",
    label: "Growth",
    hue: "#4CC27A",
    skills: [
      { id: "pricing", name: "Pricing intelligence", blurb: "Compares your menu and prices with nearby restaurants. Useful before a price change or a new location.", state: "idle", cadence: "Report every 3 months", access: [] },
      { id: "promo", name: "Promo analysis", blurb: "Shows which delivery-app promotions brought in new orders and which only cost you margin.", state: "idle", cadence: "Report every month", access: [...APPS_3PD, "POS"] },
    ],
  },
];

// ───────── Drafts (agents being written, not yet live) ─────────

export type Draft = { id: string; title: string; blurb: string; by: string; updated?: string; steps: { group: string; items: string[] }[] };

export const DRAFTS: Draft[] = [
  { id: "d1", title: "Weekly outlet scorecard", blurb: "Ranks every outlet each Monday on sales, fees kept and chargebacks, and flags the ones that slipped.", by: "Ajay mon", updated: "Last updated 2 days ago", steps: [{ group: "Read the week", items: ["Read last week's Square sales for every outlet.", "Read the delivery-app payout reports."] }, { group: "Score outlets", items: ["Rank outlets by share of sales kept after fees.", "Flag outlets that dropped 5 places or more."] }] },
  { id: "d2", title: "Missing-item watch", blurb: "Spots items that are charged back again and again, so the KoreFi team can fix the cause with the outlet.", by: "Ajay mon", steps: [] },
  { id: "d3", title: "Delivery fee check", blurb: "Compares the commission each app charged with the rate in your contract and flags orders charged too much.", by: "Ajay mon", updated: "Last updated a week ago", steps: [{ group: "Compare fees", items: ["Read the commission rate in each app contract.", "Work out the rate charged on every order.", "List orders charged above the contract rate."] }] },
  { id: "d4", title: "Promo payback", blurb: "Shows which app promotions paid for themselves in new orders and which only cost margin.", by: "Ajay mon", steps: [] },
  { id: "d5", title: "New outlet baseline", blurb: "After a new outlet opens, compares its first 8 weeks with your other outlets of the same size.", by: "Ajay mon", steps: [] },
  { id: "d6", title: "Holiday sales outlook", blurb: "Looks at last year's holiday weeks and tells you what to expect from each outlet.", by: "Ajay mon", steps: [] },
];
