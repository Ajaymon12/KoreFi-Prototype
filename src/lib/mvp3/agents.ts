import { Coins, ShieldCheck, WandSparkles, type LucideIcon } from "lucide-react";
import { LAST, WEEKS, totals, type Totals } from "@/components/finance/PnlStory";
import { TYPICAL } from "@/lib/finance/costSettings";
import { STORES, shortStore, type Store } from "@/lib/finance/outlets";
import { APPS, appLabel, chargebacks, type AppKey } from "@/lib/finance/chargebacks";
import { reconcile, type Recon } from "@/lib/finance/reconcile";
import type { Automation, CardRef } from "./dashboards";
import { findOutlets, findOutletLoose, outletsLabel, setScopeStores } from "./outletScope";
import { outletDive, versusUsual } from "./outletDive";
import { appStatuses, asOfLabel, nextSteps } from "./payoutStatus";
import * as FX from "./masaFixture";

// MVP 3: KoreFi as always-on agents (after ChatGPT Dots, docs/chatgpt-dots-market-research.md).
// Each agent watches one part of the business, posts an update when something changes, and answers
// questions in a chat. Every figure comes from the same Taco Pros reports as /mvp2, so an agent's
// number matches the report it opens. Agents only report: KoreFi does every fix.

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
  { id: "operations", name: "Operations agent", Icon: ShieldCheck, watches: "Chargebacks and the disputes KoreFi files", schedule: "Checks every new delivery-app report", status: "watching" },
  { id: "growth", name: "Growth agent", Icon: WandSparkles, watches: "Menu prices against nearby restaurants", schedule: "First report in about 2 weeks", status: "learning" },
];
export const agentOf = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

export const REPORTS: Record<ReportId, { title: string; sub: string }> = {
  pnl: { title: "Daily P&L", sub: "Last 4 weeks · all outlets" },
  payouts: { title: "Delivery payouts", sub: "DoorDash, Uber Eats, Grubhub" },
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
  setScopeStores(next);
  if (next === stores) return;
  stores = next;
  cache = null;
}
const n = () => stores.length;
/** "across 34 outlets", or "at Hyde Park" when a question is kept to one. */
const where = () => (n() === 1 ? `at ${shortStore(stores[0])}` : `across ${n()} outlets`);

/** Work out a reply on some of the restaurant's outlets only (a question that names them), then go back. */
function scopedTo<T>(only: readonly Store[], fn: () => T): T {
  const [s, c] = [stores, cache];
  stores = only;
  cache = null;
  try {
    return fn();
  } finally {
    stores = s;
    cache = c;
  }
}

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

export type Stat = { label: string; value: string; tone?: "success" | "danger"; sub?: string };
export type Row = { label: string; sub?: string; value: string; tone?: "success" | "danger" };
export type AgentReply = {
  agent: AgentId;
  /** A friendly opening line. With one, the title and lines read as one plain sentence under it, not a headline. */
  greeting?: string;
  /** How the reply reads (leadership flows, 2026-11-20). "opening": the agent's first message, one plain sentence with
   *  the headline number, then `looks` and `cover`. "answer": a reply to a prompt, a bold one-line answer, one or two
   *  sentences, then a grey `source` line. Left out: the older headline style. */
  style?: "opening" | "answer";
  /** Up to two "needs a look" lines, each with a coloured dot. */
  looks?: { tone: "danger" | "warning"; text: string }[];
  /** What the dashboard beside the chat switches to with this reply ("todo", "denied", "unmatched", "uber"). */
  view?: string;
  /** An action card only the owner can answer (Masa's payout week: "ue-9qx4"). */
  action?: "ue-9qx4";
  /** A small table in the reply (an uploaded file read back). */
  table?: { head: string[]; rows: string[][] };
  /** What the agent needs from the owner, ticked off as each arrives. */
  checklist?: { label: string; done: boolean }[];
  /** Open the outlet sheet's preview as soon as the reply lands. */
  autoOpen?: boolean;
  /** Any other canvas this reply opens beside the chat ("order:devon"). */
  canvasId?: string;
  /** A later message the agent posts on its own after this one (next week's reminder), with its own time. */
  followOn?: AgentReply & { at?: string };
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
  /** A line under the stats with a coloured dot ("Damen: 1.3% of app sales, over your 1% limit."), and what the figures cover. */
  look?: { tone: "danger" | "warning" | "success"; text: string };
  /** The agent's name when it is a named job ("Payout reconciliation"), instead of its folder's. */
  by?: string;
  /** Replaces the report card's title and line under it. */
  card?: { title: string; sub: string };
  cover?: string;
  /** Where the answer comes from, as a small line under it. */
  source?: string;
  /** The outlets the question named. The reply covers only these, and its report opens filtered to them. */
  outlets?: Store[];
  /** One outlet dug into ("Why is Damen high?"): its chargebacks open in the canvas. */
  outlet?: Store;
  /** The one-page sheet for that outlet's manager, ready to review and send. */
  sheet?: boolean;
  /** Documents the agent needs from the owner (labor leakage), each ticked off once its file is in. */
  docs?: DocRequest[];
};

export type LaborDoc = "timesheets" | "payroll" | "schedule";
export type DocRequest = { kind: LaborDoc; label: string; hint: string; required: boolean; /** The file that covers it, once added. */ file?: string };

export function weeklyPnl(): AgentReply {
  const { week, prev, outlets } = snapshot();
  const change = prev.all.moneyIn ? (week.all.moneyIn - prev.all.moneyIn) / prev.all.moneyIn : 0;
  const fees = week.all.commission + week.all.promos + week.all.cardFees;
  return {
    agent: "finance",
    title: `You kept ${usd(week.all.moneyIn)} after fees last week`,
    lines: [
      `Sales were ${usd(week.all.sales)} ${where()}, and the apps and card processors took ${usd(fees)}. That's ${pct(change)} on the week before.`,
      ...(n() > 1 ? [`${shortStore(outlets[0].store)} kept the smallest share of its sales as profit over the last 4 weeks. I'll keep an eye on it.`] : []),
    ],
    stats: [
      { label: "Sales", value: usd(week.all.sales) },
      { label: "Net after fees", value: usd(week.all.moneyIn) },
      { label: "Profit (estimate)", value: usd(week.all.profit) },
    ],
    work: [`Read ${n()} Toast sales summaries`, `Read ${n() * 3} delivery-app payout reports`, "Applied your food and staff cost settings", "Compared with the week before"],
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
      `The apps charged back ${cbs.length} orders over the last 13 weeks. KoreFi disputed them and is still waiting on ${disputing.length}. There's nothing you need to do.`,
    ],
    stats: [
      { label: "Charged back", value: usd(sumOf(cbs, "amount")), tone: "danger" },
      { label: "Won back", value: usd(sumOf(won, "wonBack")), tone: "success" },
      { label: "Being disputed", value: usd(sumOf(disputing, "amount")) },
    ],
    work: ["Read new DoorDash, Uber Eats and Grubhub adjustments", "Matched each chargeback to its order", "Checked dispute status with KoreFi"],
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

/** "Why is Damen high?": one outlet's last week, what went wrong and what to fix. Opens its orders in the canvas. */
export function outletWhy(store: Store): AgentReply {
  const d = outletDive(store);
  if (d.fx)
    return {
      agent: "operations",
      title: `${d.name} had ${d.n} orders with errors, ${versusUsual(d.n, d.usual)}`,
      lines: [FX.DAMEN_WHY.text],
      source: FX.DAMEN_WHY.source,
      work: ["Read Damen's adjustments from all 3 apps for Nov 1–7", "Matched each charge to its order and dish", "Compared with its usual week and its worst weekdays"],
      outlet: store,
      followUps: [`Send this to ${d.name}'s manager`, "What is still to dispute?"],
    };
  if (!d.n)
    return {
      agent: "operations",
      title: `${d.name} had no chargebacks last week`,
      lines: [`Nothing was charged back at ${d.name} for ${d.week}, so there is nothing to look into.`],
      work: [`Read ${d.name}'s delivery-app adjustments for ${d.week}`],
      followUps: ["Which outlets get the most chargebacks?"],
    };
  return {
    agent: "operations",
    title: `${d.name} had ${d.n} orders with errors, ${versusUsual(d.n, d.usual)}`,
    lines: [`${usd(d.charged)} was charged back at ${d.name} in ${d.week}, ${d.rate.toFixed(1)}% of its delivery-app sales. ${d.findings.join(" ")}`],
    stats: [
      { label: "Charged back", value: usd(d.charged), tone: "danger" },
      { label: "Won back", value: usd(d.won), tone: "success" },
      { label: "Being disputed", value: usd(d.open) },
    ],
    work: [`Read ${d.name}'s adjustments from all 3 apps for ${d.week}`, "Matched each charge to its order and dish", "Compared with its usual week and its worst weekdays", "Wrote what to fix"],
    outlet: store,
    followUps: [`Send this to ${d.name}'s manager`, "Which outlets get the most chargebacks?"],
  };
}

/** The sheet for the outlet's manager: one page, that outlet only, what to fix and every order, no amounts. */
export function outletSheet(store: Store): AgentReply {
  const d = outletDive(store);
  return {
    agent: "operations",
    title: `Here is the sheet for ${d.name}'s manager`,
    lines: [`One page, ${d.name} only, with what to fix and every order. Amounts are left out.`],
    work: [`Collected ${d.name}'s ${d.n} orders with errors`, "Left out the amounts", "Laid it out on one page"],
    outlet: store,
    sheet: true,
    followUps: ["Which outlets get the most chargebacks?"],
  };
}

/** Mid-week: which apps' reports are in and checked so far, and when each payout is due. */
export function payoutStatusReply(): AgentReply {
  const rows = appStatuses(LAST, stores, "mid");
  const checked = rows.filter((r) => r.reportIn).length;
  return {
    agent: "finance",
    title: checked === rows.length ? "Every app is checked" : `${checked} of ${rows.length} apps checked so far`,
    lines: [
      `Week of ${WEEK_LABEL} is still coming in, as of ${asOfLabel(LAST, "mid")}. No payout is late. ${nextSteps(LAST, stores).map((s) => `${s.day}: ${s.what}`).join(" ")}`,
    ],
    rows: rows.map((r) => ({ label: r.label, sub: `${r.orders} · ${r.payout}`, value: r.state === "waiting" ? "Waiting for report" : r.state === "paid" ? "Paid" : "Checked", tone: r.state === "paid" ? "success" : undefined })),
    work: ["Read each app's report and payout schedule", "Matched the reports that are in to Toast, by order ID", "Checked each payout against its usual day"],
    report: "payouts",
    followUps: ["Did every payout match Toast?", "Which delivery app pays me more?"],
  };
}

/** The Thursday payout update: one week, every app side by side (matched, in Toast only, in the app only). */
export function payoutReply(recons: Recon[], week: string): AgentReply {
  const sum = (f: (r: Recon) => number) => recons.reduce((n, r) => n + f(r), 0);
  const off = (r: Recon) => r.posOnly.orders + r.appOnly.orders;
  const offAmt = (r: Recon) => r.posOnly.amount + r.appOnly.amount;
  const orders = sum(off);
  const worst = [...recons].sort((a, b) => offAmt(b) - offAmt(a))[0];
  return {
    agent: "finance",
    title: orders ? `${orders} delivery orders don't match Toast` : "Every payout matched Toast",
    lines: [
      orders
        ? `Week of ${week}, all 3 apps compared with Toast. ${appLabel(worst.app as AppKey)} had the most orders on only one side (${off(worst)} orders, ${usd(offAmt(worst))}). KoreFi is checking these with the apps.`
        : `Week of ${week}: every DoorDash, Uber Eats and Grubhub order matched its Toast record and payout.`,
    ],
    stats: [
      { label: "Matched", value: usd(sum((r) => r.matched)), tone: "success" },
      { label: "In Toast only", value: usd(sum((r) => r.posOnly.amount)), tone: "danger" },
      { label: "In app only", value: usd(sum((r) => r.appOnly.amount)) },
    ],
    // Platform by platform: what matched, and what's on only one side.
    rows: recons.map((r) => ({
      label: appLabel(r.app as AppKey),
      sub: off(r) ? `${usd(r.matched)} matched · ${r.posOnly.orders} in Toast only (${usd(r.posOnly.amount)}) · ${r.appOnly.orders} in app only (${usd(r.appOnly.amount)})` : `${usd(r.matched)} matched · nothing off`,
      value: off(r) ? `${off(r)} off` : "All matched",
      tone: off(r) ? "danger" : "success",
    })),
    work: ["Read the week's Toast delivery orders", "Read the payout report from DoorDash, Uber Eats and Grubhub", "Matched every order to its payout line", "Compared the 3 apps"],
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
    title: `Your ${Math.min(4, n())} lowest-earning outlets`,
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
    work: ["Read your Toast menu", `Found restaurants near ${n()} outlets`],
  };
}

/** A first-time account has no reports yet, so it's answered on the Taco Pros sample, and says so. */

/** A typed question → the agent and the reply that answers it. Prototype only: no model.
 *  A question that names outlets ("How did Hyde Park do?", "chargebacks in Wisconsin") is answered on those only. */
export function answer(q: string): AgentReply {
  const dive = outletDiveAsk(q);
  if (dive) return dive;
  const only = findOutlets(q, stores);
  if (!only.length || only.length === stores.length) return route(q);
  const label = outletsLabel(only);
  return scopedTo(only, () => {
    const r = route(q);
    return { ...r, title: `${label}: ${r.title}`, work: [`Kept to ${label}`, ...r.work], outlets: only };
  });
}

/** "Why is Damen high?", "dig into Hyde Park", "send Damen's sheet to its manager": one outlet, chargebacks. */
function outletDiveAsk(q: string): AgentReply | null {
  const s = q.toLowerCase();
  const sheet = /(send|share|email).*(manager|sheet|store)|(manager|sheet).*(send|share)/.test(s);
  const why = /(why|what.?s (going on|wrong)|dig into|look into|drill|errors? at|high)/.test(s);
  if (!sheet && !why) return null;
  if (/(payout|fee|commission|sales|profit|p&l)/.test(s)) return null;
  const named = findOutlets(q, stores);
  const only = named.length ? named : findOutletLoose(q, stores);
  if (only.length !== 1) return null;
  if (sheet) return outletSheet(only[0]);
  return why ? outletWhy(only[0]) : null;
}

function route(q: string): AgentReply {
  const s = q.toLowerCase();
  // Ranking outlets needs more than one.
  const many = n() > 1;
  if (FX.masaFixture() && /missing/.test(s) && /(doordash|order)/.test(s))
    return {
      agent: "finance",
      by: "Payout reconciliation",
      title: "3 DoorDash orders are in Toast but not in DoorDash's report: $95.45",
      lines: ["KoreFi has claimed all 3."],
      rows: [
        { label: "DD 4BGF", sub: "Damen · Sat, Nov 7", value: "$31.40" },
        { label: "DD 26Y7", sub: "Montrose · Fri, Nov 6", value: "$27.85" },
        { label: "DD HS8V", sub: "Halsted · Tue, Nov 3", value: "$36.20" },
      ],
      source: "DoorDash report of Mon, Nov 9, matched to Toast",
      work: ["Compared DoorDash's report with Toast, by order ID"],
      followUps: ["When is each payout due?"],
    };
  if (FX.masaFixture() && /(due|when is|when are)/.test(s) && /(payout|paid|pay\b)/.test(s))
    return {
      agent: "finance",
      by: "Payout reconciliation",
      title: "Grubhub pays Wednesday and DoorDash pays Thursday",
      lines: ["Uber Eats paid on Monday; I'll confirm the amount when its report arrives on Wednesday. You'll get the full summary by email on Friday at 8 AM, and an alert sooner only if a payout does not arrive on its usual day."],
      source: "From each app's usual schedule for Prairie Taco Co.",
      work: ["Read each app's usual payout schedule"],
      followUps: ["Which DoorDash orders are missing?"],
    };
  if (FX.masaFixture() && /(still|file|not filed)/.test(s) && /dispute/.test(s)) return { agent: "operations", title: FX.STILL_TO_DISPUTE.title, lines: [FX.STILL_TO_DISPUTE.text], source: FX.STILL_TO_DISPUTE.source, work: ["Read KoreFi's filing log"], followUps: ["Why is Damen high?"] };
  if (FX.masaFixture() && /(denied|lost|declined)/.test(s)) return { agent: "operations", title: FX.DENIED.title, lines: [FX.DENIED.text], source: FX.DENIED.source, work: ["Read each app's dispute decisions"], followUps: ["What is still to dispute?"] };
  if (/(charge ?back|dispute|refund)/.test(s)) return many && /(outlet|store|where|most)/.test(s) ? chargebackOutlets() : chargebackUpdate();
  if (/(checked so far|still coming|which apps|when is|when are|when does|due|arrive|status)/.test(s) && /(payout|app|paid|pay\b|report)/.test(s)) return payoutStatusReply();
  if (/(payout|deposit|bank|missing|match|reconcil)/.test(s)) return payoutCheck();
  if (/(fee|commission|which app|pays? me more|promo)/.test(s)) return feesByApp();
  if (many && /(worst|least|lowest|best|outlet|store|location)/.test(s)) return worstOutlets();
  if (/(price|menu|pricing|competitor|growth)/.test(s)) return growthLearning();
  return weeklyPnl();
}

export const SUGGESTIONS = ["Run Chargeback recovery", "How did we do last week?", "Did every payout match Toast?", "Which delivery app pays me more?", "Where am I losing money on labor?"];

// ───────── Seeded threads (what the agents posted while you were away) ─────────

export type Message =
  | { id: string; role: "user"; text: string; /** A dashboard card the owner pointed at, sent with the message. */ ref?: CardRef; /** Files added with the message. */ files?: string[] }
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

/** Masa Kitchen's opening 3PD Payouts message: the week as it is mid-week, word for word from the agent-journey prototype. */
/** Masa Kitchen's opening payout message: the complete week, Fri, Nov 13 (leadership flows, 2026-11-20). */
function fixturePayouts(): AgentReply {
  return {
    agent: "finance",
    by: "Payout reconciliation",
    style: "opening",
    title: `Payouts for ${FX.WEEK} are in. 2,417 of ${FX.ORDERS.toast.toLocaleString("en-US")} orders matched, and 4 issues are worth a look.`,
    lines: [],
    action: "ue-9qx4",
    work: ["Read the DoorDash, Uber Eats and Grubhub payout reports for Nov 1–7", "Matched every Toast delivery order to its payout by order ID", "Checked each app's commission against your plan", "Checked each payout arrived on its usual day"],
    report: "payouts",
    card: { title: "Payouts", sub: "Nov 1–7 · 7 outlets · all apps" },
    followUps: ["Which orders weren't paid?", "Why did Uber Eats keep 34%?", "Did every payout arrive?"],
  };
}

/** Masa Kitchen's opening Chargebacks message (leadership flows, 2026-11-20): the result first, no greeting. */
function fixtureChargebacks(): AgentReply {
  const top = FX.flagged[0];
  return {
    agent: "operations",
    by: "Chargeback recovery",
    style: "opening",
    title: `Your chargebacks for ${FX.WEEK} cost you ${usd(FX.charged)}, ${usd(FX.charged - FX.USUAL)} more than a usual week. ${top.name} is the one to look at.`,
    lines: [],
    work: ["Read the DoorDash, Uber Eats and Grubhub adjustment reports for Nov 1–7", "Matched each charge to its order and outlet", "Compared each outlet with its usual week", "Checked which disputes were won, denied or not filed yet"],
    dashboard: "dash-chargebacks",
    followUps: ["Why is Damen high?", "What is still to dispute?", "Send Damen's sheet to its manager"],
  };
}

/** Masa Kitchen (KoreFi pinned its dashboards): each pinned dashboard's chat opens on one message, a summary
 *  of the dashboard and a few suggestions. The owner hasn't asked anything yet. */
export function teamPinnedThreads(): Thread[] {
  return [
    {
      id: "cb",
      title: "Chargebacks",
      agent: "operations",
      at: "Thu",
      unread: false,
      dashboard: "dash-chargebacks",
      messages: [
        {
          id: "c1",
          role: "agent",
          at: "Thu 8:00 AM",
          reply: fixtureChargebacks(),
        },
      ],
    },
    {
      id: "payout",
      title: "Payouts",
      agent: "finance",
      at: "Fri",
      unread: false,
      messages: [{ id: "p1", role: "agent", at: "Fri 8:00 AM", reply: fixturePayouts() }],
    },
  ];
}

/** Chats the Taco Pros owner had with the agents over the last month, newest first. `at` is the display time:
 * a clock time is today, "Yesterday", then a date ("Nov 14") within the last 30 days. */
export function historyThreads(): Thread[] {
  const chat = (id: string, title: string, agent: AgentId, at: string, q: string): Thread => ({
    id,
    title,
    agent,
    at,
    unread: false,
    messages: [
      { id: `${id}-q`, role: "user", text: q },
      { id: `${id}-a`, role: "agent", reply: answer(q), at },
    ],
  });
  return [
    chat("h-today-1", "Which outlets did worst last week?", "finance", "11:20 AM", "Which outlets did worst last week?"),
    chat("h-today-2", "Disputed chargebacks this week", "operations", "9:05 AM", "How many chargebacks did we dispute this week?"),
    chat("h-yday-1", "DoorDash vs Uber Eats fees", "finance", "Yesterday", "Which delivery app pays me more after fees?"),
    chat("h-yday-2", "Missing payouts check", "finance", "Yesterday", "Are any payouts missing from the bank?"),
    chat("h-nov14", "How did we do last week?", "finance", "Nov 14", "How did we do last week?"),
    chat("h-nov10", "Outlets with the most chargebacks", "operations", "Nov 10", "Which outlets get the most chargebacks?"),
    chat("h-nov3", "Did every payout match Toast?", "finance", "Nov 3", "Did every payout match Toast?"),
    chat("h-oct27", "Promo spend by app", "finance", "Oct 27", "How much did we spend on promos on each app?"),
    chat("h-oct22", "Menu prices vs nearby restaurants", "finance", "Oct 22", "How do our menu prices compare with competitors?"),
  ];
}

/** Which Recent chats group a thread's display time falls in. */
export function chatBucket(at: string) {
  if (at === "Now" || /\d:\d\d/.test(at)) return "Today";
  if (at === "Yesterday") return "Yesterday";
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(at)) return "Previous 30 days";
  return "Older";
}
export const CHAT_BUCKETS = ["Today", "Yesterday", "Previous 30 days", "Older"] as const;

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
    skills: [{ id: "chargebacks", name: "Chargeback recovery", blurb: "Finds every error charge on your delivery apps and shows which items and locations cause repeats. KoreFi disputes each one.", state: "live", cadence: "Email every Thursday", access: APPS_3PD, thread: "cb" }],
  },
  {
    agent: "finance",
    label: "Reconciliation",
    hue: "#6C74E6",
    skills: [
      { id: "payouts", name: "Payout reconciliation", blurb: "Checks every order the delivery apps report against your POS. Flags orders that are missing, wrong in amount or paid short.", state: "live", cadence: "Email every Thursday", access: [...APPS_3PD, "POS"], thread: "payout" },
      { id: "journal-entries", name: "Auto journal entries", blurb: "Prepares accounting entries from matched orders for your bookkeeper, and shows where the gaps are.", state: "idle", cadence: "Daily, 8:00 AM", access: [...APPS_3PD, "POS", "QuickBooks"] },
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
      { id: "schedule", name: "Schedule generation", blurb: "Suggests a weekly shift schedule from the forecast, your labor target and compliance rules, for your managers to use.", state: "idle", cadence: "Every Thursday, 8:00 AM", access: ["POS", "Payroll"] },
      { id: "payroll", name: "Payroll disbursement", blurb: "Checks staff pay against approved hours, including leave and overtime, and flags anything that looks off before payday.", state: "idle", cadence: "Every Friday, after the week's payouts", access: ["Payroll", "Bank account"] },
    ],
  },
  {
    agent: "operations",
    label: "Inventory",
    hue: "#3CA6C2",
    skills: [
      { id: "consumption", name: "Consumption tracking", blurb: "Turns sales into ingredients used, so you see where cost and waste go. Also checks every supplier bill.", state: "idle", cadence: "Every Monday, 8:00 AM", access: ["POS", INV] },
      { id: "inventory-forecast", name: "Inventory forecast", blurb: "Tells you how much of each ingredient to have each week, based on sales and your recipes.", state: "idle", cadence: "Every Thursday, 8:00 AM", access: ["POS", INV] },
      { id: "auto-ordering", name: "Auto ordering", blurb: "Shows what to order from each supplier by comparing the forecast with what is on hand.", state: "idle", cadence: "Every Thursday, 8:00 AM", access: ["POS", INV] },
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
  { id: "d1", title: "Weekly outlet scorecard", blurb: "Ranks every outlet each Monday on sales, fees kept and chargebacks, and flags the ones that slipped.", by: "Ajay mon", updated: "Last updated 2 days ago", steps: [{ group: "Read the week", items: ["Read last week's Toast sales for every outlet.", "Read the delivery-app payout reports."] }, { group: "Score outlets", items: ["Rank outlets by share of sales kept after fees.", "Flag outlets that dropped 5 places or more."] }] },
  { id: "d2", title: "Missing-item watch", blurb: "Spots items that are charged back again and again, so KoreFi can fix the cause with the outlet.", by: "Ajay mon", steps: [] },
  { id: "d3", title: "Delivery fee check", blurb: "Compares the commission each app charged with the rate in your contract and flags orders charged too much.", by: "Ajay mon", updated: "Last updated a week ago", steps: [{ group: "Compare fees", items: ["Read the commission rate in each app contract.", "Work out the rate charged on every order.", "List orders charged above the contract rate."] }] },
  { id: "d4", title: "Promo payback", blurb: "Shows which app promotions paid for themselves in new orders and which only cost margin.", by: "Ajay mon", steps: [] },
  { id: "d5", title: "New outlet baseline", blurb: "After a new outlet opens, compares its first 8 weeks with your other outlets of the same size.", by: "Ajay mon", steps: [] },
  { id: "d6", title: "Holiday sales outlook", blurb: "Looks at last year's holiday weeks and tells you what to expect from each outlet.", by: "Ajay mon", steps: [] },
];
