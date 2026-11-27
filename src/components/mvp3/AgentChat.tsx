"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUp, Bike, Circle, CircleCheck, Upload, Users, Bot, History, MoreHorizontal, Pencil, Check, ChevronDown, Copy, FileText, Landmark, Maximize2, Minimize2, Pin, Plus, ShieldCheck, Sparkles, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { FOLDERS, REPORTS, SUGGESTIONS, agentOf, seedThreads, type AgentId, type AgentReply, type Message, type ReportId } from "@/lib/mvp3/agents";
import { useAgents, type CanvasId } from "./AgentsProvider";
import type { Store } from "@/lib/finance/outlets";
import { outletsLabel } from "@/lib/mvp3/outletScope";
import { SAMPLE_FILES } from "@/lib/mvp3/labor";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { AgentAvatar, StepOrb, type AvatarMood } from "./AgentAvatar";
import { AgentFolders } from "./AgentFolders";
import { useAccount } from "./AccountSwitcher";
import { AgentDashboard, AutomationCard, BarDivider, CardChip, DashboardCard, PinToggle, SampleBanner, SampleTag, ScheduleControl } from "./AgentDashboard";
import { ReportView } from "./reportViews";
import { ActivityLog } from "./ActivityLog";
import { PinnedSummary } from "./PinnedSummary";
import { OutletCard, OutletPanel, SheetCard } from "./OutletDive";
import { OrderAction } from "./OrderAction";
import { OrderDraft } from "./OrderDraft";
import { activityLog } from "@/lib/mvp3/activity";
import { PointLayer } from "./PointLayer";
import { Welcome, useOnboarding } from "./Onboarding";
import { iconButton, pill } from "@/components/mvp3/styles";

// MVP 3's main area. With no chat open it's the home: a greeting, the composer, and the agents with
// what each posted last. A chat is the conversation on the left; an agent's report opens on the right
// as a canvas (the real /mvp2 report, so the numbers are the same), and can take the full width.

const iconBtn = cn(iconButton, "size-8 [&_svg]:size-4");
// Home suggestions: ChatGPT's icon pills, one icon per SUGGESTIONS entry (same order).
const suggestion = cn(pill, "inline-flex items-center gap-2 px-3.5 py-2 text-body-md");
const SUGGESTION_ICONS = [ShieldCheck, TrendingUp, Landmark, Bike, Users];
/** A restaurant whose dashboards KoreFi pinned (Masa Kitchen): asks about those dashboards. */
const PINNED_SUGGESTIONS = [
  { text: "What changed on chargebacks this week?", Icon: ShieldCheck },
  { text: "Which outlets get the most chargebacks?", Icon: Bike },
  { text: "Did every payout match Toast?", Icon: Landmark },
  { text: "How did we do last week?", Icon: TrendingUp },
];
const chip = cn(pill, "px-3 py-1.5 text-left");

/** An agent's face (bot-avatars via AgentAvatar). Kept as AgentMark so every call site stays the same. */
export function AgentMark({ agent, size = 28, mood, className }: { agent: AgentId; size?: number; mood?: AvatarMood; className?: string }) {
  return <AgentAvatar agent={agent} size={size} mood={mood} className={className} animate />;
}

// ───────── Composer ─────────

// ChatGPT-style pill: attach on the left, the field grows with the text, send on the right. Once the
// text wraps, the field takes the full width and the buttons drop to a row beneath it.
const MAX_FIELD = 200;

/** `intercept` sees the text first; returning true means it was handled (the onboarding chat answers its own questions). */
export function Composer({ placeholder, onSend, intercept }: { placeholder?: string; onSend?: () => void; intercept?: (text: string) => boolean }) {
  const { send, upload, busy: mainBusy, pointed, setPointed, active } = useAgents();
  // A composer with its own handler (the agent editor, onboarding) isn't held up by the main chat working.
  const busy = mainBusy && !intercept;
  const [text, setText] = useState("");
  // Files added with the + (names only, prototype). The main chat sends them with the message.
  const [files, setFiles] = useState<string[]>([]);
  const file = files.length > 0;
  const [tall, setTall] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Focus on mount, and again when a dashboard card is pointed at so the owner can type straight away.
  useEffect(() => {
    ref.current?.focus();
  }, [pointed]);
  // Grow with the text up to MAX_FIELD, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD)}px`;
    setTall(text.includes("\n") || el.scrollHeight > 40);
  }, [text]);
  // Keep the caret in the field when it moves between the one-row and stacked layouts.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && text) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [tall]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = () => {
    if (busy) return;
    if (files.length && !intercept) {
      onSend?.();
      upload(files, text);
      setText("");
      setFiles([]);
      return;
    }
    if (!text.trim()) return;
    if (intercept?.(text.trim())) {
      setText("");
      setFiles([]);
      return;
    }
    onSend?.();
    send(text);
    setText("");
    setFiles([]);
  };
  const ready = (!!text.trim() || (file && !intercept)) && !busy;
  // The agent is waiting on files (labor leakage): the composer becomes the drop zone, with the checklist in it.
  const last = active?.messages.at(-1);
  const docs = !intercept && last?.role === "agent" && "reply" in last ? last.reply.docs : undefined;
  const [typingFor, setTypingFor] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  if (docs && docs.some((d) => !d.file) && last && typingFor !== last.id) {
    const take = (list: FileList | null) => {
      const names = Array.from(list ?? [], (f) => f.name);
      if (names.length && !busy) upload(names);
    };
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-[20px] border border-dashed px-4 py-5 text-center transition-colors",
          dragging ? "border-(--color-text-primary) bg-(--color-neutral-lightest)" : "border-(--color-border-emphasized) bg-(--color-background-secondary)",
        )}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" multiple hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        <Upload className="size-5 text-(--color-text-secondary)" aria-hidden />
        <p className="text-body-md text-(--color-text-primary)">
          {busy ? "Reading your files…" : <>Drop files here or <button type="button" onClick={() => fileRef.current?.click()} className="font-medium underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">browse</button></>}
        </p>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {docs.map((d) => (
            <li key={d.kind} title={d.file ?? d.hint} className={cn("inline-flex items-center gap-1.5 rounded-circle border px-2.5 py-1 text-body-sm", d.file ? "border-transparent bg-(--color-neutral-lightest) text-(--color-text-primary)" : "border-(--color-border-default) text-(--color-text-secondary)")}>
              {d.file ? <CircleCheck className="size-3.5 text-(--color-text-success)" aria-label="Added" /> : <Circle className="size-3.5" aria-label="Not added yet" />}
              {d.label}
              {!d.file && !d.required && <span className="text-(--color-text-tertiary)">· optional</span>}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-body-sm text-(--color-text-tertiary)">
          {/* Demo: drops in the Taco Pros sample files still missing (also downloadable from /samples/labor). */}
          <button type="button" disabled={busy} onClick={() => upload(docs.filter((d) => !d.file).map((d) => SAMPLE_FILES[d.kind]))} className="text-body-sm text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            Use sample files
          </button>
          ·
          <button type="button" onClick={() => setTypingFor(last.id)} className="text-body-sm text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            Type a message instead
          </button>
        </p>
      </div>
    );
  }
  const attach = (
    <button type="button" aria-label="Add a file" title="Add a file" onClick={() => fileRef.current?.click()} className="grid size-8 shrink-0 place-items-center rounded-circle text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
      <Plus className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
  const submit = (
    // While an agent works the button holds a thinking orb (light dots on the dark fill).
    <button
      type="submit"
      aria-label={busy ? "Agent is working" : "Send"}
      disabled={!ready}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-circle outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary)",
        ready || busy ? "bg-(--color-text-primary) text-(--color-text-inverse-primary) hover:bg-(--color-neutral-darkest)" : "bg-(--color-neutral-light) text-(--color-text-secondary)",
      )}
    >
      {busy ? <ThinkingOrb state="working" size={20} theme="dark" aria-hidden /> : <ArrowUp className="size-4" strokeWidth={2.25} />}
    </button>
  );
  const field = (
    <textarea
      ref={ref}
      rows={1}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          go();
        }
      }}
      placeholder={pointed && !intercept ? "What should change on this card?" : (placeholder ?? "Ask your agents anything")}
      aria-label="Message your agents"
      className={cn("block min-w-0 resize-none bg-transparent py-1.5 text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)", tall ? "w-full px-2" : "flex-1 px-1")}
    />
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className={cn(
        "border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.06),0_0_1px_rgb(0_0_0/0.12)]",
        tall || file || pointed ? "rounded-[20px]" : "rounded-[22px]",
      )}
    >
      {pointed && !intercept && (
        <div className="px-1 pb-2">
          <CardChip r={pointed} onRemove={() => setPointed(null)} />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [], (f) => f.name);
          setFiles((fs) => [...fs, ...picked.filter((n) => !fs.includes(n))]);
          e.target.value = "";
        }}
      />
      {file && (
        <div className="flex flex-wrap gap-1.5 px-1 pb-2">
          {files.map((f) => (
            <span key={f} className="inline-flex max-w-full items-center gap-2 rounded-large border border-(--color-border-default) py-1 pr-1 pl-2 text-body-sm text-(--color-text-primary)">
              <FileText className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
              <span className="truncate">{f}</span>
              <button type="button" aria-label={`Remove ${f}`} onClick={() => setFiles((fs) => fs.filter((x) => x !== f))} className={iconBtn}>
                <X />
              </button>
            </span>
          ))}
        </div>
      )}
      {tall ? (
        <>
          {field}
          <div className="flex items-center justify-between pt-1">
            {attach}
            {submit}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-1">
          {attach}
          {field}
          {submit}
        </div>
      )}
    </form>
  );
}

/** The quiet line under the composer, where ChatGPT puts its disclaimer. */
export function ComposerNote() {
  return <p className="pt-1.5 text-center text-body-sm text-(--color-text-tertiary)">Agents are read-only and never change your data.</p>;
}

// ───────── Messages ─────────

function WorkLog({ steps, done, live = false }: { steps: string[]; done: number; live?: boolean }) {
  const [open, setOpen] = useState(live);
  const shown = live ? steps.slice(0, done + 1) : steps;
  return (
    <div className="text-body-sm text-(--color-text-secondary)">
      {!live && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="-ml-1 inline-flex items-center gap-1 rounded-small px-1 py-0.5 outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          Worked through {steps.length} {steps.length === 1 ? "step" : "steps"}
          <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden />
        </button>
      )}
      {(open || live) && (
        <ol className={cn("mt-1 space-y-1 border-l border-(--color-border-default) pl-3", live && "mt-0")}>
          {shown.map((s, i) => {
            const finished = !live || i < done;
            return (
              <li key={s} className="flex items-center gap-1.5 motion-safe:animate-page-in">
                {finished ? <Check className="size-3.5 shrink-0 text-(--color-text-success)" aria-hidden /> : <span className="-m-0.5 grid size-5 shrink-0 place-items-center"><StepOrb step={s} /></span>}
                <span className={cn(!finished && "text-(--color-text-primary)")}>{s}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ReportCard({ report, outlets, card }: { report: ReportId; outlets?: Store[]; card?: { title: string; sub: string } }) {
  const { canvas, canvasOutlets, setCanvas, dashboards } = useAgents();
  const pinned = dashboards.some((d) => d.id === `report-${report}` && d.pinned);
  const on = canvas === report && (canvasOutlets ?? []).join("|") === (outlets ?? []).join("|");
  const r = card ?? REPORTS[report];
  return (
    <button
      type="button"
      onClick={() => setCanvas(on ? null : report, outlets)}
      aria-pressed={on}
      className={cn(
        "flex w-full max-w-sm items-center gap-3 rounded-large border bg-(--color-background-secondary) p-2.5 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
        on ? "border-(--module-line) bg-(--module-soft)" : "border-(--color-border-default) hover:border-(--color-border-darker)",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-(--module-tint) text-(--module-strong)">
        <FileText className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-body-md font-medium text-(--color-text-primary)">
          {r.title}
          {pinned && <Pin className="size-3 text-(--color-text-secondary)" aria-label="Pinned" />}
        </span>
        <span className="block truncate text-body-sm text-(--color-text-secondary) @max-[560px]/chat:whitespace-normal">{outlets?.length ? (/all outlets/i.test(r.sub) ? r.sub.replace(/all outlets/i, outletsLabel(outlets)) : `${r.sub} · ${outletsLabel(outlets)}`) : r.sub}</span>
      </span>
      <span className="shrink-0 pr-1 text-body-sm text-(--color-text-clickable)">{on ? "Open" : "View"}</span>
    </button>
  );
}

/** What the agent needs from the owner, ticked off as each file arrives. */
function Checklist({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <ul className="space-y-1">
      {items.map((x) => (
        <li key={x.label} className="flex items-center gap-2 text-body-md text-(--color-text-primary)">
          <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border", x.done ? "border-(--color-primary) bg-(--color-primary) text-white" : "border-(--color-border-darker)")}>
            {x.done && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className={cn(x.done && "text-(--color-text-secondary)")}>{x.label}</span>
          <span className="sr-only">{x.done ? "(done)" : "(still needed)"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A file read back: a few rows, so the owner can say it's right. */
function MiniTable({ t }: { t: { head: string[]; rows: string[][] } }) {
  return (
    <div className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
      <table className="w-full text-left text-body-sm">
        <thead className="bg-(--color-neutral-lightest) text-(--color-text-secondary)">
          <tr>{t.head.map((h, i) => <th key={h} scope="col" className={cn("px-3 py-1.5 font-medium", i > 0 && "text-right")}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-(--color-border-default)">
          {t.rows.map((r) => (
            <tr key={r[0]}>{r.map((c, i) => <td key={i} className={cn("px-3 py-1.5 text-(--color-text-primary)", i > 0 && "text-right tabular-nums")}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A card for a canvas that isn't a dashboard or report (the order draft): opens it beside the chat. */
function CanvasCard({ id, title, sub }: { id: CanvasId; title: string; sub: string }) {
  const { canvas, setCanvas } = useAgents();
  const on = canvas === id;
  return (
    <button
      type="button"
      onClick={() => setCanvas(on ? null : id)}
      aria-pressed={on}
      className={cn("flex w-full max-w-sm items-center gap-3 rounded-large border bg-(--color-background-secondary) p-2.5 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", on ? "border-(--module-line) bg-(--module-soft)" : "border-(--color-border-default) hover:border-(--color-border-darker)")}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-(--module-tint) text-(--module-strong)">
        <FileText className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{title}</span>
        <span className="block text-body-sm text-(--color-text-secondary)">{sub}</span>
      </span>
      <span className="shrink-0 pr-1 text-body-sm text-(--color-text-clickable)">{on ? "Viewing" : "View"}</span>
    </button>
  );
}

/** Dollar amounts in bold, so the figures stand out in plain text. */
function boldFigures(text: string) {
  return text.split(/(\$[\d,.]+)/).map((part, i) => (/^\$[\d,.]+$/.test(part) ? <b key={i} className="font-medium">{part}</b> : part));
}

/** `last`: the newest agent message. Only it shows prompt chips, so they move on with each reply. */
function Reply({ reply, at, last = true }: { reply: AgentReply; at?: string; last?: boolean }) {
  const { send, busy, dashboards } = useAgents();
  const dash = reply.dashboard ? dashboards.find((d) => d.id === reply.dashboard) : undefined;
  const [copied, setCopied] = useState(false);
  const a = agentOf(reply.agent);
  const tone = (t?: "success" | "danger") => (t === "success" ? "text-(--color-text-success)" : t === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)");
  return (
    <div className="group/reply flex gap-3 motion-safe:animate-page-in @max-[560px]/chat:block">
      <span className="shrink-0 @max-[560px]/chat:hidden">
        <AgentMark agent={reply.agent} size={32} />
      </span>
      <div className="min-w-0 flex-1 space-y-3 @max-[560px]/chat:space-y-3">
        {/* In the narrow chat card the face shares a line with the work log, so the reply starts right under it. */}
        <div className="flex items-start gap-2">
          <span className="mt-0.5 hidden shrink-0 @max-[560px]/chat:inline-flex">
            <AgentMark agent={reply.agent} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <WorkLog steps={reply.work} done={reply.work.length} />
          </div>
        </div>
        {reply.style === "opening" ? (
          // Leadership flows: one plain sentence with the headline number, the "needs a look" lines, then coverage.
          <div className="space-y-2 text-body-md text-(--color-text-primary)">
            <p>{boldFigures(reply.title)}</p>
            {reply.looks?.map((l) => (
              <p key={l.text} className="flex items-start gap-2">
                <span aria-hidden className={cn("mt-[7px] size-2 shrink-0 rounded-circle", l.tone === "danger" ? "bg-(--color-danger-darkest)" : "bg-(--color-warning-default)")} />
                {l.text}
              </p>
            ))}
            {reply.checklist && <Checklist items={reply.checklist} />}
            {reply.cover && <p className="text-body-sm text-(--color-text-secondary)">{reply.cover}</p>}
          </div>
        ) : reply.style === "answer" ? (
          // A reply to a prompt: the answer in bold, a sentence or two, the source in grey.
          <div className="space-y-1.5 text-body-md">
            <p className="font-semibold text-(--color-text-primary)">{reply.title}</p>
            {reply.lines.map((l) => (
              <p key={l} className="text-(--color-text-primary)">{l}</p>
            ))}
            {reply.table && <MiniTable t={reply.table} />}
            {reply.checklist && <Checklist items={reply.checklist} />}
            {reply.cover && <p className="text-body-sm text-(--color-text-secondary)">{reply.cover}</p>}
            {reply.source && <p className="pt-0.5 text-body-sm text-(--color-text-tertiary)">{reply.source}</p>}
          </div>
        ) : reply.greeting ? (
          // Welcome first, then the news as one sentence with its figures in bold.
          <div className="space-y-2 text-body-md text-(--color-text-primary)">
            <p className="font-medium">{reply.greeting}</p>
            <p>{boldFigures([reply.title.replace(/\.?$/, "."), ...reply.lines].join(" "))}</p>
          </div>
        ) : (
        <div className="space-y-1.5">
          <p className="text-subtitle-md font-medium text-(--color-text-primary) @max-[560px]/chat:text-[15px] @max-[560px]/chat:leading-snug">{reply.title}</p>
          {reply.lines.map((l) => (
            <p key={l} className="text-body-md text-(--color-text-secondary)">
              {l}
            </p>
          ))}
        </div>
        )}
        {reply.stats && (
          <div className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
            <dl className="grid grid-cols-3 divide-x divide-(--color-border-default)">
              {reply.stats.map((s) => (
                <div key={s.label} className="min-w-0 px-3 py-2.5">
                  <dt className="truncate text-body-sm text-(--color-text-secondary)">{s.label}</dt>
                  <dd className={cn("text-subtitle-md font-medium tabular-nums", tone(s.tone))}>{s.value}</dd>
                  {s.sub && <dd className="truncate text-body-sm text-(--color-text-secondary)">{s.sub}</dd>}
                </div>
              ))}
            </dl>
            {reply.look && (
              <p className="flex items-center gap-2 border-t border-(--color-border-default) px-3 py-2 text-body-md text-(--color-text-primary)">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-circle", reply.look.tone === "danger" ? "bg-(--color-danger-darkest)" : reply.look.tone === "success" ? "bg-(--color-text-success)" : "bg-(--color-warning-darkest)")} />
                {reply.look.text}
              </p>
            )}
            {reply.cover && <p className="border-t border-(--color-border-default) bg-(--color-neutral-lightest) px-3 py-1.5 text-body-sm text-(--color-text-secondary)">{reply.cover}</p>}
          </div>
        )}
        {reply.rows && (
          <dl className="divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
            {reply.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2 text-body-md">
                <dt className="min-w-0">
                  <span className="block truncate text-(--color-text-primary)">{r.label}</span>
                  {r.sub && <span className="block text-body-sm text-(--color-text-secondary)">{r.sub}</span>}
                </dt>
                <dd className={cn("shrink-0 font-medium tabular-nums", tone(r.tone))}>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {reply.source && !reply.style && (
          <p className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            <span aria-hidden className="size-1.5 rounded-circle bg-(--color-text-success)" />
            {reply.source}
          </p>
        )}
        {reply.automation && (reply.report ? <AutomationCard a={reply.automation} title={REPORTS[reply.report].title} runs={a.name} kind="report" /> : <AutomationCard a={reply.automation} title={dash?.title ?? "Chargebacks"} />)}
        {dash && <DashboardCard d={dash} />}
        {reply.action && <OrderAction />}
        {reply.outlet && (reply.sheet ? <SheetCard store={reply.outlet} autoOpen={last && reply.autoOpen} /> : <OutletCard store={reply.outlet} />)}
        {reply.canvasId && reply.card && <CanvasCard id={reply.canvasId as CanvasId} title={reply.card.title} sub={reply.card.sub} />}
        {reply.report && <ReportCard report={reply.report} outlets={reply.outlets} card={reply.card} />}
        <div className="group/acts flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Copy"
            className={iconBtn}
            onClick={() =>
              void navigator.clipboard?.writeText([reply.title, ...reply.lines].join("\n")).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            {copied ? <Check /> : <Copy />}
          </button>
          {/* When it was sent, shown on hover (of the reply) or focus, beside Copy. */}
          {at && <span className="text-body-sm text-(--color-text-tertiary) opacity-0 transition-opacity group-hover/reply:opacity-100 group-focus-within/acts:opacity-100">{at}</span>}
        </div>
        {last && reply.followUps && reply.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reply.followUps.map((f) => (
              <button key={f} type="button" disabled={busy} onClick={() => send(f)} className={cn(chip, "@max-[560px]/chat:py-1 @max-[560px]/chat:text-body-sm")}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ m, last = true }: { m: Message; last?: boolean }) {
  if (m.role === "user")
    return (
      <div className="flex flex-col items-end gap-1.5">
        {m.ref && <CardChip r={m.ref} className="max-w-[80%]" />}
        {m.files?.map((f) => (
          <span key={f} className="inline-flex max-w-[80%] items-center gap-2 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-3 py-2 text-body-md text-(--color-text-primary)">
            <FileText className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
            <span className="truncate">{f}</span>
          </span>
        ))}
        {m.text && <p className="max-w-[80%] rounded-[18px] bg-(--color-neutral-light) px-3.5 py-2 text-body-md text-(--color-text-primary)">{m.text}</p>}
      </div>
    );
  if ("pending" in m)
    return (
      <div className="flex gap-3" role="status" aria-label={`${agentOf(m.agent).name} is working`}>
        <AgentMark agent={m.agent} size={32} mood="working" />
        {/* A warm beam breathes round the reply while the agent works (border-beam). */}
        <BorderBeam size="pulse-inner" colorVariant="sunset" theme="auto" strength={0.8}>
          <div className="min-w-0 flex-1 space-y-2 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-3.5 py-3">
            <p className="text-body-sm font-medium text-(--color-text-primary)">{agentOf(m.agent).name} is working…</p>
            <WorkLog steps={m.work} done={m.done} live />
          </div>
        </BorderBeam>
      </div>
    );
  return <Reply reply={m.reply} at={m.at} last={last} />;
}

// ───────── Canvas ─────────

/** `slot`: the right half of the chat page's header; the canvas's title bar goes there instead of its own row.
 *  Left out (full width) the canvas keeps its own bar; null while the slot mounts. */
function Canvas({ id, slot, chatTitle }: { id: CanvasId; slot?: HTMLElement | null; chatTitle?: string }) {
  const { setCanvas, canvasOutlets, expanded, setExpanded, dashboards, pinReport, sample } = useAgents();
  const tools = (
    <>
      <button type="button" aria-label={expanded ? "Show chat" : "Full width"} title={expanded ? "Show chat" : "Full width"} onClick={() => setExpanded(!expanded)} className={iconBtn}>
        {expanded ? <Minimize2 /> : <Maximize2 />}
      </button>
      <button type="button" aria-label="Close" title="Close" onClick={() => setCanvas(null)} className={iconBtn}>
        <X />
      </button>
    </>
  );
  // Split view: the report fills the right of the page, beside the chat card (the agent editor's layout).
  const sheet = cn(
    "min-w-0 flex-1 flex-col overflow-hidden bg-(--color-background-secondary) motion-safe:animate-page-in",
    expanded ? "flex" : "hidden lg:relative lg:flex",
  );
  if (id.startsWith("dash:")) {
    const d = dashboards.find((x) => `dash:${x.id}` === id);
    if (!d) return null;
    return (
      <aside aria-label={d.title} className={sheet} data-canvas-sheet>
        <AgentDashboard d={d} actions={tools} padRight headerTo={slot} chatTitle={chatTitle} />
      </aside>
    );
  }
  if (id.startsWith("order:")) {
    return (
      <aside aria-label="Order draft" className={sheet} data-canvas-sheet>
        <OrderDraft tools={tools} headerTo={slot} />
      </aside>
    );
  }
  if (id.startsWith("outlet:")) {
    const store = id.slice("outlet:".length) as Store;
    return (
      <aside aria-label="Outlet chargebacks" className={sheet} data-canvas-sheet>
        <OutletPanel store={store} tools={tools} headerTo={slot} />
      </aside>
    );
  }
  const report = id as ReportId;
  const pinned = dashboards.find((x) => x.id === `report-${report}`);
  return (
    <aside aria-label={REPORTS[report].title} className={sheet} data-canvas-sheet>
      {/* The report brings its own title row; the canvas adds expand and close beside it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {(() => {
          const bar = (
            <>
          {/* Pin the report to the sidebar; once pinned it can go on a schedule too (like the Chargebacks dashboard). */}
          {sample && <SampleTag />}
          {!sample && pinned?.pinned && <ScheduleControl d={pinned} />}
          {!sample && <PinToggle on={!!pinned?.pinned} onToggle={() => pinReport(report, !pinned?.pinned)} />}
          <BarDivider />
          {tools}
            </>
          );
          if (slot !== undefined) return slot && createPortal(<div className="ml-auto flex shrink-0 items-center gap-1">{bar}</div>, slot);
          return <div className="absolute top-1.5 right-2 z-10 flex items-center gap-1 rounded-medium bg-(--color-background-secondary)">{bar}</div>;
        })()}
        {sample && (
          <div className={cn("shrink-0 pt-2 pb-1 pl-4", slot !== undefined ? "pr-4" : "pr-[200px]")}>
            <SampleBanner />
          </div>
        )}
        <PointLayer report={report} off={sample} className={cn("flex min-h-0 flex-1 flex-col", sample || slot !== undefined ? "" : pinned?.pinned ? "[&>div:first-child]:pr-[380px]" : "[&>div:first-child]:pr-[200px]")}>
          <ReportView report={report} outlets={canvasOutlets} />
        </PointLayer>
      </div>
    </aside>
  );
}

// ───────── Home and thread ─────────

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Home() {
  const { threads, open, send, busy } = useAgents();
  const { account } = useAccount();
  const fresh = account.stage === "new";
  // Masa Kitchen: KoreFi pinned its dashboards, so the empty chat opens on their summary.
  const pinnedHome = !!account.teamPinned && !fresh;
  const suggestions = pinnedHome ? PINNED_SUGGESTIONS : SUGGESTIONS.map((text, i) => ({ text, Icon: SUGGESTION_ICONS[i] ?? Sparkles }));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col gap-10 px-4 pb-10 sm:px-6 md:max-lg:gap-[100px]">
        {/* The hero sits in the optical centre of the first screen, like ChatGPT's empty chat. */}
        <div className="flex min-h-[62vh] flex-col justify-end gap-7 pb-2 md:max-lg:min-h-[51.5vh]">
          <h1 className="text-center text-page-title font-normal text-(--color-text-primary) sm:text-[28px]">
            {fresh ? `Welcome, ${user.firstName}. Your agents are getting to know ${account.name}.` : pinnedHome ? `${greeting()}, ${user.firstName}. Here’s where ${account.name} stands.` : `${greeting()}, ${user.firstName}. What should we look into?`}
          </h1>
          {pinnedHome && <PinnedSummary />}
          {fresh && <p className="-mt-4 text-center text-body-lg text-(--color-text-secondary)">Your first reports usually arrive 2 to 3 days after your apps are connected. Your agents will post here when they do.</p>}
          <div>
            <div data-tour="composer">
              <Composer />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map(({ text, Icon }) => (
                <button key={text} type="button" disabled={busy} onClick={() => send(text)} className={suggestion}>
                  <Icon className="size-4 text-(--color-text-secondary)" aria-hidden />
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section aria-labelledby="agents-h" data-tour="agents" className="space-y-2.5">
          <h2 id="agents-h" className="sr-only">
            Your agents
          </h2>
          <AgentFolders />
        </section>

        {/* Phones have no Chats flyout, so recent chats sit here too. */}
        <section aria-labelledby="recent-h" className="space-y-1.5 lg:hidden">
          <h2 id="recent-h" className="text-body-sm text-(--color-text-secondary)">
            Recent chats
          </h2>
          <ul>
            {threads.filter((t) => !t.hidden).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => open(t.id)} className="flex min-h-12 w-full items-center gap-2.5 rounded-medium px-2 text-left active:bg-(--color-neutral-light)">
                  <AgentMark agent={t.agent} />
                  <span className="min-w-0 flex-1 truncate text-body-md text-(--color-text-primary)">{t.title}</span>
                  <span className="text-body-sm text-(--color-text-secondary)">{t.at}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** The chat header's ⋯ menu: go to the agent behind this chat, to see its details or edit it. */
function AgentMenu({ wid }: { wid: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const item = "flex w-full items-center gap-2 rounded-medium px-2.5 py-2 text-left text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-4 [&_svg]:text-(--color-text-secondary)";
  return (
    <div ref={ref} className="relative ml-auto shrink-0">
      <button
        type="button"
        aria-label="Agent options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(iconButton, "size-8", open && "bg-(--color-neutral-light) text-(--color-text-primary)")}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-20 w-48 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          <Link role="menuitem" href={`/agent?id=${wid}`} className={item}>
            <Bot aria-hidden />
            Agent details
          </Link>
          <Link role="menuitem" href={`/agent?id=${wid}&edit=1`} className={item}>
            <Pencil aria-hidden />
            Edit agent
          </Link>
        </div>
      )}
    </div>
  );
}

/** The chat header's Activity button: the log of what KoreFi and this chat's agent did each week.
 *  An icon, so the chat's title keeps the room. The panel hangs from the chat column (the nearest `relative`),
 *  not the button, so it never runs off the column's left edge. */
function ActivityButton({ wid, agent, dashboard }: { wid?: string; agent: AgentId; dashboard?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const { account } = useAccount();
  const items = useMemo(() => (open ? activityLog(wid, { account, agent, dashboard }) : []), [open, wid, account, agent, dashboard]);
  return (
    <div ref={ref} className="shrink-0">
      <button
        type="button"
        aria-label="Activity"
        title="Activity"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(iconButton, "size-8", open && "bg-(--color-neutral-light) text-(--color-text-primary)")}
      >
        <History className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Activity" className="absolute top-12 right-3 left-3 z-30 ml-auto flex max-h-[min(480px,calc(100%-64px))] max-w-[340px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-(--color-border-default) py-2.5 pr-2 pl-4">
            <p className="text-body-md font-medium text-(--color-text-primary)">Activity</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className={cn(iconButton, "size-7")}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActivityLog items={items} days={3} compact />
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadView() {
  const { active, canvas, expanded, dashboards, newChat } = useAgents();
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [chatWidth, setChatWidth] = useChatWidth();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const count = active?.messages.length ?? 0;
  const last = active?.messages[count - 1];
  const progress = last && "pending" in last ? last.done : -1;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [count, progress]);
  if (!active) return null;
  const a = agentOf(active.agent);
  // The agent behind this chat: runs carry it; an agent's seeded chat is matched by its thread id.
  // Free-form questions have none, so they get no agent links.
  const wid = active.workflow ?? FOLDERS.flatMap((f) => f.skills).find((s) => s.thread === active.id)?.id;
  const lastAgent = [...active.messages].reverse().find((m) => m.role === "agent")?.id;
  // Full width: the report takes the whole page, with its own title bar.
  if (canvas && expanded) return <Canvas id={canvas} />;
  const split = !!canvas;
  // The chat column's width, shared by the header's left half so both halves line up with the columns below.
  const colStyle = chatWidth ? { width: chatWidth } : undefined;
  const colClass = !chatWidth && "lg:w-[calc(clamp(380px,34vw,480px)+24px)]";
  // Activity and the agent menu: in the header on their own, inside the chat card beside a report.
  const chatTools = (
    <>
      <ActivityButton wid={wid} agent={active.agent} dashboard={dashboards.find((d) => (wid && d.workflow === wid) || d.id === active.dashboard)?.title} />
      {wid && <AgentMenu wid={wid} />}
    </>
  );

  const messages = (
    <div className={cn("flex flex-col gap-6", split ? "gap-6 px-4 pt-1 pb-5" : "mx-auto w-full max-w-[720px] px-6 py-6")}>
      {active.messages.map((m) => (
        <Bubble key={m.id} m={m} last={m.id === lastAgent} />
      ))}
      <div ref={end} />
    </div>
  );
  const composer = (
    <div className={cn("shrink-0", split ? "px-3 pb-3" : "mx-auto w-full max-w-[720px] px-6 pb-4")}>
      <Composer placeholder={`Reply to ${a.name}`} />
      <ComposerNote />
    </div>
  );

  // A dashboard beside the chat (Figma "Korefi – Agents" › Pinned dashboard): no header across the page. The chat
  // is a plain column with its own header; the dashboard pane brings its own title bar, on a grey pane.
  if (split && canvas.startsWith("dash:"))
    return (
      <section aria-label={active.title} className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-(--color-background-secondary)">
        <div ref={box} className="flex min-h-0 flex-1">
          <aside
            aria-label="Chat"
            className={cn("@container/chat relative flex min-w-0 flex-1 flex-col border-r border-(--color-border-default) bg-(--color-background-secondary) lg:flex-none lg:shrink-0", !chatWidth && "lg:w-[clamp(360px,28vw,440px)]")}
            style={colStyle}
          >
            <header className="flex h-8 shrink-0 items-center gap-2 px-4 mt-3">
              <AgentMark agent={active.agent} size={24} />
              <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{active.title}</h1>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">{chatTools}</div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{messages}</div>
            {composer}
          </aside>
          <ResizeHandle box={box} width={chatWidth} onWidth={setChatWidth} />
          <Canvas id={canvas} chatTitle={active.title} />
        </div>
      </section>
    );

  // The agent editor's layout (WorkflowEditor): one page, a header across the top,
  // the chat as a card on the left and the report on the right.
  return (
    <section aria-label={active.title} className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-(--color-background-secondary)">
      {/* Split: the header's left half sits over the chat, its right half holds the report's title bar. */}
      <header className="flex h-14 shrink-0 items-stretch border-b border-(--color-border-default)">
        <div className={cn("relative flex min-w-0 flex-1 items-center gap-2 px-3 sm:px-4", split && "lg:flex-none lg:shrink-0", split && colClass)} style={split ? colStyle : undefined}>
          <button type="button" aria-label="Back" title="Back" onClick={newChat} className={cn(iconButton, "size-8")}>
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <AgentMark agent={active.agent} size={24} />
          <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{active.title}</h1>
          <span className={cn("hidden shrink-0 text-body-sm text-(--color-text-secondary)", !split && "sm:inline")}>· {a.name}</span>
          {!split && <div className="ml-auto flex shrink-0 items-center gap-0.5">{chatTools}</div>}
        </div>
        {split && <div ref={setSlot} className="hidden min-w-0 flex-1 items-center gap-2 py-1 pr-3 pl-4 lg:flex" />}
      </header>

      {split ? (
        <div ref={box} className="flex min-h-0 flex-1">
          {/* ── the chat, as a card ── */}
          <div className={cn("flex min-w-0 flex-1 flex-col p-3 lg:flex-none lg:shrink-0", colClass)} style={colStyle}>
            <aside aria-label="Chat" className="@container/chat relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-(--color-border-default) bg-(--color-background-primary)">
              <div className="flex shrink-0 items-center justify-end gap-0.5 px-2 pt-2">{chatTools}</div>
              <div className="min-h-0 flex-1 overflow-y-auto">{messages}</div>
              {composer}
            </aside>
          </div>
          <ResizeHandle box={box} width={chatWidth} onWidth={setChatWidth} />
          {/* ── the report ── */}
          <Canvas id={canvas} slot={slot} chatTitle={active.title} />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">{messages}</div>
          {composer}
        </>
      )}
    </section>
  );
}

export function AgentWorkspace() {
  const { active, open, setCanvas, openDashboard } = useAgents();
  const { stage } = useOnboarding();
  // ?chat=<id> opens a chat (links from an SMS or email update would land here); its report opens with it.
  const params = useSearchParams();
  const chat = params.get("chat");
  // ?dash=<id> opens that pinned dashboard's chat with the dashboard beside it (the demo inbox's email button).
  const dash = params.get("dash");
  // Masa Kitchen has no New chat, so there is no empty chat to show: leaving a chat goes to its Home page.
  const { account } = useAccount();
  const router = useRouter();
  const toHome = !active && !chat && !dash && !!account.limited && stage !== "welcome";
  useEffect(() => {
    if (toHome) router.replace("/home");
  }, [toHome, router]);
  // Each link opens once: opening changes the chats, which re-creates openDashboard and re-runs this effect
  // while ?dash= is still in the URL (an endless loop before this guard).
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const key = `${dash ?? ""}|${chat ?? ""}`;
    if ((!dash && !chat) || handled.current === key) return;
    if (dash && openDashboard(dash)) {
      handled.current = key;
      // Drop the param once it's open, so leaving the chat later behaves as usual.
      router.replace("/");
      return;
    }
    if (!chat) return;
    handled.current = key;
    open(chat);
    const t = seedThreads().find((x) => x.id === chat);
    const first = t?.messages.find((m) => m.role === "agent" && "reply" in m);
    if (first && "reply" in first && first.reply.report) setCanvas(first.reply.report);
  }, [chat, dash, open, setCanvas, openDashboard, router]);
  if (toHome) return null;
  return <div className="flex min-h-0 min-w-0 flex-1">{active ? <ThreadView /> : stage === "welcome" ? <Welcome /> : <Home />}</div>;
}

// ───────── Resizable chat / report split ─────────

const CHAT_KEY = "mvp3.chatWidth";
const CHAT_MIN = 360;
const REPORT_MIN = 420;

/** The chat card width the owner last dragged to, remembered in this browser (a convenience only: it can come back empty). */
function useChatWidth() {
  const [width, setWidth] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const n = Number(window.localStorage.getItem(CHAT_KEY));
      return n > 0 ? n : null;
    } catch {
      return null;
    }
  });
  const save = (n: number | null) => {
    setWidth(n);
    try {
      if (n) window.localStorage.setItem(CHAT_KEY, String(Math.round(n)));
      else window.localStorage.removeItem(CHAT_KEY);
    } catch {}
  };
  return [width, save] as const;
}

/** The line between the chat card and the report: drag it (or focus it and use ←/→) to resize; double-click resets. */
function ResizeHandle({ box, width, onWidth }: { box: React.RefObject<HTMLDivElement | null>; width: number | null; onWidth: (n: number | null) => void }) {
  const [drag, setDrag] = useState(false);
  const rect = () => box.current?.getBoundingClientRect();
  const clamp = (n: number) => Math.max(CHAT_MIN, Math.min(n, (rect()?.width ?? 0) - REPORT_MIN));
  const current = () => width ?? (box.current?.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? CHAT_MIN;
  const fromPointer = (x: number) => clamp(x - (rect()?.left ?? 0));
  return (
    <div className="relative z-20 hidden w-0 shrink-0 lg:block">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the chat and report"
        aria-valuenow={Math.round(current())}
        aria-valuemin={CHAT_MIN}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(true);
          document.body.style.userSelect = "none";
          document.body.style.cursor = "col-resize";
        }}
        onPointerMove={(e) => drag && onWidth(fromPointer(e.clientX))}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDrag(false);
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
        }}
        onDoubleClick={() => onWidth(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          onWidth(clamp(current() + (e.key === "ArrowLeft" ? -32 : 32)));
        }}
        className="group absolute inset-y-3 -left-1.5 flex w-3 cursor-col-resize justify-center outline-none"
      >
        {/* A thin line that lights up on hover, focus and drag, with a grip in the middle. */}
        <span className={cn("h-full w-0.5 transition-colors", drag ? "bg-(--color-primary)" : "bg-transparent group-hover:bg-(--color-border-darker) group-focus-visible:bg-(--color-focus-primary)")} />
        <span className={cn("absolute top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) shadow-sm transition-opacity", drag ? "opacity-100" : "opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100")} />
      </div>
    </div>
  );
}
