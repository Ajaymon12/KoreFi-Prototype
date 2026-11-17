"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Clock,
  Download,
  GitCompareArrows,
  Landmark,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Package,
  Play,
  Copy,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  Undo2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/dashboard/primitives";
import { Section } from "@/components/mvp2/parts";
import { AppLogo } from "@/components/onboarding/marks";
import { user } from "@/lib/mockData";
import { ALL_INTEGRATIONS, isSchedule, type Workflow } from "@/lib/mvp3/workflows";
import { parseSchedule } from "@/lib/mvp3/dashboards";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";

// Opens from an agent's overview (Edit) or a draft. Laid out like Copilot's Agent Builder:
//  - left, on white: the chat. It's the only way to change the agent ("Run every Monday at 8 AM and email me",
//    "Remove step 2", "Also read QuickBooks", "Rename it to …"). Every change saves straight away, the changed
//    part of the page flashes, and the reply offers Undo. A vague message gets examples instead of a guess.
//  - right, on the page grey: a read-only preview in the Foundation system: header (avatar, name, status, Run),
//    How it runs, Overview, Steps, Inputs and Setup (when it runs, what it reads, where results go).
// No Test or Save: changes apply from the next run. Drafts still get Publish.
// Edits are kept in AgentsProvider, so a schedule set in the main chat shows up here and the other way round.
// Brand orange only (module tokens); icons sit on neutral tiles. Workflows only read, match and report.

/** A neutral icon tile. */
const tile = "grid shrink-0 place-items-center rounded-medium bg-(--color-neutral-lightest) text-(--color-text-secondary)";

/** A stage's icon and kind of action, from the verb its name starts with. */
function stageKind(title: string): { Icon: LucideIcon; action: string } {
  const t = title.toLowerCase();
  if (/^(read|load|pull|get)/.test(t)) return { Icon: Download, action: "Read data" };
  if (/^(match|compare|reconcile)/.test(t)) return { Icon: GitCompareArrows, action: "Match records" };
  if (/^(score|rank|group|work out|outline)/.test(t)) return { Icon: BarChart3, action: "Calculate" };
  if (/^(report|email|send|notify)/.test(t)) return { Icon: Mail, action: "Send a summary" };
  if (/^(check|verify|flag)/.test(t)) return { Icon: ShieldCheck, action: "Check" };
  return { Icon: Sparkles, action: "Think it through" };
}

const triggerIcon = (t: string): LucideIcon => (t.startsWith("When") ? Zap : /Daily|Every (Mon|Tue|Wed|Thu|Fri)/.test(t) ? Clock : CalendarClock);

/** Integrations a step's wording names ("Square" is the POS). */
const usedBy = (step: string, list: string[]) => list.filter((a) => step.includes(a) || (a === "POS" && /Square|POS/.test(step)));

/** The integration's mark: real logos for the delivery apps, a small tile for the rest. */
export function IntegrationMark({ name, size = 16 }: { name: string; size?: number }) {
  const app = ({ DoorDash: "doordash", "Uber Eats": "ubereats", Grubhub: "grubhub" } as const)[name as "DoorDash"];
  if (app) return <AppLogo app={app} size={size} />;
  const Icon = name === "Payroll" ? Users : name.startsWith("Inventory") ? Package : name === "QuickBooks" ? BookOpen : name === "Bank account" ? Landmark : null;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-small bg-(--gray-1200) text-white [&_svg]:size-[65%]" style={{ width: size, height: size }}>
      {Icon ? <Icon /> : <span className="text-[9px] leading-none font-semibold">■</span>}
    </span>
  );
}

/** An agent message can carry the version before its change, so the owner can undo it. */
type Chat = { who: "you" | "agent"; text: string; undo?: Workflow };
type Area = "name" | "overview" | "steps" | "inputs" | "setup";

export function WorkflowEditor({ id }: { id: string }) {
  const { getWorkflow } = useAgents();
  const base = getWorkflow(id);
  if (!base) return <p className="p-6 text-body-md text-(--color-text-secondary)">That agent doesn’t exist.</p>;
  return <Editor key={id} base={base} />;
}

// ───────── How it runs ─────────

function FlowNode({ icon, kicker, label, onClick }: { icon: React.ReactNode; kicker: string; label: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex min-w-0 max-w-[220px] items-center gap-2.5 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) py-2 pr-3 pl-2 text-left",
        onClick && "outline-none transition-colors hover:border-(--color-border-darker) hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-body-sm text-(--color-text-secondary)">{kicker}</span>
        <span className="block text-body-sm font-medium text-(--color-text-primary)">{label}</span>
      </span>
    </Tag>
  );
}

const Arrow = () => <ChevronRight aria-hidden className="size-4 shrink-0 text-(--color-text-tertiary)" />;

function Flow({ w, onStage }: { w: Workflow; onStage: (i: number) => void }) {
  const icon = (Icon: LucideIcon) => (
    <span className={cn(tile, "size-8 [&_svg]:size-4")}>
      <Icon aria-hidden />
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-5 pb-5">
      <FlowNode icon={icon(w.triggers.length ? triggerIcon(w.triggers[0]) : Zap)} kicker="When" label={w.triggers[0] ?? "When you ask"} />
      <Arrow />
      <FlowNode
        icon={
          w.integrations.length ? (
            <span className="flex h-8 shrink-0 items-center gap-1">
              {w.integrations.slice(0, 3).map((a) => (
                <span key={a} className="flex">
                  <IntegrationMark name={a} size={18} />
                </span>
              ))}
            </span>
          ) : (
            icon(Download)
          )
        }
        kicker="Reads"
        label={w.integrations.length ? w.integrations.join(", ") : "Nothing yet"}
      />
      {w.groups.map((g, i) => (
        <span key={i} className="contents">
          <Arrow />
          <FlowNode icon={icon(stageKind(g.title).Icon)} kicker={`Stage ${i + 1}`} label={g.title || "Untitled"} onClick={() => onStage(i)} />
        </span>
      ))}
      <Arrow />
      <FlowNode icon={icon(w.deliver.dashboard ? LayoutDashboard : Mail)} kicker="Sends" label={["Chat", w.deliver.email && "email", w.deliver.dashboard && "dashboard"].filter(Boolean).join(", ")} />
    </div>
  );
}

// ───────── Editor ─────────

// ───────── What a chat message asks for ─────────

type Change = { next: Workflow; reply: string; areas: Area[] };

const stepsOf = (w: Workflow) => w.groups.flatMap((g, gi) => g.steps.map((text, i) => ({ gi, i, text })));
const mapSteps = (w: Workflow, f: (steps: { gi: number; i: number; text: string }[]) => { gi: number; i: number; text: string }[]): Workflow => {
  const flat = f(stepsOf(w));
  return { ...w, groups: w.groups.map((g, gi) => ({ ...g, steps: flat.filter((x) => x.gi === gi).map((x) => x.text) })) };
};
const named = (s: string) => ALL_INTEGRATIONS.filter((a) => s.includes(a.toLowerCase()) || (a === "POS" && /\b(square|pos)\b/.test(s)) || (a === "Bank account" && /\bbank\b/.test(s)) || (a === "Inventory and supplier bills" && /inventory|supplier/.test(s)));
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const NO = /\b(stop|don'?t|do not|no longer|turn off|switch off|without|remove|disable|no)\b/;
/** A message that reads like an instruction for the agent ("Compare with last week"), so it can become a step. */
const STEP_VERB = /^(also |then |and )?(check|compare|read|load|pull|match|flag|find|look|calculate|work out|group|rank|score|sum|count|include|ignore|exclude|skip|highlight|show|list|email|send|summari[sz]e|note|split|break)/;

function interpret(text: string, w: Workflow): Change | null {
  const t = text.trim().replace(/[.!]+$/, "");
  const s = t.toLowerCase();
  const n = stepsOf(w).length;

  // Rename: "rename it to Weekly promo check", "call it …"
  const rn = t.match(/^(?:please\s+)?(?:rename(?: it| this| the agent)?(?: to)?|call it|name it)\s+["“']?(.+?)["”']?$/i);
  if (rn) return { next: { ...w, title: rn[1] }, reply: `Renamed to ${rn[1]}.`, areas: ["name"] };

  // Overview: "change the overview to …"
  const ov = t.match(/(?:overview|description)\s*(?:to|:)\s*(.+)$/i);
  if (ov) return { next: { ...w, overview: ov[1] }, reply: "I rewrote the overview.", areas: ["overview"] };

  // Steps by number: remove / move / reword.
  const last = /\b(last|final) step\b/.test(s) ? n : null;
  const num = Number(s.match(/\bstep\s*(\d+)/)?.[1] ?? last ?? 0);
  if (num && (num < 1 || num > n)) return { next: w, reply: `There's no step ${num}. This agent has ${n} ${n === 1 ? "step" : "steps"}.`, areas: [] };
  if (num && /\b(remove|delete|drop|get rid of)\b/.test(s)) {
    const gone = stepsOf(w)[num - 1].text;
    return { next: mapSteps(w, (xs) => xs.filter((_, k) => k !== num - 1)), reply: `Removed step ${num}: “${gone}”`, areas: ["steps"] };
  }
  if (num && /\bmove\b/.test(s)) {
    const to = /\b(top|first)\b/.test(s) ? 1 : /\b(bottom|end)\b/.test(s) ? n : /\bup\b/.test(s) ? num - 1 : /\bdown\b/.test(s) ? num + 1 : Number(s.match(/\bto\s*(?:step\s*)?(\d+)/)?.[1] ?? 0);
    if (!to || to < 1 || to > n || to === num) return { next: w, reply: `Where should step ${num} go? Say “move step ${num} up”, “down” or “to the top”.`, areas: [] };
    return {
      next: mapSteps(w, (xs) => {
        const ys = [...xs];
        const texts = ys.map((x) => x.text);
        const [m] = texts.splice(num - 1, 1);
        texts.splice(to - 1, 0, m);
        return ys.map((x, k) => ({ ...x, text: texts[k] }));
      }),
      reply: `Moved step ${num} to position ${to}.`,
      areas: ["steps"],
    };
  }
  const rw = t.match(/step\s*(\d+)\s*(?:to|say|should say|:)\s*(.+)$/i);
  if (num && rw) return { next: mapSteps(w, (xs) => xs.map((x, k) => (k === num - 1 ? { ...x, text: rw[2] } : x))), reply: `Step ${num} now reads “${rw[2]}”.`, areas: ["steps"] };

  // Schedule: "every Thursday at 8 AM, email me and update the dashboard".
  const schedule = parseSchedule(s);
  if (schedule) {
    const email = /e-?mail|mail|inbox/.test(s);
    const dashboard = /dashboard/.test(s);
    const deliver = { email: email || w.deliver.email, dashboard: dashboard || w.deliver.dashboard };
    const to = [deliver.email && `email you at ${user.email}`, deliver.dashboard && "update its dashboard"].filter(Boolean).join(" and ");
    return { next: { ...w, triggers: [schedule, ...w.triggers.filter((y) => !isSchedule(y))], deliver }, reply: `It now runs ${schedule.replace(/^Every/, "every").replace(/^Daily/, "daily").replace(/^Monthly/, "monthly")}${to ? `, then I'll ${to}` : ""}.`, areas: ["setup"] };
  }
  if (/\b(only when i ask|manual(ly)?|no schedule)\b/.test(s) || (NO.test(s) && /\b(schedule|trigger|running automatically)\b/.test(s)))
    return { next: { ...w, triggers: [] }, reply: "It no longer runs on its own. It runs when you ask.", areas: ["setup"] };

  // Where results go.
  if (/e-?mail/.test(s) && !named(s).length) {
    const on = !NO.test(s);
    return { next: { ...w, deliver: { ...w.deliver, email: on } }, reply: on ? `Each run now emails you at ${user.email}.` : "It won't email you any more. Results still come to a chat.", areas: ["setup"] };
  }
  if (/dashboard/.test(s)) {
    const on = !NO.test(s);
    return { next: { ...w, deliver: { ...w.deliver, dashboard: on } }, reply: on ? "Each run now updates its dashboard." : "It won't update a dashboard any more.", areas: ["setup"] };
  }

  // Integrations: "also read QuickBooks", "stop using payroll".
  const apps = named(s);
  if (apps.length) {
    if (NO.test(s)) {
      const off = apps.filter((a) => w.integrations.includes(a));
      if (!off.length) return { next: w, reply: `It doesn't read ${list(apps)} already.`, areas: [] };
      return { next: { ...w, integrations: w.integrations.filter((a) => !off.includes(a)) }, reply: `It no longer reads ${list(off)}.`, areas: ["setup"] };
    }
    // Only the app's name plus filler ("also read QuickBooks", "use payroll data") turns it on; a longer
    // instruction ("compare QuickBooks deposits with payouts") becomes a step below.
    const residue = apps.reduce((x, app) => x.replace(app.toLowerCase(), ""), s).replace(/\b(please|also|and|add|use|connect|include|read|reading|turn on|with|pull|from|in|its|the|data|too|as well|square|pos|bank|inventory|supplier|bills|account|integration)\b/g, "").replace(/[^a-z]/g, "");
    if (!residue) {
      const on = apps.filter((a) => !w.integrations.includes(a));
      if (!on.length) return { next: w, reply: `It already reads ${list(apps)}.`, areas: [] };
      return { next: { ...w, integrations: [...w.integrations, ...on] }, reply: `It now reads ${list(on)}, read-only.`, areas: ["setup"] };
    }
  }

  // A new step: "add a step: compare with last week", or an instruction like "Flag promos under 2x return".
  const add = t.match(/^(?:please\s+)?(?:add|new)\s+(?:a\s+)?step\s*(?:to|that|:|-)?\s*(.+)$/i);
  const stepText = add?.[1] ?? (STEP_VERB.test(s) ? t.replace(/^(also|then|and)\s+/i, "") : null);
  if (stepText) {
    const clean = stepText.charAt(0).toUpperCase() + stepText.slice(1) + (/[.?]$/.test(stepText) ? "" : ".");
    const next = w.groups.length ? { ...w, groups: w.groups.map((g, gi) => (gi === w.groups.length - 1 ? { ...g, steps: [...g.steps, clean] } : g)) } : { ...w, groups: [{ title: "Steps", steps: [clean] }] };
    return { next, reply: `Added step ${n + 1}: “${clean}”`, areas: ["steps"] };
  }
  return null;
}

/** Examples that fit this agent, shown under the greeting and after a message I couldn't act on. */
function examples(w: Workflow) {
  const n = stepsOf(w).length;
  const spare = ALL_INTEGRATIONS.find((a) => !w.integrations.includes(a));
  return [
    w.triggers.some(isSchedule) ? "Run every Monday at 8 AM" : "Run every Monday at 8 AM and email me",
    spare ? `Also read ${spare}` : null,
    n > 1 ? `Remove step ${n}` : null,
    "Add a step: compare with the week before",
  ].filter(Boolean) as string[];
}

// ───────── Editor ─────────

function Editor({ base }: { base: Workflow }) {
  const router = useRouter();
  const { open, saveWorkflow, runAgent, duplicateAgent, dashboards } = useAgents();
  const [w, setW] = useState(base);
  const dash = dashboards.find((d) => d.workflow === w.id);
  const [toast, setToast] = useState<string | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [chat, setChat] = useState<Chat[]>([]);
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState<Area[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const log = useRef<HTMLUListElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [chat]);
  useEffect(() => {
    if (!flash.length) return;
    const tm = window.setTimeout(() => setFlash([]), 1600);
    return () => window.clearTimeout(tm);
  }, [flash]);

  /** Apply a version: show it, save it (presets save at once; drafts wait for Publish), flash what changed. */
  const apply = (next: Workflow, areas: Area[]) => {
    setW(next);
    if (next.kind !== "draft") saveWorkflow(next);
    setSaved(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    setFlash(areas);
    if (areas[0]) document.getElementById(`area-${areas[0]}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setDraft("");
    const c = interpret(t, w);
    if (!c) {
      setChat((m) => [...m, { who: "you", text: t }, { who: "agent", text: "I'm not sure what to change. Tell me what the agent should do differently, for example:" }]);
      return;
    }
    const changed = c.areas.length > 0;
    if (changed) apply(c.next, c.areas);
    setChat((m) => [...m, { who: "you", text: t }, { who: "agent", text: changed ? `${c.reply}${w.kind === "draft" ? " Publish when you're happy." : " Saved, it applies from the next run."}` : c.reply, undo: changed ? w : undefined }]);
  };

  const undo = (k: number, prev: Workflow) => {
    apply(prev, ["name", "overview", "steps", "inputs", "setup"].filter((a) => JSON.stringify(pickArea(prev, a as Area)) !== JSON.stringify(pickArea(w, a as Area))) as Area[]);
    setChat((m) => [...m.map((x, j) => (j === k ? { ...x, undo: undefined } : x)), { who: "agent", text: "Undone. It's back to how it was." }]);
  };

  const publish = () => {
    const next = { ...w, kind: "preset" as const };
    saveWorkflow(w);
    setW(next);
    setToast("Published. It runs from its next trigger.");
  };
  const run = () => {
    saveWorkflow(w);
    runAgent(w);
    router.push("/mvp3");
  };

  const status: { label: string; tone: "success" | "info" | "neutral" } = w.kind === "draft" ? { label: "Draft", tone: "info" } : w.state === "live" ? { label: "Live", tone: "success" } : { label: w.state === "learning" ? "Learning" : "Coming soon", tone: "neutral" };
  const flat = stepsOf(w);
  const area = (a: Area) => cn("rounded-large transition-[box-shadow] duration-500", flash.includes(a) && "shadow-[0_0_0_2px_var(--color-primary),0_0_0_6px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]");
  const ex = examples(w);
  const fresh = chat.length === 0;

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(draft);
      }}
      className="flex items-end gap-2 rounded-xlarge border border-(--color-border-darker) bg-(--color-background-secondary) p-2 pl-4 shadow-[0_2px_10px_rgb(0_0_0/0.06)] transition-[border-color,box-shadow] focus-within:border-(--color-focus-primary) focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-primary)_18%,transparent)]"
    >
      <textarea
        ref={box}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(draft))}
        rows={fresh ? 3 : 2}
        placeholder={`Tell ${w.title} what to change…`}
        aria-label="Tell the agent what to change"
        className="block min-w-0 flex-1 resize-none bg-transparent py-1.5 text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary)"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!draft.trim()}
        className="grid size-9 shrink-0 place-items-center rounded-circle bg-(--color-primary-solid) text-white outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary) disabled:bg-(--color-neutral-light) disabled:text-(--color-text-tertiary)"
      >
        <ArrowUp className="size-4" />
      </button>
    </form>
  );
  const chips = (
    <div className="flex flex-wrap gap-2">
      {ex.map((x) => (
        <button key={x} type="button" onClick={() => send(x)} className="rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3 py-1.5 text-left text-body-sm text-(--color-text-primary) outline-none transition-colors hover:border-(--color-border-darker) hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          {x}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col-reverse overflow-y-auto bg-(--color-background-primary) lg:flex-row lg:overflow-hidden">
      {/* ── chat: the only way to edit ── */}
      <aside aria-label="Edit with chat" className="flex min-h-[480px] shrink-0 flex-col border-t border-(--color-border-default) bg-(--color-background-secondary) lg:min-h-0 lg:w-[400px] lg:border-t-0 lg:border-r">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--color-border-default) px-3">
          <button type="button" aria-label="Back" title="Back" onClick={() => router.back()} className="grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            <ArrowLeft className="size-4" />
          </button>
          <span className="min-w-0 flex-1 truncate text-body-md font-medium text-(--color-text-primary)">Edit {w.title}</span>
        </header>

        {fresh ? (
          <div className="flex flex-1 flex-col justify-center gap-5 px-6 py-8">
            <div className="space-y-2">
              {w.agent && <AgentAvatar agent={w.agent} size={40} />}
              <h2 className="text-subtitle-lg text-(--color-text-primary)">How would you like to change {w.title}?</h2>
              <p className="text-body-md text-(--color-text-secondary)">Tell me in your own words. I&apos;ll update it on the right and save as I go.</p>
            </div>
            {composer}
            {chips}
          </div>
        ) : (
          <>
            <ul ref={log} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {chat.map((m, k) =>
                m.who === "you" ? (
                  <li key={k} className="ml-auto w-fit max-w-[85%] rounded-large bg-(--color-neutral-light) px-3 py-2 text-body-md text-(--color-text-primary)">
                    {m.text}
                  </li>
                ) : (
                  <li key={k} className="flex gap-2.5">
                    {w.agent && <AgentAvatar agent={w.agent} size={22} className="mt-0.5 shrink-0" />}
                    <div className="min-w-0 space-y-2">
                      <p className="text-body-md text-(--color-text-primary)">{m.text}</p>
                      {m.undo && (
                        <button type="button" onClick={() => undo(k, m.undo!)} className="inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) hover:underline">
                          <Undo2 className="size-3.5" aria-hidden /> Undo
                        </button>
                      )}
                      {m.text.endsWith("for example:") && k === chat.length - 1 && chips}
                    </div>
                  </li>
                ),
              )}
            </ul>
            <div className="shrink-0 space-y-2 p-3 pt-0">{composer}</div>
          </>
        )}
      </aside>

      {/* ── preview: read-only, updates as the chat changes it ── */}
      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[880px] space-y-4 px-4 py-6 sm:px-6">
          <header id="area-name" className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 p-1", area("name"))}>
            {w.agent && <AgentAvatar agent={w.agent} size={44} />}
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-subtitle-lg text-(--color-text-primary)">{w.title}</h1>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </div>
              <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{w.kind === "draft" ? (saved ? `Draft updated ${saved}` : "Not published yet") : saved ? `Saved ${saved}` : "Change it from the chat"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="small" iconLeft={<Copy />} onClick={() => router.push(`/mvp3/agent?id=${duplicateAgent(w)}`)}>
                Duplicate
              </Button>
              {w.kind === "draft" && (
                <Button size="small" iconLeft={<Rocket />} onClick={publish}>
                  Publish
                </Button>
              )}
              <Button size="small" type="primary" iconLeft={<Play />} onClick={run}>
                Run
              </Button>
            </div>
          </header>

          <Section title="How it runs" sub={`${w.groups.length} ${w.groups.length === 1 ? "stage" : "stages"} · ${flat.length} ${flat.length === 1 ? "step" : "steps"}`}>
            <Flow w={w} onStage={(i) => document.getElementById(`stage-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          </Section>

          <div id="area-overview" className={area("overview")}>
            <Section title="Overview">
              <p className="px-5 pb-5 text-body-md leading-relaxed text-(--color-text-primary)">{w.overview || <span className="text-(--color-text-tertiary)">No overview yet.</span>}</p>
            </Section>
          </div>

          <div id="area-steps" className={area("steps")}>
            <Section title="Steps" sub="Numbered, so you can say “remove step 2” or “move step 3 up”.">
              <div className="px-5 pb-5">
                {w.groups.length === 0 && <p className="text-body-md text-(--color-text-secondary)">No steps yet. Tell me what the agent should do.</p>}
                <ol>
                  {w.groups.map((g, gi) => {
                    const n = w.groups.slice(0, gi).reduce((a, x) => a + x.steps.length, 0);
                    const { Icon, action } = stageKind(g.title);
                    return (
                      <li key={gi} id={`stage-${gi}`} className="relative flex scroll-mt-6 gap-3 pb-5 last:pb-0">
                        {gi < w.groups.length - 1 && <span aria-hidden className="absolute top-9 bottom-0 left-[15px] w-px bg-(--color-border-default)" />}
                        <span className={cn(tile, "relative z-10 size-8 border border-(--color-border-default) bg-(--color-background-secondary) [&_svg]:size-4")}>
                          <Icon aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-h-8 flex-wrap items-center gap-x-2">
                            <h3 className="text-body-md font-medium text-(--color-text-primary)">{g.title || "Untitled"}</h3>
                            <span className="text-body-sm text-(--color-text-secondary)">{action}</span>
                          </div>
                          <ol className="mt-1 space-y-2">
                            {g.steps.map((st, i) => {
                              const uses = usedBy(st, w.integrations);
                              return (
                                <li key={i} className="flex items-start gap-2.5">
                                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-circle border border-(--color-border-default) text-[11px] font-medium text-(--color-text-secondary) tabular-nums">{n + i + 1}</span>
                                  <p className="min-w-0 flex-1 text-body-md text-(--color-text-primary)">
                                    {st || <span className="text-(--color-text-tertiary)">Empty step</span>}
                                    {uses.length > 0 && (
                                      <span className="ml-2 inline-flex translate-y-0.5 gap-1 align-baseline">
                                        {uses.map((a) => (
                                          <span key={a} title={a} className="inline-flex">
                                            <IntegrationMark name={a} size={14} />
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </p>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </Section>
          </div>

          {w.inputs.length > 0 && (
            <div id="area-inputs" className={area("inputs")}>
              <Section title="Inputs" sub="Settings the agent reads each run.">
                <div className="overflow-x-auto border-t border-(--color-border-default)">
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="text-body-sm text-(--color-text-secondary)">
                      <tr className="border-b border-(--color-border-default)">
                        <th className="w-[30%] px-5 py-2.5 font-normal">Name</th>
                        <th className="w-[14%] px-3 py-2.5 font-normal">Type</th>
                        <th className="px-3 py-2.5 font-normal">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--color-border-default) text-body-md">
                      {w.inputs.map((r, i) => (
                        <tr key={i} className="align-top">
                          <td className="px-5 py-3 font-medium text-(--color-text-primary)">{r.name}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-small bg-(--color-neutral-lightest) px-2 py-0.5 text-body-sm text-(--color-text-secondary)">{r.type}</span>
                          </td>
                          <td className="px-3 py-3 text-(--color-text-secondary)">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

          <div id="area-setup" className={area("setup")}>
            <Section title="Setup" sub="When it runs, what it reads and where results go.">
              <dl className="divide-y divide-(--color-border-default) border-t border-(--color-border-default)">
                {[
                  { Icon: w.triggers[0] ? triggerIcon(w.triggers[0]) : Zap, label: "Runs", value: w.triggers.length ? w.triggers.join(" · ") : "When you ask" },
                  {
                    Icon: Plug,
                    label: "Reads",
                    value: w.integrations.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {w.integrations.map((a) => (
                          <span key={a} className="inline-flex items-center gap-1.5 rounded-circle border border-(--color-border-default) py-0.5 pr-2.5 pl-1">
                            <IntegrationMark name={a} size={16} />
                            {a}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "Nothing yet"
                    ),
                  },
                  { Icon: MessageSquare, label: "Sends to", value: list(["A chat", w.deliver.email && `an email to ${user.email}`, w.deliver.dashboard && (dash ? `the ${dash.title} dashboard` : "a dashboard")].filter(Boolean) as string[]) },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 px-5 py-3">
                    <span className={cn(tile, "size-8 [&_svg]:size-4")}>
                      <Icon aria-hidden />
                    </span>
                    <dt className="w-20 shrink-0 pt-1.5 text-body-sm text-(--color-text-secondary)">{label}</dt>
                    <dd className="min-w-0 flex-1 pt-1 text-body-md text-(--color-text-primary)">{value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>

          {(dash?.pinned || w.thread) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
              {dash?.pinned && (
                <button type="button" onClick={() => router.push(`/mvp3/dashboard?id=${dash.id}`)} className="text-body-sm text-(--color-text-clickable) hover:underline">
                  Open the {dash.title} dashboard
                </button>
              )}
              {w.thread && (
                <button
                  type="button"
                  onClick={() => {
                    open(w.thread!);
                    router.push("/mvp3");
                  }}
                  className="text-body-sm text-(--color-text-clickable) hover:underline"
                >
                  Open the latest report
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}

/** The part of a workflow each page area shows, to flash only what an undo changed. */
function pickArea(w: Workflow, a: Area) {
  return a === "name" ? w.title : a === "overview" ? w.overview : a === "steps" ? w.groups : a === "inputs" ? w.inputs : [w.triggers, w.integrations, w.deliver];
}
