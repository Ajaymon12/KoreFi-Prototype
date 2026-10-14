"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { Row } from "@/components/dashboard/overview/InsightFeed";
import { HowWeKnow, TAGS, persona, shortRole } from "@/components/dashboard/overview/Insights";
import { mvpHref } from "@/lib/mvp/insights";
import type { Insight } from "@/lib/sources/overview";

// The insights pieces every MVP report carries. Report only: nothing here asks the owner to act.
//  - InsightDrawer: the "How we know" panel, with prev/next through the list.
//  - MvpInsights: up to three findings as a list (the default block under a report).
//  - InsightBanner: the same findings as a three-column card at the top of a page (after Mercury's
//    "Categorization that keeps up with you" banner on Transactions), dismissible for the visit.

export function InsightDrawer({ insights, openId, onOpen }: { insights: Insight[]; openId: string | null; onOpen: (id: string | null) => void }) {
  const i = insights.findIndex((x) => x.id === openId);
  const cur = insights[i];
  return (
    <DetailDrawer
      open={!!cur}
      onClose={() => onOpen(null)}
      eyebrow={cur && `${persona(cur).role} · ${i + 1} of ${insights.length}`}
      title={cur ? TAGS[cur.tag].label : ""}
      onPrev={i > 0 ? () => onOpen(insights[i - 1].id) : undefined}
      onNext={i >= 0 && i < insights.length - 1 ? () => onOpen(insights[i + 1].id) : undefined}
      footer={
        cur && (
          <Link href={mvpHref(cur)} onClick={() => onOpen(null)} className="group flex items-center gap-1 text-body-md text-(--color-text-clickable) hover:underline">
            Open the report
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      }
    >
      {cur && <HowWeKnow x={cur} />}
    </DetailDrawer>
  );
}

export function MvpInsights({ insights, title = "Insights", empty = "Nothing stands out here this period." }: { insights: Insight[]; title?: string; empty?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-subtitle-md text-(--color-text-primary)">
        <Sparkles aria-hidden className="size-3.5 text-(--color-primary)" />
        {title}
        <span className="text-body-sm text-(--color-text-secondary) tabular-nums">{insights.length}</span>
      </h2>
      {insights.length ? (
        <ul className="divide-y divide-(--color-border-default) overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
          {insights.map((x) => (
            <Row key={x.id} x={x} onOpen={() => setOpenId(x.id)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-large border border-(--color-border-default) px-5 py-6 text-center text-body-md text-(--color-text-secondary)">{empty}</p>
      )}
      <InsightDrawer insights={insights} openId={openId} onOpen={setOpenId} />
    </section>
  );
}

export function InsightBanner({ insights, title = "What KoreFi sees" }: { insights: Insight[]; title?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  if (hidden || !insights.length) return null;
  const shown = insights.slice(0, 3);
  return (
    <section aria-label={title} className="relative overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-5 pt-4 pb-5">
      {/* A soft brand wash in the corner, as Mercury tints its AI banner. */}
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-circle bg-(--brand-300) opacity-60 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-subtitle-md text-(--color-text-primary)">
          <Sparkles aria-hidden className="size-4 text-(--color-primary)" />
          {title}
        </h2>
        <button type="button" aria-label="Hide for now" onClick={() => setHidden(true)} className="grid size-7 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ul className={cn("relative mt-3 grid gap-x-6 gap-y-3 md:divide-x md:divide-(--color-border-default)", shown.length === 3 && "md:grid-cols-3", shown.length === 2 && "md:grid-cols-2")}>
        {shown.map((x) => (
          <li key={x.id} className="min-w-0 md:pl-5 md:first:pl-0">
            <button type="button" onClick={() => setOpenId(x.id)} className="group block w-full text-left outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
              <span className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
                <span aria-hidden className={cn("size-1.5 rounded-circle", TAGS[x.tag].dot)} />
                {TAGS[x.tag].label} · {shortRole(x)}
              </span>
              <span className="mt-1 block text-body-lg font-medium text-(--color-text-primary) group-hover:underline">{x.title}</span>
              <span className="mt-1 block text-body-md text-(--color-text-secondary)">{x.line}</span>
            </button>
          </li>
        ))}
      </ul>
      <InsightDrawer insights={shown} openId={openId} onOpen={setOpenId} />
    </section>
  );
}
