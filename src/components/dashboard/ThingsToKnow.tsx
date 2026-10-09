"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoworkAvatar } from "@/components/module/CoworkAvatar";
import { StatusBadge } from "./primitives";
import type { Persona } from "@/lib/nav";

// "Things to know": compact cards, ranked by impact. Reading order inside a card is
// who noticed → what happened (one sentence) → what it's worth. It's a report: issues are tagged
// as handled by KoreFi, the whole card opens the detailed page, and "How we know" is a popover so
// it never changes the card's height.

export type Cowork = { role: string; illustration: Persona["illustration"] };

export type Thing = {
  cowork: Cowork;
  /** "issue": KoreFi is handling it. "win": good news, nothing to handle. */
  kind: "issue" | "win";
  headline: string;
  /** What the amount means, e.g. "lost to downtime". */
  caption: string;
  value: string;
  href: string;
  /** "How we know": the method in one sentence, and the sources it read. */
  method: string;
  sources: React.ReactNode;
};

function HowWeKnow({ method, children }: { method: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative z-10">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        aria-label="How we know"
        title="How we know"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid size-6 place-items-center rounded-small text-(--color-text-tertiary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          open && "bg-(--color-neutral-light) text-(--color-text-primary)",
        )}
      >
        <Info className="size-3.5" />
      </button>
      <div
        id={panel}
        role="dialog"
        aria-label="How we know"
        hidden={!open}
        className="absolute top-full right-0 z-20 mt-1.5 w-72 space-y-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-3 shadow-md"
      >
        <p className="text-subtitle-xs text-(--color-text-primary)">How we know</p>
        <p className="text-body-sm text-(--color-text-secondary)">{method}</p>
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    </div>
  );
}

function ThingCard({ thing }: { thing: Thing }) {
  const issue = thing.kind === "issue";
  return (
    <article className="group/card relative flex flex-col rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-5 transition-colors hover:border-(--color-border-darker)">
      <div className="flex items-center gap-2">
        <CoworkAvatar kind={thing.cowork.illustration} className="size-6" />
        <span className="min-w-0 flex-1 truncate text-body-sm text-(--color-text-secondary)">{thing.cowork.role}</span>
        <StatusBadge tone={issue ? "neutral" : "success"}>{issue ? "KoreFi is on it" : "Good news"}</StatusBadge>
      </div>

      {/* The headline link stretches over the whole card; the info button sits above it. */}
      <Link
        href={thing.href}
        className="mt-3 line-clamp-2 text-subtitle-sm leading-[1.4] text-(--color-text-primary) outline-none after:absolute after:inset-0 after:rounded-large focus-visible:after:outline-2 focus-visible:after:outline-(--color-focus-primary)"
      >
        {thing.headline}
      </Link>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className={cn("text-subtitle-lg tabular-nums", issue ? "text-(--color-text-danger)" : "text-(--color-text-success)")}>{thing.value}</span>
          <span className="truncate text-body-sm text-(--color-text-tertiary)">{thing.caption}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <HowWeKnow method={thing.method}>{thing.sources}</HowWeKnow>
          <ArrowRight aria-hidden className="size-4 text-(--color-text-tertiary) transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-(--color-text-primary)" />
        </div>
      </div>
    </article>
  );
}

export function ThingsGrid({ things }: { things: Thing[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {things.map((t) => (
        <ThingCard key={t.headline} thing={t} />
      ))}
    </div>
  );
}
