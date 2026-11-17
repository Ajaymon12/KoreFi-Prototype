"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOLDERS, type AgentId } from "@/lib/mvp3/agents";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";
import { AgentCard, useAgentCards } from "./AgentsPage";

// Home / Your agents, after a projects home strip: a row of tabs grouped by agent (All, Operations,
// Finance, Growth) with "Browse all" on the right, and under it a row of the same preview cards as the
// Agents page (a scaled report for live agents, an outline of the dashboard for the rest).
// Report-only: cards open the agent; Run now and Duplicate sit in each card's menu.

const ROW = 3;
const focus = "outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

export function AgentFolders() {
  const { account } = useAccount();
  const real = account.stage !== "new";
  const cards = useAgentCards().filter((c) => c.kind !== "draft");
  const [tab, setTab] = useState<AgentId | "all">("all");
  const shown = (tab === "all" ? cards : cards.filter((c) => c.agent === tab)).slice(0, ROW);

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
          {FOLDERS.map((f) => (
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
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <AgentCard key={c.id} c={c} real={real} />
        ))}
      </ul>
    </div>
  );
}
