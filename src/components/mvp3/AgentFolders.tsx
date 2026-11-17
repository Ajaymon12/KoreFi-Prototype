"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENTS, type AgentId } from "@/lib/mvp3/agents";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";
import { AgentCard, useAgentCards } from "./AgentsPage";

// Home / Your agents, after a projects home strip: a row of tabs grouped by agent (All, Operations,
// Finance, Growth) with "Browse all" on the right, and under it a row of the same preview cards as the
// Agents page (a scaled report for live agents, an outline of the dashboard for the rest). "All agents" groups the
// cards under each agent's heading (up to a row each, "See all" opens that agent's tab); an agent tab shows all of its cards.
// Report-only: cards open the agent; Run now and Duplicate sit in each card's menu.

const ROW = 3;
const focus = "outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

export function AgentFolders() {
  const { account } = useAccount();
  const real = account.stage !== "new";
  const cards = useAgentCards().filter((c) => c.kind !== "draft");
  const [tab, setTab] = useState<AgentId | "all">("all");
  // The three agents (Operations, Finance, Growth), named as on the Agents page.
  const teams = AGENTS.map((a) => ({ agent: a.id, label: a.name.replace(/ agent$/, "") }));
  const groups = (tab === "all" ? teams : teams.filter((f) => f.agent === tab)).map((f) => ({ f, all: cards.filter((c) => c.agent === f.agent) })).filter((g) => g.all.length);

  const tabCls = (on: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-2 rounded-circle border px-3.5 text-body-md transition-colors",
      focus,
      on ? "border-(--color-border-darker) bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)",
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Your agents" className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) p-1">
          <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={tabCls(tab === "all")}>
            All agents
          </button>
          {teams.map((f) => (
            <button key={f.agent} type="button" role="tab" aria-selected={tab === f.agent} onClick={() => setTab(f.agent)} className={cn(tabCls(tab === f.agent), "pl-2")}>
              <AgentAvatar agent={f.agent} size={20} mood={real ? "default" : "sleeping"} />
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/mvp3/agents" className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-medium px-1 text-body-md font-medium text-(--color-text-primary) hover:text-(--color-text-clickable)", focus)}>
          Browse all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="space-y-8">
        {groups.map(({ f, all }) => {
          const shown = tab === "all" ? all.slice(0, ROW) : all;
          return (
            <section key={f.agent} aria-labelledby={`team-${f.agent}`} className="space-y-3">
              {tab === "all" && (
                <div className="flex items-center gap-2.5">
                  <AgentAvatar agent={f.agent} size={24} mood={real ? "default" : "sleeping"} />
                  <h3 id={`team-${f.agent}`} className="flex items-baseline gap-2 text-subtitle-md font-medium text-(--color-text-primary)">
                    {f.label}
                    <span className="text-body-md font-normal text-(--color-text-secondary)">{all.length}</span>
                  </h3>
                  {all.length > ROW && (
                    <button type="button" onClick={() => setTab(f.agent)} className={cn("ml-auto inline-flex items-center gap-1 rounded-medium px-1 text-body-sm text-(--color-text-clickable) hover:underline", focus)}>
                      See all
                      <ArrowRight className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((c) => (
                  <AgentCard key={c.id} c={c} real={real} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
