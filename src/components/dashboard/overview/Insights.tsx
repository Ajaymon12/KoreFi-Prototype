"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoworkAvatar } from "@/components/module/CoworkAvatar";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { NAV_MODULES } from "@/lib/nav";
import type { Insight, InsightTag } from "@/lib/sources/overview";

// The things to know this week: the top findings from every cowork, biggest effect on profit
// first, as one compact row of neutral cards. Reading order inside a card is how much → what
// happened → who found it and what the number means. Colour is kept to the tag's dot. A card
// opens "How we know" in the side drawer; the "+N more" tile opens the drawer at the next
// finding, and the drawer steps through all of them. Report only: issues are tagged as handled
// by KoreFi, and the only link is to the full report.

const TAGS: Record<InsightTag, { label: string; dot: string }> = {
  onit: { label: "KoreFi is on it", dot: "bg-(--color-text-secondary)" },
  watch: { label: "Watch", dot: "bg-(--color-warning-default)" },
  good: { label: "Good news", dot: "bg-(--color-success-default)" },
  info: { label: "Worth knowing", dot: "bg-(--color-info-default)" },
};

const persona = (x: Insight) => NAV_MODULES.find((m) => m.id === x.cowork)!.persona!;
const shortRole = (x: Insight) => persona(x).role.replace(/ cowork$/i, "");

const Avatar = ({ x, size = "size-6", className }: { x: Insight; size?: string; className?: string }) => <CoworkAvatar kind={persona(x).illustration} className={cn(size, className)} />;

const BestGuess = () => (
  <span title="Estimated from your usual sales" className="cursor-help border-b border-dotted border-current">
    Best guess
  </span>
);

function Tag({ tag }: { tag: InsightTag }) {
  return (
    // Below xl the cards are narrow, so the tag shrinks to its dot and the number keeps the room.
    <span title={TAGS[tag].label} className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-small bg-(--color-neutral-lightest) px-1.5 text-body-sm whitespace-nowrap text-(--color-text-secondary) xl:px-2">
      <span className={cn("size-1.5 rounded-circle", TAGS[tag].dot)} />
      <span className="sr-only xl:not-sr-only">{TAGS[tag].label}</span>
    </span>
  );
}

const surface =
  "group rounded-large border border-(--color-border-default) bg-(--color-background-secondary) text-left transition-colors outline-none hover:border-(--color-border-darker) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

function Card({ x, onOpen }: { x: Insight; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`${x.big}, ${x.title}`} className={cn(surface, "flex min-h-38 min-w-0 flex-col gap-2 px-5 py-4.5")}>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-subtitle-lg whitespace-nowrap text-(--color-text-primary) tabular-nums">{x.big}</span>
          {!x.sure && (
            <span className="truncate text-body-sm text-(--color-text-tertiary)">
              <BestGuess />
            </span>
          )}
        </span>
        <Tag tag={x.tag} />
      </span>
      <span className="line-clamp-2 text-body-md leading-[1.55] text-(--color-text-primary)">{x.title}</span>
      <span className="mt-auto flex w-full min-w-0 items-center gap-1.5 border-t border-(--color-border-default) pt-3 text-body-sm text-(--color-text-tertiary)">
        <Avatar x={x} size="size-4" />
        <span className="min-w-0 truncate">
          {shortRole(x)} · {x.bigSub}
        </span>
        <ArrowRight aria-hidden className="ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-text-primary)" />
      </span>
    </button>
  );
}

/** The findings past the top ones, behind one tile. Opens the drawer at the first of them. */
function MoreTile({ rest, onOpen }: { rest: Insight[]; onOpen: () => void }) {
  const coworks = [...new Map(rest.map((x) => [x.cowork, x])).values()].slice(0, 3);
  const counts = (Object.keys(TAGS) as InsightTag[])
    .map((t) => [rest.filter((x) => x.tag === t).length, TAGS[t].label.toLowerCase()] as const)
    .filter(([n]) => n)
    .map(([n, l]) => `${n} ${l}`)
    .join(" · ");
  return (
    <button
      type="button"
      onClick={onOpen}
      title={counts}
      aria-label={`${rest.length} more findings: ${counts}`}
      className={cn(surface, "flex items-center gap-3 px-5 py-3.5 md:col-span-3 lg:col-span-1 lg:flex-col lg:items-start lg:justify-between lg:py-4.5")}
    >
      <span className="flex items-baseline gap-1.5 lg:flex-col lg:gap-0.5">
        <span className="text-subtitle-lg text-(--color-text-primary) tabular-nums">+{rest.length}</span>
        <span className="text-body-sm text-(--color-text-secondary)">more findings</span>
      </span>
      <span className="ml-auto flex w-auto items-center gap-2 lg:ml-0 lg:w-full lg:justify-between">
        <span className="flex">
          {coworks.map((x, i) => (
            <Avatar key={x.cowork} x={x} size="size-5" className={cn("shadow-[0_0_0_2px_var(--color-background-secondary)]", i && "-ml-1.5")} />
          ))}
        </span>
        <ArrowRight aria-hidden className="size-4 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-text-primary)" />
      </span>
    </button>
  );
}

function HowWeKnow({ x }: { x: Insight }) {
  return (
    <>
      <div>
        <p className="text-jumbo-md text-(--color-text-primary) tabular-nums">{x.big}</p>
        <p className="mt-1.5 text-body-sm text-(--color-text-secondary)">
          {x.bigSub}
          {!x.sure && (
            <>
              {" · "}
              <BestGuess />
            </>
          )}
        </p>
        <h3 className="mt-3 text-subtitle-lg leading-[1.35] text-(--color-text-primary)">{x.title}</h3>
        <p className="mt-1.5 text-body-md text-(--color-text-secondary)">{x.line}</p>
      </div>
      <section>
        <h4 className="mb-1 text-body-sm text-(--color-text-secondary)">How we know</h4>
        <ol className="[counter-reset:step]">
          {x.steps.map((s, i) => (
            <li
              key={i}
              className={cn(
                "grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-2.5 border-t border-(--color-border-default) py-2 text-body-md [counter-increment:step] first:border-t-0 before:text-subtitle-xs before:text-(--color-text-secondary) before:content-[counter(step)]",
                s.result && "font-semibold",
              )}
            >
              <span>
                {s.label}
                {s.src && <small className="mt-px block text-body-sm font-normal text-(--color-text-secondary)">{s.src}</small>}
              </span>
              <b className={cn("font-semibold whitespace-nowrap tabular-nums", s.result && "text-subtitle-md", s.result === "bad" && "text-(--color-text-danger)", s.result === "good" && "text-(--color-text-success)")}>
                {s.value}
              </b>
            </li>
          ))}
        </ol>
      </section>
      <div className="space-y-2">
        {x.wrong && (
          <p className="text-body-sm text-(--color-text-secondary)">
            <b className="font-semibold text-(--color-text-primary)">Could be wrong if:</b> {x.wrong}
          </p>
        )}
        <p className="text-body-sm text-(--color-text-tertiary)">Source: {x.source}</p>
      </div>
    </>
  );
}

export function ThingsToKnow({ insights, count = 3 }: { insights: Insight[]; count?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const top = insights.slice(0, count);
  const rest = insights.slice(count);
  const i = insights.findIndex((x) => x.id === openId);
  const cur = insights[i];

  return (
    <section aria-label="Things to know this week">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_136px]">
        {top.map((x) => (
          <Card key={x.id} x={x} onOpen={() => setOpenId(x.id)} />
        ))}
        {rest.length > 0 && <MoreTile rest={rest} onOpen={() => setOpenId(rest[0].id)} />}
      </div>

      <DetailDrawer
        open={!!cur}
        onClose={() => setOpenId(null)}
        eyebrow={cur && `${persona(cur).role} · ${i + 1} of ${insights.length}`}
        title={cur ? TAGS[cur.tag].label : ""}
        onPrev={i > 0 ? () => setOpenId(insights[i - 1].id) : undefined}
        onNext={i >= 0 && i < insights.length - 1 ? () => setOpenId(insights[i + 1].id) : undefined}
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
    </section>
  );
}
