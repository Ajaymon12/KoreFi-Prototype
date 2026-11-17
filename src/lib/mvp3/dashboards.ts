import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { APPS, appLabel, chargebacks, type AppKey, type Chargeback } from "@/lib/finance/chargebacks";
import { shortStore } from "@/lib/finance/outlets";
import type { AgentId, ReportId } from "./agents";

// MVP 3: the dashboard an agent builds when it runs (Chargeback recovery → "Chargebacks").
// The owner shapes it in the chat ("only DoorDash", "add reasons", "last 4 weeks"), pins it to the
// sidebar, and can put it on a schedule ("every Thursday at 8 AM, email me and update the dashboard").
// Figures come from the same chargebacks() as the /mvp2 Chargeback report, so they match it.
// Prototype: no model, a keyword parser reads the request.

export type WidgetId = "kpis" | "trend" | "apps" | "outlets" | "reasons" | "recent";

export const WIDGETS: { id: WidgetId; title: string; words: RegExp }[] = [
  { id: "kpis", title: "Totals", words: /\b(totals?|kpis?|headline|summary numbers)\b/ },
  { id: "trend", title: "Week by week", words: /(trend|week by week|weekly chart|over time|by week)/ },
  { id: "apps", title: "By delivery app", words: /(by app|per app|each app|app breakdown|by delivery app)/ },
  { id: "outlets", title: "Outlets with the most chargebacks", words: /\b(outlets?|stores?|locations?)\b/ },
  { id: "reasons", title: "Why orders get charged back", words: /\b(reasons?|why|causes?)\b/ },
  { id: "recent", title: "Latest chargebacks", words: /\b(recent|latest|list|table|transactions?)\b/ },
];
export const widgetTitle = (id: WidgetId) => WIDGETS.find((w) => w.id === id)!.title;

export type DashConfig = { weeks: number; apps: AppKey[]; widgets: WidgetId[]; topN: number };
export type Automation = { schedule: string; email: boolean; dashboard: boolean };
export type Dashboard = {
  id: string;
  title: string;
  /** The agent workflow that fills it. */
  workflow: string;
  agent: AgentId;
  config: DashConfig;
  pinned: boolean;
  automation?: Automation;
  updated: string;
  /** The chat it was built in, where it's customised. */
  thread?: string;
  /** A pinned /mvp2 report (P&L Summary, Payouts…) instead of the agent's own blocks. */
  report?: ReportId;
};

export const DEFAULT_CONFIG: DashConfig = { weeks: 13, apps: [], widgets: ["kpis", "trend", "apps", "outlets"], topN: 5 };

// ───────── Figures ─────────

const sum = (xs: Chargeback[], k: "amount" | "wonBack" = "amount") => xs.reduce((n, c) => n + c[k], 0);
const isOpen = (c: Chargeback) => c.status === "disputing" || c.status === "new";

export function dashData(cfg: DashConfig) {
  const from = Math.max(0, LAST - cfg.weeks + 1);
  const all = chargebacks(WEEKS, from, LAST);
  const rows = cfg.apps.length ? all.filter((c) => cfg.apps.includes(c.app)) : all;
  const won = rows.filter((c) => c.status === "won");
  const decided = rows.filter((c) => !isOpen(c));

  const group = <K extends string>(key: (c: Chargeback) => K) => {
    const m = new Map<K, Chargeback[]>();
    for (const c of rows) m.set(key(c), [...(m.get(key(c)) ?? []), c]);
    return [...m.entries()].map(([k, xs]) => ({ key: k, n: xs.length, amount: sum(xs), wonBack: sum(xs.filter((c) => c.status === "won"), "wonBack") })).sort((a, b) => b.amount - a.amount);
  };

  const weeks = [];
  for (let i = from; i <= LAST; i++) {
    const xs = rows.filter((c) => c.week === i);
    weeks.push({ label: WEEKS[i].label, charged: sum(xs), won: sum(xs.filter((c) => c.status === "won"), "wonBack") });
  }

  return {
    rows,
    kpis: { charged: sum(rows), won: sum(won, "wonBack"), open: sum(rows.filter(isOpen)), winRate: decided.length ? won.length / decided.length : null, n: rows.length },
    weeks,
    apps: (cfg.apps.length ? cfg.apps : APPS.map((a) => a.key)).map((k) => group((c) => c.app).find((g) => g.key === k) ?? { key: k, n: 0, amount: 0, wonBack: 0 }),
    outlets: group((c) => c.store).slice(0, cfg.topN),
    reasons: group((c) => c.reason),
    recent: [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  };
}

export const appsLabel = (apps: AppKey[]) => (apps.length === 0 || apps.length === APPS.length ? "All apps" : apps.map(appLabel).join(" and "));
export const scopeLabel = (cfg: DashConfig) => `Last ${cfg.weeks} weeks · ${appsLabel(cfg.apps)}`;
export { shortStore };

// ───────── Reading a request ─────────

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "every thursday at 8 am" → "Every Thursday, 8:00 AM". Null when no day or cadence is named. */
export function parseSchedule(text: string): string | null {
  const s = text.toLowerCase();
  const day = DAYS.find((d) => new RegExp(`\\b${d}s?\\b|\\b${d.slice(0, 3)}\\b`).test(s));
  const daily = /\b(daily|every day|each day|every morning)\b/.test(s);
  const monthly = /\b(monthly|every month)\b/.test(s);
  if (!day && !daily && !monthly) return null;
  const t = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/);
  const h = t ? Number(t[1]) : 8;
  const time = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${t?.[2] ?? "00"} ${t ? (t[3].startsWith("p") ? "PM" : "AM") : "AM"}`;
  if (daily) return `Daily, ${time}`;
  if (monthly) return `Monthly, 1st at ${time}`;
  return `Every ${cap(day!)}, ${time}`;
}

const APP_WORDS: [RegExp, AppKey][] = [
  [/door ?dash/, "doordash"],
  [/uber/, "uber"],
  [/grub ?hub/, "grubhub"],
];

export type Customised = { config: DashConfig; title?: string; pin?: boolean; automation?: Automation; changes: string[] };

/** What a chat message asks of the dashboard, or null when it isn't about the dashboard. */
export function customize(text: string, d: Dashboard): Customised | null {
  const s = text.toLowerCase();
  const cfg: DashConfig = { ...d.config, apps: [...d.config.apps], widgets: [...d.config.widgets] };
  const changes: string[] = [];
  const out: Customised = { config: cfg, changes };

  const schedule = parseSchedule(s);
  if (schedule && /(every|each|daily|monthly|schedule|automat|send|email|report)/.test(s)) {
    let email = /e-?mail|mail|inbox/.test(s);
    let dashboard = /dashboard|update|refresh/.test(s);
    if (!email && !dashboard) email = dashboard = true;
    out.automation = { schedule, email, dashboard };
    if (dashboard) out.pin = true;
    changes.push(`${schedule}: ${[email && "email", dashboard && "dashboard"].filter(Boolean).join(" + ")}`);
  } else {
    if (/\bunpin\b/.test(s)) out.pin = false;
    else if (/\bpin\b|sidebar/.test(s)) out.pin = true;
    if (out.pin !== undefined) changes.push(out.pin ? "Pinned to your sidebar" : "Unpinned from your sidebar");

    const removing = /(remove|hide|drop|without|exclude|except|take out|no more|get rid)/.test(s);
    const named = APP_WORDS.filter(([re]) => re.test(s)).map(([, k]) => k);
    if (/\b(all|every) (the )?apps\b/.test(s)) {
      cfg.apps = [];
      changes.push("All apps");
    } else if (named.length) {
      cfg.apps = removing ? APPS.map((a) => a.key).filter((k) => !named.includes(k) && (d.config.apps.length === 0 || d.config.apps.includes(k))) : named;
      changes.push(cfg.apps.length ? `Only ${appsLabel(cfg.apps)}` : "All apps");
    }

    const w = s.match(/\b(\d{1,2})\s*weeks?\b/);
    const weeks = w ? Number(w[1]) : /last month|past month|4 weeks/.test(s) ? 4 : /quarter|3 months|13 weeks/.test(s) ? 13 : null;
    if (weeks) {
      cfg.weeks = Math.min(13, Math.max(1, weeks));
      changes.push(`Last ${cfg.weeks} weeks`);
    }

    const top = s.match(/\btop (\d{1,2})\b/);
    if (top) {
      cfg.topN = Math.min(15, Math.max(1, Number(top[1])));
      if (!cfg.widgets.includes("outlets")) cfg.widgets.push("outlets");
      changes.push(`Top ${cfg.topN} outlets`);
    }

    for (const wd of WIDGETS) {
      if (!wd.words.test(s)) continue;
      if (wd.id === "outlets" && top) continue;
      const has = cfg.widgets.includes(wd.id);
      if (removing && has) {
        cfg.widgets = cfg.widgets.filter((x) => x !== wd.id);
        changes.push(`Removed ${wd.title.toLowerCase()}`);
      } else if (!removing && !has) {
        cfg.widgets.push(wd.id);
        changes.push(`Added ${wd.title.toLowerCase()}`);
      }
    }

    const name = text.match(/(?:rename(?: it)?|call it|title it)(?: to)?\s+["“']?([^"”']+)["”']?/i);
    if (name) {
      out.title = name[1].trim().replace(/[.!]$/, "");
      changes.push(`Renamed to ${out.title}`);
    }
  }

  return changes.length ? out : null;
}
