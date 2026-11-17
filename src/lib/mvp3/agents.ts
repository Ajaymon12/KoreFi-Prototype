import { Coins, ShieldCheck, WandSparkles, type LucideIcon } from "lucide-react";
import { LAST, WEEKS, totals, type Totals } from "@/components/finance/PnlStory";
import { TYPICAL } from "@/lib/finance/costSettings";
import { STORES, shortStore, type Store } from "@/lib/finance/outlets";
import { APPS, appLabel, chargebacks, type AppKey } from "@/lib/finance/chargebacks";
import { reconcile } from "@/lib/finance/reconcile";
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
  { id: "finance", name: "Finance agent", Icon: Coins, watches: "P&L, payouts and deposits across your outlets", schedule: "Checks daily · weekly P&L on Mondays", status: "watching" },
  { id: "operations", name: "Operations agent", Icon: ShieldCheck, watches: "Chargebacks and the disputes the KoreFi team files", schedule: "Checks every new delivery-app report", status: "watching" },
  { id: "growth", name: "Growth agent", Icon: WandSparkles, watches: "Menu prices against nearby restaurants", schedule: "First report in about 2 weeks", status: "learning" },
];
export const agentOf = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

export const REPORTS: Record<ReportId, { title: string; sub: string }> = {
  pnl: { title: "P&L Summary", sub: "Last 4 weeks · all outlets" },
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

export function payoutCheck(): AgentReply {
  const { worstRecon: r } = snapshot();
  const app = appLabel(r.app as AppKey);
  return {
    agent: "finance",
    title: `${app}: ${r.appOnly.orders + r.posOnly.orders} orders don't match Square`,
    lines: [
      `${r.posOnly.orders} orders were rung up in Square but aren't in ${app}'s payout (${usd(r.posOnly.amount)}), and ${r.appOnly.orders} were paid by ${app} but never recorded in Square (${usd(r.appOnly.amount)}).`,
      "The KoreFi team is checking these with the app.",
    ],
    stats: [
      { label: "Matched", value: usd(r.matched), tone: "success" },
      { label: "In Square only", value: usd(r.posOnly.amount), tone: "danger" },
      { label: `In ${app} only`, value: usd(r.appOnly.amount) },
    ],
    work: [`Read ${app} payout reports for 4 weeks`, "Matched every order to Square", "Flagged orders found on only one side"],
    report: "payouts",
    followUps: ["How did we do last week?", "Which delivery app pays me more?"],
  };
}

export function worstOutlets(): AgentReply {
  const { outlets } = snapshot();
  return {
    agent: "finance",
    title: "Your 4 lowest-earning outlets",
    lines: ["Profit as a share of sales over the last 4 weeks, after fees and your food and staff estimates. Same ranking as the P&L Summary."],
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
export const withSampleNote = (r: AgentReply): AgentReply => ({ ...r, lines: [...r.lines, "This is Taco Pros sample data. Your own numbers arrive with your first reports, usually 2 to 3 days after your apps are connected."] });

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

export type Thread = { id: string; title: string; agent: AgentId; at: string; unread: boolean; messages: Message[]; workflow?: string; dashboard?: string };

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
    { id: "payout", title: pay.title.split(":")[0] + " payout check", agent: "finance", at: "Mon", unread: false, messages: [{ id: "p1", role: "agent", reply: pay, at: "Mon" }] },
  ];
}

// ───────── Folders (the home groups what each agent does) ─────────

export type SkillState = "live" | "learning" | "soon";
export type Skill = { id: string; name: string; blurb: string; state: SkillState; cadence: string; access: string[]; thread?: string };
export type Folder = { agent: AgentId; label: string; hue: string; skills: Skill[] };

const APPS_3PD = ["DoorDash", "Uber Eats", "Grubhub"];

export const FOLDERS: Folder[] = [
  {
    agent: "operations",
    label: "Operations",
    hue: "#F2784B",
    skills: [{ id: "chargebacks", name: "Chargeback recovery", blurb: "Finds every error charge on your delivery apps, disputes it for you, and shows which items and locations cause repeats.", state: "live", cadence: "Email every Thursday", access: APPS_3PD, thread: "cb" }],
  },
  {
    agent: "finance",
    label: "Finance",
    hue: "#6C74E6",
    skills: [
      { id: "payouts", name: "Payout reconciliation", blurb: "Matches every delivery order in your POS with the app's record and its payout. Flags orders that are missing or paid short.", state: "live", cadence: "Email every Friday, after the week's payouts", access: [...APPS_3PD, "POS"], thread: "payout" },
      { id: "channel-pnl", name: "Channel P&L", blurb: "What you keep from in-store and each app, after fees and promos.", state: "soon", cadence: "Shows profit", access: [...APPS_3PD, "POS"] },
      { id: "labor", name: "Labor cost", blurb: "Labor as a % of sales by location, against your target.", state: "soon", cadence: "Cuts cost", access: ["POS", "Payroll"] },
      { id: "food", name: "Food cost", blurb: "Actual food cost % by location, with a check on every supplier bill.", state: "soon", cadence: "Cuts cost", access: ["POS", "Inventory and supplier bills"] },
    ],
  },
  {
    agent: "growth",
    label: "Growth",
    hue: "#4CC27A",
    skills: [
      { id: "pricing", name: "Pricing intelligence", blurb: "Compares your menu and prices with nearby restaurants. Useful before a price change or a new location.", state: "learning", cadence: "Report every 3 months", access: [] },
      { id: "promo", name: "Promo analysis", blurb: "Shows which delivery-app promotions brought in new orders and which only cost you margin.", state: "soon", cadence: "Report every month", access: [...APPS_3PD, "POS"] },
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
