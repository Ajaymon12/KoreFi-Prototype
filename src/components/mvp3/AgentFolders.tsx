"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, LayoutDashboard, Mail, Play, SlidersHorizontal, X } from "lucide-react";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { cn } from "@/lib/utils";
import { FOLDERS, agentOf, type AgentId, type Folder, type Skill, type SkillState, type Thread } from "@/lib/mvp3/agents";
import { isSchedule } from "@/lib/mvp3/workflows";
import { IntegrationMark } from "./WorkflowEditor";
import { useAgents } from "./AgentsProvider";
import { AgentMark } from "./AgentChat";
import { StatusDot } from "./Mvp3Sidebar";
import { useAccount } from "./AccountSwitcher";

// Home: one neutral card per agent (Operations, Finance, Growth), like ChatGPT's GPT list: the agent's
// face, its status, and the skills inside with their state. Click opens the agent's skills.
// Report-only: no "turn on" buttons, the KoreFi team sets agents up.

const STATE: Record<SkillState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-(--color-success-lightest) text-(--color-text-success)" },
  learning: { label: "Learning", cls: "bg-(--color-neutral-light) text-(--color-text-secondary)" },
  soon: { label: "Coming soon", cls: "bg-(--color-neutral-lightest) text-(--color-text-secondary)" },
};

const PEEK = 3;

/** A restaurant that just joined has no reports yet, so nothing is live: its live skills are still learning. */
function forStage(f: Folder, fresh: boolean): Folder {
  return fresh ? { ...f, skills: f.skills.map((s) => (s.state === "live" ? { ...s, state: "learning" as const, thread: undefined } : s)) } : f;
}

function AgentCard({ f, fresh }: { f: Folder; fresh: boolean }) {
  const a = agentOf(f.agent);
  const status = fresh ? "learning" : a.status;
  const live = f.skills.filter((s) => s.state === "live").length;
  const more = f.skills.length - PEEK;
  return (
    <span className="flex h-full flex-col rounded-xlarge border border-(--color-border-default) bg-(--color-background-secondary) p-4 text-left transition-[border-color,box-shadow] group-hover:border-(--color-border-darker) group-hover:shadow-[0_6px_20px_-12px_rgb(0_0_0/0.2)]">
      <span className="flex items-center gap-3">
        <AgentMark agent={f.agent} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-subtitle-md font-medium text-(--color-text-primary)">{f.label}</span>
          <span className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            <StatusDot status={status} />
            <span aria-hidden>·</span>
            {live} of {f.skills.length} live
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="mt-4 block divide-y divide-(--color-border-default) border-t border-(--color-border-default)">
        {f.skills.slice(0, PEEK).map((s) => (
          <span key={s.id} className="flex items-center justify-between gap-2 py-2">
            <span className="min-w-0 truncate text-body-md text-(--color-text-primary)">{s.name}</span>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-circle px-2 py-0.5 text-[11px] font-medium", STATE[s.state].cls)}>
              {s.state === "live" && <span className="size-1.5 rounded-circle bg-current" />}
              {STATE[s.state].label}
            </span>
          </span>
        ))}
        {more > 0 && <span className="block pt-2 text-body-sm text-(--color-text-secondary)">+{more} more</span>}
      </span>
    </span>
  );
}

/** The latest thing a skill posted: its chat's last agent reply. */
function latestOf(t: Thread | undefined) {
  if (!t) return null;
  for (let i = t.messages.length - 1; i >= 0; i--) {
    const m = t.messages[i];
    if (m.role === "agent" && "reply" in m) return { title: m.reply.title, at: m.at ?? t.at };
  }
  return null;
}

const action = "inline-flex h-8 items-center gap-1.5 rounded-medium px-2.5 text-body-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5";

function SkillCard({ s, onClose }: { s: Skill; onClose: () => void }) {
  const router = useRouter();
  const { threads, open, getWorkflow, runAgent, dashboards } = useAgents();
  const w = getWorkflow(s.id);
  const thread = s.thread ? threads.find((t) => t.id === s.thread) : undefined;
  const latest = latestOf(thread);
  const dash = dashboards.find((d) => d.workflow === s.id && d.pinned);
  const schedule = w?.triggers.find(isSchedule) ?? w?.triggers[0];
  const integrations = w?.integrations ?? [];
  const live = s.state === "live";
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <li className="flex flex-col rounded-large border border-(--color-border-default) bg-(--color-background-secondary) transition-shadow hover:shadow-[0_6px_20px_-12px_rgb(0_0_0/0.25)]">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-body-lg font-medium text-(--color-text-primary)">{w?.title ?? s.name}</h3>
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-circle px-2 py-0.5 text-[11px] font-medium", STATE[s.state].cls)}>
            {live && <span className="size-1.5 rounded-circle bg-current" />}
            {STATE[s.state].label}
          </span>
        </div>
        <p className="line-clamp-2 text-body-sm text-(--color-text-secondary)">{s.blurb}</p>

        {latest ? (
          <button
            type="button"
            onClick={() => {
              open(thread!.id);
              go("/mvp3");
            }}
            className="group flex items-center gap-2 rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-left outline-none hover:bg-(--color-neutral-light) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[11px] text-(--color-text-secondary)">
                Latest · {latest.at}
                {thread?.unread && <span className="font-medium text-(--color-text-clickable)">New</span>}
              </span>
              <span className="block truncate text-body-sm font-medium text-(--color-text-primary)">{latest.title}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        ) : s.state === "learning" ? (
          <p className="rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-secondary)">Learning your data. The first report will post in a chat.</p>
        ) : null}

        <dl className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body-sm text-(--color-text-secondary)">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Reads</dt>
            <dd className="flex items-center gap-1.5">
              {integrations.length ? (
                <>
                  <span className="flex -space-x-1">
                    {integrations.map((a) => (
                      <span key={a} title={a} className="rounded-small ring-2 ring-(--color-background-secondary)">
                        <IntegrationMark name={a} size={18} />
                      </span>
                    ))}
                  </span>
                  {integrations.length === 1 && integrations[0]}
                </>
              ) : (
                <span className="text-(--color-text-success)">No access needed</span>
              )}
            </dd>
          </div>
          {schedule && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Runs</dt>
              <CalendarClock className="size-3.5" aria-hidden />
              <dd>{schedule}</dd>
            </div>
          )}
          {w?.deliver.email && s.state !== "soon" && (
            <div className="flex items-center gap-1.5" title="Emails you the result">
              <dt className="sr-only">Sends</dt>
              <Mail className="size-3.5" aria-hidden />
              <dd>Email</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex items-center gap-1 border-t border-(--color-border-default) px-2 py-2">
        {live && w && (
          <button
            type="button"
            onClick={() => {
              runAgent(w);
              go("/mvp3");
            }}
            className={cn(action, "bg-(--color-text-primary) text-(--color-text-inverse-primary) hover:bg-(--color-neutral-darkest)")}
          >
            <Play aria-hidden />
            Run now
          </button>
        )}
        <Link href={`/mvp3/agent?id=${s.id}`} onClick={onClose} className={cn(action, "text-(--color-text-primary) hover:bg-(--color-neutral-light)")}>
          <SlidersHorizontal aria-hidden />
          {s.state === "soon" ? "Preview" : live ? "Details" : "Edit"}
        </Link>
        {dash && (
          <Link href={`/mvp3/dashboard?id=${dash.id}`} onClick={onClose} className={cn(action, "ml-auto text-(--color-text-primary) hover:bg-(--color-neutral-light)")}>
            <LayoutDashboard aria-hidden />
            {dash.title}
          </Link>
        )}
      </div>
    </li>
  );
}

function FolderDialog({ folder, agentName, status, onClose }: { folder: Folder; agentName: string; status: "watching" | "learning"; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, true, onClose);
  const live = folder.skills.filter((s) => s.state === "live").length;
  const one = folder.skills.length === 1;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/40 p-4 motion-safe:animate-page-in">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={folder.label}
        className={cn("my-auto w-full overflow-hidden rounded-xlarge border border-(--color-border-default) bg-(--color-background-primary) shadow-[0_24px_64px_-16px_rgb(0_0_0/0.3)]", one ? "max-w-[480px]" : "max-w-[800px]")}
      >
        <header className="relative flex items-center gap-3 border-b border-(--color-border-default) bg-(--color-background-secondary) px-5 py-4">
          <span className="relative">
            <AgentMark agent={folder.agent} size={40} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-subtitle-lg font-medium text-(--color-text-primary)">{folder.label}</h2>
            <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-(--color-text-secondary)">
              {agentName}
              <StatusDot status={status} />
              <span aria-hidden>·</span>
              {live} of {folder.skills.length} live
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            <X className="size-4" />
          </button>
        </header>
        <ul className={cn("grid gap-3 p-4", !one && "sm:grid-cols-2")}>
          {folder.skills.map((s) => (
            <SkillCard key={s.id} s={s} onClose={onClose} />
          ))}
        </ul>
        <p className="px-5 pb-4 text-body-sm text-(--color-text-secondary)">Agents only report. The KoreFi team files every dispute and fix.</p>
      </div>
    </div>
  );
}

export function AgentFolders() {
  const { account } = useAccount();
  const fresh = account.stage === "new";
  const folders = FOLDERS.map((f) => forStage(f, fresh));
  const [sel, setSel] = useState<AgentId | null>(null);
  const folder = folders.find((f) => f.agent === sel);
  const agent = sel ? agentOf(sel) : null;

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 sm:grid-cols-3">
        {folders.map((f) => (
          <li key={f.agent}>
            <button type="button" aria-haspopup="dialog" onClick={() => setSel(f.agent)} className="group block h-full w-full rounded-xlarge outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)">
              <AgentCard f={f} fresh={fresh} />
            </button>
          </li>
        ))}
      </ul>

      {folder && agent && <FolderDialog folder={folder} agentName={agent.name} status={fresh ? "learning" : agent.status} onClose={() => setSel(null)} />}
    </div>
  );
}
