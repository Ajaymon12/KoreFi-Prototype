import { channelName, pctChange, sum, type DashboardData } from "@/lib/sources/dashboard";
import { insightsFor, scopeFor, storeRows, type Insight, type Step } from "@/lib/sources/overview";
import { fmtCents } from "@/lib/mockData";
import { DEFINITIONS } from "@/lib/metrics";
import { PERIOD } from "@/lib/period";
import { ACCOUNTING_SOURCE, LATEST, MONTHS, STORES, pnl } from "@/lib/finance/books";

// Sous's brain for the prototype: no model, no network. A question is matched to an intent, then
// answered from the same selectors the dashboards use, so every number on an answer is one the
// owner can find on a page. Swap `answer` for a model call later; the Answer shape stays.

export type Answer = {
  title: string;
  /** Short paragraphs under the title. */
  lines: string[];
  /** One big number, like an Overview insight. */
  stat?: { value: string; sub: string; tone?: "danger" | "success" };
  /** "How we got there" rows. */
  steps?: Step[];
  /** Source names shown as chips ("Based on N sources"). */
  sources: string[];
  followUps: string[];
  link?: { label: string; href: string };
  /** Whether "Ask the team to look at this" makes sense (something is off, not just a lookup). */
  teamNote?: boolean;
};

type Intent = "payout-gap" | "chargebacks" | "fees" | "downtime" | "waits" | "orders" | "sales" | "cash" | "profit" | "define" | "help";

const RULES: [Intent, RegExp][] = [
  ["define", /\b(what is|what's|what does|define|definition|formula|how is .* calculated|meaning)\b/],
  ["payout-gap", /(missing|short|gap|reconcil|didn'?t (get|arrive|reach)|not in my bank|deposit)/],
  ["chargebacks", /(charge ?back|dispute|refund|order error|won back)/],
  ["fees", /(fee|commission|pays? (me )?more|which app|what i keep|what you keep|keep|promo)/],
  ["downtime", /(paus|downtime|closed|offline|went down)/],
  ["waits", /(wait|driver|pickup|slow)/],
  ["profit", /(profit|net income|margin|p&l|pnl|food cost|labou?r|expenses?|(last|this) month)/],
  ["cash", /(cash|balance|bank account|how much (do i have|is in))/],
  ["orders", /(order|busy|traffic)/],
  ["sales", /(sales|revenue|sold|selling|how (am i|are we) doing|how did we do)/],
  ["help", /(help|what can you|hello|^hi\b|hey)/],
];

/** What a question defaults to when it matches nothing but the owner is on a specific page. */
const PAGE_DEFAULT: [RegExp, Intent][] = [
  [/reconciliation|payout/, "payout-gap"],
  [/chargeback|order-quality|refunds/, "chargebacks"],
  [/fees|platform-comparison|what-you-keep/, "fees"],
  [/wait-and-downtime/, "downtime"],
  [/orders/, "orders"],
  [/sales/, "sales"],
  [/pnl|books|tax/, "profit"],
  [/balance-summary/, "cash"],
];

const SOURCE_NAMES = ["Square", "DoorDash", "Uber Eats", "Mercury", ACCOUNTING_SOURCE];
const chips = (text: string, extra: string[] = []) => [...new Set([...SOURCE_NAMES.filter((n) => text.includes(n.split(" ")[0])), ...extra])];

/** Long lists stay readable in a narrow panel: first few rows, then a count of the rest. */
const capSteps = (steps: Step[], max = 5): Step[] => (steps.length > max ? [...steps.slice(0, max), { label: `${steps.length - max} more`, value: "" }] : steps);

const signed = (n: number) => `${n >= 0 ? "up" : "down"} ${Math.abs(n * 100).toFixed(1)}%`;

/** The store a question is about, if it names one ("Midtown", "the kitchen"). */
function storeIn(q: string, stores: string[]): string | null {
  return stores.find((s) => s.toLowerCase().split(/[–-]/).pop()!.trim().split(" ").some((w) => w.length > 3 && w !== "casa" && q.includes(w.toLowerCase()))) ?? null;
}

const fromInsight = (i: Insight, followUps: string[]): Answer => ({
  title: i.title,
  lines: [i.line],
  stat: { value: i.big, sub: i.bigSub, tone: i.bigTone },
  steps: i.steps,
  sources: chips(i.source),
  followUps,
  link: { label: "Open the report", href: i.href },
  teamNote: i.tag === "watch" || i.tag === "onit",
});

export const SUGGESTIONS = [
  "Why is money missing from my bank?",
  "How are my chargebacks doing?",
  "Which delivery app pays me more?",
  "Was any store paused on the apps?",
  "How did we do last month?",
];

export function intentFor(question: string, pathname = ""): Intent | null {
  const q = question.toLowerCase();
  const hit = RULES.find(([, re]) => re.test(q));
  if (hit) return hit[0];
  return PAGE_DEFAULT.find(([re]) => re.test(pathname))?.[1] ?? null;
}

export function answer(question: string, data: DashboardData, pathname = ""): Answer {
  const q = question.toLowerCase();
  const all = [...new Set(data.ops.map((o) => o.store))];
  const store = storeIn(q, all);
  const scope = scopeFor(store ?? undefined, all);
  const rows = storeRows(data, scope);
  const insights = insightsFor(data, scope, rows);
  const find = (prefix: string) => insights.find((i) => i.id.startsWith(prefix));
  const where = store ? ` at ${store}` : "";
  const intent = intentFor(question, pathname);

  switch (intent) {
    case "define": {
      const d = Object.values(DEFINITIONS).find((x) => q.includes(x.name.toLowerCase()) || (x.name === "What you keep" && /keep/.test(q)));
      if (d) return { title: d.name, lines: [d.formula, d.scope], sources: d.sources, followUps: ["Why is money missing from my bank?", "Which delivery app pays me more?"] };
      break;
    }
    case "payout-gap": {
      const gaps = insights.filter((i) => i.id.startsWith("gap-"));
      if (gaps.length > 1) {
        const total = sum(gaps.map((g) => g.impact));
        return { ...fromInsight(gaps[0], ["Which delivery app pays me more?", "How are my chargebacks doing?"]), title: `${gaps.length} payouts are short, ${fmtCents(total)} in total`, stat: { value: `−${fmtCents(total)}`, sub: "not in your bank yet", tone: "danger" }, steps: gaps.flatMap((g) => g.steps) };
      }
      if (gaps[0]) return fromInsight(gaps[0], ["Which delivery app pays me more?", "How are my chargebacks doing?"]);
      return { title: "Your payouts match your bank", lines: ["Every payout the apps reported has a matching deposit in Mercury, so nothing is missing."], sources: ["DoorDash", "Uber Eats", "Mercury"], followUps: ["How are my chargebacks doing?", "How much cash do I have?"], link: { label: "Open Reconciliation", href: "/finance/reconciliation" } };
    }
    case "chargebacks": {
      const open = find("open");
      const won = find("won");
      const lost = find("lost");
      const main = open ?? lost ?? won;
      if (!main) return { title: "No chargebacks to report", lines: [`Nothing was charged back${where} in ${PERIOD.range}.`], sources: ["DoorDash", "Uber Eats"], followUps: SUGGESTIONS.slice(0, 2) };
      const parts = [open && `${open.big} still being disputed`, won && `${won.big} won back`, lost && `${lost.big.replace("−", "")} lost`].filter(Boolean);
      return { ...fromInsight(main, ["Which delivery app pays me more?", "Was any store paused on the apps?"]), title: `Chargebacks${where}: ${parts.join(", ")}`, lines: [open ? open.line : main.line], steps: capSteps([...(open?.steps ?? []), ...(won?.steps ?? []), ...(lost?.steps ?? [])].filter((s) => !s.result)), teamNote: !!open };
    }
    case "fees": {
      const per = find("per");
      const byApp = data.payouts.map((p) => ({ name: channelName(p.source), gross: p.gross, fees: p.fees, net: p.net }));
      const feeTotal = sum(byApp.map((a) => a.fees));
      const base = per ? fromInsight(per, ["How are my chargebacks doing?", "What is what you keep?"]) : { title: "Fees by app", lines: [], sources: ["DoorDash", "Uber Eats"], followUps: SUGGESTIONS.slice(0, 2) };
      return { ...base, lines: [...base.lines, `Together the apps took ${fmtCents(feeTotal)} in commission and fees on ${fmtCents(sum(byApp.map((a) => a.gross)))} of sales.`], teamNote: false };
    }
    case "downtime": {
      const i = find("down");
      if (i) return fromInsight(i, ["Do drivers wait long at my stores?", "How are my chargebacks doing?"]);
      return { title: "No store was paused", lines: [`Every storefront${where} stayed open on the apps in ${PERIOD.range}.`], sources: ["DoorDash", "Uber Eats"], followUps: ["Do drivers wait long at my stores?"], link: { label: "Open Wait & downtime", href: "/operations/wait-and-downtime" } };
    }
    case "waits": {
      const i = find("wait");
      if (i) return fromInsight(i, ["Was any store paused on the apps?", "How are my chargebacks doing?"]);
      return { title: "Driver waits look normal", lines: ["No store has longer driver waits than the period before."], sources: ["DoorDash", "Uber Eats"], followUps: ["Was any store paused on the apps?"], link: { label: "Open Wait & downtime", href: "/operations/wait-and-downtime" } };
    }
    case "orders": {
      const i = find("orders");
      if (i) return fromInsight(i, ["How did we do last month?", "Which delivery app pays me more?"]);
      break;
    }
    case "sales": {
      const net = sum(data.sales.map((s) => s.netSales));
      const prev = sum(data.sales.map((s) => s.previousNetSales));
      const orders = sum(data.sales.map((s) => s.orders));
      return {
        title: `Net sales are ${signed(pctChange(net, prev))} on the 30 days before`,
        lines: [`${fmtCents(net)} across ${orders.toLocaleString("en-US")} orders in ${PERIOD.range}.`, ...(store ? [`Square reports sales for all your stores together, so this is not split by ${store}.`] : [])],
        stat: { value: fmtCents(net), sub: PERIOD.label, tone: net >= prev ? "success" : "danger" },
        steps: [
          { label: "This period", value: fmtCents(net), src: PERIOD.range },
          { label: "The 30 days before", value: fmtCents(prev) },
          { label: "Change", value: `${net >= prev ? "+" : "−"}${Math.abs(pctChange(net, prev) * 100).toFixed(1)}%`, result: net >= prev ? "good" : "bad" },
        ],
        sources: ["Square"],
        followUps: ["Which delivery app pays me more?", "How did we do last month?"],
        link: { label: "Open Sales", href: "/operations/sales" },
      };
    }
    case "cash": {
      const now = sum(data.balances.map((b) => b.amount));
      const prev = sum(data.balances.map((b) => b.previousAmount));
      return {
        title: `You have ${fmtCents(now)} in the bank`,
        lines: [`That is ${signed(pctChange(now, prev))} on a month ago (${fmtCents(prev)}).`],
        stat: { value: fmtCents(now), sub: "available now", tone: now >= prev ? "success" : "danger" },
        sources: ["Mercury"],
        followUps: ["Why is money missing from my bank?", "How did we do last month?"],
        link: { label: "Open Balance Sheet", href: "/finance/balance-summary" },
      };
    }
    case "profit": {
      const stores = store ? STORES.filter((s) => s === store) : STORES;
      const m = pnl(stores, LATEST.year, LATEST.month, LATEST.month);
      const margin = m.revenue ? (m.net / m.revenue) * 100 : 0;
      return {
        title: `${MONTHS[LATEST.month]} profit${where || " across your stores"}: ${fmtCents(m.net)}`,
        lines: [`That is a ${margin.toFixed(1)}% margin on ${fmtCents(m.revenue)} of sales.`],
        stat: { value: fmtCents(m.net), sub: `${MONTHS[LATEST.month]} ${LATEST.year} net profit`, tone: m.net >= 0 ? "success" : "danger" },
        steps: [
          { label: "Sales", value: fmtCents(m.revenue) },
          { label: "Food & drink costs", value: `−${fmtCents(m.cogs)}` },
          { label: "Labor", value: `−${fmtCents(m.labor)}` },
          { label: "Running costs", value: `−${fmtCents(m.opex)}` },
          { label: "Profit", value: fmtCents(m.net), result: m.net >= 0 ? "good" : "bad" },
        ],
        sources: [ACCOUNTING_SOURCE],
        followUps: ["How are my chargebacks doing?", "Which delivery app pays me more?"],
        link: { label: "Open P&L", href: "/finance/pnl" },
      };
    }
    case "help":
      return {
        title: "Hi, I'm Sous",
        lines: ["I read your sales, payouts, chargebacks, bank and books, and tell you what is happening and why. I never change anything: if something needs fixing, I can pass a note to the KoreFi team."],
        sources: [],
        followUps: SUGGESTIONS.slice(0, 4),
      };
  }

  // Nothing matched: show what is worth knowing instead of a dead end.
  const top = insights.slice(0, 3);
  return {
    title: "I'm not sure about that one yet",
    lines: ["I can answer questions about payouts, chargebacks, fees, store downtime, sales, cash and profit. Here is what stands out right now:", ...top.map((i) => `• ${i.title}`)],
    sources: [],
    followUps: SUGGESTIONS.slice(0, 4),
  };
}

/** Starter questions built from what is actually going on, most important first. */
export function suggestionsFor(data: DashboardData): string[] {
  const all = [...new Set(data.ops.map((o) => o.store))];
  const scope = scopeFor(undefined, all);
  const ids = insightsFor(data, scope, storeRows(data, scope)).map((i) => i.id.replace(/-.*/, ""));
  const ask: Record<string, string> = {
    gap: SUGGESTIONS[0],
    open: SUGGESTIONS[1],
    lost: SUGGESTIONS[1],
    won: SUGGESTIONS[1],
    per: SUGGESTIONS[2],
    down: SUGGESTIONS[3],
    wait: "Do drivers wait long at my stores?",
    orders: "How are my orders trending?",
  };
  return [...new Set([...ids.map((id) => ask[id]).filter(Boolean), SUGGESTIONS[4]])].slice(0, 5);
}
