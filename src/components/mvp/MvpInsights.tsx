"use client";
import { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, FileText, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FreshnessStamp } from "@/components/dashboard/primitives";
import { mvpHref } from "@/lib/mvp/insights";
import { fmtCents } from "@/lib/mockData";
import { CONNECTIONS } from "@/lib/sources/connections";
import type { Insight, InsightTag } from "@/lib/sources/overview";

// KoreFi's AI findings, one card across the MVP. The experience follows what works on Mobbin:
//  - Xero: a finding opens in place (an accordion), not in a panel that takes you away.
//  - Perplexity / Rox: the source is shown on the answer; Rox: how sure it is ("best guess").
//  - Linktree / Basedash / Xero: 👍 👎 on every AI answer.
//  - Profound / Rox / Xero: when it was generated, and that AI can be wrong.
//  - Collapse to the one-line summary instead of hiding the card (remembered per browser).
// Look: Mixpanel Spark's white card with a soft brand glow, Sprig's "✦" pill, Quicken's bottom line.
// Report only: nothing here asks the owner to act; "KoreFi is on it" says who does.

const KIND: Record<InsightTag, { label: string; dot: string; text: string }> = {
  watch: { label: "Worth a look", dot: "bg-(--color-warning-default)", text: "text-(--color-warning-darkest)" },
  onit: { label: "KoreFi is on it", dot: "bg-(--brand-900)", text: "text-(--brand-1100)" },
  good: { label: "Good news", dot: "bg-(--color-success-default)", text: "text-(--color-success-darkest)" },
  info: { label: "Worth knowing", dot: "bg-(--color-info-default)", text: "text-(--color-info-darkest)" },
};
const ORDER: InsightTag[] = ["watch", "onit", "good", "info"];

const toneText = (tone?: "danger" | "success") => (tone === "danger" ? "text-(--color-text-danger)" : tone === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)");

/** When the findings were last worked out: the newest sync among the connected sources. */
const UPDATED_AT = CONNECTIONS.filter((c) => c.connected && c.status !== "error").map((c) => c.lastSyncedAt).sort().at(-1) ?? "";

// ---- Open / closed, remembered per browser. Closed (one line) by default. ----

const KEY = "kf-ai-card-open";
const listeners = new Set<() => void>();
const readOpen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const writeOpen = (v: boolean) => {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-(--color-text-primary)">{children}</b>;

/** The bottom line, in KoreFi's voice: what it's handling, what's worth a look, the good news. */
function BottomLine({ xs }: { xs: Insight[] }) {
  const onit = xs.filter((x) => x.tag === "onit");
  const watch = xs.filter((x) => x.tag === "watch");
  const good = xs.filter((x) => x.tag === "good");
  const atStake = onit.reduce((n, x) => n + x.impact, 0);
  const parts: React.ReactNode[] = [];
  if (onit.length) parts.push(atStake > 0 ? <>KoreFi is following up on <B>{fmtCents(atStake)}</B> for you</> : <>KoreFi is handling <B>{onit.length}</B> thing{onit.length === 1 ? "" : "s"} for you</>);
  if (watch.length) parts.push(<><B>{watch.length} thing{watch.length === 1 ? "" : "s"}</B> {watch.length === 1 ? "is" : "are"} worth a look</>);
  if (good.length) parts.push(<>there&apos;s <B>good news</B>{good.length > 1 ? ` on ${good.length} fronts` : ""}</>);
  if (!parts.length) return <>Nothing needs you this period. A few things worth knowing below.</>;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && (i === parts.length - 1 ? ", and " : ", ")}
          {p}
        </span>
      ))}
      .
    </>
  );
}

/** 👍 👎 on a finding. The prototype keeps the answer for the visit; a backend would collect it. */
function Feedback() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const btn = (v: "up" | "down", Icon: typeof ThumbsUp, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={vote === v}
      onClick={() => setVote(vote === v ? null : v)}
      className={cn(
        "grid size-7 place-items-center rounded-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
        vote === v ? "bg-(--brand-300) text-(--brand-1100)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
  return (
    <div className="flex items-center gap-1">
      <span aria-live="polite" className="mr-1 text-body-sm text-(--color-text-secondary)">
        {vote ? "Thanks, that helps KoreFi learn" : "Was this useful?"}
      </span>
      {btn("up", ThumbsUp, "Useful")}
      {btn("down", ThumbsDown, "Not useful")}
    </div>
  );
}

/** One finding: a row that opens in place to the arithmetic, the source and how sure KoreFi is. */
function Finding({ x, open, onToggle }: { x: Insight; open: boolean; onToggle: () => void }) {
  const k = KIND[x.tag];
  const panelId = useId();
  const at = x.title.indexOf(x.big);
  const fig = <span className={cn("font-semibold tabular-nums", toneText(x.bigTone))}>{x.big}</span>;
  return (
    <li className={cn("rounded-medium transition-colors", open && "bg-(--color-background-secondary)")}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="group flex w-full items-start gap-3 rounded-medium px-3 py-2 text-left outline-none hover:bg-(--color-background-secondary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
        <span aria-hidden className={cn("mt-[7px] size-2 shrink-0 rounded-circle", k.dot)} />
        <span className="min-w-0 flex-1">
          {/* The figure, bold and coloured, inside the sentence when the sentence says it, else in front. */}
          <span className="block text-body-md text-(--color-text-primary)">
            {at >= 0 ? (
              <>
                {x.title.slice(0, at)}
                {fig}
                {x.title.slice(at + x.big.length)}
              </>
            ) : (
              <>
                {fig}
                <span className="text-(--color-text-tertiary)"> · </span>
                {x.title}
              </>
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-body-sm">
            <span className={k.text}>{k.label}</span>
            {!x.sure && <span className="text-(--color-text-secondary)">· best guess</span>}
            {!open && <span className="truncate text-(--color-text-secondary)">· {x.bigSub}</span>}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("mt-1 size-4 shrink-0 text-(--color-text-tertiary) transition-transform duration-200 group-hover:text-(--color-text-primary)", open && "rotate-180")} />
      </button>

      {/* In place, as Xero opens its insight over the widget: no panel, no lost context. */}
      <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 px-3 pt-0.5 pb-3 pl-8">
            <p className="text-body-md text-(--color-text-secondary)">{x.line}</p>
            {x.steps.length > 0 && (
              <ol className="rounded-medium border border-(--color-border-default) bg-(--color-background-secondary)">
                {x.steps.map((s, i) => (
                  <li key={i} className={cn("flex items-baseline justify-between gap-4 border-t border-(--color-border-default) px-3 py-2 text-body-md first:border-t-0", s.result && "font-semibold")}>
                    <span className="min-w-0">
                      {s.label}
                      {s.src && <span className="block text-body-sm font-normal text-(--color-text-secondary)">{s.src}</span>}
                    </span>
                    <span className={cn("shrink-0 tabular-nums", s.result === "bad" && "text-(--color-text-danger)", s.result === "good" && "text-(--color-text-success)")}>{s.value}</span>
                  </li>
                ))}
              </ol>
            )}
            {x.wrong && (
              <p className="text-body-sm text-(--color-text-secondary)">
                <b className="font-medium text-(--color-text-primary)">Could be wrong if</b> {x.wrong.charAt(0).toLowerCase() + x.wrong.slice(1)}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {/* Perplexity / Rox: the source sits on the answer. */}
                <span title={x.source} className="inline-flex h-6 max-w-72 items-center gap-1.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) px-2 text-body-sm text-(--color-text-secondary)">
                  <FileText aria-hidden className="size-3 shrink-0" />
                  <span className="truncate">{x.source}</span>
                </span>
                <Link href={mvpHref(x)} className="group/link inline-flex items-center gap-1 text-body-sm font-medium text-(--color-text-clickable) hover:underline">
                  Open report
                  <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
                </Link>
              </div>
              <Feedback />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** The AI card. Closed it's one line: the ✦ pill, the bottom line and how many findings; open, the
 *  findings list below it. A flat warm tint and an orange hairline set it apart from the white report
 *  cards — no shadow. */
function AiCard({ insights, title, empty }: { insights: Insight[]; title: string; empty?: string }) {
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  const [openId, setOpenId] = useState<string | null>(null);
  const bodyId = useId();
  const ordered = [...insights].sort((a, b) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag));
  const has = insights.length > 0;
  const sentence = <span className="text-(--color-text-secondary)">{has ? <BottomLine xs={insights} /> : empty}</span>;
  return (
    <section aria-label={title} className="rounded-large border border-(--brand-400) bg-(--brand-200)">
      {/* The whole line toggles the findings. */}
      <div className="flex min-h-12 items-center gap-3 px-3 py-2">
        <span title={title} className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-circle bg-(--brand-300) pr-2.5 pl-2 text-body-sm font-medium text-(--brand-1100)">
          <Sparkles aria-hidden className="size-3.5" />
          KoreFi AI
        </span>
        {has ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => writeOpen(!open)}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-medium py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
          >
            <span className={cn("min-w-0 flex-1 text-body-md", !open && "truncate")}>{sentence}</span>
            {/* The kinds of finding at a glance, then the toggle. */}
            <span aria-hidden className="hidden shrink-0 items-center gap-1 md:flex">
              {ORDER.filter((t) => insights.some((x) => x.tag === t)).map((t) => (
                <span key={t} className={cn("size-1.5 rounded-circle", KIND[t].dot)} />
              ))}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-medium px-2 py-1 text-body-sm font-medium text-(--brand-1100) transition-colors group-hover:bg-(--brand-300)">
              {open ? "Hide" : `${insights.length} finding${insights.length === 1 ? "" : "s"}`}
              <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
            </span>
          </button>
        ) : (
          <p className="min-w-0 flex-1 text-body-md">{sentence}</p>
        )}
      </div>

      {has && (
        <div id={bodyId} className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-(--brand-400) px-2 pt-2 pb-3">
              <ul className="space-y-0.5">
                {ordered.map((x) => (
                  <Finding key={x.id} x={x} open={openId === x.id} onToggle={() => setOpenId((o) => (o === x.id ? null : x.id))} />
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 px-3 text-body-sm text-(--color-text-tertiary)">
                {UPDATED_AT && <FreshnessStamp at={UPDATED_AT} label="Updated" />}
                <span aria-hidden>·</span>
                <span>AI can make mistakes. Every number links back to the report it came from.</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Findings for one report, under its content. Always shown, with an empty state. */
export function MvpInsights({ insights, title = "What KoreFi sees", empty = "Nothing stands out here this period." }: { insights: Insight[]; title?: string; empty?: string }) {
  return <AiCard insights={insights} title={title} empty={empty} />;
}

/** The same card at the top of a page: the first three findings; it collapses instead of disappearing. */
export function InsightBanner({ insights, title = "What KoreFi sees" }: { insights: Insight[]; title?: string }) {
  if (!insights.length) return null;
  return <AiCard insights={insights.slice(0, 3)} title={title} />;
}
