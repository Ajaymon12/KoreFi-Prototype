"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Bike, Check, ChevronDown, Copy, FileText, Landmark, Maximize2, Minimize2, Pin, PinOff, Plus, ShieldCheck, Sparkles, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { REPORTS, SUGGESTIONS, agentOf, seedThreads, type AgentId, type AgentReply, type Message, type ReportId } from "@/lib/mvp3/agents";
import { useAgents, type CanvasId } from "./AgentsProvider";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { AgentAvatar, StepOrb, type AvatarMood } from "./AgentAvatar";
import { AgentFolders } from "./AgentFolders";
import { AgentDashboard, AutomationCard, DashboardCard, ScheduleControl } from "./AgentDashboard";
import { REPORT_VIEW } from "./reportViews";
import { Welcome, useOnboarding } from "./Onboarding";

// MVP 3's main area. With no chat open it's the home: a greeting, the composer, and the agents with
// what each posted last. A chat is the conversation on the left; an agent's report opens on the right
// as a canvas (the real /mvp2 report, so the numbers are the same), and can take the full width.

const iconBtn = "grid size-7 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5";
// Home suggestions: ChatGPT's icon pills, one icon per SUGGESTIONS entry (same order).
const suggestion = "inline-flex items-center gap-2 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3.5 py-2 text-body-md text-(--color-text-primary) outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-50";
const SUGGESTION_ICONS = [ShieldCheck, TrendingUp, Landmark, Bike];
const chip = "rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3 py-1.5 text-left text-body-sm text-(--color-text-primary) outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-50";

/** An agent's face (bot-avatars via AgentAvatar). Kept as AgentMark so every call site stays the same. */
export function AgentMark({ agent, size = 28, mood, className }: { agent: AgentId; size?: number; mood?: AvatarMood; className?: string }) {
  return <AgentAvatar agent={agent} size={size} mood={mood} className={className} />;
}

// ───────── Composer ─────────

// ChatGPT-style pill: attach on the left, the field grows with the text, send on the right. Once the
// text wraps, the field takes the full width and the buttons drop to a row beneath it.
const MAX_FIELD = 200;

/** `intercept` sees the text first; returning true means it was handled (the onboarding chat answers its own questions). */
export function Composer({ placeholder, onSend, intercept }: { placeholder?: string; onSend?: () => void; intercept?: (text: string) => boolean }) {
  const { send, busy } = useAgents();
  const [text, setText] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [tall, setTall] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
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
    if (!text.trim() || busy) return;
    if (intercept?.(text.trim())) {
      setText("");
      setFile(null);
      return;
    }
    onSend?.();
    send(text);
    setText("");
    setFile(null);
  };
  const ready = !!text.trim() && !busy;
  const attach = (
    <button type="button" aria-label="Add a file" title="Add a file" onClick={() => fileRef.current?.click()} className="grid size-9 shrink-0 place-items-center rounded-circle text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
      <Plus className="size-5" strokeWidth={1.75} aria-hidden />
    </button>
  );
  const submit = (
    // While an agent works the button holds a thinking orb (light dots on the dark fill).
    <button
      type="submit"
      aria-label={busy ? "Agent is working" : "Send"}
      disabled={!ready}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-circle outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary)",
        ready || busy ? "bg-(--color-text-primary) text-(--color-text-inverse-primary) hover:bg-(--color-neutral-darkest)" : "bg-(--color-neutral-light) text-(--color-text-secondary)",
      )}
    >
      {busy ? <ThinkingOrb state="working" size={20} theme="dark" aria-hidden /> : <ArrowUp className="size-[18px]" strokeWidth={2.25} />}
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
      placeholder={placeholder ?? "Ask your agents anything"}
      aria-label="Message your agents"
      className={cn("block min-w-0 resize-none bg-transparent py-1.5 text-body-lg text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)", tall ? "w-full px-2" : "flex-1 px-1")}
    />
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className={cn(
        "border border-(--color-border-default) bg-(--color-background-secondary) p-2 shadow-[0_4px_16px_rgb(0_0_0/0.06),0_0_1px_rgb(0_0_0/0.12)]",
        tall || file ? "rounded-[24px]" : "rounded-[28px]",
      )}
    >
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.pdf" hidden onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
      {file && (
        <div className="px-1 pb-2">
          <span className="inline-flex max-w-full items-center gap-2 rounded-large border border-(--color-border-default) py-1 pr-1 pl-2 text-body-sm text-(--color-text-primary)">
            <FileText className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
            <span className="truncate">{file}</span>
            <button type="button" aria-label={`Remove ${file}`} onClick={() => setFile(null)} className={iconBtn}>
              <X />
            </button>
          </span>
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
function ComposerNote() {
  return <p className="pt-2 text-center text-body-sm text-(--color-text-secondary)">Agents are read-only and never change your data.</p>;
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

function ReportCard({ report }: { report: ReportId }) {
  const { canvas, setCanvas, dashboards } = useAgents();
  const pinned = dashboards.some((d) => d.id === `report-${report}` && d.pinned);
  const on = canvas === report;
  const r = REPORTS[report];
  return (
    <button
      type="button"
      onClick={() => setCanvas(on ? null : report)}
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
        <span className="block truncate text-body-sm text-(--color-text-secondary)">{r.sub}</span>
      </span>
      <span className="shrink-0 pr-1 text-body-sm text-(--color-text-clickable)">{on ? "Open" : "View"}</span>
    </button>
  );
}

function Reply({ reply, at }: { reply: AgentReply; at?: string }) {
  const { send, busy, dashboards } = useAgents();
  const dash = reply.dashboard ? dashboards.find((d) => d.id === reply.dashboard) : undefined;
  const [copied, setCopied] = useState(false);
  const a = agentOf(reply.agent);
  const tone = (t?: "success" | "danger") => (t === "success" ? "text-(--color-text-success)" : t === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)");
  return (
    <div className="flex gap-3 motion-safe:animate-page-in">
      <AgentMark agent={reply.agent} size={32} />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="flex items-center gap-2 pt-1 text-body-sm text-(--color-text-secondary)">
          <span className="font-medium text-(--color-text-primary)">{a.name}</span>
          {at && <span>{at}</span>}
        </p>
        <WorkLog steps={reply.work} done={reply.work.length} />
        <div className="space-y-1.5">
          <p className="text-subtitle-sm font-medium text-(--color-text-primary)">{reply.title}</p>
          {reply.lines.map((l) => (
            <p key={l} className="text-body-md text-(--color-text-secondary)">
              {l}
            </p>
          ))}
        </div>
        {reply.stats && (
          <dl className="grid grid-cols-3 divide-x divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
            {reply.stats.map((s) => (
              <div key={s.label} className="min-w-0 px-3 py-2.5">
                <dt className="truncate text-body-sm text-(--color-text-secondary)">{s.label}</dt>
                <dd className={cn("text-subtitle-md font-medium tabular-nums", tone(s.tone))}>{s.value}</dd>
              </div>
            ))}
          </dl>
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
        {reply.automation && (reply.report ? <AutomationCard a={reply.automation} title={REPORTS[reply.report].title} runs={a.name} kind="report" /> : <AutomationCard a={reply.automation} title={dash?.title ?? "Chargebacks"} />)}
        {dash && <DashboardCard d={dash} />}
        {reply.report && <ReportCard report={reply.report} />}
        <div className="flex items-center gap-0.5">
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
        </div>
        {reply.followUps && reply.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reply.followUps.map((f) => (
              <button key={f} type="button" disabled={busy} onClick={() => send(f)} className={chip}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.role === "user")
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-[18px] bg-(--color-neutral-light) px-3.5 py-2 text-body-md text-(--color-text-primary)">{m.text}</p>
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
  return <Reply reply={m.reply} at={m.at} />;
}

// ───────── Canvas ─────────

function Canvas({ id }: { id: CanvasId }) {
  const { setCanvas, expanded, setExpanded, dashboards, pinReport } = useAgents();
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
  if (id.startsWith("dash:")) {
    const d = dashboards.find((x) => `dash:${x.id}` === id);
    if (!d) return null;
    return (
      <aside aria-label={d.title} className={cn("flex min-w-0 flex-col border-l border-(--color-border-default) bg-(--color-background-primary) motion-safe:animate-page-in", expanded ? "flex-1 border-l-0" : "hidden flex-[1.4] lg:flex")}>
        <AgentDashboard d={d} actions={tools} padRight />
      </aside>
    );
  }
  const report = id as ReportId;
  const pinned = dashboards.find((x) => x.id === `report-${report}`);
  return (
    <aside aria-label={REPORTS[report].title} className={cn("flex min-w-0 flex-col border-l border-(--color-border-default) bg-(--color-background-secondary) motion-safe:animate-page-in", expanded ? "flex-1 border-l-0" : "hidden flex-[1.4] lg:flex")}>
      {/* The report brings its own title row; the canvas adds expand and close beside it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute top-1.5 right-2 z-10 flex items-center gap-1 rounded-medium bg-(--color-background-secondary)">
          {/* Pin the report to the sidebar; once pinned it can go on a schedule too (like the Chargebacks dashboard). */}
          {pinned?.pinned && <ScheduleControl d={pinned} />}
          <button type="button" onClick={() => pinReport(report, !pinned?.pinned)} aria-pressed={!!pinned?.pinned} className="inline-flex h-8 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5">
            {pinned?.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
            {pinned?.pinned ? "Unpin" : "Pin to sidebar"}
          </button>
          {tools}
        </div>
        <div className={cn("flex min-h-0 flex-1 flex-col", pinned?.pinned ? "[&>div:first-child]:pr-[380px]" : "[&>div:first-child]:pr-[200px]")}>{REPORT_VIEW[report]()}</div>
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
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col gap-10 px-4 pb-10 sm:px-6">
        {/* The hero sits in the optical centre of the first screen, like ChatGPT's empty chat. */}
        <div className="flex min-h-[62vh] flex-col justify-end gap-7 pb-2">
          <h1 className="text-center text-page-title font-normal text-(--color-text-primary) sm:text-[28px]">
            {greeting()}, {user.firstName}. What should we look into?
          </h1>
          <div>
            <div data-tour="composer">
              <Composer />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => {
                const Icon = SUGGESTION_ICONS[i] ?? Sparkles;
                return (
                  <button key={s} type="button" disabled={busy} onClick={() => send(s)} className={suggestion}>
                    <Icon className="size-4 text-(--color-text-secondary)" aria-hidden />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <section aria-labelledby="agents-h" data-tour="agents" className="space-y-2.5">
          <h2 id="agents-h" className="text-body-sm text-(--color-text-secondary)">
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
            {threads.map((t) => (
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

function ThreadView() {
  const { active, canvas, expanded } = useAgents();
  const end = useRef<HTMLDivElement>(null);
  const count = active?.messages.length ?? 0;
  const last = active?.messages[count - 1];
  const progress = last && "pending" in last ? last.done : -1;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [count, progress]);
  if (!active) return null;
  const a = agentOf(active.agent);
  return (
    <section aria-label={active.title} className={cn("min-w-0 flex-1 flex-col", expanded && canvas ? "hidden" : "flex")}>
      <header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-(--color-border-default) px-4 py-2">
        <AgentMark agent={active.agent} size={24} />
        <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{active.title}</h1>
        <span className="hidden shrink-0 text-body-sm text-(--color-text-secondary) sm:inline">· {a.name}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-6", canvas ? "max-w-[560px]" : "max-w-[720px] sm:px-6")}>
          {active.messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          <div ref={end} />
        </div>
      </div>
      <div className={cn("mx-auto w-full shrink-0 px-4 pb-4", canvas ? "max-w-[560px]" : "max-w-[720px] sm:px-6")}>
        <Composer placeholder={`Reply to ${a.name}`} />
        <ComposerNote />
      </div>
    </section>
  );
}

export function AgentWorkspace() {
  const { active, canvas, open, setCanvas } = useAgents();
  const { stage } = useOnboarding();
  // ?chat=<id> opens a chat (links from an SMS or email update would land here); its report opens with it.
  const params = useSearchParams();
  const chat = params.get("chat");
  useEffect(() => {
    if (!chat) return;
    open(chat);
    const t = seedThreads().find((x) => x.id === chat);
    const first = t?.messages.find((m) => m.role === "agent" && "reply" in m);
    if (first && "reply" in first && first.reply.report) setCanvas(first.reply.report);
  }, [chat, open, setCanvas]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {active ? <ThreadView /> : stage === "welcome" ? <Welcome /> : <Home />}
      {active && canvas && <Canvas id={canvas} />}
    </div>
  );
}
