import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Draft } from "@/lib/mvp3/agents";

// A draft agent: grey card with its title, who wrote it, and a paper preview of its steps that bleeds off the bottom edge.
export function DraftCard({ d }: { d: Draft }) {
  return (
    <Link href={`/mvp3/agent?id=${d.id}`} className="relative flex outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) h-[260px] overflow-hidden rounded-large bg-(--color-neutral-lightest) transition-shadow hover:shadow-[0_6px_20px_-10px_rgb(0_0_0/0.25)] border border-(--color-border-default)">
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-(--color-text-clickable) uppercase">
          <span className="size-1.5 rounded-circle bg-current" />
          Draft
        </p>
        <h3 className="mt-3 text-subtitle-md font-medium text-(--color-text-primary)">{d.title}</h3>
        <p className="mt-1 line-clamp-3 text-body-sm text-(--color-text-secondary)">{d.blurb}</p>
        {d.updated && <p className="mt-1 text-body-sm text-(--color-text-secondary)">{d.updated}</p>}
        <p className="mt-auto text-body-md text-(--color-text-primary)">
          {d.by}
          <span className="block text-body-sm text-(--color-text-secondary)">Created by</span>
        </p>
      </div>
      <div className="mt-4 mr-4 w-[48%] shrink-0 overflow-hidden rounded-t-medium border border-b-0 border-(--color-border-default) bg-(--color-background-secondary) p-3 shadow-sm">
        <p className="text-body-sm font-medium text-(--color-text-primary)">Steps</p>
        {d.steps.length === 0 ? (
          <p className="text-body-sm text-(--color-text-secondary)">No steps yet</p>
        ) : (
          <div className="mt-1.5 space-y-2">
            {d.steps.map((g) => (
              <div key={g.group}>
                <p className="text-body-sm text-(--color-text-secondary)">{g.group}</p>
                <ol className="mt-1 space-y-1">
                  {g.items.map((s, i) => (
                    <li key={s} className={cn("flex gap-1.5 text-body-sm leading-4 text-(--color-text-primary)")}>
                      <span className="grid size-4 shrink-0 place-items-center rounded-circle border border-(--color-border-default) text-[9px] text-(--color-text-secondary)">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
