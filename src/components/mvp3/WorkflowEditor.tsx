"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  BarChart3,
  BookOpen,
  CalendarClock,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  Info,
  Quote,
  GitCompareArrows,
  History,
  Landmark,
  ListChecks,
  Mail,
  Package,
  Pencil,
  Play,
  Plug,
  Plus,
  Redo2,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Switch } from "@astryxdesign/core/Switch";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Selector } from "@astryxdesign/core/Selector";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { TextArea } from "@astryxdesign/core/TextArea";
import { SquareMark } from "@/components/ui/SquareMark";
import { AppLogo } from "@/components/onboarding/marks";
import { user } from "@/lib/mockData";
import { FOLDERS, agentOf } from "@/lib/mvp3/agents";
import { missingFor } from "@/lib/mvp3/flows";
import { useAccount } from "./AccountSwitcher";
import { ALL_INTEGRATIONS, DEFAULT_TWEAKS, isSchedule, type Tweaks, type WfGroup, type Workflow } from "@/lib/mvp3/workflows";
import { parseSchedule } from "@/lib/mvp3/dashboards";
import { emailKindOf } from "@/lib/mvp3/emails";
import { hasRuns, runHistory } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { EmailModal } from "./EmailPreview";
import { ReportModal } from "./ReportPreview";
import { Composer, ComposerNote } from "./AgentChat";
import { focusRing, iconButton, pill } from "@/components/mvp3/styles";

// Opens from an agent's overview (Edit) or a draft. One card inside the app panel (Figma 1687:9039):
//  - Header: back, name, status, undo/redo, Runs, Run now.
//  - Left: the chat, the way to change anything in the owner's own words. Each change comes back as a
//    "What I changed" card with Undo, including changes made on the right.
//  - Right: who the agent is, its Steps left to right (Trigger → Reads → each stage → You get; a card jumps to
//    where it's edited), then Setup (schedule, instructions, outputs) or Configure (stages one by one, what it reads).
// Controls are Astryx (Button, IconButton, Badge, Switch); colours come through app/(mvp3)/mvp3/astryx-bridge.css.
// No Test or Save: changes apply from the next run. Drafts still get Publish.
// Edits are kept in AgentsProvider, so a schedule set in the main chat shows up here and the other way round.
// Brand orange only (Foundation tokens). Workflows only read, match and report.

const triggerIcon = (t: string): LucideIcon => (t.startsWith("When") ? Zap : /Daily|Every (Mon|Tue|Wed|Thu|Fri)/.test(t) ? Clock : CalendarClock);

/** The step types in "Add a step". Each adds a stage the owner then words in the inspector or the chat. */
const KINDS = [
  { key: "read", Icon: Download, label: "Read data", hint: "Pull a report from an app", title: "Read data", step: "Read the latest report from each delivery app." },
  { key: "match", Icon: GitCompareArrows, label: "Match records", hint: "Pair two sources line by line", title: "Match records", step: "Match each line to its order in Toast." },
  { key: "calc", Icon: BarChart3, label: "Calculate", hint: "Total, group and rank", title: "Work out the totals", step: "Group the results by outlet and rank them." },
  { key: "check", Icon: ShieldCheck, label: "Check", hint: "Flag anything that looks off", title: "Check the results", step: "Flag anything that looks off." },
  { key: "report", Icon: Mail, label: "Send a summary", hint: "Email you or update a dashboard", title: "Report", step: "Email the owner a short summary." },
] as const;
type KindKey = (typeof KINDS)[number]["key"];

/** The integration's mark: real logos for the delivery apps and Square, a small tile for the rest. */
export function IntegrationMark({ name, size = 16 }: { name: string; size?: number }) {
  const app = ({ DoorDash: "doordash", "Uber Eats": "ubereats", Grubhub: "grubhub" } as const)[name as "DoorDash"];
  if (app) return <AppLogo app={app} size={size} />;
  if (name === "POS") return <SquareMark size={size} />;
  const Icon = name === "Payroll" ? Users : name.startsWith("Inventory") ? Package : name === "QuickBooks" ? BookOpen : name === "Bank account" ? Landmark : FileText;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-small bg-(--color-text-primary) text-(--color-text-inverse-primary) [&_svg]:size-[65%]" style={{ width: size, height: size }}>
      <Icon />
    </span>
  );
}

/** What the owner calls each source, and what the agent takes from it. */
const SOURCE: Record<string, { label: string; reads: string }> = {
  DoorDash: { label: "DoorDash", reads: "Weekly reports" },
  "Uber Eats": { label: "Uber Eats", reads: "Weekly reports" },
  Grubhub: { label: "Grubhub", reads: "Weekly reports" },
  POS: { label: "Toast", reads: "Orders and sales" },
  QuickBooks: { label: "QuickBooks", reads: "Your books" },
  "Bank account": { label: "Bank account", reads: "Deposits" },
  Payroll: { label: "Payroll", reads: "Hours and pay" },
  "Inventory and supplier bills": { label: "Inventory", reads: "Stock and supplier bills" },
};
const sourceOf = (a: string) => SOURCE[a] ?? { label: a, reads: "Reports" };

/** An agent message can carry the version before its change, so the owner can undo it. */
type Chat = { who: "you" | "agent"; text: string; undo?: Workflow; chips?: string[] };
type Area = "name" | "overview" | "steps" | "inputs" | "setup";

export function WorkflowEditor({ id }: { id: string }) {
  const { getWorkflow } = useAgents();
  const base = getWorkflow(id);
  if (!base) return <p className="p-6 text-body-md text-(--color-text-secondary)">That agent doesn’t exist.</p>;
  return <Editor key={id} base={base} />;
}

// ───────── Words ─────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES = ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"];
/** Minimum error rates for the chargeback outlet filter, in percent. */
const RATES = [0, 0.5, 1, 2, 3, 5];
/** "Every Thursday, 8:00 AM" → "Thu · 8 AM"; "Daily, 8:00 AM" → "Daily · 8 AM". */
const shortWhen = (t: string) => {
  const time = t.match(/(\d{1,2}):00 ([AP]M)/);
  const at = time ? `${time[1]} ${time[2]}` : "";
  const day = t.match(/^Every (\w{3})\w*day/)?.[1] ?? (t.startsWith("Daily") ? "Daily" : t.startsWith("Monthly") ? "Monthly" : null);
  return day ? (at ? `${day} · ${at}` : day) : t;
};
const timeOf = (t?: string) => t?.match(/\d{1,2}:\d{2} [AP]M/)?.[0] ?? "8:00 AM";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ───────── Small parts ─────────

/** A button that opens a small panel under it. One panel is open at a time (`at`), and it closes on a choice, Escape or a click outside. */
function Pop({ id, at, set, label, trigger, triggerClass, align = "left", children }: { id: string; at: string | null; set: (id: string | null) => void; label: string; trigger: React.ReactNode; triggerClass?: string; align?: "left" | "center" | "right"; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const open = at === id;
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) set(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") set(null);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, set]);
  return (
    <span ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label} onClick={() => set(open ? null : id)} className={triggerClass}>
        {trigger}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={label}
          className={cn(
            "kf-pop absolute top-full z-30 mt-2 block w-[264px] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 text-left text-body-md font-normal tracking-normal text-(--color-text-primary) shadow-[0_16px_40px_rgb(0_0_0/0.16)]",
            align === "center" ? "left-1/2 -translate-x-1/2" : align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** Free text that helps the agent's insights fit the restaurant. Saves when you click away. */
function ContextField({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="mt-3" onBlur={() => draft.trim() !== value && onSave(draft.trim())}>
      <TextArea label="Context for better insights" isLabelHidden placeholder="Add context for better insights, e.g. I don't have space for another counter in the kitchen." rows={2} value={draft} onChange={(v) => setDraft(v)} />
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <Switch size="sm" label={label} isLabelHidden value={on} onChange={() => onChange()} />;
}

/** One step type as a row in the "+" menu on a connector. */
function KindRow({ Icon, label, hint, soon, onPick, compact }: { Icon: LucideIcon; label: string; hint: string; soon?: boolean; onPick?: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      disabled={soon}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 text-left transition-colors",
        focusRing,
        compact ? "rounded-medium px-2 py-1.5 hover:bg-(--color-neutral-lightest)" : "rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 py-2 hover:border-(--color-border-input) hover:shadow-[0_1px_3px_rgb(0_0_0/0.06)]",
        soon && "cursor-default hover:border-(--color-border-default) hover:bg-transparent hover:shadow-none",
      )}
    >
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-medium [&_svg]:size-4", soon ? "bg-(--color-neutral-lightest) text-(--color-text-tertiary)" : "bg-[color-mix(in_srgb,var(--color-primary)_9%,var(--color-background-secondary))] text-(--color-primary)")}>
        <Icon aria-hidden />
      </span>
      <span className={cn("shrink-0 text-body-md", soon ? "text-(--color-text-tertiary)" : "text-(--color-text-primary)")}>{label}</span>
      {soon ? <Badge variant="neutral" label="Coming soon" /> : <span className="min-w-0 truncate text-body-sm text-(--color-text-secondary)">{hint}</span>}
    </button>
  );
}

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Files the agent reads alongside the reports: drop them on the tile or attach, then remove any. */
function Files({ files, onChange }: { files: { name: string; size: number }[]; onChange: (f: { name: string; size: number }[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const have = new Set(files.map((f) => f.name));
    const fresh = [...list].filter((f) => !have.has(f.name)).map((f) => ({ name: f.name, size: f.size }));
    if (fresh.length) onChange([...files, ...fresh]);
  };
  return (
    <ul className="space-y-1.5">
      {files.map((f) => (
        <li key={f.name} className="flex items-center gap-2.5 rounded-large border border-(--color-border-default) py-2 pr-1.5 pl-3">
          <FileText className="size-[18px] shrink-0 text-(--color-text-secondary)" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-md text-(--color-text-primary)">{f.name}</span>
            <span className="block text-body-sm text-(--color-text-secondary) tabular-nums">{kb(f.size)}</span>
          </span>
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((x) => x.name !== f.name))} className={cn(iconButton, "size-7 shrink-0")}>
            <X className="size-4" aria-hidden />
          </button>
        </li>
      ))}
      <li
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn("flex w-full items-center justify-center gap-2 rounded-large border border-dashed px-3 py-2 text-body-md text-(--color-text-primary) transition-colors", focusRing, over ? "border-(--color-focus-primary) bg-(--color-brand-lightest)" : "border-(--color-border-input) hover:border-(--color-primary) hover:bg-(--color-primary)/8 hover:text-(--color-text-clickable)")}
        >
          <Plus className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
          Add a file
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </li>
    </ul>
  );
}

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

  // Setup tweaks (Setup tab rows 2–4): outlets, insights, suggested actions, context, attachment.
  const tw = { ...DEFAULT_TWEAKS, ...w.tweaks };
  const tweak = (patch: Partial<Tweaks>, reply: string): Change => ({ next: { ...w, tweaks: { ...tw, ...patch } }, reply, areas: ["setup"] });
  const pct = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (/\b(all|every|each) outlets?\b/.test(s) && !pct) return tweak({ minErrorRate: 0 }, "It now shows every outlet.");
  if (pct && /outlet|error|rate|above|over|more than/.test(s)) {
    const r = Number(pct[1]);
    return tweak({ minErrorRate: r }, r ? `It now only shows outlets with an error rate above ${r}%.` : "It now shows every outlet.");
  }
  if (/store managers?|\bmanagers?\b|outlet[- ]?wise/.test(s)) {
    const on = !NO.test(s) && !/\b(hide|off)\b/.test(s);
    if (on === tw.managerReports) return { next: w, reply: on ? "Store managers already get their outlet's report." : "Store managers don't get reports already.", areas: [] };
    return tweak({ managerReports: on }, on ? "Each store manager now gets their own outlet's report." : "Store managers won't get their outlet's report any more.");
  }
  if (/\binsights?\b/.test(s) && !/context/.test(s)) {
    const on = !NO.test(s) && !/\b(hide|off)\b/.test(s);
    if (on === tw.insights) return { next: w, reply: on ? "Insights are already on." : "Insights are already off.", areas: [] };
    return tweak({ insights: on }, on ? "Each run now includes insights." : "Insights are off.");
  }
  if (/\b(suggested |suggest(ion)?s? ?)?actions?\b/.test(s) && /suggest|action/.test(s)) {
    const on = !NO.test(s) && !/\b(hide|off)\b/.test(s);
    if (on === tw.actions) return { next: w, reply: on ? "Suggested actions are already on." : "Suggested actions are already off.", areas: [] };
    return tweak({ actions: on }, on ? "Each run now includes suggested actions." : "Suggested actions are off.");
  }
  if (/\b(pdf|excel|spreadsheet|xlsx|csv|sheet)\b/.test(s)) {
    const attach = /\bpdf\b/.test(s) && !/instead of (a )?pdf/.test(s) ? "pdf" : "excel";
    return { next: { ...w, tweaks: { ...tw, attach }, deliver: { ...w.deliver, email: true } }, reply: `The email now comes with ${attach === "pdf" ? "a PDF" : "an Excel file"} of the totals by outlet.`, areas: ["setup"] };
  }
  const ctx = t.match(/^(?:context|note|fyi|keep in mind|remember)(?: that)?\s*[:,-]?\s*(.+)$/i) ?? t.match(/^((?:we|i) (?:don'?t|do not|can'?t|cannot|only|have|are|close|open)\b.+)$/i);
  if (ctx) {
    const c = cap(ctx[1].trim());
    return tweak({ context: tw.context ? `${tw.context} ${c}${/[.?!]$/.test(c) ? "" : "."}` : c + (/[.?!]$/.test(c) ? "" : ".") }, "Got it. I'll keep that in mind for insights and suggested actions.");
  }

  // Questions get an answer, not a change.
  if (/\?$/.test(text.trim()) || /^(what|when|how|which|who|does|do|is|can|why)\b/.test(s)) return { next: w, reply: answer(s, w, tw), areas: [] };

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
/** A plain answer about the agent's current setup. */
function answer(s: string, w: Workflow, tw: Tweaks) {
  const when = w.triggers[0] ? `It runs ${w.triggers[0].replace(/^Every/, "every").replace(/^Daily/, "daily").replace(/^Monthly/, "monthly")}, and whenever you ask.` : "It runs only when you ask.";
  const reads = w.integrations.length ? `It reads ${list(w.integrations)}, and never changes anything there.` : "It doesn't read any apps yet.";
  const shows = [tw.minErrorRate ? `outlets with an error rate above ${tw.minErrorRate}%` : "every outlet", tw.insights && "insights", tw.actions && "suggested actions"].filter(Boolean) as string[];
  const gets = [w.deliver.email && `an email with ${tw.attach === "pdf" ? "a PDF" : "an Excel file"}`, w.deliver.dashboard && "a dashboard update", "a chat message"].filter(Boolean) as string[];
  if (/\b(when|schedule|how often|time|day)\b/.test(s)) return when;
  if (/\b(read|app|source|data|connect)/.test(s)) return reads;
  if (/\b(get|email|send|output|pdf|excel|dashboard)\b/.test(s)) return `After each run you get ${list(gets)}.`;
  if (/\b(step|instruction|stage)/.test(s)) return `It has ${stepsOf(w).length} steps in ${w.groups.length} stages: ${w.groups.map((g) => g.title).join(", ")}. Open Configure to edit them, or tell me what to change.`;
  return `${w.overview} ${when} It shows ${list(shows)}.`;
}

function examples(w: Workflow) {
  const spare = ALL_INTEGRATIONS.find((a) => !w.integrations.includes(a));
  const tw = { ...DEFAULT_TWEAKS, ...w.tweaks };
  return [
    w.triggers.some(isSchedule) ? "Run every Monday at 8 AM" : "Run every Monday at 8 AM and email me",
    /chargeback/i.test(w.id) ? (tw.minErrorRate ? "Show all outlets" : "Only show outlets above 2% error rate") : spare ? `Also read ${spare}` : null,
    tw.attach === "pdf" ? "Send the email as Excel" : "Send the email as a PDF",
  ].filter(Boolean).slice(0, 4) as string[];
}

// ───────── Editor ─────────

const card = "rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_1px_2px_rgb(0_0_0/0.04)]";
/** A section title on the details page ("Steps", "Instructions"): 16px medium (Figma 1687:9591). */
const pageHead = "text-subtitle-sm font-medium text-(--color-text-primary)";

function Editor({ base }: { base: Workflow }) {
  const router = useRouter();
  const { saveWorkflow, runAgent, dashboards } = useAgents();
  const [w, setW] = useState(base);
  const dash = dashboards.find((d) => d.workflow === w.id);
  const [toast, setToast] = useState<string | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [chat, setChat] = useState<Chat[]>([]);
  /** The agent is "typing": its reply lands a beat after yours. */
  const [typing, setTyping] = useState(false);
  /** Parts that just changed and flash for a moment: "name", "when", "sources", "output", "g0"… */
  const [flash, setFlash] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  /** Setup: schedule, instructions and what you get. Configure: the stages one by one, and what it reads. */
  const [view, setView] = useState<"setup" | "configure">("setup");
  /** Configure → Instructions: read it as a document, or edit stage by stage. */
  const [mode, setMode] = useState<"view" | "edit">("view");
  /** Instructions in view mode: clipped with a fade until "Show all". */
  const [more, setMore] = useState(false);
  /** The open "Add stage" menu. */
  const [pop, setPop] = useState<string | null>(null);
  const [mail, setMail] = useState(false);
  /** The attachment preview open: PDF or Excel. */
  const [file, setFile] = useState<"pdf" | "excel" | null>(null);
  const [past, setPast] = useState<Workflow[]>([]);
  const [future, setFuture] = useState<Workflow[]>([]);
  const log = useRef<HTMLUListElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [chat, typing]);
  useEffect(() => {
    if (!flash.length) return;
    const tm = window.setTimeout(() => setFlash([]), 1800);
    return () => window.clearTimeout(tm);
  }, [flash]);

  /** Apply a version: show it, save it (presets save at once; drafts wait for Publish), flash the parts that changed. */
  const apply = (next: Workflow, areas: Area[], record = true) => {
    const t0 = { ...DEFAULT_TWEAKS, ...w.tweaks };
    const t1 = { ...DEFAULT_TWEAKS, ...next.tweaks };
    const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    const spots = areas.flatMap((a): string[] => {
      if (a === "name") return ["name"];
      if (a === "steps") {
        const changed = next.groups.map((g, i) => (differs(g, w.groups[i]) ? `g${i}` : "")).filter(Boolean);
        // A stage added or removed shifts every stage after it: flash only the new one, or nothing.
        return next.groups.length === w.groups.length ? changed : next.groups.length > w.groups.length ? changed.slice(0, 1) : [];
      }
      if (a === "setup") return [differs(w.triggers, next.triggers) && "when", differs(w.integrations, next.integrations) && "sources", (differs(w.deliver, next.deliver) || t0.attach !== t1.attach || t0.managerReports !== t1.managerReports) && "output", t0.minErrorRate !== t1.minErrorRate && "rate", (t0.insights !== t1.insights || t0.actions !== t1.actions || t0.context !== t1.context) && "show"].filter((x): x is string => !!x);
      return [];
    });
    if (record) {
      setPast((p) => [...p.slice(-49), w]);
      setFuture([]);
    }
    setW(next);
    if (next.kind !== "draft") saveWorkflow(next);
    setSaved(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    setFlash(spots);
  };
  const suffix = w.kind === "draft" ? " Publish when you're happy." : " Saved, it applies from the next run.";
  const ALL_AREAS: Area[] = ["name", "overview", "steps", "inputs", "setup"];
  const changedAreas = (a: Workflow, b: Workflow) => ALL_AREAS.filter((x) => JSON.stringify(pickArea(a, x)) !== JSON.stringify(pickArea(b, x)));

  /** A change made on the page: apply it and say so in the chat, with Undo. */
  const commit = (next: Workflow, reply: string, areas: Area[]) => {
    apply(next, areas);
    setChat((m) => [...m, { who: "agent", text: `${reply}${suffix}`, undo: w }]);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    setPop(null);
    setChat((m) => [...m, { who: "you", text: t }]);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (/^(undo|undo that|revert|go back)$/i.test(t.replace(/[.!]+$/, ""))) {
        const prev = past[past.length - 1];
        if (!prev) return setChat((m) => [...m, { who: "agent", text: "There's nothing to undo yet." }]);
        stepBack();
        return setChat((m) => {
          const k = m.map((x) => !!x.undo).lastIndexOf(true);
          return [...m.map((x, j) => (j === k ? { ...x, undo: undefined } : x)), { who: "agent", text: "Undone. It's back to how it was." }];
        });
      }
      const c = interpret(t, w);
      if (!c) return setChat((m) => [...m, { who: "agent", text: "I'm not sure what to change. Tell me what the agent should do differently, for example:" }]);
      const changed = c.areas.length > 0;
      if (changed) apply(c.next, c.areas);
      setChat((m) => [...m, { who: "agent", text: changed ? `${c.reply}${suffix}` : c.reply, undo: changed ? w : undefined }]);
    }, 550);
  };

  const undo = (k: number, prev: Workflow) => {
    apply(prev, changedAreas(prev, w));
    setChat((m) => [...m.map((x, j) => (j === k ? { ...x, undo: undefined } : x)), { who: "agent", text: "Undone. It's back to how it was." }]);
  };
  const stepBack = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [w, ...f]);
    apply(prev, changedAreas(prev, w), false);
  };
  const stepForward = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, w]);
    apply(next, changedAreas(next, w), false);
  };

  const publish = () => {
    const next = { ...w, kind: "preset" as const };
    saveWorkflow(w);
    setW(next);
    setToast("Published. It runs from its next trigger.");
  };
  // What it reads that this restaurant hasn't shared: Run asks for it instead of running (lib/mvp3/flows).
  const { account } = useAccount();
  const needs = missingFor(FOLDERS.flatMap((f) => f.skills).find((sk) => sk.id === w.id)?.access ?? w.integrations, account);
  const run = () => {
    saveWorkflow(w);
    runAgent(w);
    router.push("/");
  };

  // ── stages ──
  const firstStep = (gi: number) => w.groups.slice(0, gi).reduce((a, x) => a + x.steps.length, 0);
  const setGroups = (groups: WfGroup[]) => ({ ...w, groups });
  const addStage = (key: KindKey, at: number) => {
    const k = KINDS.find((x) => x.key === key)!;
    const groups = [...w.groups];
    groups.splice(at, 0, { title: k.title, steps: [k.step] });
    setPop(null);
    commit(setGroups(groups), `Added a ${k.label.toLowerCase()} stage: “${k.step}”`, ["steps"]);
  };
  const editStep = (gi: number, i: number, text: string) => {
    const t = text.trim();
    const g = w.groups[gi];
    if (t === g.steps[i]) return;
    const num = firstStep(gi) + i + 1;
    const steps = t ? g.steps.map((s, j) => (j === i ? t : s)) : g.steps.filter((_, j) => j !== i);
    commit(setGroups(w.groups.map((x, j) => (j === gi ? { ...x, steps } : x))), t ? `Step ${num} now reads “${t}”` : `Removed step ${num}: “${g.steps[i]}”`, ["steps"]);
  };
  const addStep = (gi: number, text: string) => {
    const t = text.trim();
    if (!t) return;
    const clean = cap(t) + (/[.?!]$/.test(t) ? "" : ".");
    if (!w.groups[gi]) return commit(setGroups([{ title: "Instructions", steps: [clean] }]), `Added step 1: “${clean}”`, ["steps"]);
    commit(setGroups(w.groups.map((x, j) => (j === gi ? { ...x, steps: [...x.steps, clean] } : x))), `Added step ${firstStep(gi) + w.groups[gi].steps.length + 1}: “${clean}”`, ["steps"]);
  };
  const renameStage = (gi: number, title: string) => {
    const t = title.trim();
    if (!t || t === w.groups[gi].title) return;
    commit(setGroups(w.groups.map((x, j) => (j === gi ? { ...x, title: t } : x))), `Renamed the stage to “${t}”.`, ["steps"]);
  };
  const removeStage = (gi: number) => {
    const g = w.groups[gi];
    commit(setGroups(w.groups.filter((_, j) => j !== gi)), `Removed the “${g.title}” stage and its ${g.steps.length} ${g.steps.length === 1 ? "step" : "steps"}.`, ["steps"]);
  };

  const status: { label: string; tone: "success" | "info" | "neutral" } = w.kind === "draft" ? { label: "Draft", tone: "info" } : w.state === "live" ? { label: "Live", tone: "success" } : { label: w.state === "idle" ? "Not live" : "Learning", tone: "neutral" };
  const ex = examples(w);
  const fresh = chat.length === 0;
  const unsure = !fresh && chat[chat.length - 1].text.endsWith("for example:");
  const trigger = w.triggers[0];
  const agentName = w.agent ? agentOf(w.agent).name : "KoreFi";

  // What lands in the inbox: the real weekly email where the agent has one, else its latest run's headline and figures.
  const kind = emailKindOf(w.id);
  const preview = useMemo(() => {
    if (kind) return true;
    return runHistory(w.id, w.thread).length > 0;
  }, [kind, w.id, w.thread]);

  const day = trigger?.match(/^Every (\w+day)/)?.[1];
  const setEmail = () => send(w.deliver.email ? "Stop emailing me" : "Email me each run");

  /** A Steps card or Configure row: jump to where that part is edited. */
  const goTo = (key: string) => {
    const tab = key === "sources" || key.startsWith("g") ? "configure" : "setup";
    setView(tab);
    window.setTimeout(() => document.getElementById(`part-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  // ───────── Steps: Trigger → Reads → Works → You get, four cards that always fit (Figma 1687:9592) ─────────

  /** One stop on the track: a round icon on the line, its name, and a glance at what it holds. Clicking jumps to where it's edited. */
  const stop = (key: string, Icon: LucideIcon, label: string, hint: React.ReactNode) => {
    const lit = key === "g0" ? flash.some((k) => /^g\d/.test(k)) : flash.includes(key) || (key === "output" && flash.some((k) => k === "show" || k === "rate"));
    return (
      <li key={key} className="min-w-0">
        <button type="button" onClick={() => goTo(key)} className={cn("group/stop flex w-full flex-col items-center gap-2 rounded-large px-1 pt-0.5 pb-1.5 text-center", focusRing)}>
          <span
            className={cn(
              "relative z-10 grid size-10 place-items-center rounded-circle border bg-(--color-background-secondary) text-(--color-primary) shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-[transform,border-color,box-shadow] duration-200 group-hover/stop:-translate-y-0.5 group-hover/stop:border-(--color-primary) group-hover/stop:shadow-[0_6px_16px_color-mix(in_srgb,var(--color-primary)_22%,transparent)] [&_svg]:size-[18px]",
              lit ? "border-(--color-primary) shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_16%,transparent)]" : "border-(--color-border-default)",
            )}
          >
            <Icon aria-hidden />
          </span>
          <span className="block max-w-full truncate text-body-sm font-medium text-(--color-text-primary)">{label}</span>
          <span className="flex h-4 max-w-full items-center justify-center gap-1 truncate text-body-sm text-(--color-text-secondary)">{hint}</span>
        </button>
      </li>
    );
  };
  const tiny = "size-3.5 shrink-0 text-(--color-text-secondary)";
  const steps = (
    <ol className="relative grid grid-cols-4" aria-label="How it works">
      {/* the line between the stops, and the pulse that runs along it */}
      <span aria-hidden className="absolute top-[21px] right-[12.5%] left-[12.5%] h-px overflow-hidden bg-(--color-border-input)">
        <span className="kf-flow absolute inset-y-0 w-1/5 bg-gradient-to-r from-transparent via-(--color-primary) to-transparent" />
      </span>
      {stop("when", trigger ? triggerIcon(trigger) : Play, "Trigger", trigger ? shortWhen(trigger) : "When you ask")}
      {stop(
        "sources",
        Plug,
        "Reads",
        w.integrations.length ? (
          <span className="flex items-center gap-1">
            {w.integrations.slice(0, 4).map((a) => (
              <span key={a} title={sourceOf(a).label} className="grid">
                <IntegrationMark name={a} size={14} />
              </span>
            ))}
            {w.integrations.length > 4 && <span className="pl-0.5 tabular-nums">+{w.integrations.length - 4}</span>}
          </span>
        ) : (
          "No apps yet"
        ),
      )}
      {stop("g0", ListChecks, "Works", `${w.groups.length} ${w.groups.length === 1 ? "stage" : "stages"} · ${stepsOf(w).length} steps`)}
      {stop(
        "output",
        Send,
        "You get",
        <>
          <MessageSquare className={tiny} aria-label="Chat message" />
          {w.deliver.email && <Mail className={tiny} aria-label="Email" />}
          {w.deliver.email && (w.tweaks?.attach === "excel" ? <FileSpreadsheet className={tiny} aria-label="Excel file" /> : <FileText className={tiny} aria-label="PDF" />)}
          {w.tweaks?.managerReports && <Users className={tiny} aria-label="Store manager reports" />}
        </>,
      )}
    </ol>
  );

  // ───────── Setup: four overall tweaks, numbered (whiteboard 2026-11-20) ─────────

  const flat = stepsOf(w);
  const tw = { ...DEFAULT_TWEAKS, ...w.tweaks };
  const tweak = (patch: Partial<Tweaks>, reply: string) => commit({ ...w, tweaks: { ...tw, ...patch } }, reply, ["setup"]);
  /** Error rates are a chargeback idea; other agents skip the outlet filter. */
  const hasRate = /chargeback/i.test(w.id);
  const freq = !trigger ? "manual" : trigger.startsWith("Daily") ? "daily" : trigger.startsWith("Monthly") ? "monthly" : day ? "weekly" : "custom";
  const time = timeOf(trigger);
  const setWhen = (f: string, d = day ?? "Monday", t = time) => send(f === "manual" ? "Only when I ask" : f === "daily" ? `Run daily at ${t}` : f === "monthly" ? `Run monthly at ${t}` : `Run every ${d} at ${t}`);

  /** One numbered setting row: number and title on the left, its controls on the right (stacked on narrow panes). */
  const setting = (n: number, id: string, title: string, body: React.ReactNode) => (
    <li key={id} id={`part-${id}`} className={cn("flex scroll-mt-6 flex-col gap-3 px-4 py-4 transition-colors duration-500 xl:flex-row xl:items-start xl:gap-6", flash.includes(id) && "bg-(--color-brand-lightest)")}>
      <div className="flex shrink-0 items-center gap-2.5 xl:w-52 xl:pt-1">
        <span className="grid size-5 shrink-0 place-items-center rounded-circle bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary) tabular-nums">{n}</span>
        <h3 className="text-body-md font-medium text-(--color-text-primary)">{title}</h3>
      </div>
      <div className="min-w-0 flex-1">{body}</div>
    </li>
  );

  const items = [
    setting(
      1,
      "when",
      "When it runs",
      <div className="flex flex-wrap items-end gap-2">
        <Selector size="sm" label="Repeat" isLabelHidden value={freq === "custom" ? "weekly" : freq} onChange={(v) => setWhen(v)} options={[{ value: "weekly", label: "Every week" }, { value: "daily", label: "Every day" }, { value: "monthly", label: "Every month" }, { value: "manual", label: "Only when I ask" }]} />
        {freq === "weekly" && <Selector size="sm" label="Day" isLabelHidden value={day} onChange={(v) => setWhen("weekly", v)} options={DAYS.map((d) => ({ value: d, label: `on ${d}` }))} />}
        {freq !== "manual" && <Selector size="sm" label="Time" isLabelHidden value={time} onChange={(v) => setWhen(freq === "custom" ? "weekly" : freq, day, v)} options={TIMES.map((t) => ({ value: t, label: `at ${t.replace(":00", "")}` }))} />}
      </div>,
    ),
    hasRate &&
      setting(
        2,
        "rate",
        "Instructions",
        <div className="flex flex-wrap items-center gap-2 text-body-md text-(--color-text-primary)">
          <span>Show</span>
          <Selector size="sm" label="Which outlets to show" isLabelHidden value={String(tw.minErrorRate)} onChange={(v) => tweak({ minErrorRate: Number(v) }, Number(v) ? `It now only shows outlets with an error rate above ${v}%.` : "It now shows every outlet.")} options={RATES.map((r) => ({ value: String(r), label: r ? `Outlets with error rate above ${r}%` : "All outlets" }))} />
        </div>,
      ),
    setting(
      hasRate ? 3 : 2,
      "show",
      "What it shows",
      <>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <CheckboxInput size="sm" label="Insights" value={tw.insights} onChange={(on) => tweak({ insights: on }, on ? "Each run now includes insights." : "Insights are off.")} />
          <CheckboxInput size="sm" label="Suggested actions" value={tw.actions} onChange={(on) => tweak({ actions: on }, on ? "Each run now includes suggested actions." : "Suggested actions are off.")} />
        </div>
        <ContextField key={tw.context} value={tw.context} onSave={(t) => tweak({ context: t }, t ? "Got it. I'll keep that in mind for insights and actions." : "Cleared the context.")} />
      </>,
    ),
    setting(
      hasRate ? 4 : 3,
      "output",
      "Detailed version",
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={w.deliver.email} label="Email me each run" onChange={setEmail} />
          <span className="text-body-md text-(--color-text-primary)">Email it as</span>
          <SegmentedControl size="sm" label="Attachment" value={tw.attach} isDisabled={!w.deliver.email} onChange={(v) => tweak({ attach: v as Tweaks["attach"] }, `The email now comes with ${v === "pdf" ? "a PDF" : "an Excel file"}.`)}>
            <SegmentedControlItem value="pdf" label="PDF" icon={<FileText className="size-3.5" aria-hidden />} />
            <SegmentedControlItem value="excel" label="Excel" icon={<FileSpreadsheet className="size-3.5" aria-hidden />} />
          </SegmentedControl>
          <span className="flex items-center gap-0.5 border-l border-(--color-border-default) pl-3">
            <span className="mr-1 text-body-sm text-(--color-text-secondary)">Preview</span>
            {kind && preview && <IconButton variant="ghost" size="sm" label="Preview the email" tooltip="Email" icon={<Mail className="size-4" />} onClick={() => setMail(true)} />}
            <IconButton variant="ghost" size="sm" label="Preview the PDF" tooltip="PDF" icon={<FileText className="size-4" />} onClick={() => setFile("pdf")} />
            <IconButton variant="ghost" size="sm" label="Preview the Excel file" tooltip="Excel" icon={<FileSpreadsheet className="size-4" />} onClick={() => setFile("excel")} />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-(--color-border-default) pt-3">
          <Toggle on={tw.managerReports} label="Show outlet-wise reports to store managers" onChange={() => tweak({ managerReports: !tw.managerReports }, tw.managerReports ? "Store managers won't get their outlet's report any more." : "Each store manager now gets their own outlet's report.")} />
          <span className="text-body-md text-(--color-text-primary)">Show outlet-wise reports to store managers</span>
          {dash?.pinned && (
            <button type="button" onClick={() => router.push(`/dashboard?id=${dash.id}`)} className={cn("max-w-full truncate rounded-small text-body-sm text-(--color-text-clickable) underline", focusRing)}>
              Open {dash.title}
            </button>
          )}
        </div>
      </div>,
    ),
  ];
  const setup = <ol className={cn(card, "divide-y divide-(--color-border-default) overflow-hidden")}>{items.filter(Boolean)}</ol>;

  // ───────── Configure: Instructions and Knowledge, as cards (after Copilot's agent builder) ─────────

  /** "Suggest improvements": the agent posts a few ideas in the chat, each a chip that applies it. */
  const suggest = (area: "instructions" | "knowledge") => {
    const have = flat.map((x) => x.text.toLowerCase()).join(" ");
    const ideas =
      area === "instructions"
        ? ["Add a step: compare with the week before", "Add a step: flag outlets with 3 or more charges in a week", "Add a step: group charges by reason", "Add a step: note which items get charged back most"].filter((x) => !have.includes(x.split(": ")[1].split(" ").slice(0, 3).join(" ")))
        : ALL_INTEGRATIONS.filter((a) => !w.integrations.includes(a)).slice(0, 3).map((a) => `Also read ${a}`);
    setChat((m) => [
      ...m,
      {
        who: "agent",
        text: ideas.length
          ? area === "instructions"
            ? "A few ways to sharpen the instructions. Tap one to add it:"
            : `It could read more to find the cause. Tap one to add it, or attach a file like your refund policy on the right:`
          : "It already covers what I'd suggest. Tell me anything you'd like to change.",
        chips: ideas.slice(0, 3),
      },
    ]);
  };
  const info = (text: string) => (
    <span title={text} aria-label={text} role="img" className="inline-grid text-(--color-text-tertiary)">
      <Info className="size-4" aria-hidden />
    </span>
  );
  const cardHead = (title: string, tip: string, right: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-subtitle-sm font-medium text-(--color-text-primary)">{title}</h3>
      {info(tip)}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  );
  const suggestButton = (area: "instructions" | "knowledge") => <Button size="sm" variant="secondary" label="Suggest improvements" icon={<Quote className="size-4" />} onClick={() => suggest(area)} />;

  /** Edit mode: each stage's name and steps, edited in place. */
  const stageEdit = (gi: number) => {
    const g = w.groups[gi];
    return (
      <div key={`${gi}-${g.title}`} className={cn("group/stage rounded-medium transition-colors duration-500", flash.includes(`g${gi}`) && "bg-(--color-brand-lightest)")}>
        <div className="flex items-center gap-2">
          <input
            key={g.title}
            defaultValue={g.title}
            aria-label="Stage name"
            onBlur={(e) => renameStage(gi, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="-ml-1.5 min-w-0 flex-1 rounded-small px-1.5 py-0.5 text-body-md font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus:bg-(--color-neutral-lightest)"
          />
          <IconButton variant="ghost" size="sm" label={`Delete the ${g.title} stage`} tooltip="Delete stage" icon={<Trash2 className="size-4" />} onClick={() => removeStage(gi)} />
        </div>
        <ul className="mt-1 space-y-0.5">
          {g.steps.map((text, i) => {
            const num = firstStep(gi) + i + 1;
            return (
              <li key={`${gi}-${i}-${text}`} className="group/step flex items-start gap-2 text-body-md text-(--color-text-primary)">
                <span aria-hidden className="mt-[11px] ml-1.5 size-1 shrink-0 rounded-circle bg-(--color-text-primary)" />
                <textarea
                  defaultValue={text}
                  rows={1}
                  aria-label={`Step ${num}`}
                  onBlur={(e) => editStep(gi, i, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), e.currentTarget.blur())}
                  className="block min-w-0 flex-1 resize-none field-sizing-content rounded-small px-1.5 py-0.5 caret-(--color-primary) outline-none hover:bg-(--color-neutral-lightest) focus:bg-(--color-neutral-lightest)"
                />
                <button type="button" aria-label={`Remove step ${num}`} title="Remove this step" onClick={() => editStep(gi, i, "")} className={cn(iconButton, "mt-0.5 size-6 shrink-0 opacity-0 group-hover/step:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100")}>
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
          <li key={`${gi}-new-${g.steps.length}`} className="flex items-center gap-2">
            <Plus className="ml-0.5 size-3.5 shrink-0 text-(--color-text-tertiary)" aria-hidden />
            <input
              type="text"
              placeholder="Add a step, then press Enter"
              aria-label={`Add a step to ${g.title}`}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addStep(gi, e.currentTarget.value);
              }}
              className="min-w-0 flex-1 rounded-small px-1.5 py-0.5 text-body-md text-(--color-text-primary) caret-(--color-primary) outline-none placeholder:text-(--color-text-tertiary) hover:bg-(--color-neutral-lightest) focus:bg-(--color-neutral-lightest)"
            />
          </li>
        </ul>
      </div>
    );
  };

  const instructionsCard = (
    <section id="part-g0" aria-label="Instructions" className={cn(card, "scroll-mt-6 rounded-[16px] p-5")}>
      {cardHead(
        "Instructions",
        "What the agent does on each run, stage by stage. Write it the way you'd brief a person.",
        <>
          {suggestButton("instructions")}
          <SegmentedControl size="sm" label="Instructions mode" value={mode} onChange={(v) => setMode(v as "view" | "edit")}>
            <SegmentedControlItem value="view" label="View" isLabelHidden icon={<Eye className="size-4" aria-hidden />} />
            <SegmentedControlItem value="edit" label="Edit" isLabelHidden icon={<Pencil className="size-4" aria-hidden />} />
          </SegmentedControl>
        </>,
      )}
      {mode === "view" ? (
        <div className="relative mt-4">
          <div className={cn("space-y-5 overflow-hidden text-body-md text-(--color-text-primary)", !more && "max-h-[320px]")}>
            <div>
              <h4 className="mb-1.5 text-body-md font-medium">Purpose</h4>
              <p className="text-pretty">{w.overview}</p>
            </div>
            {w.groups.map((g, gi) => (
              <div key={gi} className={cn("rounded-medium transition-colors duration-500", flash.includes(`g${gi}`) && "bg-(--color-brand-lightest)")}>
                <h4 className="mb-1.5 text-body-md font-medium">{g.title || "Untitled"}</h4>
                <ul className="list-disc space-y-1 pl-5 marker:text-(--color-text-secondary)">
                  {g.steps.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
            {!w.groups.length && <p className="text-(--color-text-secondary)">No stages yet. Switch to edit, or tell the chat what it should do first.</p>}
          </div>
          {!more && w.groups.length > 1 && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-(--color-background-secondary) to-transparent" />}
          {w.groups.length > 1 && (
            <button type="button" onClick={() => setMore(!more)} className={cn("relative mt-2 rounded-small text-body-sm text-(--color-text-clickable) underline", focusRing)}>
              {more ? "Show less" : "Show all"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {w.groups.map((_, gi) => stageEdit(gi))}
          <Pop
            id="cfg-add"
            at={pop}
            set={setPop}
            align="left"
            label="Add a stage"
            trigger={
              <>
                <Plus className="size-4" aria-hidden />
                Add stage
              </>
            }
            triggerClass={cn("flex items-center gap-1.5 rounded-medium border border-(--color-border-default) px-2.5 py-1 text-body-md text-(--color-text-primary) transition-colors hover:bg-(--color-neutral-lightest)", focusRing)}
          >
            {KINDS.map((k) => (
              <KindRow key={k.key} compact Icon={k.Icon} label={k.label} hint={k.hint} onPick={() => addStage(k.key, w.groups.length)} />
            ))}
          </Pop>
        </div>
      )}
    </section>
  );

  const files = w.knowledge ?? [];
  const knowledgeCard = (
    <section id="part-sources" aria-label="Knowledge" className={cn(card, "scroll-mt-6 rounded-[16px] p-5")}>
      {cardHead("Knowledge", "What the agent reads. It only reads, and never changes anything.", suggestButton("knowledge"))}
      <div className="mt-4 rounded-large border border-(--color-border-default) p-4">
        {!files.length && <p className="mb-3 text-center text-body-md text-(--color-text-secondary)">Focus your agent by adding files, like recipes and payrolls</p>}
        <div className={cn(!files.length && "mx-auto max-w-[260px]")}>
          <Files files={files} onChange={(knowledge) => commit({ ...w, knowledge }, knowledge.length > files.length ? `Added ${knowledge[knowledge.length - 1].name}. It reads it alongside the reports.` : "Removed the file.", [])} />
        </div>
      </div>
      <ul className={cn("mt-4 transition-colors duration-500", flash.includes("sources") && "rounded-medium bg-(--color-brand-lightest)")}>
        {ALL_INTEGRATIONS.map((a) => {
          const on = w.integrations.includes(a);
          return (
            <li key={a} className="flex items-center gap-3 py-2.5">
              <IntegrationMark name={a} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md text-(--color-text-primary)">{sourceOf(a).label}</span>
                <span className="block truncate text-body-sm text-(--color-text-secondary)">{sourceOf(a).reads}</span>
              </span>
              <Toggle on={on} label={`Read ${sourceOf(a).label}`} onChange={() => send(on ? `Stop reading ${a}` : `Also read ${a}`)} />
            </li>
          );
        })}
      </ul>
    </section>
  );

  const configure = (
    <div className="space-y-5">
      {instructionsCard}
      {knowledgeCard}
    </div>
  );

  const tabs = (
    <TabList role="tablist" value={view} onChange={(v) => setView(v as "setup" | "configure")} hasDivider>
      <Tab value="setup" label="Setup" panelId="agent-setup" />
      <Tab value="configure" label="Configure" panelId="agent-configure" />
    </TabList>
  );

  // ───────── the page: one card, header across the top, chat on the left, the agent on the right (Figma 1687:9039) ─────────

  return (
    <section aria-label="Workflow" className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-(--color-background-secondary) selection:bg-(--color-brand-light)">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--color-border-default) px-3 sm:px-4">
        <IconButton variant="ghost" size="sm" label="Back" tooltip="Back" icon={<ArrowLeft className="size-4" />} onClick={() => router.back()} />
        <h1 id="node-name" className={cn("min-w-0 truncate rounded-small px-1 text-body-md font-medium text-(--color-text-primary) transition-colors duration-500", flash.includes("name") && "bg-(--color-brand-light)")}>
          {w.title}
        </h1>
        <Badge variant={status.tone} label={status.label} />
        <div className="ml-auto flex items-center gap-1">
          {(saved || w.kind === "draft") && <span className="mr-2 hidden truncate text-body-sm text-(--color-text-secondary) sm:inline">{saved ? `${w.kind === "draft" ? "Draft updated" : "Saved"} ${saved}` : "Not published yet"}</span>}
          <IconButton variant="ghost" size="sm" label="Undo" tooltip="Undo" icon={<Undo2 className="size-4" />} isDisabled={!past.length} onClick={stepBack} />
          <IconButton variant="ghost" size="sm" label="Redo" tooltip="Redo" icon={<Redo2 className="size-4" />} isDisabled={!future.length} onClick={stepForward} />
          {w.kind !== "draft" && hasRuns(w.id) && <Button size="sm" variant="ghost" label="Runs" icon={<History className="size-4" />} onClick={() => router.push(`/agent?id=${w.id}`)} />}
          {w.kind === "draft" && <Button size="sm" label="Publish" icon={<Rocket className="size-4" />} onClick={publish} />}
          <span className="ml-1">
            <Button size="sm" variant="primary" label="Run now" icon={<Play className="size-4" />} onClick={run} />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ── the chat: change anything in your own words ── */}
        <div className="flex shrink-0 flex-col p-3 lg:w-[clamp(320px,30%,420px)]">
          <aside aria-label="Change this agent by chat" className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[16px] border border-(--color-border-default) bg-(--color-background-primary) lg:min-h-0">
            {fresh ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-6 text-center">
                {w.agent ? <AgentAvatar agent={w.agent} size={48} /> : <Sparkles className="size-8 text-(--color-primary)" aria-hidden />}
                <p className="mt-3 text-subtitle-md font-medium text-balance text-(--color-text-primary)">What should {w.title} do differently?</p>
                <p className="mt-1.5 max-w-[320px] text-body-md text-pretty text-(--color-text-secondary)">Tell me in your own words, or edit it on the right. I save as I go, and you can undo any change.</p>
              </div>
            ) : (
              <ul ref={log} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
                {chat.map((m, k) =>
                  m.who === "you" ? (
                    <li key={k} className="ml-auto w-fit max-w-[85%] rounded-large bg-(--color-neutral-light) px-3 py-1.5 text-body-md text-(--color-text-primary)">
                      {m.text}
                    </li>
                  ) : (
                    <li key={k} className="flex gap-2.5">
                      {w.agent && <AgentAvatar agent={w.agent} size={22} className="mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        {m.undo ? (
                          <div className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-3">
                            <p className="text-body-sm font-medium text-(--color-text-secondary)">What I changed</p>
                            <p className="mt-1 text-body-md text-(--color-text-primary)">{m.text}</p>
                            <div className="mt-2">
                              <Button size="sm" variant="ghost" label="Undo" icon={<Undo2 className="size-4" aria-hidden />} onClick={() => undo(k, m.undo!)} />
                            </div>
                          </div>
                        ) : (
                          <p className="text-body-md text-(--color-text-primary)">{m.text}</p>
                        )}
                        {m.chips?.length && k === chat.length - 1 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.chips.map((x) => (
                              <button key={x} type="button" onClick={() => send(x)} className={cn(pill, "px-3 py-1.5 text-left")}>
                                {x}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ),
                )}
                {typing && (
                  <li className="flex items-center gap-2.5" aria-live="polite">
                    {w.agent && <AgentAvatar agent={w.agent} size={22} className="shrink-0" />}
                    <span className="flex gap-1 rounded-large bg-(--color-neutral-lightest) px-3 py-2.5" aria-label={`${agentName} is typing`}>
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="size-1.5 animate-bounce rounded-circle bg-(--color-text-tertiary)" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  </li>
                )}
              </ul>
            )}
            <div className="shrink-0 px-3 pb-3">
              {(fresh || unsure) && (
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {ex.map((x) => (
                    <button key={x} type="button" onClick={() => send(x)} className={cn(pill, "px-3 py-1.5 text-left")}>
                      {x}
                    </button>
                  ))}
                </div>
              )}
              <Composer
                placeholder={`Reply to ${agentName}`}
                intercept={(t) => {
                  send(t);
                  return true;
                }}
              />
              <ComposerNote />
            </div>
          </aside>
        </div>

        {/* ── the agent: who it is, its steps, then Setup or Configure ── */}
        <div className="min-w-0 flex-1 bg-(--color-background-secondary) lg:overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            <div className="flex items-start gap-3">
              {w.agent ? <AgentAvatar agent={w.agent} size={40} className="shrink-0" /> : <span className="grid size-10 shrink-0 place-items-center rounded-medium bg-(--color-brand-lightest) text-(--color-primary)"><Sparkles className="size-5" aria-hidden /></span>}
              <div className="min-w-0 flex-1">
                <label className="group/name flex items-center gap-2">
                  <input
                    key={w.title}
                    defaultValue={w.title}
                    aria-label="Agent name"
                    onBlur={(e) => {
                      const t = e.target.value.trim();
                      if (t && t !== w.title) commit({ ...w, title: t }, `Renamed to ${t}.`, ["name"]);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="-ml-1.5 field-sizing-content max-w-full min-w-[4ch] rounded-small px-1.5 text-[20px] leading-7 font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus:bg-(--color-neutral-lightest)"
                  />
                  <Pencil className="size-3.5 shrink-0 text-(--color-text-tertiary) opacity-0 group-hover/name:opacity-100" aria-hidden />
                </label>
                <textarea
                  key={w.overview}
                  defaultValue={w.overview}
                  aria-label="What it does"
                  rows={2}
                  onBlur={(e) => {
                    const t = e.target.value.trim();
                    if (t && t !== w.overview) commit({ ...w, overview: t }, "I rewrote the overview.", ["overview"]);
                  }}
                  className="-ml-1.5 mt-1 block w-full resize-none field-sizing-content rounded-small px-1.5 py-0.5 text-body-sm text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) focus:bg-(--color-neutral-lightest) focus:text-(--color-text-primary)"
                />
              </div>
            </div>

            {/* What the agent has and what it needs from the owner, before Run (leadership flow 3). */}
            {needs.length > 0 && (
              <section aria-label="What it needs" className="grid max-w-[640px] gap-1.5 rounded-large border border-(--color-border-default) bg-(--color-background-primary) px-4 py-3 text-body-md">
                <p>
                  <b className="font-semibold">Has:</b> {account.hasLabel ?? "Your sales reports"}
                </p>
                <p>
                  <b className="font-semibold">Needs from you:</b> {needs.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(" · ")}
                </p>
              </section>
            )}

            <section aria-labelledby="h-steps">
              <h2 id="h-steps" className={pageHead}>Steps</h2>
              <div className="mt-3 max-w-[680px]">{steps}</div>
            </section>

            {tabs}

            {view === "setup" ? (
              <div id="agent-setup" role="tabpanel" className="-mt-1 flex flex-col gap-6">
                {setup}
              </div>
            ) : (
              <div id="agent-configure" role="tabpanel" className="-mt-1">{configure}</div>
            )}
          </div>
        </div>
      </div>

      {mail && kind && <EmailModal kind={kind} onClose={() => setMail(false)} />}
      {file && <ReportModal format={file} title={w.title} onClose={() => setFile(null)} />}
      <Toast message={toast} onDismiss={dismiss} />
    </section>
  );
}

/** The part of a workflow each page area shows, to flash only what an undo changed. */
function pickArea(w: Workflow, a: Area) {
  return a === "name" ? w.title : a === "overview" ? w.overview : a === "steps" ? w.groups : a === "inputs" ? w.inputs : [w.triggers, w.integrations, w.deliver, w.tweaks];
}
