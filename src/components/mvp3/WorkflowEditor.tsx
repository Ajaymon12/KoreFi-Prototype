"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  BookOpen,
  Download,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  GitCompareArrows,
  Mail,
  Map as MapIcon,
  MessageSquare,
  MousePointerClick,
  Package,
  Paperclip,
  Play,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { AppLogo } from "@/components/onboarding/marks";
import { user } from "@/lib/mockData";
import { ALL_INTEGRATIONS, TRIGGER_CHOICES, isSchedule, type InputType, type Workflow } from "@/lib/mvp3/workflows";
import { parseSchedule } from "@/lib/mvp3/dashboards";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";

// Opens when an agent (or a draft) is clicked. Laid out like the ChatGPT Dots workflow editor:
//  - left, on the page's grey: the chat to ask for changes (back arrow and title on top, composer at the bottom);
//  - middle, a white sheet: title bar (status, flow-diagram toggle, save state), then Overview (folded after three
//    lines), Inputs as a table, and Steps as a timeline of stages. Clicking a step selects it;
//  - right, on the grey: Publish / Test / Run, then Triggers, Sends results to (email, dashboard) and Integrations
//    as folding cards, then the selected step's details (or a hint to pick one).
// Run saves, starts the agent and opens its result in a chat (Chargeback recovery builds a dashboard there).
// Edits are kept in AgentsProvider, so a schedule set in the chat shows up here and the other way round.
// Accents use the agent's folder colour (--hue, as on the home screen's folders).
// Prototype: changes live in memory. Workflows only read, match and report.

const field = "w-full rounded-medium border border-transparent bg-transparent px-2 py-1 text-body-md text-(--color-text-primary) outline-none hover:border-(--color-border-default) focus:border-(--color-border-darker) focus:bg-(--color-background-secondary)";
const iconBtn = "grid size-7 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-30 [&_svg]:size-3.5";
const heading = "flex items-center gap-4 text-subtitle-sm tracking-wider text-(--color-text-secondary) uppercase after:h-px after:flex-1 after:bg-(--color-border-default)";
const addLink = "inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) hover:underline";
const btn = "inline-flex h-9 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-40 [&_svg]:size-4";
const card = "rounded-xlarge bg-(--color-background-secondary) p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]";
const count = "rounded-medium bg-(--color-neutral-light) px-1.5 text-body-sm font-normal text-(--color-text-secondary)";
/** An icon tile in the agent's colour. */
const tint = "grid shrink-0 place-items-center rounded-medium bg-[color-mix(in_srgb,var(--hue)_14%,var(--color-background-secondary))] text-(--hue)";
const TYPES: InputType[] = ["text", "list", "number", "date"];

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

type Chat = { who: "you" | "agent"; text: string };
type Pick = { g: number; i: number } | null;

export function WorkflowEditor({ id }: { id: string }) {
  const { getWorkflow } = useAgents();
  const base = getWorkflow(id);
  if (!base) return <p className="p-6 text-body-md text-(--color-text-secondary)">That agent doesn’t exist.</p>;
  return <Editor key={id} base={base} />;
}

// ───────── Flow diagram (behind the map button) ─────────

function FlowNode({ Icon, kicker, label, children, onClick }: { Icon?: LucideIcon; kicker: string; label: React.ReactNode; children?: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex min-w-[78px] flex-1 basis-0 flex-col gap-2 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-2.5 text-left",
        onClick && "outline-none transition-[box-shadow,border-color] hover:border-[color-mix(in_srgb,var(--hue)_45%,transparent)] hover:shadow-[0_6px_16px_-8px_rgb(0_0_0/0.18)] focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
      )}
    >
      {Icon ? (
        <span className={cn(tint, "size-7 [&_svg]:size-3.5")}>
          <Icon aria-hidden />
        </span>
      ) : (
        <span className="flex h-7 items-center">{children}</span>
      )}
      <span className="-mb-1.5 truncate text-[10px] font-medium tracking-wider text-(--color-text-tertiary) uppercase">{kicker}</span>
      <span className="line-clamp-3 text-body-sm font-medium text-(--color-text-primary)">{label}</span>
    </Tag>
  );
}

function Connector() {
  return (
    <span aria-hidden className="flex w-4 shrink-0 items-center self-center">
      <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--hue)_40%,var(--color-border-default))]" />
      <ChevronRight className="-ml-1.5 size-3.5 text-[color-mix(in_srgb,var(--hue)_60%,var(--color-border-darker))]" />
    </span>
  );
}

function Flow({ w, onStage }: { w: Workflow; onStage: (i: number) => void }) {
  return (
    <figure aria-label="How it runs" className="overflow-hidden rounded-large border border-(--color-border-default) bg-[linear-gradient(180deg,color-mix(in_srgb,var(--hue)_7%,transparent),transparent)] motion-safe:animate-page-in">
      <figcaption className="flex items-center justify-between px-4 pt-3 text-subtitle-xs tracking-wider text-(--color-text-secondary) uppercase">
        How it runs
        <span className="text-[11px] tracking-normal normal-case">
          {w.groups.length} stages · {w.groups.reduce((a, g) => a + g.steps.length, 0)} steps
        </span>
      </figcaption>
      <div className="flex items-stretch overflow-x-auto px-3 pt-3 pb-3 [scrollbar-width:thin]">
        <FlowNode Icon={w.triggers.length ? triggerIcon(w.triggers[0]) : Zap} kicker="When" label={w.triggers[0] ?? "When you ask"} />
        <Connector />
        <FlowNode kicker="Reads" label={w.integrations.length ? w.integrations.join(", ") : "Nothing yet"}>
          <span className="flex shrink-0 items-center gap-1">
            {w.integrations.length ? (
              w.integrations.slice(0, 3).map((a) => (
                <span key={a} className="flex">
                  <IntegrationMark name={a} size={18} />
                </span>
              ))
            ) : (
              <span className={cn(tint, "size-7 [&_svg]:size-3.5")}>
                <Download aria-hidden />
              </span>
            )}
          </span>
        </FlowNode>
        {w.groups.map((g, i) => (
          <span key={i} className="contents">
            <Connector />
            <FlowNode Icon={stageKind(g.title).Icon} kicker={`Stage ${i + 1}`} label={g.title || "Untitled"} onClick={() => onStage(i)} />
          </span>
        ))}
        <Connector />
        <FlowNode Icon={w.deliver.dashboard ? LayoutDashboard : Mail} kicker="Sends" label={["Chat", w.deliver.email && "email", w.deliver.dashboard && "dashboard"].filter(Boolean).join(", ")} />
      </div>
    </figure>
  );
}

// ───────── Right-hand cards ─────────

function FoldCard({ title, n, open, onToggle, onAdd, addLabel, children }: { title: string; n: number; open: boolean; onToggle: () => void; onAdd?: () => void; addLabel?: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-medium py-0.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          <h2 className="text-body-lg font-medium text-(--color-text-primary)">{title}</h2>
          <span className={count}>{n}</span>
          <ChevronDown aria-hidden className={cn("size-4 text-(--color-text-secondary) transition-transform duration-200", !open && "-rotate-90")} />
        </button>
        {onAdd && (
          <button type="button" aria-label={addLabel} onClick={onAdd} className={cn(iconBtn, "size-8 border border-(--color-border-default) [&_svg]:size-4")}>
            <Plus />
          </button>
        )}
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

// ───────── Editor ─────────

function Editor({ base }: { base: Workflow }) {
  const router = useRouter();
  const { open, saveWorkflow, runAgent, dashboards } = useAgents();
  const [w, setW] = useState(base);
  const dash = dashboards.find((d) => d.workflow === w.id);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [chat, setChat] = useState<Chat[]>([{ who: "agent", text: `This is how ${base.title} works. Edit anything in the middle, or tell me what to change.` }]);
  const [draft, setDraft] = useState("");
  const [triggerPick, setTriggerPick] = useState(TRIGGER_CHOICES[0]);
  const [adding, setAdding] = useState(false);
  const [more, setMore] = useState(false);
  const [map, setMap] = useState(true);
  const [fold, setFold] = useState({ triggers: true, deliver: true, integrations: false });
  const [pick, setPick] = useState<Pick>(null);

  const edit = (fn: (x: Workflow) => Workflow) => {
    setW(fn);
    setDirty(true);
  };
  const setStep = (g: number, i: number, text: string) => edit((x) => ({ ...x, groups: x.groups.map((gr, a) => (a === g ? { ...gr, steps: gr.steps.map((s, b) => (b === i ? text : s)) } : gr)) }));
  const moveStep = (g: number, i: number, d: -1 | 1) => {
    edit((x) => ({
      ...x,
      groups: x.groups.map((gr, a) => {
        if (a !== g) return gr;
        const steps = [...gr.steps];
        [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
        return { ...gr, steps };
      }),
    }));
    if (pick?.g === g && pick.i === i) setPick({ g, i: i + d });
  };
  const delStep = (g: number, i: number) => {
    edit((x) => ({ ...x, groups: x.groups.map((gr, a) => (a === g ? { ...gr, steps: gr.steps.filter((_, b) => b !== i) } : gr)) }));
    setPick(null);
  };
  const addStep = (g: number, text = "") => edit((x) => ({ ...x, groups: x.groups.map((gr, a) => (a === g ? { ...gr, steps: [...gr.steps, text] } : gr)) }));
  const toStage = (i: number) => document.getElementById(`stage-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    const s = t.toLowerCase();
    // "Every Thursday at 8 AM, email me and update the dashboard" sets the trigger and where results go.
    const schedule = parseSchedule(s);
    if (schedule) {
      let email = /e-?mail|mail/.test(s);
      let dashboard = /dashboard/.test(s);
      if (!email && !dashboard) email = dashboard = true;
      edit((x) => ({ ...x, triggers: [schedule, ...x.triggers.filter((y) => !isSchedule(y))], deliver: { email: email || x.deliver.email, dashboard: dashboard || x.deliver.dashboard } }));
      setFold((f) => ({ ...f, triggers: true, deliver: true }));
      const to = [email && `email you at ${user.email}`, dashboard && "update its dashboard"].filter(Boolean).join(" and ");
      setChat((c) => [...c, { who: "you", text: t }, { who: "agent", text: `Done. It runs ${schedule.replace(/^Every/, "every")}, then I'll ${to}. Save to turn it on.` }]);
      return;
    }
    // "Add QuickBooks" / "use payroll" switches on an integration.
    const named = ALL_INTEGRATIONS.filter((a) => s.includes(a.toLowerCase()) || (a === "POS" && /square/.test(s)) || (a === "Bank account" && /\bbank\b/.test(s)));
    const fresh = named.filter((a) => !w.integrations.includes(a));
    if (fresh.length && /(add|use|connect|include|read|turn on|with)/.test(s)) {
      edit((x) => ({ ...x, integrations: [...x.integrations, ...fresh] }));
      setFold((f) => ({ ...f, integrations: true }));
      setChat((c) => [...c, { who: "you", text: t }, { who: "agent", text: `I turned on ${fresh.join(" and ")}. It's read-only. Mention it in a step so I know when to use it.` }]);
      return;
    }
    const hasGroup = w.groups.length > 0;
    if (!hasGroup) edit((x) => ({ ...x, groups: [{ title: "Steps", steps: [t] }] }));
    else addStep(w.groups.length - 1, t);
    setChat((c) => [...c, { who: "you", text: t }, { who: "agent", text: "I added that as the last step. Reorder or reword it in the middle, then save." }]);
  };

  const save = () => {
    saveWorkflow(w);
    setDirty(false);
    setToast(w.kind === "draft" ? "Published. It runs from its next trigger." : "Changes saved. They apply from the next run.");
  };
  const status = w.kind === "draft" ? { label: "Draft", cls: "text-(--color-text-clickable)" } : w.state === "live" ? { label: "Live", cls: "text-(--color-text-success)" } : { label: w.state === "learning" ? "Learning" : "Coming soon", cls: "text-(--color-text-secondary)" };
  const picked = pick && w.groups[pick.g]?.steps[pick.i] !== undefined ? { ...pick, text: w.groups[pick.g].steps[pick.i], stage: w.groups[pick.g].title, n: w.groups.slice(0, pick.g).reduce((a, x) => a + x.steps.length, 0) + pick.i + 1 } : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-2 bg-(--color-background-primary) p-2" style={{ ["--hue" as string]: w.hue ?? "var(--color-primary)" }}>
      {/* ── chat ── */}
      <aside className="hidden w-[320px] shrink-0 flex-col xl:flex">
        <div className="flex h-12 items-center gap-2 px-1">
          <button type="button" aria-label="Back" onClick={() => router.back()} className={cn(iconBtn, "size-8 [&_svg]:size-4")}>
            <ArrowLeft />
          </button>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            <MessageSquare className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Editing {w.title}</span>
          </span>
        </div>
        <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {chat.map((m, i) =>
            m.who === "you" ? (
              <li key={i} className="ml-auto w-fit max-w-[85%] rounded-large bg-(--color-background-secondary) px-3 py-2 text-body-md text-(--color-text-primary) shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
                {m.text}
              </li>
            ) : (
              <li key={i} className="flex gap-2.5 text-body-md leading-relaxed text-(--color-text-primary)">
                {w.agent && <AgentAvatar agent={w.agent} size={22} className="mt-0.5 shrink-0" />}
                <p className="min-w-0">{m.text}</p>
              </li>
            ),
          )}
        </ul>
        <form onSubmit={ask} className="rounded-xlarge border border-(--color-border-default) bg-(--color-background-secondary) p-3 shadow-[0_2px_8px_rgb(0_0_0/0.05)] focus-within:border-(--color-focus-primary)">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), e.currentTarget.form?.requestSubmit())} rows={2} placeholder="Ask for a change, e.g. Run every Thursday at 8 AM and email me" aria-label="Ask for a change" className="block w-full resize-none bg-transparent text-body-md outline-none placeholder:text-(--color-text-secondary)" />
          <div className="flex items-center justify-between pt-2">
            <Paperclip className="size-4 text-(--color-text-tertiary)" aria-hidden />
            <button type="submit" aria-label="Send" disabled={!draft.trim()} className="grid size-8 place-items-center rounded-medium bg-(--color-primary) text-white outline-none transition-opacity focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary) disabled:opacity-35">
              <ArrowUp className="size-4" />
            </button>
          </div>
        </form>
      </aside>

      {/* ── workflow sheet ── */}
      <section aria-label={w.title} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xlarge border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_1px_3px_rgb(0_0_0/0.05)]">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--color-border-default) px-4 py-2 sm:px-6">
          <button type="button" aria-label="Back" onClick={() => router.back()} className={cn(iconBtn, "xl:hidden")}>
            <ArrowLeft />
          </button>
          <input aria-label="Agent name" value={w.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} className="min-w-0 max-w-[300px] flex-1 truncate bg-transparent text-subtitle-lg font-medium text-(--color-text-primary) outline-none" />
          <span className={cn("flex items-center gap-1.5 text-body-sm font-medium tracking-wider uppercase", status.cls)}>
            <span className="size-1.5 rounded-circle bg-current" />
            {status.label}
          </span>
          <button type="button" aria-label={map ? "Hide flow diagram" : "Show flow diagram"} aria-pressed={map} title="Flow diagram" onClick={() => setMap((m) => !m)} className={cn(iconBtn, "size-8 [&_svg]:size-4", map && "bg-(--color-neutral-light) text-(--color-text-primary)")}>
            <MapIcon />
          </button>
          <span className="ml-auto truncate text-body-sm text-(--color-text-secondary)">{dirty ? "Unsaved changes" : w.kind === "draft" ? "Not published yet" : "Saved · up to date"}</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[760px] space-y-10 px-4 py-8 sm:px-8">
            {map && <Flow w={w} onStage={toStage} />}

            <section className="space-y-4">
              <h2 className={heading}>Overview</h2>
              {more ? (
                <textarea aria-label="Overview" value={w.overview} onChange={(e) => edit((x) => ({ ...x, overview: e.target.value }))} className={cn(field, "-mx-2 w-[calc(100%+16px)] resize-none text-body-lg leading-relaxed [field-sizing:content]")} />
              ) : (
                <p className="line-clamp-3 text-body-lg leading-relaxed text-(--color-text-primary)">{w.overview}</p>
              )}
              <button type="button" onClick={() => setMore((m) => !m)} className="text-body-md text-(--color-text-clickable) hover:underline">
                {more ? "Show less" : "Show more"}
              </button>
            </section>

            <section className="space-y-4">
              <h2 className={heading}>Inputs</h2>
              <div className="overflow-x-auto rounded-large border border-(--color-border-default)">
                <table className="w-full min-w-[520px] text-left">
                  <thead className="bg-(--color-neutral-lightest) text-body-sm tracking-wider text-(--color-text-secondary) uppercase">
                    <tr className="divide-x divide-(--color-border-default)">
                      <th className="w-[34%] px-4 py-3 font-medium">Name</th>
                      <th className="w-[18%] px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border-default)">
                    {w.inputs.map((r, i) => (
                      <tr key={i} className="group divide-x divide-(--color-border-default) align-top hover:bg-(--color-neutral-lightest)">
                        <td className="p-2">
                          <input aria-label="Input name" value={r.name} onChange={(e) => edit((x) => ({ ...x, inputs: x.inputs.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) }))} className={cn(field, "font-medium")} />
                        </td>
                        <td className="p-2 pt-2.5">
                          <select
                            aria-label="Input type"
                            value={r.type}
                            onChange={(e) => edit((x) => ({ ...x, inputs: x.inputs.map((y, j) => (j === i ? { ...y, type: e.target.value as InputType } : y)) }))}
                            className="ml-1 cursor-pointer appearance-none rounded-medium bg-(--color-neutral-light) px-2 py-0.5 text-body-sm text-(--color-text-secondary) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                          >
                            {TYPES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <div className="flex items-start gap-1">
                            <textarea aria-label="Input description" value={r.desc} rows={1} placeholder="What it's for" onChange={(e) => edit((x) => ({ ...x, inputs: x.inputs.map((y, j) => (j === i ? { ...y, desc: e.target.value } : y)) }))} className={cn(field, "min-w-0 flex-1 resize-none text-(--color-text-secondary) [field-sizing:content]")} />
                            <button type="button" aria-label="Remove input" onClick={() => edit((x) => ({ ...x, inputs: x.inputs.filter((_, j) => j !== i) }))} className={cn(iconBtn, "mt-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100")}>
                              <Trash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => edit((x) => ({ ...x, inputs: [...x.inputs, { name: "new input", type: "text", desc: "" }] }))} className={addLink}>
                <Plus className="size-3.5" /> Add input
              </button>
            </section>

            <section className="space-y-4">
              <h2 className={heading}>Steps</h2>
              {w.groups.length === 0 && <p className="text-body-md text-(--color-text-secondary)">No steps yet. Add a stage, or ask in the chat.</p>}
              <ol>
                {w.groups.map((g, gi) => {
                  const n = w.groups.slice(0, gi).reduce((a, x) => a + x.steps.length, 0);
                  const { Icon } = stageKind(g.title);
                  return (
                    <li key={gi} id={`stage-${gi}`} className="relative flex scroll-mt-4 gap-3 pb-6 last:pb-0">
                      {/* the rail down to the next stage */}
                      {gi < w.groups.length - 1 && <span aria-hidden className="absolute top-9 bottom-0 left-[17px] w-0.5 bg-[color-mix(in_srgb,var(--hue)_25%,var(--color-border-default))]" />}
                      <span className={cn(tint, "relative z-10 size-9 [&_svg]:size-4")}>
                        <Icon aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex h-9 items-center gap-1">
                          <input aria-label="Stage name" value={g.title} onChange={(e) => edit((x) => ({ ...x, groups: x.groups.map((y, a) => (a === gi ? { ...y, title: e.target.value } : y)) }))} className={cn(field, "min-w-0 flex-1 font-medium")} />
                          <span className="shrink-0 text-body-sm whitespace-nowrap text-(--color-text-tertiary)">
                            {g.steps.length} {g.steps.length === 1 ? "step" : "steps"}
                          </span>
                          <button type="button" aria-label="Remove stage" onClick={() => edit((x) => ({ ...x, groups: x.groups.filter((_, a) => a !== gi) }))} className={iconBtn}>
                            <X />
                          </button>
                        </div>
                        <ol className="mt-1 space-y-1">
                          {g.steps.map((s, i) => {
                            const on = pick?.g === gi && pick.i === i;
                            return (
                              <li
                                key={i}
                                onClick={() => setPick({ g: gi, i })}
                                className={cn("group flex cursor-pointer items-start gap-2 rounded-large border p-1.5 transition-colors", on ? "border-[color-mix(in_srgb,var(--hue)_50%,transparent)] bg-[color-mix(in_srgb,var(--hue)_6%,var(--color-background-secondary))]" : "border-transparent hover:bg-(--color-neutral-lightest)")}
                              >
                                <span className={cn("mt-1 grid size-5 shrink-0 place-items-center rounded-circle text-[10px] font-medium", on ? "bg-(--hue) text-white" : "border border-(--color-border-default) text-(--color-text-secondary)")}>{n + i + 1}</span>
                                <textarea aria-label={`Step ${n + i + 1}`} value={s} rows={1} onFocus={() => setPick({ g: gi, i })} onChange={(e) => setStep(gi, i, e.target.value)} className={cn(field, "min-w-0 flex-1 resize-none py-0.5 [field-sizing:content]")} />
                              </li>
                            );
                          })}
                        </ol>
                        <button type="button" onClick={() => addStep(gi)} className={cn(addLink, "mt-1 ml-[38px]")}>
                          <Plus className="size-3.5" /> Add step
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={() => edit((x) => ({ ...x, groups: [...x.groups, { title: "New stage", steps: [""] }] }))} className={cn(addLink, "ml-12")}>
                <Plus className="size-3.5" /> Add stage
              </button>
            </section>
          </div>
        </div>
      </section>

      {/* ── actions, triggers, integrations, selected step ── */}
      <aside className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
        <div className="flex h-12 items-center justify-end gap-2">
          <button type="button" onClick={save} disabled={!dirty && w.kind !== "draft"} className={btn}>
            <Rocket aria-hidden />
            {w.kind === "draft" ? "Publish" : "Save"}
          </button>
          <button type="button" onClick={() => setToast("Test run started on last week's data. The result opens in the chat.")} className={btn}>
            <FlaskConical aria-hidden />
            Test
          </button>
          <button
            type="button"
            onClick={() => {
              if (dirty) saveWorkflow(w);
              runAgent(w);
              router.push("/mvp3");
            }}
            className={cn(btn, "border-transparent bg-(--color-primary) text-white hover:bg-(--color-primary) hover:opacity-90")}
          >
            <Play aria-hidden />
            Run
          </button>
        </div>

        <FoldCard title="Triggers" n={w.triggers.length} open={fold.triggers} onToggle={() => setFold((f) => ({ ...f, triggers: !f.triggers }))} onAdd={() => (setFold((f) => ({ ...f, triggers: true })), setAdding(true))} addLabel="Add trigger">
          {w.triggers.length === 0 && !adding && <p className="text-body-sm text-(--color-text-secondary)">{w.kind === "draft" ? "This draft has no triggers yet." : "No triggers. It runs when you ask."}</p>}
          <ul className="space-y-1">
            {w.triggers.map((t, i) => {
              const Icon = triggerIcon(t);
              return (
                <li key={i} className="flex items-center gap-2 rounded-medium bg-(--color-neutral-lightest) py-1.5 pr-1 pl-1.5 text-body-sm text-(--color-text-primary)">
                  <span className={cn(tint, "size-6 [&_svg]:size-3.5")}>
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">{t}</span>
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => edit((x) => ({ ...x, triggers: x.triggers.filter((_, j) => j !== i) }))} className={iconBtn}>
                    <X />
                  </button>
                </li>
              );
            })}
          </ul>
          {adding && (
            <div className="mt-2 flex items-center gap-1.5">
              <select aria-label="Trigger" value={triggerPick} onChange={(e) => setTriggerPick(e.target.value)} className="min-w-0 flex-1 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2 py-1.5 text-body-sm outline-none">
                {TRIGGER_CHOICES.filter((t) => !w.triggers.includes(t)).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!w.triggers.includes(triggerPick)) edit((x) => ({ ...x, triggers: [...x.triggers, triggerPick] }));
                  setAdding(false);
                }}
                className="h-8 rounded-medium bg-(--color-primary) px-2.5 text-body-sm font-medium text-white"
              >
                Add
              </button>
            </div>
          )}
        </FoldCard>

        <FoldCard title="Sends results to" n={1 + Number(w.deliver.email) + Number(w.deliver.dashboard)} open={fold.deliver} onToggle={() => setFold((f) => ({ ...f, deliver: !f.deliver }))}>
          <ul className="space-y-0.5">
            <li className="flex items-center gap-2 px-1.5 py-1.5 text-body-sm text-(--color-text-primary)">
              <span className={cn(tint, "size-6 [&_svg]:size-3.5")}>
                <MessageSquare aria-hidden />
              </span>
              <span className="min-w-0 flex-1">A chat with the result</span>
              <span className="text-[11px] text-(--color-text-tertiary)">Always</span>
            </li>
            {[
              { k: "email" as const, Icon: Mail, label: "Email", sub: user.email },
              { k: "dashboard" as const, Icon: LayoutDashboard, label: dash ? `${dash.title} dashboard` : "Dashboard", sub: dash ? (dash.pinned ? "Pinned in your sidebar" : "Not pinned yet") : "Built on the first run" },
            ].map(({ k, Icon, label, sub }) => {
              const on = w.deliver[k];
              return (
                <li key={k}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => edit((x) => ({ ...x, deliver: { ...x.deliver, [k]: !on } }))}
                    className="flex w-full items-center gap-2 rounded-medium px-1.5 py-1.5 text-left text-body-sm outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                  >
                    <span className={cn(tint, "size-6 [&_svg]:size-3.5", !on && "opacity-50 grayscale")}>
                      <Icon aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", on ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>{label}</span>
                      <span className="block truncate text-[11px] text-(--color-text-tertiary)">{sub}</span>
                    </span>
                    <span aria-hidden className={cn("relative h-4 w-7 shrink-0 rounded-circle transition-colors", on ? "bg-(--hue)" : "bg-(--color-border-darker)")}>
                      <span className={cn("absolute top-0.5 size-3 rounded-circle bg-white shadow-sm transition-[left]", on ? "left-3.5" : "left-0.5")} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {w.triggers.some(isSchedule) && (w.deliver.email || w.deliver.dashboard) && (
            <p className="mt-2 border-t border-(--color-border-default) pt-2 text-body-sm text-(--color-text-secondary)">
              {w.triggers.find(isSchedule)}: {[w.deliver.email && "email", w.deliver.dashboard && "dashboard update"].filter(Boolean).join(" and ")}.
            </p>
          )}
        </FoldCard>

        <FoldCard title="Integrations" n={w.integrations.length} open={fold.integrations} onToggle={() => setFold((f) => ({ ...f, integrations: !f.integrations }))}>
          <p className="pb-2 text-body-sm text-(--color-text-secondary)">What this agent reads from. Read-only access.</p>
          <ul className="space-y-0.5">
            {ALL_INTEGRATIONS.map((a) => {
              const on = w.integrations.includes(a);
              return (
                <li key={a}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => edit((x) => ({ ...x, integrations: on ? x.integrations.filter((y) => y !== a) : [...x.integrations, a] }))}
                    className={cn("flex w-full items-center gap-2 rounded-medium px-1.5 py-1.5 text-left text-body-sm outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", on ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}
                  >
                    <span className={cn("transition-opacity", !on && "opacity-50 grayscale")}>
                      <IntegrationMark name={a} size={20} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a}</span>
                    <span aria-hidden className={cn("relative h-4 w-7 shrink-0 rounded-circle transition-colors", on ? "bg-(--hue)" : "bg-(--color-border-darker)")}>
                      <span className={cn("absolute top-0.5 size-3 rounded-circle bg-white shadow-sm transition-[left]", on ? "left-3.5" : "left-0.5")} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </FoldCard>

        {picked ? (
          <section className={cn(card, "space-y-3 motion-safe:animate-page-in")}>
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-circle bg-(--hue) text-[11px] font-medium text-white">{picked.n}</span>
              <h2 className="min-w-0 flex-1 truncate text-body-lg font-medium text-(--color-text-primary)">Step {picked.n}</h2>
              <button type="button" aria-label="Close step" onClick={() => setPick(null)} className={iconBtn}>
                <X />
              </button>
            </div>
            <p className="text-body-md text-(--color-text-primary)">{picked.text || "Empty step"}</p>
            <dl className="space-y-2.5 border-t border-(--color-border-default) pt-3 text-body-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--color-text-secondary)">Stage</dt>
                <dd className="truncate text-(--color-text-primary)">{picked.stage}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--color-text-secondary)">Action</dt>
                <dd className="flex items-center gap-1.5 text-(--color-text-primary)">
                  {(() => {
                    const { Icon, action } = stageKind(picked.stage);
                    return (
                      <>
                        <Icon className="size-3.5 text-(--hue)" aria-hidden />
                        {action}
                      </>
                    );
                  })()}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-(--color-text-secondary)">Uses</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {usedBy(picked.text, w.integrations).length ? (
                    usedBy(picked.text, w.integrations).map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 rounded-circle border border-(--color-border-default) py-0.5 pr-2 pl-0.5 text-(--color-text-primary)">
                        <IntegrationMark name={a} size={16} />
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-(--color-text-tertiary)">Results of earlier steps</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="flex items-center gap-1 border-t border-(--color-border-default) pt-2">
              <button type="button" aria-label="Move up" disabled={picked.i === 0} onClick={() => moveStep(picked.g, picked.i, -1)} className={iconBtn}>
                <ArrowUp />
              </button>
              <button type="button" aria-label="Move down" disabled={picked.i === w.groups[picked.g].steps.length - 1} onClick={() => moveStep(picked.g, picked.i, 1)} className={iconBtn}>
                <ArrowDown />
              </button>
              <button type="button" onClick={() => delStep(picked.g, picked.i)} className="ml-auto inline-flex items-center gap-1 rounded-medium px-2 py-1 text-body-sm text-(--color-text-danger) outline-none hover:bg-(--color-neutral-light) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                <Trash2 className="size-3.5" /> Delete step
              </button>
            </div>
          </section>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-body-sm text-(--color-text-secondary)">
            <MousePointerClick className="size-5" aria-hidden />
            Select a step to see its actions and settings
          </div>
        )}

        {dash?.pinned && (
          <button type="button" onClick={() => router.push(`/mvp3/dashboard?id=${dash.id}`)} className="self-start px-1 text-body-sm text-(--color-text-clickable) hover:underline">
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
            className="self-start px-1 text-body-sm text-(--color-text-clickable) hover:underline"
          >
            Open the latest report
          </button>
        )}
      </aside>
      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}
