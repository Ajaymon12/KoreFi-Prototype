"use client";
import { cn } from "@/lib/utils";
import { agentOf, type AgentId } from "@/lib/mvp3/agents";
import { AgentAvatar } from "./AgentAvatar";

// The way back to the agent from a pinned report or dashboard. It carries the agent's face and name, tinted in
// the brand colour, so it reads as "talk to the agent that built this" rather than a plain toolbar button.
export function AgentChatButton({ agent, onClick, className }: { agent: AgentId; onClick: () => void; className?: string }) {
  const name = agentOf(agent).name;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ask the ${name} about this, or tell it what to change`}
      className={cn(
        "group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-circle border border-(--color-brand-light) bg-(--color-brand-lightest) py-0 pr-3 pl-1 text-body-sm font-medium text-(--color-text-primary) outline-none transition-colors hover:border-(--color-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
        className,
      )}
    >
      <AgentAvatar agent={agent} size={24} animate />
      <span>
        Ask {name}
      </span>
    </button>
  );
}
