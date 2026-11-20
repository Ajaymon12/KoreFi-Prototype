import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { APPS, chargebacks } from "@/lib/finance/chargebacks";
import type { Store } from "@/lib/finance/outlets";
import { reconcile } from "@/lib/finance/reconcile";
import type { Account } from "./accounts";
import type { AgentId } from "./agents";

// MVP 3: the activity log behind an agent and its chats. What happened each week and who did it:
//  - the KoreFi team (ops) uploads the delivery-app and Toast reports, checks them, files disputes, chases mismatches;
//  - the agent then runs on them, updates the dashboard and emails the owner.
// Report-only: the owner never acts here; the log shows the work was done.
// Same week calendar as the runs (lib/mvp3/runs): a week closes Thursday, and the agent runs at 8 AM that day,
// so the team's uploads and checks land just before it. Figures come from the same reports as the dashboards.
// Prototype: generated from the reports, plus the account's stage (new: waiting; agents off: no agent entries).

const DAY = 86_400_000;
const HOUR = 3_600_000;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export type Activity = {
  id: string;
  /** Epoch ms. */
  at: number;
  /** Who did it: someone on the KoreFi team, the agent, or KoreFi itself (account events). */
  by: { kind: "team"; name: string } | { kind: "agent"; agent: AgentId } | { kind: "system" };
  text: string;
  detail?: string;
};

/** The KoreFi ops people on the account, taking turns week to week. */
const TEAM = ["Priya · KoreFi team", "Marcus · KoreFi team"];

/** Weeks of activity kept. */
const WEEKS_SHOWN = 6;

type Opts = { account: Account; agent: AgentId; dashboard?: string };

function weekOf(wid: string | undefined, i: number, { account, agent, dashboard }: Opts): Activity[] {
  const stores: readonly Store[] = account.stores;
  const n = stores.length;
  const close = WEEKS[i].start.getTime() + 7 * DAY; // Thursday 00:00, the week just ended
  const label = WEEKS[i].label;
  const name = TEAM[i % TEAM.length];
  const team = { kind: "team" as const, name };
  const bot = { kind: "agent" as const, agent };
  const out: Activity[] = [];
  const add = (key: string, at: number, by: Activity["by"], text: string, detail?: string) => out.push({ id: `${wid ?? "chat"}-${i}-${key}`, at, by, text, detail });
  const agentOn = !account.agentsOff;

  if (wid === "chargebacks") {
    const rows = chargebacks(WEEKS, i, i, stores);
    const won = rows.filter((c) => c.status === "won");
    const open = rows.filter((c) => c.status === "disputing" || c.status === "new");
    add("upload", close + 6.5 * HOUR, team, `Uploaded ${rows.length} chargebacks from the apps`, `Week of ${label}`);
    if (agentOn) add("refresh", close + 8 * HOUR, bot, `Updated the ${dashboard ?? "Chargebacks"} dashboard and emailed you`, `${won.length} won, ${open.length} being disputed`);
    add("file", close + DAY + 11 * HOUR, team, `Filed ${open.length + won.length} disputes with the apps`);
    if (won.length) add("won", close + 5 * DAY + 15 * HOUR, team, `Won ${won.length} disputes, ${usd(won.reduce((s, c) => s + c.wonBack, 0))} back`);
  } else if (wid === "payouts") {
    const recons = APPS.map((a) => reconcile(a.key, stores, [WEEKS[i]]));
    const off = recons.reduce((s, r) => s + r.posOnly.orders + r.appOnly.orders, 0);
    add("upload", close + 6.5 * HOUR, team, "Uploaded Toast sales and the apps' payout reports", `Week of ${label} · ${n} outlets`);
    if (agentOn) add("refresh", close + 8 * HOUR, bot, `Updated the ${dashboard ?? "Delivery payouts"} dashboard and emailed you`, off ? `${off} orders don't match Toast` : "Every payout matched Toast");
    if (off) add("chase", close + DAY + 14 * HOUR, team, `Raised ${off} unmatched orders with the apps`);
  } else if (wid === "channel-pnl") {
    // The P&L runs Monday morning on the closed week.
    const mon = close + ((8 - new Date(close).getUTCDay()) % 7) * DAY;
    add("upload", mon + 6.5 * HOUR, team, "Uploaded Toast sales and the apps' payout reports", `Week of ${label} · ${n} outlets`);
    if (agentOn) add("refresh", mon + 8 * HOUR, bot, `Updated the ${dashboard ?? "P&L Summary"} and emailed you`, "P&L by channel for the week");
  } else {
    // A chat with no agent behind it: the reports every answer is read from.
    add("upload", close + 6.5 * HOUR, team, "Uploaded Toast sales and the apps' reports", `Week of ${label} · ${n} outlets`);
  }
  return out;
}

/** The log for an agent (by workflow id) or a chat, newest first. */
export function activityLog(wid: string | undefined, opts: Opts): Activity[] {
  const { account } = opts;
  // Just joined: nothing has come in yet, so the log says what's happening instead.
  if (account.stage === "new") {
    const now = WEEKS[LAST].start.getTime() + 7 * DAY + 9 * HOUR;
    return [
      { id: "new-wait", at: now + HOUR, by: { kind: "team", name: TEAM[0] }, text: "Waiting for your delivery-app invites", detail: "Your first reports usually arrive 2 to 3 days after the apps are connected" },
      { id: "new-joined", at: now, by: { kind: "system" }, text: `${account.name} joined KoreFi` },
    ];
  }
  // Today is the Thursday the latest week closed, just after the 8 AM run (the runs' calendar).
  const today = WEEKS[LAST].start.getTime() + 7 * DAY + 9 * HOUR;
  const out: Activity[] = [];
  for (let i = LAST; i > LAST - WEEKS_SHOWN && i >= 0; i--) out.push(...weekOf(wid, i, opts));
  // Masa Kitchen: the KoreFi team pinned its dashboards when they set the account up.
  if (account.teamPinned && opts.dashboard && (wid === "chargebacks" || wid === "payouts")) {
    const first = Math.max(0, LAST - WEEKS_SHOWN + 1);
    out.push({ id: `${wid}-pinned`, at: WEEKS[first].start.getTime() + 7 * DAY + 9 * HOUR, by: { kind: "team", name: TEAM[0] }, text: `Pinned the ${opts.dashboard} dashboard to your sidebar`, detail: "Updates every Thursday, 8:00 AM" });
  }
  return out.filter((x) => x.at <= today).sort((a, b) => b.at - a.at);
}
