"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Bike, Bot, History, MoreHorizontal, Pencil, Check, ChevronDown, Copy, FileText, Landmark, Maximize2, Minimize2, Pin, PinOff, Plus, ShieldCheck, Sparkles, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { FOLDERS, REPORTS, SUGGESTIONS, agentOf, seedThreads, type AgentId, type AgentReply, type Message, type ReportId } from "@/lib/mvp3/agents";
import { useAgents, type CanvasId } from "./AgentsProvider";
import type { Store } from "@/lib/finance/outlets";
import { outletsLabel } from "@/lib/mvp3/outletScope";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { AgentAvatar, StepOrb, type AvatarMood } from "./AgentAvatar";
import { AgentFolders } from "./AgentFolders";
import { useAccount } from "./AccountSwitcher";
import { AgentDashboard, AutomationCard, CardChip, DashboardCard, SampleBanner, SampleTag, ScheduleControl } from "./AgentDashboard";
import { ReportView } from "./reportViews";
import { ActivityLog } from "./ActivityLog";
import { PinnedSummary } from "./PinnedSummary";
import { OutletCard, OutletPanel, SheetCard } from "./OutletDive";
import { activityLog } from "@/lib/mvp3/activity";
import { PointLayer } from "./PointLayer";
import { Welcome, useOnboarding } from "./Onboarding";

// MVP 3's main area. With no chat open it's the home: a greeting, the composer, and the agents with
// what each posted last. A chat is the conversation on the left; an agent's report opens on the right
// as a canvas (the real /mvp2 report, so the numbers are the same), and can take the full width.

const iconBtn = "grid size-7 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5";
// Home suggestions: ChatGPT's icon pills, one icon per SUGGESTIONS entry (same order).
const suggestion = "inline-flex items-center gap-2 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3.5 py-2 text-body-md text-(--color-text-primary) outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-50";
const SUGGESTION_ICONS = [ShieldCheck, TrendingUp, Landmark, Bike];
/** A restaurant whose dashboards the KoreFi team pinned (Masa Kitchen): asks about those dashboards. */
const PINNED_SUGGESTIONS = [
  { text: "What changed on chargebacks this week?", Icon: ShieldCheck },
  { text: "Which outlets get the most chargebacks?", Icon: Bike },
  { text: "Did every payout match Square?", Icon: Landmark },
  { text: "How did we do last week?", Icon: TrendingUp },
];
const chip = "rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-3 py-1.5 text-left text-body-sm text-(--color-text-primary) outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-50";

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
  const { send, busy, pointed, setPointed } = useAgents();
  const [text, setText] = useState("");
  const [file, setFile] = useState<string | null>(null);
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
      placeholder={pointed && !intercept ? "What should change on this card?" : (placeholder ?? "Ask your agents anything")}
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
        tall || file || pointed ? "rounded-[24px]" : "rounded-[28px]",
      )}
    >
      {pointed && !intercept && (
        <div className="px-1 pb-2">
          <CardChip r={pointed} onRemove={() => setPointed(null)} />
        </div>
      )}
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
export function ComposerNote() {
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
        <span className="block truncate text-body-sm text-(--color-text-secondary)">{outlets?.length ? (/all outlets/i.test(r.sub) ? r.sub.replace(/all outlets/i, outletsLabel(outlets)) : `${r.sub} · ${outletsLabel(outlets)}`) : r.sub}</span>
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
          <span className="font-medium text-(--color-text-primary)">{reply.by ?? a.name}</span>
          {at && <span>{at}</span>}
        </p>
        <WorkLog steps={reply.work} done={reply.work.length} />
        <div className="space-y-1.5">
          <p className="text-subtitle-md font-medium text-(--color-text-primary)">{reply.title}</p>
          {reply.lines.map((l) => (
            <p key={l} className="text-body-md text-(--color-text-secondary)">
              {l}
            </p>
          ))}
        </div>
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
                <span aria-hidden className={cn("size-2 shrink-0 rounded-circle", reply.look.tone === "danger" ? "bg-(--color-danger-darker,#c92a2a)" : reply.look.tone === "success" ? "bg-(--color-text-success)" : "bg-(--color-warning-darker,#a45a00)")} />
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
        {reply.source && (
          <p className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            <span aria-hidden className="size-1.5 rounded-circle bg-(--color-text-success)" />
            {reply.source}
          </p>
        )}
        {reply.automation && (reply.report ? <AutomationCard a={reply.automation} title={REPORTS[reply.report].title} runs={a.name} kind="report" /> : <AutomationCard a={reply.automation} title={dash?.title ?? "Chargebacks"} />)}
        {dash && <DashboardCard d={dash} />}
        {reply.outlet && (reply.sheet ? <SheetCard store={reply.outlet} /> : <OutletCard store={reply.outlet} />)}
        {reply.report && <ReportCard report={reply.report} outlets={reply.outlets} card={reply.card} />}
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
      <div className="flex flex-col items-end gap-1.5">
        {m.ref && <CardChip r={m.ref} className="max-w-[80%]" />}
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

/** `width`: the width the owner dragged the panel to (px), or null for the default split. */
function Canvas({ id, width }: { id: CanvasId; width: number | null }) {
  const { setCanvas, canvasOutlets, expanded, setExpanded, dashboards, pinReport, sample } = useAgents();
  // A dragged width wins over the default 1 : 1.4 split, but always leaves the chat at least 360px.
  const sized = width && !expanded ? { flex: "0 0 auto", width: `min(${width}px, calc(100% - 360px))` } : undefined;
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
  // Split view: the dashboard is a raised white sheet floating on the chat's grey workspace, with an orange top edge
  // that matches the open card in the chat, so it reads as the thing the chat made, not a second column of the page.
  const sheet = cn(
    "flex min-w-0 flex-col overflow-hidden bg-(--color-background-secondary) motion-safe:animate-page-in",
    expanded
      ? "flex-1"
      : "hidden flex-[1.4] lg:my-2 lg:mr-2 lg:relative lg:flex lg:rounded-large lg:border lg:border-(--color-border-default) lg:before:absolute lg:before:inset-x-0 lg:before:top-0 lg:before:z-10 lg:before:h-[3px] lg:before:bg-(--module-line) lg:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.18)]",
  );
  if (id.startsWith("dash:")) {
    const d = dashboards.find((x) => `dash:${x.id}` === id);
    if (!d) return null;
    return (
      <aside aria-label={d.title} className={sheet} style={sized}>
        <AgentDashboard d={d} actions={tools} padRight />
      </aside>
    );
  }
  if (id.startsWith("outlet:")) {
    const store = id.slice("outlet:".length) as Store;
    return (
      <aside aria-label="Outlet chargebacks" className={sheet} style={sized}>
        <OutletPanel store={store} tools={tools} />
      </aside>
    );
  }
  const report = id as ReportId;
  const pinned = dashboards.find((x) => x.id === `report-${report}`);
  return (
    <aside aria-label={REPORTS[report].title} className={sheet} style={sized}>
      {/* The report brings its own title row; the canvas adds expand and close beside it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute top-1.5 right-2 z-10 flex items-center gap-1 rounded-medium bg-(--color-background-secondary)">
          {/* Pin the report to the sidebar; once pinned it can go on a schedule too (like the Chargebacks dashboard). */}
          {sample && <SampleTag />}
          {!sample && pinned?.pinned && <ScheduleControl d={pinned} />}
          {!sample && <button type="button" onClick={() => pinReport(report, !pinned?.pinned)} aria-pressed={!!pinned?.pinned} className="inline-flex h-8 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5">
            {pinned?.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
            {pinned?.pinned ? "Unpin" : "Pin to sidebar"}
          </button>}
          {tools}
        </div>
        {sample && (
          <div className="shrink-0 pt-2 pr-[200px] pb-1 pl-4">
            <SampleBanner />
          </div>
        )}
        <PointLayer report={report} off={sample} className={cn("flex min-h-0 flex-1 flex-col", sample ? "" : pinned?.pinned ? "[&>div:first-child]:pr-[380px]" : "[&>div:first-child]:pr-[200px]")}>
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
  // Masa Kitchen: the KoreFi team pinned its dashboards, so the empty chat opens on their summary.
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
        className={cn("grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", open && "bg-(--color-neutral-light) text-(--color-text-primary)")}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-20 w-48 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          <Link role="menuitem" href={`/mvp3/agent?id=${wid}`} className={item}>
            <Bot aria-hidden />
            Agent details
          </Link>
          <Link role="menuitem" href={`/mvp3/agent?id=${wid}&edit=1`} className={item}>
            <Pencil aria-hidden />
            Edit agent
          </Link>
        </div>
      )}
    </div>
  );
}

/** The chat header's Activity button: the log of what the KoreFi team and this chat's agent did each week.
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
        className={cn("grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", open && "bg-(--color-neutral-light) text-(--color-text-primary)")}
      >
        <History className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Activity" className="absolute top-12 right-3 left-3 z-30 ml-auto flex max-h-[min(480px,calc(100%-64px))] max-w-[340px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-(--color-border-default) py-2.5 pr-2 pl-4">
            <p className="text-body-md font-medium text-(--color-text-primary)">Activity</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
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
  const { active, canvas, expanded, dashboards } = useAgents();
  const end = useRef<HTMLDivElement>(null);
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
  return (
    <section
      aria-label={active.title}
      className={cn(
        "relative min-w-0 flex-1 flex-col",
        expanded && canvas ? "hidden" : "flex",
        // Beside the floating sheet, the chat starts at the sheet's top edge so the two headers line up.
        canvas && !expanded && "lg:pt-[9px]",
      )}
    >
      <header className={cn("flex h-11 shrink-0 items-center gap-2 border-b border-(--color-border-default) px-4", canvas && !expanded && "lg:border-b-transparent")}>
        <AgentMark agent={active.agent} size={24} />
        <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{active.title}</h1>
        {/* With a dashboard beside the chat the column is narrow: the title gets the room. */}
        <span className={cn("hidden shrink-0 text-body-sm text-(--color-text-secondary)", !canvas && "sm:inline")}>· {a.name}</span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <ActivityButton wid={wid} agent={active.agent} dashboard={dashboards.find((d) => (wid && d.workflow === wid) || d.id === active.dashboard)?.title} />
          {wid && <AgentMenu wid={wid} />}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto flex w-full flex-col gap-6 px-6 py-6", canvas ? "max-w-[560px]" : "max-w-[720px]")}>
          {active.messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          <div ref={end} />
        </div>
      </div>
      <div className={cn("mx-auto w-full shrink-0 px-6 pb-4", canvas ? "max-w-[560px]" : "max-w-[720px]")}>
        <Composer placeholder={`Reply to ${a.name}`} />
        <ComposerNote />
      </div>
    </section>
  );
}

export function AgentWorkspace() {
  const { active, canvas, open, setCanvas, expanded } = useAgents();
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
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useCanvasWidth();
  const split = !!(active && canvas) && !expanded;
  return (
    <div ref={box} className={cn("flex min-h-0 min-w-0 flex-1 transition-colors", split && "lg:bg-(--gray-300)")}>
      {active ? <ThreadView /> : stage === "welcome" ? <Welcome /> : <Home />}
      {split && <ResizeHandle box={box} width={width} onWidth={setWidth} />}
      {active && canvas && <Canvas id={canvas} width={width} />}
    </div>
  );
}

// ───────── Resizable chat / panel split ─────────

const CANVAS_KEY = "mvp3.canvasWidth";
const CANVAS_MIN = 420;
const CHAT_MIN = 360;

/** The panel width the owner last dragged to, remembered in this browser (a convenience only: it can come back empty). */
function useCanvasWidth() {
  const [width, setWidth] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const n = Number(window.localStorage.getItem(CANVAS_KEY));
      return n > 0 ? n : null;
    } catch {
      return null;
    }
  });
  const save = (n: number | null) => {
    setWidth(n);
    try {
      if (n) window.localStorage.setItem(CANVAS_KEY, String(Math.round(n)));
      else window.localStorage.removeItem(CANVAS_KEY);
    } catch {}
  };
  return [width, save] as const;
}

/** The line between the chat and the dashboard: drag it (or focus it and use ←/→) to resize; double-click resets. */
function ResizeHandle({ box, width, onWidth }: { box: React.RefObject<HTMLDivElement | null>; width: number | null; onWidth: (n: number | null) => void }) {
  const [drag, setDrag] = useState(false);
  const clamp = (n: number) => {
    const total = box.current?.getBoundingClientRect().width ?? 0;
    return Math.max(CANVAS_MIN, Math.min(n, total - CHAT_MIN));
  };
  const current = () => width ?? (box.current?.lastElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? CANVAS_MIN;
  const fromPointer = (x: number) => clamp((box.current?.getBoundingClientRect().right ?? 0) - x);
  return (
    <div className="relative z-20 hidden w-0 lg:block">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the chat and dashboard"
        aria-valuenow={Math.round(current())}
        aria-valuemin={CANVAS_MIN}
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
          onWidth(clamp(current() + (e.key === "ArrowLeft" ? 32 : -32)));
        }}
        className="group absolute inset-y-0 -left-1.5 flex w-3 cursor-col-resize justify-center outline-none"
      >
        {/* A thin line that lights up on hover, focus and drag, with a grip in the middle. */}
        <span className={cn("h-full w-0.5 transition-colors", drag ? "bg-(--color-primary)" : "bg-transparent group-hover:bg-(--color-border-darker) group-focus-visible:bg-(--color-focus-primary)")} />
        <span className={cn("absolute top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) shadow-sm transition-opacity", drag ? "opacity-100" : "opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100")} />
      </div>
    </div>
  );
}
