"use client";
import { BotAvatar, type BotAvatarType } from "bot-avatars";
import { ThinkingOrb } from "thinking-orbs";
import { cn } from "@/lib/utils";
import type { AgentId } from "@/lib/mvp3/agents";

// Agent faces and "thinking" marks from Libraries.dev (bot-avatars, thinking-orbs; MIT, 2D canvas).
// Each agent has its own body; it hops while it works and sleeps while it's still learning.

const LOOK: Record<AgentId, { type: BotAvatarType; color?: string }> = {
  finance: { type: "clover", color: "#F76808" }, // brand orange (--brand-900)
  operations: { type: "hexagon" }, // coral
  growth: { type: "flower" }, // green
};

export type AvatarMood = "default" | "working" | "sleeping";

export function AgentAvatar({ agent, size = 28, mood = "default", className }: { agent: AgentId; size?: number; mood?: AvatarMood; className?: string }) {
  const look = LOOK[agent];
  // The Growth agent is still learning: asleep until its first report.
  const state = mood === "default" && agent === "growth" ? "sleeping" : mood;
  return (
    <span aria-hidden className={cn("inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <BotAvatar type={look.type} color={look.color} state={state} size={size} shading="plastic" />
    </span>
  );
}

/** Which orb a work step gets: reading = searching, matching/ranking = solving, applying settings = weaving. */
export function stepOrb(step: string) {
  if (/^(Read|Found)/.test(step)) return "searching" as const;
  if (/^(Match|Compar|Check|Group|Rank|Split|Built|Flag)/.test(step)) return "solving" as const;
  if (/^Applied/.test(step)) return "weaving" as const;
  return "working" as const;
}

export function StepOrb({ step, size = 20 }: { step: string; size?: 20 | 64 }) {
  return <ThinkingOrb state={stepOrb(step)} size={size} aria-label={step} />;
}
