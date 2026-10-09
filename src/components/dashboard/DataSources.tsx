"use client";
import { useCallback, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FreshnessStamp } from "./primitives";
import { useDismiss } from "./useDismiss";

type Status = "healthy" | "syncing" | "error";
const DOT: Record<Status, string> = { healthy: "bg-(--color-success-default)", syncing: "bg-(--color-info-default)", error: "bg-(--color-danger-default)" };
const TEXT: Record<Status, string> = { healthy: "Synced", syncing: "Syncing", error: "Not syncing" };

// One quiet pill in place of a row of connection chips: the summary is visible, the detail is
// one click away.
export function DataSources({ sources, syncedAt, timezoneNote }: { sources: { id: string; name: string; status: Status }[]; syncedAt: string; timezoneNote: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  const broken = sources.filter((s) => s.status === "error").length;
  const summary = broken ? `${broken} source${broken === 1 ? "" : "s"} need${broken === 1 ? "s" : ""} attention` : `${sources.length} sources connected`;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-md text-(--color-text-primary) transition-colors hover:bg-(--color-neutral-lightest) aria-expanded:bg-(--color-neutral-lightest)"
      >
        <span className={cn("size-2 rounded-circle", broken ? DOT.error : DOT.healthy)} />
        {summary}
        <ChevronDown className={cn("size-4 text-(--color-text-secondary) transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="dialog" aria-label="Data sources" className="absolute top-full right-0 z-30 mt-2 w-72 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-2 shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
          <ul>
            {sources.map((s) => (
              <li key={s.id} className="flex h-9 items-center gap-2.5 rounded-medium px-2 text-body-md">
                <span className={cn("size-2 rounded-circle", DOT[s.status])} />
                <span className="flex-1 text-(--color-text-primary)">{s.name}</span>
                <span className={cn("text-body-sm", s.status === "error" ? "text-(--color-danger-darkest)" : "text-(--color-text-secondary)")}>{TEXT[s.status]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-1 space-y-0.5 border-t border-(--color-border-default) px-2 pt-2 pb-1">
            <FreshnessStamp at={syncedAt} label="Latest sync" />
            <p className="text-body-sm text-(--color-text-secondary)">Days end at midnight {timezoneNote}.</p>
          </div>
        </div>
      )}
    </div>
  );
}
