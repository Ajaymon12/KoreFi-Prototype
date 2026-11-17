import { DRAFTS, FOLDERS, type AgentId, type SkillState } from "./agents";

// The workflow behind each agent: what it reads, the steps it follows, when it runs and which
// integrations it uses. The editor (components/mvp3/WorkflowEditor) lets the team view and alter it.
// Prototype: edits live in memory only. A workflow only reads, matches and reports; it never changes your data.

export type InputType = "text" | "list" | "number" | "date";
export type WfInput = { name: string; type: InputType; desc: string };
export type WfGroup = { title: string; steps: string[] };
export type Workflow = {
  id: string;
  title: string;
  kind: "preset" | "draft";
  state: SkillState | "draft";
  overview: string;
  inputs: WfInput[];
  groups: WfGroup[];
  triggers: string[];
  integrations: string[];
  /** Where each run's result goes, besides the chat: an email to the owner, and the dashboard it builds. */
  deliver: { email: boolean; dashboard: boolean };
  /** Files the agent reads alongside the reports (policies, handbooks, contract templates). Prototype: name and size only. */
  knowledge?: { name: string; size: number }[];
  thread?: string;
  /** The agent it belongs to and that agent's folder colour (drafts have neither). */
  agent?: AgentId;
  hue?: string;
};

export const ALL_INTEGRATIONS = ["DoorDash", "Uber Eats", "Grubhub", "POS", "QuickBooks", "Bank account", "Payroll", "Inventory and supplier bills"];
export const TRIGGER_CHOICES = ["Every Monday, 8:00 AM", "Every Thursday, 8:00 AM", "Every Friday, after the week's payouts", "Daily, 8:00 AM", "Monthly, 1st at 8:00 AM", "Every 3 months", "When a new delivery-app report arrives"];

const OUTLETS: WfInput = { name: "outlets", type: "list", desc: "Outlets to include. Default: all 34." };
const PERIOD: WfInput = { name: "review period", type: "text", desc: "How far back to look, e.g. last 13 weeks." };

const PRESET: Record<string, Partial<Workflow>> = {
  chargebacks: {
    overview: "Finds every error charge on your delivery apps. It reads each app's weekly adjustment report, matches every charge to its order, and shows which items and outlets cause repeats. The KoreFi team files the disputes; this agent reports what was won back.",
    inputs: [PERIOD, OUTLETS, { name: "apps", type: "list", desc: "Delivery apps to read." }],
    groups: [
      { title: "Read the apps", steps: ["Read the new adjustment report from DoorDash, Uber Eats and Grubhub.", "List every charge marked as an order error."] },
      { title: "Match charges", steps: ["Match each chargeback to its order in Square.", "Group chargebacks by item and by outlet."] },
      { title: "Report", steps: ["Check each dispute's status with the KoreFi team.", "Email the owner a summary of what was won back."] },
    ],
    triggers: ["Every Thursday, 8:00 AM"],
    deliver: { email: true, dashboard: false },
  },
  payouts: {
    overview: "Matches every delivery order in your POS with the app's record and its payout. It flags orders that are missing from a payout or paid short, so the KoreFi team can chase them with the app.",
    inputs: [PERIOD, OUTLETS, { name: "tolerance", type: "number", desc: "Ignore differences under this amount ($)." }],
    groups: [
      { title: "Load the week", steps: ["Read the week's Square delivery orders.", "Read the payout report from each app."] },
      { title: "Match orders", steps: ["Match every order to its payout line.", "Flag orders found on only one side or paid short."] },
      { title: "Report", steps: ["Compare DoorDash, Uber Eats and Grubhub side by side.", "Email the owner the weekly comparison every Thursday."] },
    ],
    triggers: ["Every Thursday, 8:00 AM"],
    deliver: { email: true, dashboard: false },
  },
  "channel-pnl": {
    overview: "Shows yesterday's P&L every morning, by channel, item and store, so you see what made money and what didn't. It reads the day's Square sales and every delivery app's orders, takes off commission, promotions, card fees and chargebacks, applies your food and staff cost settings, and emails the owner the day's P&L at 8 AM.",
    inputs: [OUTLETS, { name: "compare with", type: "text", desc: "What each day is measured against. Default: the same day last week." }],
    groups: [
      { title: "Load yesterday", steps: ["Read yesterday's Square sales for in-store and website orders, by item and outlet.", "Read yesterday's orders from DoorDash, Uber Eats and Grubhub."] },
      { title: "Build the P&L", steps: ["Subtract commission, promotions, card fees and chargebacks for each channel.", "Apply the owner's food and staff cost settings.", "Rank items and outlets by what they kept, and compare with the same day last week."] },
      { title: "Report", steps: ["Email the owner yesterday's P&L by channel, item and store.", "Update the Daily P&L dashboard."] },
    ],
    triggers: ["Daily, 8:00 AM"],
    deliver: { email: true, dashboard: false },
  },
};

export function workflowOf(id: string): Workflow | null {
  for (const f of FOLDERS) {
    const s = f.skills.find((x) => x.id === id);
    if (!s) continue;
    const p = PRESET[id] ?? {};
    return {
      id,
      title: s.name,
      kind: "preset",
      state: s.state,
      overview: p.overview ?? s.blurb,
      inputs: p.inputs ?? [PERIOD, OUTLETS],
      groups: p.groups ?? [{ title: "Outline", steps: [`Read ${s.access.join(", ") || "your menu"} data for the review period.`, "Work out the result for each outlet.", "Email the owner what changed."] }],
      triggers: p.triggers ?? [s.cadence],
      integrations: s.access.filter((a) => ALL_INTEGRATIONS.includes(a)),
      deliver: p.deliver ?? { email: true, dashboard: false },
      thread: s.thread,
      agent: f.agent,
      hue: f.hue,
    };
  }
  const d = DRAFTS.find((x) => x.id === id);
  if (!d) return null;
  return {
    id,
    title: d.title,
    kind: "draft",
    state: "draft",
    overview: d.blurb,
    inputs: [PERIOD, OUTLETS],
    groups: d.steps.map((g) => ({ title: g.group, steps: [...g.items] })),
    triggers: [],
    integrations: [],
    deliver: { email: true, dashboard: false },
  };
}

/** A new, empty agent the owner starts from scratch (Agents → New agent). */
export function blankWorkflow(id: string): Workflow {
  return { id, title: "Untitled agent", kind: "draft", state: "draft", overview: "Describe what this agent should watch and what it should tell you.", inputs: [PERIOD, OUTLETS], groups: [], triggers: [], integrations: [], deliver: { email: true, dashboard: false } };
}

/** Time-based triggers (not "When … arrives"); an automation keeps one of these. */
export const isSchedule = (t: string) => !t.startsWith("When");
