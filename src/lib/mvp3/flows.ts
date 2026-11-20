import type { Account } from "./accounts";
import type { AgentId, AgentReply, Message, Thread } from "./agents";
import * as FX from "./masaFixture";

// The four leadership flows (2026-11-20), as scripted replies. Every figure comes from lib/mvp3/masaFixture, the same
// numbers the dashboards and emails show, so nothing appears only in the chat.
//  1. Chargeback week (Masa Kitchen): the thread's three prompts and what follows them.
//  2. Payout week (Masa Kitchen): the same, plus the one order only the owner can answer (lib/mvp3/orderAnswer).
//  3. An agent that needs the owner's documents (Saffron Grill, Auto ordering; any agent missing data).
//  Questions outside the connected data (labor cost, food cost, profit) get one fixed answer.

/** "a, b and c". */
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const norm = (q: string) => q.toLowerCase().replace(/[’]/g, "'").replace(/[?.!\s]+$/, "").trim();
const DAMEN = FX.FX_OUTLETS[0];

const answer = (agent: AgentId, title: string, lines: string[], source: string | undefined, followUps: string[], extra: Partial<AgentReply> = {}): AgentReply => ({
  agent,
  style: "answer",
  title,
  lines,
  source,
  work: extra.work ?? ["Read the week's reports"],
  followUps,
  ...extra,
});

// ───────── Questions outside the connected data ─────────

export const OUT_OF_SCOPE = /\b(labou?r cost|staff cost|wages?|payroll|food cost|cost of goods|cogs|profit|margin)\b/;
export function outOfScope(agent: AgentId): AgentReply {
  return answer(agent, "I can't see that yet.", ["Labor needs your payroll report, and food cost needs stock counts and supplier bills. The KoreFi team can set either up with you."], undefined, [], { work: ["Checked which reports are connected"] });
}

// ───────── Flow 1: chargeback week ─────────

const cb = (title: string, lines: string[], source: string, followUps: string[], extra: Partial<AgentReply> = {}) => answer("operations", title, lines, source, followUps, extra);

function chargebackReply(q: string): AgentReply | null {
  const s = norm(q);
  if (/why is damen high|why.*damen|damen.*(high|why)/.test(s))
    return cb(
      `Damen had ${DAMEN.errors} orders with errors, up from its usual ${DAMEN.usual}.`,
      ["6 were on Wednesday and Thursday, and 8 were missing items. Chips & Queso was left out 3 times, which is new."],
      "From the app adjustment reports, matched to Damen's Toast orders",
      ["Send Damen's sheet to its manager", "Which items at Damen?"],
      { outlet: DAMEN.store, work: ["Read Damen's adjustments from all 3 apps for Nov 1–7", "Matched each charge to its Toast order", "Compared with its usual week"] },
    );
  if (/which items.*damen|items at damen/.test(s)) {
    const [a, b, ...rest] = FX.DAMEN_ITEMS;
    const twos = rest.filter(([, n]) => n === 2).map(([i]) => i);
    const ones = rest.filter(([, n]) => n === 1).map(([i]) => i);
    return cb(
      `${a[0]} and ${b[0]} came up most at Damen, ${a[1]} times each.`,
      [`${list(twos)} came up twice each, and ${list(ones)} once.`],
      "From Damen's 14 charges this week",
      ["Send Damen's sheet to its manager", "What is still to dispute?"],
      { outlet: DAMEN.store, work: ["Grouped Damen's 14 charges by dish"] },
    );
  }
  if (/(send|share).*(damen|sheet|manager)/.test(s))
    return cb("Here's the one-page sheet for Damen.", ["It has what to fix and every order, with no amounts."], "", ["What is still to dispute?"], {
      source: undefined,
      outlet: DAMEN.store,
      sheet: true,
      autoOpen: true,
      work: ["Collected Damen's 14 orders with errors", "Left out the amounts", "Laid it out on one page"],
    });
  if (/still to dispute|not filed|still.*dispute/.test(s))
    return cb(
      `${FX.usd0(FX.CBST.todo)} on ${FX.TODO.length} orders isn't filed yet.`,
      ["All are inside the apps' deadlines: 14 days on DoorDash, 30 days on Uber Eats and Grubhub. You'll see the result in next Thursday's review."],
      "From the KoreFi team's filing log",
      ["Why is Damen high?", "What was denied?", "Send Damen's sheet to its manager"],
      { dashboard: "dash-chargebacks", view: "todo", work: ["Read the KoreFi team's filing log"] },
    );
  if (/denied|declined|lost/.test(s))
    return cb(
      `${FX.usd0(FX.CBST.denied)} on ${FX.DENIED_ORDERS.length} orders was denied.`,
      [`Both were food-quality claims, which the apps rarely refund without a photo from the customer. ${FX.usd0(FX.CBST.wait)} more is waiting on the apps' decision.`],
      "From each app's dispute decisions",
      ["What is still to dispute?", "Why is Damen high?"],
      { dashboard: "dash-chargebacks", view: "denied", work: ["Read each app's dispute decisions"] },
    );
  return null;
}

// ───────── Flow 2: payout week ─────────

const pay = (title: string, lines: string[], source: string, followUps: string[], extra: Partial<AgentReply> = {}) => answer("finance", title, lines, source, followUps, { by: "Payout reconciliation", ...extra });

function payoutReply(q: string): AgentReply | null {
  const s = norm(q);
  const ue = FX.PAY[1];
  if (/which orders weren't paid|orders (weren't|were not|not) paid|unpaid orders|which orders/.test(s) && !/send/.test(s))
    return pay(
      `${FX.ORDERS.unpaid} orders in Toast weren't paid: ${FX.usd2(FX.UNPAID)}.`,
      ["3 are on DoorDash and 1 on Uber Eats. We've claimed 3, and 1 needs your answer."],
      "Toast orders matched to each app's payout by order ID",
      ["Why did Uber Eats keep 34%?", "Send the unpaid orders to Priya"],
      { report: "payouts", view: "unmatched", work: ["Matched every Toast delivery order to its payout by order ID"] },
    );
  if (/uber eats.*(keep|kept|34)|why did uber/.test(s))
    return pay(
      `Uber Eats kept ${FX.kept(ue)}%, mostly promos and ads.`,
      [`Commission was ${ue.rate}%, as per your plan. Promos took ${FX.usd0(ue.promos)} and ads ${FX.usd0(ue.ads)}. It still paid you ${FX.usd0(ue.up)} more than last week, because orders were up.`],
      "From the Uber Eats payout report of Mon, Nov 9",
      ["Which orders weren't paid?"],
      { report: "payouts", view: "uber", work: ["Read the Uber Eats payout report of Mon, Nov 9"] },
    );
  if (/every payout arrive|payouts? arrive|did .*arrive/.test(s))
    return pay(
      "All 3 payouts arrived on their usual day.",
      ["Uber Eats on Monday, Grubhub on Wednesday, DoorDash on Thursday. I can't confirm the deposits reached your bank, because the bank isn't connected."],
      "From each app's payout report",
      ["Which orders weren't paid?"],
      { work: ["Read each app's payout report"] },
    );
  if (/send.*(unpaid|orders).*priya|priya/.test(s))
    return pay(
      `Sent the ${FX.ORDERS.unpaid} unpaid orders to Priya.`,
      ["She has the order IDs, the amounts and which ones KoreFi has claimed."],
      "From the unmatched orders list",
      ["Did every payout arrive?"],
      { work: ["Emailed the unmatched orders to Priya"] },
    );
  return null;
}

/** Masa Kitchen's scripted replies, by thread: the Chargebacks chat ("cb") and the Payouts chat ("payout"). */
export function masaReply(q: string, thread: Thread | undefined): AgentReply | null {
  if (!thread) return chargebackReply(q) ?? payoutReply(q);
  if (thread.id === "cb" || thread.agent === "operations") return chargebackReply(q) ?? payoutReply(q);
  return payoutReply(q) ?? chargebackReply(q);
}

// ───────── Flow 3: an agent that needs the owner's documents ─────────

/** What each data source looks like as something the owner can send. */
const NEEDS: Record<string, string[]> = {
  "Inventory and supplier bills": ["This week's stock count for each outlet", "Last month's supplier bills"],
  Payroll: ["The last 4 weeks of timesheets", "Your last payroll report"],
  QuickBooks: ["Last month's P&L from QuickBooks"],
  "Bank account": ["Last month's bank statements"],
};

/** What the agent needs that the restaurant hasn't shared (empty when it has everything it reads). */
export function missingFor(access: string[], account: Account): string[] {
  const has = account.has ?? [];
  return access.filter((a) => !has.includes(a)).flatMap((a) => NEEDS[a] ?? []);
}

export const reportsInbox = (account: Account) => `${account.name.toLowerCase().replace(/[^a-z]+/g, "")}-reports@korefiops.com`;

const ORDERING = "auto-ordering";
const STOCK = "This week's stock count for each outlet";
const BILLS = "Last month's supplier bills";

/** Run on an agent missing data: it asks, and never says it ran. */
export function docsAsk(agentId: string, name: string, agent: AgentId, needs: string[], account: Account): AgentReply {
  const ordering = agentId === ORDERING;
  const count = needs.length === 1 ? "one thing" : needs.length === 2 ? "two things" : `${needs.length} things`;
  return {
    agent,
    style: "opening",
    title: ordering ? `To draft this week's order I need ${count} from you.` : `To run ${name} I need ${count} from you.`,
    lines: [],
    checklist: needs.map((label) => ({ label, done: false })),
    cover: `Upload a sheet, take a photo, or forward them to ${reportsInbox(account)}.`,
    work: ["Checked which of your reports this agent reads", "Found what's missing"],
    followUps: ordering ? ["Upload stock count", "Upload supplier bills", "What format do you need?"] : ["What format do you need?"],
  };
}

/** The checklist so far in a docs thread (from its latest reply that carries one). */
export function checklistIn(messages: Message[]): { label: string; done: boolean }[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "agent" && "reply" in m && m.reply.checklist) return m.reply.checklist;
  }
  return null;
}

const STOCK_ROWS = [
  ["Chicken thigh", "40 lb"],
  ["Basmati rice", "60 lb"],
  ["Paneer", "15 lb"],
  ["Onions", "50 lb"],
  ["Cooking oil", "4 jugs"],
];

/** A file arrived in a docs thread: read it back, tick it off. `kind` comes from the chip or the file's name. */
export function docsAfterUpload(thread: Thread, file: string, account: Account): AgentReply | null {
  const list = checklistIn(thread.messages);
  if (!list) return null;
  const ordering = thread.workflow === ORDERING;
  const isBills = /bill|invoice|supplier|receipt/i.test(file) || (list.find((x) => x.label === STOCK)?.done ?? false);
  const target = ordering ? (isBills ? BILLS : STOCK) : list.find((x) => !x.done)?.label;
  const next = list.map((x) => (x.label === target ? { ...x, done: true } : x));
  if (ordering && target === STOCK)
    return {
      agent: "operations",
      style: "answer",
      title: "I read 12 items for the Devon outlet, counted on Sun, Nov 15.",
      lines: ["Here are the first five. Is this right?"],
      table: { head: ["Item", "On hand"], rows: STOCK_ROWS },
      checklist: next,
      work: [`Read ${file}`, "Matched each line to an item"],
      followUps: ["Yes, that's right", "Fix something"],
    };
  if (ordering && target === BILLS)
    return {
      agent: "operations",
      style: "answer",
      title: "I read 9 bills from 2 suppliers: Restaurant Depot and Patel Brothers.",
      lines: ["Is this right?"],
      checklist: next,
      work: [`Read ${file}`, "Found each supplier and item price"],
      followUps: ["Yes, that's right", "Fix something"],
    };
  const left = next.filter((x) => !x.done);
  return {
    agent: (thread.agent as AgentId) ?? "operations",
    style: "answer",
    title: left.length ? `Got it. ${left.length === 1 ? "One more thing" : `${left.length} more things`} to go.` : "Thanks, that's everything I need.",
    lines: left.length ? [`Next: ${left[0].label.toLowerCase()}.`] : ["The KoreFi team checks it with you before the first run. It posts here once it's ready."],
    checklist: next,
    work: [`Read ${file}`],
    followUps: [],
    cover: left.length ? `Upload it, take a photo, or forward it to ${reportsInbox(account)}.` : undefined,
  };
}

/** The Devon order draft (the dashboard beside the chat). Order = usual weekly use − on hand. */
export const ORDER_DRAFT = [
  { item: "Chicken thigh", onHand: 40, use: 180, unit: "lb", supplier: "Restaurant Depot" },
  { item: "Basmati rice", onHand: 60, use: 150, unit: "lb", supplier: "Patel Brothers" },
  { item: "Paneer", onHand: 15, use: 70, unit: "lb", supplier: "Patel Brothers" },
  { item: "Onions", onHand: 50, use: 120, unit: "lb", supplier: "Restaurant Depot" },
  { item: "Cooking oil", onHand: 4, use: 10, unit: "jugs", supplier: "Restaurant Depot" },
];

/** Chips and typed replies inside a docs thread. `upload` names the sample file a chip stands for. */
export function docsReply(q: string, thread: Thread, account: Account): { reply: AgentReply; upload?: string; reminder?: AgentReply } | null {
  const list = checklistIn(thread.messages);
  if (!list) return null;
  const s = norm(q);
  const ordering = thread.workflow === ORDERING;
  const inbox = reportsInbox(account);
  if (/^upload stock count/.test(s)) return { reply: docsAfterUpload(thread, "Devon stock count, Nov 15.xlsx", account)!, upload: "Devon stock count, Nov 15.xlsx" };
  if (/^upload supplier bills/.test(s)) return { reply: docsAfterUpload(thread, "Supplier bills, October.pdf", account)!, upload: "Supplier bills, October.pdf" };
  if (/format/.test(s))
    return {
      reply: {
        agent: thread.agent,
        style: "answer",
        title: "Any format you already use.",
        lines: ["A Google Sheet, an Excel file or a photo of a paper count all work."],
        work: ["Checked what I can read"],
        followUps: list.filter((x) => !x.done).map((x) => (x.label === STOCK ? "Upload stock count" : x.label === BILLS ? "Upload supplier bills" : "")).filter(Boolean),
      },
    };
  if (/fix something/.test(s))
    return { reply: { agent: thread.agent, style: "answer", title: "Tell me what to change.", lines: ["For example, \"Paneer is 12 lb, not 15\". Or upload a new sheet."], work: ["Waiting for your change"], followUps: ["Yes, that's right"] } };
  if (/yes, that's right|that's right|^yes/.test(s)) {
    const left = list.filter((x) => !x.done);
    if (left.length)
      return {
        reply: {
          agent: thread.agent,
          style: "answer",
          title: `Thanks. Now ${left[0].label.toLowerCase()}.`,
          lines: [`Upload them, take a photo, or forward them to ${inbox}.`],
          checklist: list,
          work: ["Saved it"],
          followUps: [left[0].label === BILLS ? "Upload supplier bills" : "Upload stock count"],
        },
      };
    if (ordering)
      return {
        reply: {
          agent: "operations",
          style: "opening",
          title: "Here's this week's order for Devon. It's based on 4 weeks of sales and Sunday's count. Check it before you place it.",
          lines: [],
          cover: "Covers Devon only · 5 other outlets still need a stock count",
          canvasId: "order:devon",
          card: { title: "Order draft", sub: "Devon · week of Nov 16 · 5 items" },
          work: ["Read 4 weeks of Toast sales for Devon", "Worked out each item's usual weekly use", "Took away what's on hand", "Matched each item to its supplier"],
          followUps: ["Why 140 lb of chicken?", "Add another outlet's count"],
        },
        reminder: {
          agent: "operations",
          style: "opening",
          title: "Time for this week's count at Devon. Reply with a photo or the sheet.",
          lines: [],
          work: ["Checked the schedule"],
          followUps: ["Why 140 lb of chicken?"],
        },
      };
  }
  if (ordering && /140|chicken/.test(s)) {
    const x = ORDER_DRAFT[0];
    return { reply: answer("operations", `Devon uses about ${x.use} lb a week and has ${x.onHand} lb on hand.`, [`${x.use} − ${x.onHand} = ${x.use - x.onHand}.`], "From 4 weeks of Toast sales and Sunday's count", ["Add another outlet's count"], { work: ["Read Devon's chicken use"] }) };
  }
  if (ordering && /another outlet/.test(s))
    return { reply: answer("operations", "Send me the next outlet's count.", [`Upload a sheet or a photo, or forward it to ${inbox}. I'll add that outlet to the order.`], undefined, [], { work: ["Waiting for the next count"] }) };
  return null;
}
