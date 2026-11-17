"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Mail, Pin, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { PageHeader } from "@/components/shell/PageHeader";
import { DRAFTS, FOLDERS, type Draft, type SkillState } from "@/lib/mvp3/agents";
import { isSchedule } from "@/lib/mvp3/workflows";
import { useAgents } from "./AgentsProvider";
import { DraftCard } from "./DraftCards";
import { IntegrationMark } from "./WorkflowEditor";

// MVP 3 / Agents: the preset agents KoreFi set up (grouped as on the home's folders), then drafts, with
// New agent to start one from scratch. A card opens the editor (view, alter, add steps and integrations);
// Run starts it now and opens the result in a chat. Preset edits and new agents live in AgentsProvider.

const STATE: Record<SkillState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-(--color-success-lightest) text-(--color-text-success)" },
  learning: { label: "Learning", cls: "bg-(--color-neutral-light) text-(--color-text-secondary)" },
  soon: { label: "Coming soon", cls: "bg-(--color-neutral-lightest) text-(--color-text-secondary)" },
};

export function AgentsPage() {
  const router = useRouter();
  const { getWorkflow, runAgent, newAgent, created, dashboards } = useAgents();
  const drafts: Draft[] = [
    ...created.map((w) => ({ id: w.id, title: w.title, blurb: w.overview, by: `${user.firstName} ${user.lastName}`, updated: "Just now", steps: w.groups.map((g) => ({ group: g.title, items: g.steps })) })),
    ...DRAFTS.map((d) => {
      const w = getWorkflow(d.id);
      return w ? { ...d, title: w.title, blurb: w.overview } : d;
    }),
  ];

  return (
    <>
      <PageHeader
        title="Agents"
        actions={
          <button type="button" onClick={() => router.push(`/mvp3/agent?id=${newAgent()}`)} className="inline-flex h-8 items-center gap-1.5 rounded-medium bg-(--color-primary) px-3 text-body-sm font-medium text-white outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary)">
            <Plus className="size-4" aria-hidden />
            New agent
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] space-y-10 px-4 py-6 sm:px-6">
          {FOLDERS.map((f) => (
            <section key={f.agent} aria-labelledby={`f-${f.agent}`} className="space-y-3">
              <h2 id={`f-${f.agent}`} className="flex items-center gap-2 text-body-md font-medium text-(--color-text-primary)">
                <span className="size-2.5 rounded-circle" style={{ background: f.hue }} />
                {f.label}
                <span className="font-normal text-(--color-text-secondary)">{f.skills.length}</span>
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {f.skills.map((s) => {
                  const w = getWorkflow(s.id)!;
                  const st = STATE[s.state];
                  const schedule = w.triggers.find(isSchedule) ?? w.triggers[0];
                  const dash = dashboards.find((d) => d.workflow === s.id);
                  return (
                    <li key={s.id} className={cn("relative flex flex-col rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-4 transition-colors hover:border-(--color-border-darker)", s.state === "soon" && "opacity-80")}>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/mvp3/agent?id=${s.id}`} className="text-body-md font-medium text-(--color-text-primary) outline-none after:absolute after:inset-0 after:rounded-large focus-visible:after:outline-2 focus-visible:after:outline-(--color-focus-primary)">
                          {w.title}
                        </Link>
                        <span className={cn("shrink-0 rounded-circle px-2 py-0.5 text-[11px]", st.cls)}>{st.label}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-body-sm text-(--color-text-secondary)">{w.overview}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-sm text-(--color-text-secondary)">
                        {w.integrations.length > 0 && (
                          <span className="flex items-center gap-1" title={w.integrations.join(", ")}>
                            {w.integrations.map((a) => (
                              <span key={a} className="flex">
                                <IntegrationMark name={a} size={18} />
                              </span>
                            ))}
                          </span>
                        )}
                        {schedule && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" aria-hidden />
                            {schedule}
                          </span>
                        )}
                        {w.deliver.email && s.state !== "soon" && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="size-3.5" aria-hidden />
                            Email
                          </span>
                        )}
                        {dash?.pinned && (
                          <span className="inline-flex items-center gap-1">
                            <Pin className="size-3.5" aria-hidden />
                            {dash.title} dashboard
                          </span>
                        )}
                      </div>
                      {s.state === "live" && (
                        <button
                          type="button"
                          onClick={() => {
                            runAgent(w);
                            router.push("/mvp3");
                          }}
                          className="relative z-10 mt-3 inline-flex h-8 w-fit items-center gap-1.5 rounded-medium border border-(--color-border-default) px-2.5 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                        >
                          <Play className="size-3.5" aria-hidden />
                          Run now
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section aria-labelledby="drafts-h" className="space-y-3">
            <h2 id="drafts-h" className="flex items-center gap-2 text-body-md font-medium text-(--color-text-primary)">
              Drafts
              <span className="font-normal text-(--color-text-secondary)">{drafts.length}</span>
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {drafts.map((d) => (
                <li key={d.id}>
                  <DraftCard d={d} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
