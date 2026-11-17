"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Play, Plus, Search, SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { PageHeader } from "@/components/shell/PageHeader";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { AGENTS, DRAFTS, FOLDERS, type AgentId } from "@/lib/mvp3/agents";
import { isSchedule } from "@/lib/mvp3/workflows";
import { runHistory } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";

// MVP 3 / Agents, laid out as a grid of compact cards: each agent's face and name on top, two lines of what it
// does, and its status with the last run (or team) underneath. The whole card opens the agent.
// Search and a filter (All / Running / Available / Drafts) sit above the grid. Agents that aren't live show a
// Run button; the first run makes them live. Report-only: no fix buttons.

const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const focus = "outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

type Kind = "live" | "learning" | "idle" | "draft";
export type Card = { id: string; title: string; blurb: string; kind: Kind; agent?: AgentId; team?: string; hue?: string; meta: string };
type Filter = "all" | "running" | "available" | "drafts";
const FILTERS: { id: Filter; label: string; match: (k: Kind) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "running", label: "Running", match: (k) => k === "live" },
  { id: "available", label: "Available", match: (k) => k === "learning" || k === "idle" },
  { id: "drafts", label: "Drafts", match: (k) => k === "draft" },
];
/** The page puts live agents on top, then the rest by category (the agent behind them), then drafts. The filter pills narrow by status. */
type Group = { id: string; label: string; note: string; agent?: AgentId; match: (c: Card) => boolean };
const CATEGORY_NOTE: Record<AgentId, string> = {
  operations: "Chargebacks, labor and inventory across your outlets.",
  finance: "Payouts, reconciliation and P&L.",
  growth: "Menu prices and how you compare with nearby restaurants.",
};
const GROUPS: Group[] = [
  { id: "live", label: "Live", note: "Running on your reports. Each run posts a dashboard in a chat.", match: (c) => c.kind === "live" },
  ...(["operations", "finance", "growth"] as const).map((id): Group => ({
    id,
    label: AGENTS.find((a) => a.id === id)!.name.replace(/ agent$/, ""),
    note: CATEGORY_NOTE[id],
    agent: id,
    match: (c) => c.kind !== "draft" && c.kind !== "live" && c.agent === id,
  })),
  { id: "drafts", label: "Drafts", note: "Agents being written. Publish one to start it.", match: (c) => c.kind === "draft" },
];
const BADGE: Record<Kind,{ label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-(--color-success-lightest) text-(--color-text-success)" },
  learning: { label: "Learning", cls: "bg-(--color-background-secondary) text-(--color-text-primary)" },
  idle: { label: "Not live", cls: "bg-(--color-background-secondary) text-(--color-text-secondary)" },
  draft: { label: "Draft", cls: "bg-(--color-background-secondary) text-(--color-text-secondary)" },
};

// ───────── Card ─────────

function CardMenu({ c, onRun, onDuplicate }: { c: Card; onRun?: () => void; onDuplicate: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const item = cn("flex w-full items-center gap-2 rounded-medium px-2.5 py-2 text-left text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-lightest) [&_svg]:size-4 [&_svg]:text-(--color-text-secondary)", focus);
  return (
    <div ref={ref} className="relative z-10">
      <button
        type="button"
        aria-label={`More for ${c.title}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)", focus, !open && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100")}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 w-44 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          <Link role="menuitem" href={`/mvp3/agent?id=${c.id}`} className={item}>
            <SquareArrowOutUpRight aria-hidden />
            Open
          </Link>
          {onRun && (
            <button role="menuitem" type="button" onClick={onRun} className={item}>
              <Play aria-hidden />
              Run now
            </button>
          )}
          <button role="menuitem" type="button" onClick={onDuplicate} className={item}>
            <Copy aria-hidden />
            Duplicate
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentCard({ c, real }: { c: Card; real: boolean }) {
  const router = useRouter();
  const { getWorkflow, runAgent, duplicateAgent } = useAgents();
  const w = getWorkflow(c.id);
  const b = BADGE[c.kind];
  return (
    <li
      className={cn(
        "group relative flex flex-col rounded-xlarge border border-(--color-border-default) bg-(--color-background-secondary) p-5",
        "transition-[border-color,box-shadow] hover:border-(--color-border-darker) hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]",
        c.kind === "draft" && "border-dashed",
      )}
    >
      <div className="flex items-center gap-3">
        {c.agent ? (
          <AgentAvatar agent={c.agent} size={32} mood={c.kind === "live" && real ? "default" : "sleeping"} />
        ) : (
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-circle bg-(--color-neutral-light) text-body-sm font-medium text-(--color-text-primary)">
            {user.firstName[0]}
          </span>
        )}
        {/* The whole card opens the agent; the menu sits above the link. */}
        <Link href={`/mvp3/agent?id=${c.id}`} className="min-w-0 flex-1 truncate text-body-lg font-medium text-(--color-text-primary) outline-none after:absolute after:inset-0 after:rounded-xlarge focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--color-focus-primary)">
            {c.title}
          </Link>
        {w && (
          <CardMenu
            c={c}
            onRun={
              (c.kind === "live" || c.kind === "idle") && real
                ? () => {
                    runAgent(w);
                    router.push("/mvp3");
                  }
                : undefined
            }
            onDuplicate={() => router.push(`/mvp3/agent?id=${duplicateAgent(w)}`)}
          />
        )}
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2lh] text-body-md text-(--color-text-secondary)">{c.blurb}</p>
      <div className="mt-4 flex min-w-0 items-center gap-2 text-body-sm text-(--color-text-secondary)">
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-circle px-2 py-0.5 text-[11px] font-medium shadow-[0_0_0_1px_var(--color-border-default)]", b.cls)}>
          {c.kind === "live" && <span className="size-1.5 rounded-circle bg-current" />}
          {b.label}
        </span>
        <span className="truncate">{c.meta}</span>
        {/* Not live yet: a Run button right on the card. The first run makes the agent live. */}
        {c.kind === "idle" && real && w && (
          <button
            type="button"
            onClick={() => {
              runAgent(w);
              router.push("/mvp3");
            }}
            className={cn("relative z-10 ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-medium border border-(--color-border-default) px-2.5 text-body-sm font-medium text-(--color-text-primary) hover:bg-(--color-neutral-lightest)", focus)}
          >
            <Play className="size-3.5" aria-hidden />
            Run
          </button>
        )}
      </div>
    </li>
  );
}

/** Every agent as a gallery card: the agents' skills (live first), then drafts. Shared with the home's "Your agents". */
export function useAgentCards(): Card[] {
  const { account } = useAccount();
  const { getWorkflow, created } = useAgents();
  const isNew = account.stage === "new";
  return useMemo<Card[]>(() => {
    const skills = FOLDERS.flatMap((f) =>
      f.skills.map((s): Card => {
        const w = getWorkflow(s.id);
        // A restaurant that just joined has no reports, so its live agents are still learning.
        const state = w?.state ?? s.state;
        const kind: Kind = state === "idle" ? "idle" : state === "live" && !isNew ? "live" : "learning";
        const last = kind === "live" && !account.agentsOff ? runHistory(s.id, s.thread)[0] : undefined;
        const next = w?.triggers.find(isSchedule);
        const meta = last ? `Last run ${fmtDay(last.at)}${next ? ` · ${next}` : ""}` : f.label;
        return { id: s.id, title: w?.title ?? s.name, blurb: w?.overview ?? s.blurb, kind, agent: f.agent, team: f.label, hue: f.hue, meta };
      }),
    );
    const drafts: Card[] = [
      ...created.map((w): Card => ({ id: w.id, title: w.title, blurb: w.overview, kind: "draft", agent: w.agent, hue: w.hue, meta: "Edited just now" })),
      ...DRAFTS.map((d): Card => {
        const w = getWorkflow(d.id);
        return { id: d.id, title: w?.title ?? d.title, blurb: w?.overview ?? d.blurb, kind: "draft", meta: `${d.updated ? d.updated.replace(/^Last updated /, "Edited ") : "Not started"}` };
      }),
    ];
    return [...skills.sort((a, b) => Number(b.kind === "live") - Number(a.kind === "live")), ...drafts];
  }, [getWorkflow, created, isNew, account.agentsOff]);
}

// ───────── Page ─────────

export function AgentsPage() {
  const router = useRouter();
  const { account } = useAccount();
  const { newAgent } = useAgents();
  const isNew = account.stage === "new";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const cards = useAgentCards();

  const needle = q.trim().toLowerCase();
  const shown = cards.filter((c) => FILTERS.find((f) => f.id === filter)!.match(c.kind) && (!needle || `${c.title} ${c.blurb} ${c.team ?? ""}`.toLowerCase().includes(needle)));

  return (
    <>
      <PageHeader
        title="Agents"
        actions={
          <button type="button" onClick={() => router.push(`/mvp3/agent?id=${newAgent()}`)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-medium bg-(--color-primary) px-3 text-body-sm font-medium text-white hover:opacity-90", focus, "focus-visible:outline-offset-1")}>
            <Plus className="size-4" aria-hidden />
            New agent
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-0 flex-1 basis-64">
              <span className="sr-only">Search agents</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search agents"
                className="h-9 w-full rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) pr-3 pl-9 text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary) focus:border-(--color-focus-primary)"
              />
            </label>
            {/* Filter pills: the chosen one is filled dark, the rest are outlined, so the current view is obvious. */}
            <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const n = cards.filter((c) => f.match(c.kind)).length;
                const on = filter === f.id;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-circle border px-3.5 text-body-md font-medium transition-colors",
                      focus,
                      "focus-visible:outline-offset-2",
                      on ? "border-transparent bg-(--color-text-primary) text-(--color-text-inverse-primary)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) hover:bg-(--color-neutral-lightest)",
                    )}
                  >
                    {f.label}
                    <span className={cn("min-w-5 rounded-circle px-1.5 text-center text-body-sm tabular-nums", on ? "bg-white/20" : "bg-(--color-neutral-light) text-(--color-text-secondary)")}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {shown.length ? (
            // Live agents on top, then the rest by category (Operations, Finance, Growth), then Drafts, each with a
            // heading and a line of what it covers; the filter pills narrow every group by status.
            <div className="space-y-12">
              {GROUPS.map((g) => {
                const group = shown.filter(g.match);
                if (!group.length) return null;
                return (
                  <section key={g.id} aria-labelledby={`group-${g.id}`} className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-(--color-border-default) pb-2">
                      {g.agent && <AgentAvatar agent={g.agent} size={28} />}
                      <div className="min-w-0">
                        <h2 id={`group-${g.id}`} className="flex items-baseline gap-2 text-subtitle-md font-medium text-(--color-text-primary)">
                          {g.label}
                          <span className="text-body-md font-normal text-(--color-text-secondary)">{group.length}</span>
                        </h2>
                        <p className="text-body-sm text-(--color-text-secondary)">{g.note}</p>
                      </div>
                    </div>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.map((c) => (
                        <AgentCard key={c.id} c={c} real={!isNew} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="py-16 text-center text-body-md text-(--color-text-secondary)">{needle ? `No agents match “${q.trim()}”` : "Nothing here yet."}</p>
          )}
        </div>
      </div>
    </>
  );
}
