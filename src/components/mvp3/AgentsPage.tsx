"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil, Play, Plus, Search, SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { PageHeader } from "@/components/shell/PageHeader";
import { AGENTS, DRAFTS, FOLDERS, type AgentId } from "@/lib/mvp3/agents";
import { isSchedule } from "@/lib/mvp3/workflows";
import { runHistory } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";
import { focusRing, iconButton } from "@/components/mvp3/styles";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";

// MVP 3 / Agents, laid out as a grid of compact cards: each agent's face and name on top, two lines of what it
// does, and its status with the last run (or team) underneath. The whole card opens the agent.
// Search and a filter (All / Running / Available / Drafts) sit above the grid. Agents that aren't live show a
// Run button; the first run makes them live. Report-only: no fix buttons.

const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

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
// The page leads with what runs today plus the next three worth turning on (founders' priority order). The rest of
// the catalog sits behind "Show all", so the owner isn't handed a wall of not-live cards. Search and the
// Available filter always reach every agent.
const NEXT_UP = ["channel-pnl", "three-way-recon", "journal-entries"];
const isLater = (c: Card) => c.kind !== "draft" && c.kind !== "live" && !NEXT_UP.includes(c.id);
const GROUPS: Group[] = [
  { id: "live", label: "Live", note: "Running on your reports. Each run posts a dashboard in a chat.", match: (c) => c.kind === "live" },
  { id: "next", label: "Next up", note: "Ready to turn on. The first run makes an agent live.", match: (c) => c.kind !== "draft" && c.kind !== "live" && NEXT_UP.includes(c.id) },
  ...(["operations", "finance", "growth"] as const).map((id): Group => ({
    id,
    label: AGENTS.find((a) => a.id === id)!.name.replace(/ agent$/, ""),
    note: CATEGORY_NOTE[id],
    agent: id,
    match: (c) => isLater(c) && c.agent === id,
  })),
  { id: "drafts", label: "Drafts", note: "Agents being written. Publish one to start it.", match: (c) => c.kind === "draft" },
];
const LATER_GROUPS = new Set(["operations", "finance", "growth"]);
// Masa Kitchen: every agent is live, so there is no live / not live split. Each sits under its category, with no status badge.
const FLAT_GROUPS: Group[] = GROUPS.filter((g) => g.id !== "live" && g.id !== "next").map((g) => (g.agent ? { ...g, match: (c) => c.kind !== "draft" && c.agent === g.agent } : g));
const BADGE: Record<Kind,{ label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-(--color-success-lightest) text-(--color-text-success)" },
  learning: { label: "Learning", cls: "bg-(--color-background-secondary) text-(--color-text-primary)" },
  idle: { label: "Not live", cls: "bg-(--color-background-secondary) text-(--color-text-secondary)" },
  draft: { label: "Draft", cls: "bg-(--color-background-secondary) text-(--color-text-secondary)" },
};

// ───────── Card ─────────

function CardMenu({ c, onRun, onDuplicate }: { c: Card; onRun?: () => void; onDuplicate?: () => void }) {
  // Astryx DropdownMenu (see docs/mvp3-astryx-components.md). It owns open state, outside-click, Escape, focus and
  // arrow-key navigation, so the hand-built menu, useDismiss and the manual `open` state are gone.
  return (
    <div className="relative z-10">
      <DropdownMenu
        placement="below"
        alignment="end"
        hasChevron={false}
        menuWidth={176}
        renderTrigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label={`More for ${c.title}`}
            className={cn(iconButton, "size-8 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 max-sm:opacity-100")}
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
        items={[
          { label: "Open", href: `/agent?id=${c.id}`, icon: SquareArrowOutUpRight },
          { label: "Edit", href: `/agent?id=${c.id}&edit=1`, icon: Pencil },
          ...(onRun ? [{ label: "Run now", onClick: onRun, icon: Play }] : []),
          ...(onDuplicate ? [{ label: "Duplicate", onClick: onDuplicate, icon: Copy }] : []),
        ]}
      />
    </div>
  );
}

/** `plain`: every agent counts as live, so no status badge or sleeping face, and every card gets a Run button. */
export function AgentCard({ c, real, plain = false }: { c: Card; real: boolean; plain?: boolean }) {
  const router = useRouter();
  const { getWorkflow, runAgent, duplicateAgent } = useAgents();
  const limited = !!useAccount().account.limited;
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
          <AgentAvatar agent={c.agent} size={32} mood={plain || (c.kind === "live" && real) ? "default" : "sleeping"} />
        ) : (
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-circle bg-(--color-neutral-light) text-body-sm font-medium text-(--color-text-primary)">
            {user.firstName[0]}
          </span>
        )}
        {/* The whole card opens the agent; the menu sits above the link. */}
        <Link href={`/agent?id=${c.id}`} className="min-w-0 flex-1 truncate text-body-lg font-medium text-(--color-text-primary) outline-none after:absolute after:inset-0 after:rounded-xlarge focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--color-focus-primary)">
            {c.title}
          </Link>
        {w && (
          <CardMenu
            c={c}
            onRun={
              (c.kind === "live" || c.kind === "idle") && real
                ? () => {
                    runAgent(w);
                    router.push("/");
                  }
                : undefined
            }
            onDuplicate={limited ? undefined : () => router.push(`/agent?id=${duplicateAgent(w)}`)}
          />
        )}
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2lh] text-body-md text-(--color-text-secondary)">{c.blurb}</p>
      <div className="mt-4 flex min-w-0 items-center gap-2 text-body-sm text-(--color-text-secondary)">
        {(!plain || c.kind === "draft") && (
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-circle px-2 py-0.5 text-body-sm font-medium shadow-[0_0_0_1px_var(--color-border-default)]", b.cls)}>
            {c.kind === "live" && <span className="size-1.5 rounded-circle bg-current" />}
            {b.label}
          </span>
        )}
        {/* A plain card always leads with the team name, so cards with a last run carry the same tag as the rest. */}
        {plain && c.team && c.meta !== c.team ? (
          <span className="truncate">
            {c.team} · <span className="font-medium text-(--color-text-primary)">{c.meta}</span>
          </span>
        ) : (
          <span className="truncate">{c.meta}</span>
        )}
        {/* Not live yet: a Run button right on the card; the first run makes the agent live. On a plain card every agent gets it. */}
        {(plain ? c.kind !== "draft" : c.kind === "idle") && real && w && (
          <button
            type="button"
            onClick={() => {
              runAgent(w);
              router.push("/");
            }}
            className={cn("relative z-10 ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-medium border border-(--color-border-default) px-2.5 text-body-sm font-medium text-(--color-text-primary) hover:border-(--color-primary) hover:bg-(--color-primary)/8 hover:text-(--color-text-clickable)", focusRing)}
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
      // Masa Kitchen (the leadership demo account) has no sample drafts; agents the owner writes still show.
      ...(account.id === "masa" ? [] : DRAFTS).map((d): Card => {
        const w = getWorkflow(d.id);
        return { id: d.id, title: w?.title ?? d.title, blurb: w?.overview ?? d.blurb, kind: "draft", meta: `${d.updated ? d.updated.replace(/^Last updated /, "Edited ") : "Not started"}` };
      }),
    ];
    return [...skills.sort((a, b) => Number(b.kind === "live") - Number(a.kind === "live")), ...drafts];
  }, [getWorkflow, created, isNew, account.agentsOff, account.id]);
}

// ───────── Page ─────────

export function AgentsPage() {
  const router = useRouter();
  const { account } = useAccount();
  const { newAgent } = useAgents();
  const isNew = account.stage === "new";
  // Masa Kitchen: every agent is live, so the page shows no status and a Run button on every card.
  const flat = account.id === "masa";
  const groups = flat ? FLAT_GROUPS : GROUPS;
  const filters = flat ? FILTERS.filter((f) => f.id === "all" || f.id === "drafts") : FILTERS;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);

  const cards = useAgentCards();

  const needle = q.trim().toLowerCase();
  const shown = cards.filter((c) => FILTERS.find((f) => f.id === filter)!.match(c.kind) && (!needle || `${c.title} ${c.blurb} ${c.team ?? ""}`.toLowerCase().includes(needle)));
  // Collapsed only on the plain "All" view: a search or a status filter means the owner is looking for something.
  const collapsed = !flat && !showAll && !needle && filter === "all";
  const later = shown.filter(isLater).length;

  return (
    <>
      <PageHeader
        title="Agents"
        actions={
          !account.limited && (
            <Button type="primary" size="small" className="[&_svg]:size-4" iconLeft={<Plus aria-hidden />} onClick={() => router.push(`/agent?id=${newAgent()}`)}>
              New agent
            </Button>
          )
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
              {filters.map((f) => {
                const n = cards.filter((c) => f.match(c.kind)).length;
                const on = filter === f.id;
                if (f.id === "drafts" && !n && !on) return null;
                // With no status filters and no drafts, a lone "All" pill says nothing.
                if (flat && f.id === "all" && !cards.some((c) => c.kind === "draft")) return null;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-circle border px-3.5 text-body-md font-medium transition-colors",
                      focusRing,
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
              {groups.map((g) => {
                const group = shown.filter(g.match);
                if (!group.length) return null;
                if (collapsed && LATER_GROUPS.has(g.id)) {
                  // One toggle in place of the first hidden group; the rest render nothing.
                  if (g.id !== groups.find((x) => LATER_GROUPS.has(x.id) && shown.some(x.match))?.id) return null;
                  return (
                    <div key="more" className="flex justify-center">
                      <button type="button" onClick={() => setShowAll(true)} className={cn("inline-flex h-9 items-center rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-3.5 text-body-md font-medium text-(--color-text-primary) hover:border-(--color-primary) hover:bg-(--color-primary)/8 hover:text-(--color-text-clickable)", focusRing)}>
                        Show all agents ({later} more)
                      </button>
                    </div>
                  );
                }
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
                        <AgentCard key={c.id} c={c} real={!isNew} plain={flat} />
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
