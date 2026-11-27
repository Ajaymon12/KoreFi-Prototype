import { CHANNELS, LAST, WEEKS, totals } from "@/components/finance/PnlStory";
import { TYPICAL } from "@/lib/finance/costSettings";
import { APPS, chargebacks } from "@/lib/finance/chargebacks";
import { STORES } from "@/lib/finance/outlets";
import { reconcile } from "@/lib/finance/reconcile";
import { payoutReply, type AgentReply } from "./agents";

// MVP 3: the run history of a live agent, for its overview page (components/mvp3/AgentOverview).
// One scheduled run per closed week, on the morning after the week ends (the week's reports are in by then).
// Each run reads only its own week, from the same reports as /mvp2, and carries the reply it posted, so
// opening a run shows that week's chat. Prototype: runs started in this session come from AgentsProvider.

const DAY = 86_400_000;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export type Metric = { label: string; value: number; tone?: "success" | "danger"; money?: boolean };
export type Run = {
  id: string;
  /** Epoch ms of the start. */
  at: number;
  minutes: number;
  status: "completed" | "running";
  trigger: "scheduled" | "manual";
  /** The week of data it read. */
  week: string;
  headline: string;
  metrics: Metric[];
  reply: AgentReply;
  /** A chat that already holds this run (seeded threads, or a run started in this session). */
  thread?: string;
};

/** Weeks of history the overview keeps. */
const HISTORY = 13;

function chargebackRun(i: number): Omit<Run, "id" | "at" | "minutes" | "status" | "trigger"> {
  const rows = chargebacks(WEEKS, i, i);
  const sum = (xs: typeof rows, k: "amount" | "wonBack" = "amount") => xs.reduce((n, c) => n + c[k], 0);
  const won = rows.filter((c) => c.status === "won");
  const open = rows.filter((c) => c.status === "disputing" || c.status === "new");
  const headline = `${won.length} disputes won, ${usd(sum(won, "wonBack"))} back`;
  const metrics: Metric[] = [
    { label: "Charged back", value: sum(rows), tone: "danger", money: true },
    { label: "Won back", value: sum(won, "wonBack"), tone: "success", money: true },
    { label: "Being disputed", value: sum(open), money: true },
  ];
  return {
    week: WEEKS[i].label,
    headline,
    metrics,
    reply: {
      agent: "operations",
      title: headline,
      lines: [`The apps charged back ${rows.length} orders in the week of ${WEEKS[i].label}. KoreFi disputed them and is still waiting on ${open.length}. There's nothing you need to do.`],
      stats: metrics.map((m) => ({ label: m.label, value: usd(m.value), tone: m.tone })),
      work: ["Read the new adjustment report from DoorDash, Uber Eats and Grubhub", "Matched each chargeback to its order in Toast", "Checked dispute status with KoreFi", "Emailed you the summary"],
      report: "chargebacks",
    },
  };
}

function payoutRun(i: number): Omit<Run, "id" | "at" | "minutes" | "status" | "trigger"> {
  const recons = APPS.map((a) => reconcile(a.key, STORES, [WEEKS[i]]));
  const matched = recons.reduce((n, r) => n + r.matched, 0);
  const posOnly = recons.reduce((n, r) => n + r.posOnly.amount, 0);
  const appOnly = recons.reduce((n, r) => n + r.appOnly.amount, 0);
  const orders = recons.reduce((n, r) => n + r.posOnly.orders + r.appOnly.orders, 0);
  const headline = orders ? `${orders} orders don't match Toast` : "Every payout matched Toast";
  const metrics: Metric[] = [
    { label: "Matched", value: matched, tone: "success", money: true },
    { label: "In Toast only", value: posOnly, tone: "danger", money: true },
    { label: "In app only", value: appOnly, money: true },
  ];
  return {
    week: WEEKS[i].label,
    headline,
    metrics,
    // Same platform-by-platform comparison as the Thursday chat update.
    reply: payoutReply(recons, WEEKS[i].label),
  };
}

function pnlRun(i: number): Omit<Run, "id" | "at" | "minutes" | "status" | "trigger"> {
  const t = totals(STORES, i, i, () => TYPICAL);
  const fees = t.all.commission + t.all.promos + t.all.cardFees;
  // The channel that keeps the biggest share of its sales.
  const best = [...CHANNELS].sort((a, b) => t.cols[b.key].moneyIn / (t.cols[b.key].sales || 1) - t.cols[a.key].moneyIn / (t.cols[a.key].sales || 1))[0];
  const headline = `You kept ${usd(t.all.moneyIn)} after fees`;
  const metrics: Metric[] = [
    { label: "Sales", value: t.all.sales, money: true },
    { label: "Net after fees", value: t.all.moneyIn, tone: "success", money: true },
    { label: "Fees", value: fees, tone: "danger", money: true },
  ];
  return {
    week: WEEKS[i].label,
    headline,
    metrics,
    reply: {
      agent: "finance",
      title: headline,
      lines: [`Sales were ${usd(t.all.sales)} in the week of ${WEEKS[i].label}, and the apps and card processors took ${usd(fees)}. ${best.label} kept the biggest share of its sales.`],
      stats: metrics.map((m) => ({ label: m.label, value: usd(m.value), tone: m.tone })),
      work: ["Read the week's Toast sales", "Read the payout report from each app", "Applied your food and staff cost settings", "Emailed you the P&L by channel"],
      report: "pnl",
    },
  };
}

const BUILD: Record<string, (i: number) => Omit<Run, "id" | "at" | "minutes" | "status" | "trigger">> = { chargebacks: chargebackRun, payouts: payoutRun, "channel-pnl": pnlRun };
export const hasRuns = (id: string) => id in BUILD;

const cache = new Map<string, Run[]>();

/** Scheduled runs, newest first. The latest one is the agent's seeded chat (`thread`). */
export function runHistory(id: string, thread?: string): Run[] {
  const build = BUILD[id];
  if (!build) return [];
  const hit = cache.get(id);
  if (hit) return hit;
  // Chargebacks and payouts run Thursday 8 AM, when the week (Thu–Wed) closes.
  // Daily operational P&L runs every morning; the history shows its Monday runs, which roll up the closed week
  // (the reports are weekly, so those are the figures that match the Daily P&L dashboard).
  const hour = 8;
  const runs: Run[] = [];
  for (let i = LAST; i > LAST - HISTORY && i >= 0; i--) {
    const close = WEEKS[i].start.getTime() + 7 * DAY;
    const toMonday = id === "channel-pnl" ? ((8 - new Date(close).getUTCDay()) % 7) * DAY : 0;
    const at = close + toMonday + hour * 3_600_000;
    runs.push({ id: `${id}-${i}`, at, minutes: 2 + ((i * 7) % 5), status: "completed", trigger: "scheduled", ...build(i), thread: i === LAST ? thread : undefined });
  }
  cache.set(id, runs);
  return runs;
}

/** "The day after the newest data", used as today on the overview's chart. */
export const asOf = () => WEEKS[LAST].start.getTime() + 7 * DAY;
export { usd };
