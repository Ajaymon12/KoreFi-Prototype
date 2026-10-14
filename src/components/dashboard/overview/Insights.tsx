"use client";
import { cn } from "@/lib/utils";
import { CoworkAvatar } from "@/components/module/CoworkAvatar";
import { NAV_MODULES } from "@/lib/nav";
import type { Insight, InsightTag } from "@/lib/sources/overview";

// Shared pieces of an insight: its tag, the cowork that found it and the "How we know" steps.
// Used by the Home feed (InsightFeed).

export const TAGS: Record<InsightTag, { label: string; dot: string }> = {
  onit: { label: "KoreFi is on it", dot: "bg-(--color-text-secondary)" },
  watch: { label: "Watch", dot: "bg-(--color-warning-default)" },
  good: { label: "Good news", dot: "bg-(--color-success-default)" },
  info: { label: "Worth knowing", dot: "bg-(--color-info-default)" },
};

export const persona = (x: Insight) => NAV_MODULES.find((m) => m.id === x.cowork)!.persona!;
export const shortRole = (x: Insight) => persona(x).role.replace(/ cowork$/i, "");

export const Avatar = ({ x, size = "size-6", className }: { x: Insight; size?: string; className?: string }) => <CoworkAvatar kind={persona(x).illustration} className={cn(size, className)} />;

const BestGuess = () => (
  <span title="Estimated from your usual sales" className="cursor-help border-b border-dotted border-current">
    Best guess
  </span>
);

export function Tag({ tag }: { tag: InsightTag }) {
  return (
    // Below xl the cards are narrow, so the tag shrinks to its dot and the number keeps the room.
    <span title={TAGS[tag].label} className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-small bg-(--color-neutral-lightest) px-1.5 text-body-sm whitespace-nowrap text-(--color-text-secondary) xl:px-2">
      <span className={cn("size-1.5 rounded-circle", TAGS[tag].dot)} />
      <span className="sr-only xl:not-sr-only">{TAGS[tag].label}</span>
    </span>
  );
}

export function HowWeKnow({ x }: { x: Insight }) {
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
