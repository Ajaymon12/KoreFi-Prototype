"use client";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/mvp3/activity";
import { agentOf } from "@/lib/mvp3/agents";
import { AgentAvatar } from "./AgentAvatar";

// The activity log (lib/mvp3/activity): a day-by-day timeline of what the KoreFi team and the agent did.
// Used on an agent's overview and in a chat's Activity panel. Report-only: nothing here asks the owner to act.

const day = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const time = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function Who({ by, size }: { by: Activity["by"]; size: number }) {
  if (by.kind === "agent") return <AgentAvatar agent={by.agent} size={size} />;
  const letter = by.kind === "team" ? by.name[0] : "K";
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-circle text-[11px] font-medium", by.kind === "team" ? "bg-(--color-neutral-light) text-(--color-text-primary)" : "bg-(--color-primary-solid) text-(--color-text-inverse-primary)")} style={{ width: size, height: size }}>
      {letter}
    </span>
  );
}

/** `short` (the chat's panel): "Priya, KoreFi" and "Agent", so the line fits a narrow column. */
const whoName = (by: Activity["by"], short = false) =>
  by.kind === "team" ? (short ? `${by.name.split(" · ")[0]}, KoreFi` : by.name) : by.kind === "agent" ? (short ? "Agent" : agentOf(by.agent).name) : "KoreFi";

/** `days`: how many days show before "Show earlier". */
export function ActivityLog({ items, days = 7, compact = false }: { items: Activity[]; days?: number; compact?: boolean }) {
  const [shown, setShown] = useState(days);
  const groups = useMemo(() => {
    const out: { day: string; items: Activity[] }[] = [];
    for (const a of items) {
      const d = day(a.at);
      const g = out[out.length - 1];
      if (g?.day === d) g.items.push(a);
      else out.push({ day: d, items: [a] });
    }
    return out;
  }, [items]);
  if (!items.length) return <p className="px-4 py-10 text-center text-body-md text-(--color-text-secondary)">Nothing yet. The KoreFi team’s updates show here once your reports come in.</p>;
  const size = compact ? 22 : 26;
  return (
    <div className={compact ? "px-4 py-3" : "px-4 py-3"}>
      <ol className={compact ? "space-y-3" : "space-y-4"}>
        {groups.slice(0, shown).map((g) => (
          <li key={g.day}>
            <p className="pb-2 text-body-sm font-medium text-(--color-text-secondary)">{g.day}</p>
            <ol className="relative space-y-2.5 before:absolute before:top-2 before:bottom-2 before:left-(--x) before:w-px before:bg-(--color-border-default)" style={{ ["--x" as string]: `${size / 2}px` }}>
              {g.items.map((a) => (
                <li key={a.id} className="relative flex gap-3">
                  <span className="relative z-[1] rounded-circle bg-(--color-background-secondary)">
                    <Who by={a.by} size={size} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-(--color-text-primary)", compact ? "text-body-sm leading-5" : "text-body-md")}>{a.text}</p>
                    <p className="text-body-sm text-(--color-text-secondary)">
                      {whoName(a.by, compact)} · {time(a.at)}
                      {a.detail && !compact && <> · {a.detail}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {groups.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + days)} className="mt-4 h-8 rounded-medium border border-(--color-border-default) px-3 text-body-sm font-medium text-(--color-text-primary) outline-none hover:border-(--color-primary) hover:bg-(--color-primary)/8 hover:text-(--color-text-clickable) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          Show earlier
        </button>
      )}
    </div>
  );
}
