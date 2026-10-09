"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, NotebookText } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { DetailDrawer, DrawerSection } from "@/components/ui/DetailDrawer";
import { DeltaChip } from "../primitives";
import type { Brief, Insight } from "@/lib/sources/overview";

// The weekly brief: one line on what came in this week, and the note behind it in the side
// drawer, so the owner reads the whole week without leaving Overview. Report only: what KoreFi
// is handling is listed as handled, never as something to approve.

export function WeeklyBrief({ brief, insights }: { brief: Brief; insights: Insight[] }) {
  const [open, setOpen] = useState(false);
  const handled = insights.filter((x) => x.tag === "onit");
  const good = insights.find((x) => x.tag === "good");
  const watch = insights.filter((x) => x.tag === "watch");
  return (
    <>
      {/* One slim row: the week's money is the headline; everything else is a chip or lives in the note. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-large border border-(--color-brand-lightest) bg-linear-to-r from-(--brand-200) to-(--color-background-secondary) px-4 py-2.5 text-left transition-shadow outline-none hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
      >
        <span className="flex shrink-0 items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
          <NotebookText className="size-4 text-(--color-primary)" />
          Weekly brief · {brief.date}
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-(--color-border-default) sm:block" />
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <Money value={brief.amount} className="text-subtitle-lg text-(--color-text-primary)" />
          <span className="truncate text-body-md text-(--color-text-secondary)">{brief.amountLabel}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {brief.change && (
            <span className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
              <DeltaChip value={brief.change.value} />
              {brief.change.label}
            </span>
          )}
          {brief.flag && (
            <span className="inline-flex h-5 items-center gap-1.5 rounded-small bg-(--color-background-secondary) px-2 text-body-sm text-(--color-text-primary)">
              <span className="size-1.5 rounded-circle bg-(--color-primary)" />
              {brief.flag}
            </span>
          )}
          <span className="ml-1 flex items-center gap-1 text-subtitle-sm whitespace-nowrap text-(--color-text-primary)">
            Read the note
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </button>

      <DetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={brief.eyebrow}
        title="Your week"
        footer={
          <Link href="/home/weekly-notes" className="group flex items-center gap-1 text-body-md text-(--color-text-clickable) hover:underline">
            All weekly notes
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      >
        <p className="text-subtitle-lg leading-[1.35] text-(--color-text-primary)">{brief.headline}</p>
        <DrawerSection className="divide-y divide-(--color-border-default)">
          {brief.note.map((l) => (
            <div key={l.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-3 text-body-md">
              <span className="text-body-sm text-(--color-text-secondary)">{l.label}</span>
              <span className="text-(--color-text-primary) tabular-nums">
                {l.text}
                {l.lines?.map((t) => (
                  <span key={t} className="block text-body-sm text-(--color-text-secondary)">
                    {t}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </DrawerSection>
        {handled.length > 0 && (
          <DrawerSection title="KoreFi is handling" className="divide-y divide-(--color-border-default)">
            {handled.map((x) => (
              <p key={x.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-body-md text-(--color-text-primary)">
                {x.title}
                <span className="shrink-0 text-subtitle-sm tabular-nums">{x.big}</span>
              </p>
            ))}
          </DrawerSection>
        )}
        {watch.length > 0 && (
          <DrawerSection title="Worth watching" className="divide-y divide-(--color-border-default)">
            {watch.map((x) => (
              <p key={x.id} className="px-4 py-3 text-body-md text-(--color-text-primary)">
                {x.title}
              </p>
            ))}
          </DrawerSection>
        )}
        {good && (
          <DrawerSection title="Good to know">
            <p className="px-4 py-3 text-body-md text-(--color-text-primary)">{good.title}</p>
          </DrawerSection>
        )}
        <p className="text-body-sm text-(--color-text-tertiary)">Nothing here needs you.</p>
      </DetailDrawer>
    </>
  );
}
