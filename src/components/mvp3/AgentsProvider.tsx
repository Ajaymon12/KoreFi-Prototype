"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { user } from "@/lib/mockData";
import type { Account } from "@/lib/mvp3/accounts";
import { useAccount } from "./AccountSwitcher";
import { FOLDERS, REPORTS, agentOf, answer, chargebackUpdate, payoutCheck, seedThreads, weeklyPnl, setAccountStores, type AgentReply, type Message, type ReportId, type Thread } from "@/lib/mvp3/agents";
import { blankWorkflow, isSchedule, workflowOf, type Workflow } from "@/lib/mvp3/workflows";
import { DEFAULT_CONFIG, customize, parseSchedule, scopeLabel, type Automation, type Dashboard } from "@/lib/mvp3/dashboards";

// MVP 3's state, kept in the layout so chats, edited agents and dashboards survive moving between pages.
//  - Chats: `active` null = a new chat (the home screen).
//  - Agents: the owner's edits to a preset, and agents they wrote from scratch, by id (workflowOf is the preset).
//  - Running an agent opens a chat, plays its steps as a work log, and builds its dashboard (Chargeback recovery).
//  - Dashboards: shaped in that chat, pinned to the sidebar, and put on a schedule (email + dashboard update).
//  - The canvas is the report or dashboard docked right of the chat (the ChatGPT Dots split).
// Prototype: all in memory.

export type CanvasId = ReportId | `dash:${string}`;

type Ctx = {
  threads: Thread[];
  active: Thread | null;
  open: (id: string) => void;
  newChat: () => void;
  send: (text: string) => void;
  /** Home's tiles: ask a question in its own chat. Reopens the chat that already asked it, so repeat clicks don't pile up. */
  ask: (question: string) => void;
  busy: boolean;
  canvas: CanvasId | null;
  setCanvas: (r: CanvasId | null) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  // agents
  getWorkflow: (id: string) => Workflow | null;
  saveWorkflow: (w: Workflow) => void;
  created: Workflow[];
  newAgent: () => string;
  /** Copy an agent into a new draft ("Copy of …") and return its id; the original is untouched. */
  duplicateAgent: (w: Workflow) => string;
  runAgent: (w: Workflow) => void;
  /** Open a past run's chat (the agent overview's history); a run without one gets a chat holding its reply. */
  openRun: (run: { id: string; thread?: string; week: string; reply: AgentReply }, w: Workflow) => void;
  // dashboards
  dashboards: Dashboard[];
  pinDashboard: (id: string, pinned: boolean) => void;
  /** Open a pinned dashboard as its chat with the dashboard in the canvas. False when it has no chat to open. */
  openDashboard: (id: string) => boolean;
  /** Pin (or unpin) a report the agent opened, e.g. the P&L Summary. Pinned reports are dashboards with `report`. */
  pinReport: (report: ReportId, pinned: boolean) => void;
  setAutomation: (id: string, a: Automation | undefined) => void;
  /** A restaurant with no reports yet: agents answer "no reports yet", never with another restaurant's figures. */
  sample: boolean;
};

const AgentsContext = createContext<Ctx | null>(null);
export function useAgents() {
  const c = useContext(AgentsContext);
  if (!c) throw new Error("useAgents must be inside <AgentsProvider>");
  return c;
}

let seq = 0;
const id = () => `m${Date.now().toString(36)}${seq++}`;
const STEP_MS = 520;
const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** The owner's words, shown back when they set a schedule. */
/** A restaurant with no reports yet gets this instead of figures: never another restaurant's numbers. */
function noReportsYet(agent: AgentReply["agent"], restaurant: string): AgentReply {
  return {
    agent,
    title: `No ${restaurant} reports yet`,
    lines: [`I answer from ${restaurant}'s own delivery-app reports, and none have come in yet. Once your apps are connected and the KoreFi team has verified them, the first reports usually arrive in 2 to 3 days. I'll post here as soon as they do.`],
    work: ["Checked for your reports"],
  };
}

const where = (a: Automation, title: string, report = false) => [a.email && `email the report to ${user.email}`, a.dashboard && (report ? `refresh the pinned ${title}` : `update the ${title} dashboard`)].filter(Boolean).join(" and ");

/** The chats an account opens on: what its agents posted, or none for a restaurant that just joined or has no agent on yet. */
function seedFor(account: Account) {
  setAccountStores(account.stores);
  if (account.stage === "new" || account.agentsOff) return [];
  if (!account.home) return seedThreads();
  // Taco Pros opens with Recent chats empty: its seeded chats only back the pinned dashboards and agent cards.
  // The Chargebacks chat is where the Chargebacks dashboard was built, so asks there reshape it.
  return seedThreads().map((t) => ({ ...t, hidden: true, unread: false, ...(t.id === "cb" ? { dashboard: "dash-chargebacks" } : {}) }));
}

/** Taco Pros (Account.home) opens with two dashboards already pinned (Daily P&L is not live, so it isn't pinned), each built in one of its seeded chats. */
function seedDashboards(account: Account): Dashboard[] {
  if (!account.home) return [];
  const thu = "Every Thursday, 8:00 AM";
  return [
    { id: "dash-chargebacks", title: "Chargebacks", workflow: "chargebacks", agent: "operations", config: DEFAULT_CONFIG, pinned: true, updated: "Thu 8:00 AM", thread: "cb", automation: { schedule: thu, email: true, dashboard: true } },
    { id: "report-payouts", title: REPORTS.payouts.title, workflow: "payouts", agent: "finance", config: DEFAULT_CONFIG, pinned: true, updated: "Thu 8:00 AM", thread: "payout", report: "payouts", automation: { schedule: thu, email: true, dashboard: true } },
  ];
}

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAccount();
  const sample = account.stage === "new";
  const [threads, setThreads] = useState<Thread[]>(() => seedFor(account));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [canvas, setCanvasState] = useState<CanvasId | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [workflows, setWorkflows] = useState<Record<string, Workflow>>({});
  const [dashboards, setDashboards] = useState<Dashboard[]>(() => seedDashboards(account));
  // Switching restaurant (top-bar AccountSwitcher) starts over on that account's chats and dashboards.
  const [seededFor, setSeededFor] = useState(account.id);
  if (seededFor !== account.id) {
    setSeededFor(account.id);
    setThreads(seedFor(account));
    setActiveId(null);
    setCanvasState(null);
    setExpanded(false);
    setDashboards(seedDashboards(account));
    setWorkflows({});
  }
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const setCanvas = useCallback((r: CanvasId | null) => {
    setCanvasState(r);
    if (!r) setExpanded(false);
  }, []);

  const open = useCallback(
    (tid: string) => {
      setActiveId(tid);
      setThreads((ts) => ts.map((t) => (t.id === tid ? { ...t, unread: false } : t)));
      setCanvas(null);
    },
    [setCanvas],
  );
  const newChat = useCallback(() => {
    setActiveId(null);
    setCanvas(null);
  }, [setCanvas]);

  const patch = (tid: string, f: (m: Message[]) => Message[]) => setThreads((ts) => ts.map((t) => (t.id === tid ? { ...t, messages: f(t.messages) } : t)));

  /** Post the user's message and a pending reply, fill the work log a step at a time, then swap in the answer. */
  const play = useCallback((tid: string | null, q: string, reply: AgentReply, extra?: Partial<Thread>) => {
    const pid = id();
    const pending: Message = { id: pid, role: "agent", pending: true, agent: reply.agent, work: reply.work, done: 0 };
    let target = tid;
    if (!target) {
      target = id();
      const t: Thread = { id: target, title: q.length > 42 ? q.slice(0, 40) + "…" : q, agent: reply.agent, at: "Now", unread: false, messages: [{ id: id(), role: "user", text: q }, pending], ...extra };
      setThreads((ts) => [t, ...ts]);
      setActiveId(target);
      setCanvasState(null);
    } else {
      const t2 = target;
      setThreads((ts) => ts.map((t) => (t.id === t2 ? { ...t, ...extra, hidden: false, messages: [...t.messages, { id: id(), role: "user", text: q }, pending] } : t)));
    }
    const done = target;
    reply.work.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => patch(done, (m) => m.map((x) => (x.id === pid && "pending" in x ? { ...x, done: i + 1 } : x))), STEP_MS * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        patch(done, (m) => m.map((x) => (x.id === pid ? { id: pid, role: "agent", reply, at: now() } : x)));
        if (reply.dashboard) setCanvasState(`dash:${reply.dashboard}`);
        else if (reply.report) setCanvasState(reply.report);
      }, STEP_MS * (reply.work.length + 1)),
    );
  }, []);

  // ── Agents ──

  // An account with no agent turned on (Saffron Grill) sees every preset as Not live until it's run.
  const agentsOff = !!account.agentsOff;
  const getWorkflow = useCallback(
    (wid: string) => {
      if (workflows[wid]) return workflows[wid];
      const w = workflowOf(wid);
      return w && agentsOff && w.kind === "preset" ? { ...w, state: "idle" as const } : w;
    },
    [workflows, agentsOff],
  );

  /** A schedule and delivery set on a dashboard carry over to its agent, and the other way round. */
  const saveWorkflow = useCallback((w: Workflow) => {
    setWorkflows((ws) => ({ ...ws, [w.id]: w }));
    const schedule = w.triggers.find(isSchedule);
    setDashboards((ds) => ds.map((d) => (d.workflow === w.id ? { ...d, automation: schedule && (w.deliver.email || w.deliver.dashboard) ? { schedule, ...w.deliver } : undefined } : d)));
  }, []);

  const created = useMemo(() => Object.values(workflows).filter((w) => w.id.startsWith("new-")), [workflows]);

  const newAgent = useCallback(() => {
    const wid = `new-${Date.now().toString(36)}`;
    setWorkflows((ws) => ({ ...ws, [wid]: blankWorkflow(wid) }));
    return wid;
  }, []);

  const duplicateAgent = useCallback((w: Workflow) => {
    const wid = `new-${Date.now().toString(36)}`;
    const copy: Workflow = { ...structuredClone(w), id: wid, title: `Copy of ${w.title}`, kind: "draft", state: "draft", thread: undefined };
    setWorkflows((ws) => ({ ...ws, [wid]: copy }));
    return wid;
  }, []);

  const runAgent = useCallback(
    (w: Workflow) => {
      // An agent that isn't live yet goes live on its first run.
      if (w.state === "idle") setWorkflows((ws) => ({ ...ws, [w.id]: { ...(ws[w.id] ?? w), state: "live" } }));
      const steps = w.groups.flatMap((g) => g.steps).filter((s) => s.trim());
      const work = (steps.length ? steps : ["Read last week's data"]).slice(0, 6).map((s) => s.replace(/\.$/, ""));
      const agent = w.agent ?? "operations";
      if (sample) {
        const tid = id();
        setThreads((ts) => [{ id: tid, title: `${w.title} · ${now()}`, agent, at: "Now", unread: false, messages: [], workflow: w.id }, ...ts]);
        setActiveId(tid);
        setCanvasState(null);
        play(tid, `Run ${w.title}`, noReportsYet(agent, account.name));
        return;
      }
      let reply: AgentReply;
      let dashId: string | undefined;
      if (w.id === "chargebacks") {
        dashId = `dash-${w.id}`;
        const existing = dashboards.find((d) => d.id === dashId);
        const d: Dashboard = existing ?? { id: dashId, title: "Chargebacks", workflow: w.id, agent, config: DEFAULT_CONFIG, pinned: false, updated: now() };
        const schedule = w.triggers.find(isSchedule);
        const base = chargebackUpdate();
        reply = {
          ...base,
          work,
          report: undefined,
          dashboard: dashId,
          lines: [...base.lines, existing ? "I refreshed your Chargebacks dashboard with this run." : "I built a Chargebacks dashboard from this run. Tell me what to change, and pin it to your sidebar if you want to keep it."],
          followUps: ["Only show DoorDash", "Add why orders get charged back", "Every Thursday at 8 AM, email me this and update the dashboard", "Pin it to my sidebar"],
        };
        const next = { ...d, updated: now(), automation: d.automation ?? (schedule && w.deliver.dashboard ? { schedule, ...w.deliver } : undefined) };
        setDashboards((ds) => (existing ? ds.map((x) => (x.id === dashId ? next : x)) : [...ds, next]));
      } else if (w.id === "payouts") {
        reply = { ...payoutCheck(), work };
      } else if (w.id === "channel-pnl") {
        reply = { ...weeklyPnl(), work };
      } else {
        reply = {
          agent,
          title: `${w.title} ran on last week's data`,
          lines: [steps.length ? `I followed its ${steps.length} steps. Nothing needs your attention, and I'll post here when a run finds something.` : "It has no steps yet, so I only read last week's data. Add steps in the editor and run it again."],
          work,
          followUps: ["How did we do last week?"],
        };
      }
      const tid = id();
      // play() needs the thread to exist with its link to the dashboard, so create it here.
      setThreads((ts) => [{ id: tid, title: `${w.title} · ${now()}`, agent, at: "Now", unread: false, messages: [], workflow: w.id, dashboard: dashId }, ...ts]);
      setActiveId(tid);
      setCanvasState(null);
      if (dashId) setDashboards((ds) => ds.map((x) => (x.id === dashId ? { ...x, thread: tid } : x)));
      play(tid, `Run ${w.title}`, reply);
    },
    [dashboards, play, sample, account.name],
  );

  const runChats = useRef<Record<string, string>>({});
  const openRun = useCallback(
    (run: { id: string; thread?: string; week: string; reply: AgentReply }, w: Workflow) => {
      const known = run.thread ?? runChats.current[run.id];
      if (known && threads.some((t) => t.id === known)) return open(known);
      const tid = id();
      runChats.current[run.id] = tid;
      setThreads((ts) => [{ id: tid, title: `${w.title} · ${run.week}`, agent: run.reply.agent, at: run.week, unread: false, workflow: w.id, messages: [{ id: id(), role: "agent", reply: run.reply, at: run.week }] }, ...ts]);
      setActiveId(tid);
      setCanvas(null);
    },
    [threads, open, setCanvas],
  );

  // ── Dashboards ──

  const pinDashboard = useCallback((did: string, pinned: boolean) => setDashboards((ds) => ds.map((d) => (d.id === did ? { ...d, pinned } : d))), []);

  const openDashboard = useCallback(
    (did: string) => {
      const d = dashboards.find((x) => x.id === did);
      if (!d?.thread || !threads.some((t) => t.id === d.thread)) return false;
      open(d.thread);
      setCanvasState(d.report ?? `dash:${d.id}`);
      return true;
    },
    [dashboards, threads, open],
  );

  /** The agent each report belongs to, and the agent workflow that fills it (if any). */
  const reportDash = useCallback(
    (report: ReportId, thread?: string): Dashboard => ({
      id: `report-${report}`,
      title: REPORTS[report].title,
      workflow: report === "payouts" ? "payouts" : report === "pnl" ? "channel-pnl" : "",
      agent: report === "chargebacks" ? "operations" : "finance",
      config: DEFAULT_CONFIG,
      pinned: false,
      updated: now(),
      thread,
      report,
    }),
    [],
  );

  const pinReport = useCallback(
    (report: ReportId, pinned: boolean) =>
      setDashboards((ds) => {
        const did = `report-${report}`;
        if (ds.some((d) => d.id === did)) return ds.map((d) => (d.id === did ? { ...d, pinned, thread: d.thread ?? activeId ?? undefined } : d));
        return [...ds, { ...reportDash(report, activeId ?? undefined), pinned }];
      }),
    [activeId, reportDash],
  );

  const setAutomation = useCallback(
    (did: string, a: Automation | undefined) => {
      const d = dashboards.find((x) => x.id === did);
      setDashboards((ds) => {
        const list = ds.some((x) => x.id === did) || !did.startsWith("report-") ? ds : [...ds, reportDash(did.slice(7) as ReportId, activeId ?? undefined)];
        return list.map((x) => (x.id === did ? { ...x, automation: a, pinned: a?.dashboard ? true : x.pinned } : x));
      });
      if (!d) return;
      const w = workflows[d.workflow] ?? workflowOf(d.workflow);
      if (!w) return;
      const triggers = a ? [a.schedule, ...w.triggers.filter((t) => !isSchedule(t))] : w.triggers.filter((t) => !isSchedule(t));
      setWorkflows((ws) => ({ ...ws, [w.id]: { ...w, triggers, deliver: a ? { email: a.email, dashboard: a.dashboard } : w.deliver } }));
    },
    [dashboards, workflows, reportDash, activeId],
  );

  // ── Chat ──

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      const thread = threads.find((t) => t.id === activeId);

      // No reports yet: say so. Never answer with another restaurant's numbers.
      if (sample) {
        play(activeId, q, noReportsYet(thread ? agentOf(thread.agent).id : answer(q).agent, account.name));
        return;
      }

      // In a chat that built a dashboard, a request about the dashboard reshapes it.
      const dash = thread?.dashboard ? dashboards.find((d) => d.id === thread.dashboard) : undefined;
      const c = dash ? customize(q, dash) : null;
      if (dash && c) {
        const title = c.title ?? dash.title;
        setDashboards((ds) => ds.map((d) => (d.id === dash.id ? { ...d, config: c.config, title, pinned: c.pin ?? d.pinned, updated: now() } : d)));
        if (c.automation) setAutomation(dash.id, c.automation);
        const lines = c.automation
          ? [`Every run I'll ${where(c.automation, title)}.${c.automation.dashboard ? " It's pinned to your sidebar." : ""} You can change this in the agent's Triggers.`]
          : [`Now showing ${scopeLabel(c.config).toLowerCase()}.${c.pin ? " It's in your sidebar under Dashboards." : ""}`];
        play(activeId, q, {
          agent: dash.agent,
          title: c.automation ? `Done. ${c.automation.schedule}` : c.changes.length === 1 ? c.changes[0] : "Dashboard updated",
          lines,
          work: c.automation ? ["Set the schedule on Chargeback recovery", "Turned on email and dashboard updates"] : ["Rebuilt the dashboard"],
          dashboard: dash.id,
          automation: c.automation,
          followUps: c.automation ? ["Add the latest chargebacks", "Top 10 outlets"] : dash.pinned || c.pin ? ["Every Thursday at 8 AM, email me this and update the dashboard"] : ["Pin it to my sidebar"],
        });
        return;
      }

      // In a chat with a report (P&L Summary…), "pin it" pins it and "every Monday at 8 AM email me" schedules it.
      const lastReport = thread && [...thread.messages].reverse().find((m) => m.role === "agent" && "reply" in m && m.reply.report);
      const report = lastReport && "reply" in lastReport ? lastReport.reply.report : undefined;
      if (report) {
        const did = `report-${report}`;
        const existing = dashboards.find((d) => d.id === did);
        const title = REPORTS[report].title;
        const schedule = parseSchedule(q);
        const pinAsk = /\bunpin\b/i.test(q) ? false : /\bpin\b|sidebar/i.test(q) ? true : undefined;
        if (schedule || pinAsk !== undefined) {
          const agent = existing?.agent ?? agentOf(thread!.agent).id;
          if (schedule) {
            let email = /e-?mail|mail|inbox/i.test(q);
            let dashboard = /dashboard|update|refresh|pin|sidebar/i.test(q);
            if (!email && !dashboard) email = dashboard = true;
            const a: Automation = { schedule, email, dashboard };
            setAutomation(did, a);
            play(activeId, q, { agent, title: `Done. ${schedule}`, lines: [`Every run I'll ${where(a, title, true)}.${a.dashboard ? " It's pinned to your sidebar." : ""}`], work: [`Scheduled the ${title}`], report, automation: a });
          } else {
            pinReport(report, pinAsk!);
            play(activeId, q, { agent, title: pinAsk ? `${title} pinned to your sidebar` : `${title} unpinned`, lines: [pinAsk ? "It's under Dashboards in the sidebar and opens full page. Want it on a schedule too?" : "It's off your sidebar. Ask me to pin it again any time."], work: ["Updated your sidebar"], report, followUps: pinAsk ? ["Every Monday at 8 AM, email me this and update it"] : undefined });
          }
          return;
        }
      }

      // "Run Chargeback recovery" from any chat runs that agent.
      if (/^(run|start)\b/i.test(q)) {
        const name = q.replace(/^(run|start)\s+(the\s+)?/i, "").toLowerCase();
        const skill = name && FOLDERS.flatMap((f) => f.skills).find((s) => (name.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(name.replace(/ agent$/, ""))));
        const w = skill && getWorkflow(skill.id);
        if (w) return runAgent(w);
      }

      play(activeId, q, answer(q));
    },
    [activeId, threads, dashboards, play, setAutomation, getWorkflow, runAgent, pinReport, sample, account.name],
  );

  const ask = useCallback(
    (question: string) => {
      const asked = threads.find((t) => t.messages[0]?.role === "user" && t.messages[0].text === question);
      if (asked) return open(asked.id);
      play(null, question, answer(question));
    },
    [threads, open, play],
  );

  const active = threads.find((t) => t.id === activeId) ?? null;
  const busy = !!active?.messages.some((m) => "pending" in m);
  const value = useMemo<Ctx>(
    () => ({ threads, active, open, newChat, send, ask, busy, canvas, setCanvas, expanded, setExpanded, getWorkflow, saveWorkflow, created, newAgent, duplicateAgent, runAgent, openRun, dashboards, pinDashboard, openDashboard, pinReport, setAutomation, sample }),
    [threads, active, open, newChat, send, ask, busy, canvas, setCanvas, expanded, getWorkflow, saveWorkflow, created, newAgent, duplicateAgent, runAgent, openRun, dashboards, pinDashboard, openDashboard, pinReport, setAutomation, sample],
  );
  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}
