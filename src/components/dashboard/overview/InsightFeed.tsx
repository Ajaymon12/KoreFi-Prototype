"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { fmtCents } from "@/lib/mockData";
import type { Insight, InsightTag } from "@/lib/sources/overview";
import { Avatar, HowWeKnow, persona, shortRole, TAGS } from "./Insights";

// Home: AI insights across the whole platform. Reading order is the point:
//  1. a plain-language summary (what to know in ten seconds),
//  2. the findings, grouped by how much they matter (watch → handled → good → FYI),
//  3. "How we know" in the drawer, so every number can be traced to its source.
// Report only: the owner is never asked to act. Issues are labelled as handled by KoreFi.

type Area = "all" | Insight["cowork"];
const AREAS: { id: Area; label: string }[] = [
  { id: "all", label: "All" },
  { id: "finance", label: "Finance" },
  { id: "operations", label: "Operations" },
  { id: "growth", label: "Growth" },
];

// Group order = priority. Each group says what it means for the owner, in one line.
const GROUPS: { tag: InsightTag; title: string; hint: string }[] = [
  { tag: "watch", title: "Worth watching", hint: "Moving the wrong way. Keep an eye on these." },
  { tag: "onit", title: "KoreFi is on it", hint: "Found and being followed up. Nothing for you to do." },
  { tag: "good", title: "Good news", hint: "Money or momentum in your favour." },
  { tag: "info", title: "Worth knowing", hint: "Context, no action." },
];

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The summary card: one headline and up to three short sentences, built from the findings. */
function Summary({ insights }: { insights: Insight[] }) {
  const watch = insights.filter((x) => x.tag === "watch");
  const onit = insights.filter((x) => x.tag === "onit");
  const good = insights.filter((x) => x.tag === "good");
  const atStake = onit.reduce((a, x) => a + x.impact, 0);
  const headline = watch.length
    ? `${plural(watch.length, "thing")} worth watching this period${onit.length ? `, and KoreFi is handling ${onit.length} more` : ""}.`
    : onit.length
      ? `Nothing needs you. KoreFi is handling ${onit.length}.`
      : "All clear this period.";
  const lines = [
    onit.length && atStake > 0 ? `${fmtCents(atStake)} is being followed up with the delivery apps and your bank.` : "",
    watch[0] ? `Biggest watch item: ${watch[0].title}.` : "",
    good[0] ? `Good news: ${good[0].title}.` : "",
  ].filter(Boolean);
  return (
    <section aria-label="Summary" className="rounded-large border border-(--color-brand-lightest) bg-linear-to-r from-(--brand-200) to-(--color-background-secondary) px-6 py-5">
      <p className="flex items-center gap-1.5 text-subtitle-xs tracking-wide text-(--color-text-secondary) uppercase">
        <Sparkles aria-hidden className="size-3.5 text-(--color-primary)" />
        Summary
      </p>
      <h2 className="mt-2 text-page-title text-(--color-text-primary)">{headline}</h2>
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {lines.map((l) => (
            <li key={l} className="relative pl-4 text-body-lg text-(--color-text-secondary) before:absolute before:top-[0.65em] before:left-0 before:size-1.5 before:rounded-circle before:bg-(--color-text-tertiary)">
              {l}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Row({ x, onOpen }: { x: Insight; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${x.big}, ${x.title}`}
        className="group grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-4 gap-y-1 px-5 py-4 text-left transition-colors outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus-primary)"
      >
        <span className="min-w-0">
          <span className="block text-body-lg text-(--color-text-primary)">{x.title}</span>
          <span className="mt-1 block text-body-md text-(--color-text-secondary)">{x.line}</span>
          <span className="mt-2 flex items-center gap-1.5 text-body-sm text-(--color-text-tertiary)">
            <Avatar x={x} size="size-4" />
            {shortRole(x)}
            {!x.sure && <span title="Estimated from your usual sales">· Best guess</span>}
          </span>
        </span>
        <span className="text-right">
          <span
            className={cn(
              "block text-subtitle-lg whitespace-nowrap tabular-nums",
              x.bigTone === "danger" ? "text-(--color-text-danger)" : x.bigTone === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)",
            )}
          >
            {x.big}
          </span>
          <span className="mt-0.5 block max-w-40 text-body-sm text-(--color-text-secondary)">{x.bigSub}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-text-primary)" />
      </button>
    </li>
  );
}

export function InsightFeed({ insights }: { insights: Insight[] }) {
  const [area, setArea] = useState<Area>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(() => insights.filter((x) => area === "all" || x.cowork === area), [insights, area]);
  const i = shown.findIndex((x) => x.id === openId);
  const cur = shown[i];

  return (
    <>
      <Summary insights={insights} />

      <section aria-label="Insights" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-subtitle-lg text-(--color-text-primary)">
            Insights <span className="ml-1 text-body-md text-(--color-text-secondary)">{shown.length}</span>
          </h2>
          <div role="tablist" aria-label="Filter by area" className="flex rounded-circle bg-(--color-neutral-lightest) p-0.75">
            {AREAS.map((a) => {
              const n = a.id === "all" ? insights.length : insights.filter((x) => x.cowork === a.id).length;
              if (a.id !== "all" && n === 0) return null;
              return (
                <button
                  key={a.id}
                  role="tab"
                  type="button"
                  aria-selected={area === a.id}
                  onClick={() => setArea(a.id)}
                  className={cn(
                    "flex h-7.5 items-center gap-1.5 rounded-circle px-3 text-body-sm whitespace-nowrap text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                    area === a.id && "bg-(--color-text-primary) text-(--color-background-secondary) hover:text-(--color-background-secondary)",
                  )}
                >
                  {a.label}
                  <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {GROUPS.map((g) => {
          const rows = shown.filter((x) => x.tag === g.tag);
          if (!rows.length) return null;
          return (
            <div key={g.tag}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                <h3 className="flex items-center gap-2 text-subtitle-md text-(--color-text-primary)">
                  <span aria-hidden className={cn("size-2 rounded-circle", TAGS[g.tag].dot)} />
                  {g.title}
                  <span className="text-body-sm text-(--color-text-secondary) tabular-nums">{rows.length}</span>
                </h3>
                <p className="text-body-sm text-(--color-text-secondary)">{g.hint}</p>
              </div>
              <ul className="divide-y divide-(--color-border-default) overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
                {rows.map((x) => (
                  <Row key={x.id} x={x} onOpen={() => setOpenId(x.id)} />
                ))}
              </ul>
            </div>
          );
        })}

        {shown.length === 0 && <p className="rounded-large border border-(--color-border-default) px-5 py-8 text-center text-body-md text-(--color-text-secondary)">No findings here this period.</p>}
      </section>

      <DetailDrawer
        open={!!cur}
        onClose={() => setOpenId(null)}
        eyebrow={cur && `${persona(cur).role} · ${i + 1} of ${shown.length}`}
        title={cur ? TAGS[cur.tag].label : ""}
        onPrev={i > 0 ? () => setOpenId(shown[i - 1].id) : undefined}
        onNext={i >= 0 && i < shown.length - 1 ? () => setOpenId(shown[i + 1].id) : undefined}
        footer={
          cur && (
            <Link href={cur.href} className="group flex items-center gap-1 text-body-md text-(--color-text-clickable) hover:underline">
              Open the full report
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        }
      >
        {cur && <HowWeKnow x={cur} />}
      </DetailDrawer>
    </>
  );
}
