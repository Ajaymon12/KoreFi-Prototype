"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowUp, ChefHat, Check, Copy, HandHelping, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceChip } from "@/components/dashboard/primitives";
import { getActiveModule } from "@/lib/nav";
import { user } from "@/lib/mockData";
import type { Answer } from "@/lib/assistant/engine";
import { useAssistant, type Message } from "./AssistantProvider";

// The chat itself, shared by the right-hand panel and the /ai page. Pattern from ClickUp Brain
// (Mobbin): prompt-first empty state with suggestions that come from your own data, a pinned
// composer, answers that end in sources and follow-up chips. Owners can't change anything here:
// the one "action" is passing a note to the KoreFi team.

export function SousMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-circle bg-(--color-brand-lightest) text-(--color-primary) [&_svg]:size-4", className)}>
      <ChefHat />
    </span>
  );
}

const iconBtn = "grid size-7 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";
const chipBtn = "rounded-circle border border-(--color-border-default) px-2.5 py-1 text-left text-body-sm text-(--color-text-primary) outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-50";

function Thinking() {
  return (
    <div className="flex items-center gap-2.5" role="status" aria-label="Sous is thinking">
      <SousMark />
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 rounded-circle bg-(--color-text-secondary) motion-safe:animate-pulse" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
    </div>
  );
}

function AnswerCard({ id, answer, requested, rating }: { id: string; answer: Answer; requested?: boolean; rating?: "up" | "down" }) {
  const { ask, busy, requestTeam, rate, setOpen } = useAssistant();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText([answer.title, ...answer.lines].join("\n")).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex gap-2.5 motion-safe:animate-page-in">
      <SousMark />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <p className="text-body-md font-medium text-(--color-text-primary)">{answer.title}</p>
          {answer.lines.map((l) => (
            <p key={l} className="text-body-md text-(--color-text-secondary)">
              {l}
            </p>
          ))}
        </div>

        {answer.stat && (
          <div className="rounded-medium border border-(--color-border-default) px-3 py-2.5">
            <p className={cn("text-subtitle-lg font-medium", answer.stat.tone === "danger" ? "text-(--color-text-danger)" : answer.stat.tone === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{answer.stat.value}</p>
            <p className="text-body-sm text-(--color-text-secondary)">{answer.stat.sub}</p>
          </div>
        )}

        {answer.steps && answer.steps.length > 0 && (
          <dl className="divide-y divide-(--color-border-default) rounded-medium border border-(--color-border-default)">
            {answer.steps.map((s, i) => (
              <div key={`${s.label}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-body-md">
                <dt className="min-w-0">
                  <span className="block text-(--color-text-primary)">{s.label}</span>
                  {s.src && <span className="block text-body-sm text-(--color-text-secondary)">{s.src}</span>}
                </dt>
                <dd className={cn("shrink-0 font-medium", s.result === "bad" ? "text-(--color-text-danger)" : s.result === "good" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {answer.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-body-sm text-(--color-text-secondary)">Based on {answer.sources.length} {answer.sources.length === 1 ? "source" : "sources"}</span>
            {answer.sources.map((s) => (
              <SourceChip key={s} name={s} />
            ))}
          </div>
        )}

        {answer.link && (
          <Link href={answer.link.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-body-md font-medium text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            {answer.link.label}
            <ArrowRight className="size-3.5" />
          </Link>
        )}

        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Copy answer" onClick={copy} className={iconBtn}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
          <button type="button" aria-label="Good answer" aria-pressed={rating === "up"} onClick={() => rate(id, "up")} className={cn(iconBtn, rating === "up" && "text-(--color-text-primary)")}>
            <ThumbsUp className="size-3.5" />
          </button>
          <button type="button" aria-label="Bad answer" aria-pressed={rating === "down"} onClick={() => rate(id, "down")} className={cn(iconBtn, rating === "down" && "text-(--color-text-primary)")}>
            <ThumbsDown className="size-3.5" />
          </button>
          {answer.teamNote && (
            <button
              type="button"
              disabled={requested}
              onClick={() => requestTeam(id)}
              className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-medium px-2 text-body-sm text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:pointer-events-none"
            >
              {requested ? <Check className="size-3.5 text-(--color-text-success)" /> : <HandHelping className="size-3.5" />}
              {requested ? "Sent to the KoreFi team" : "Ask the team to look at this"}
            </button>
          )}
        </div>

        {answer.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {answer.followUps.map((f) => (
              <button key={f} type="button" disabled={busy} onClick={() => ask(f)} className={chipBtn}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.role === "user")
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-large bg-(--color-neutral-lightest) px-3 py-2 text-body-md text-(--color-text-primary)">{m.text}</p>
      </div>
    );
  if (m.pending) return <Thinking />;
  return <AnswerCard id={m.id} answer={m.answer} requested={m.requested} rating={m.rating} />;
}

function Composer({ autoFocus }: { autoFocus?: boolean }) {
  const { ask, busy } = useAssistant();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const send = () => {
    if (!text.trim() || busy) return;
    ask(text);
    setText("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="rounded-large border border-(--color-border-input) bg-(--color-background-primary) p-2 focus-within:border-(--color-focus-primary) focus-within:outline-2 focus-within:outline-(--color-focus-primary)/20"
    >
      <textarea
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Ask about payouts, chargebacks, fees, profit…"
        aria-label="Ask Sous"
        className="block w-full resize-none bg-transparent px-1.5 py-1 text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
      />
      <div className="flex items-center justify-between pt-1">
        <span className="px-1.5 text-body-sm text-(--color-text-secondary)">Read-only. Sous never changes your data.</span>
        <button type="submit" aria-label="Send" disabled={!text.trim() || busy} className="grid size-7 place-items-center rounded-circle bg-(--color-primary-solid) text-(--color-text-inverse-primary) outline-none transition-opacity focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary) disabled:opacity-40">
          <ArrowUp className="size-4" />
        </button>
      </div>
    </form>
  );
}

/** Where the owner is, so they know what Sous will lean on when a question is short. */
function useViewing() {
  const path = usePathname();
  const mod = getActiveModule(path);
  const child = mod?.children?.find((c) => path === c.href || path.startsWith(c.href + "/"));
  return child ? `${mod!.label} · ${child.label}` : mod?.label;
}

export function SousChat({ variant, autoFocus }: { variant: "panel" | "page"; autoFocus?: boolean }) {
  const { messages, suggestions } = useAssistant();
  const viewing = useViewing();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);
  const page = variant === "page";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto flex min-h-full w-full flex-col gap-5 px-4 py-4", page && "max-w-[720px] px-6 py-8")}>
          {messages.length === 0 ? (
            <div className={cn("my-auto space-y-5", page && "space-y-6")}>
              <div className="space-y-2">
                <SousMark className={cn(page && "size-10 [&_svg]:size-5")} />
                <h2 className={cn("font-medium text-(--color-text-primary)", page ? "text-jumbo-sm" : "text-subtitle-md")}>Hi {user.firstName}, what shall we look at?</h2>
                <p className="text-body-md text-(--color-text-secondary)">Ask me anything about your sales, payouts, chargebacks and books. I only read, and I always show where a number comes from.</p>
              </div>
              <div className="space-y-1">
                <p className="text-body-sm text-(--color-text-secondary)">Suggested</p>
                <ul>
                  {suggestions.map((s) => (
                    <li key={s}>
                      <SuggestionRow text={s} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} m={m} />)
          )}
          <div ref={end} />
        </div>
      </div>
      <div className={cn("shrink-0 space-y-2 px-4 pb-4", page && "mx-auto w-full max-w-[720px] px-6 pb-6")}>
        {viewing && (
          <p className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            <Sparkles className="size-3.5" aria-hidden />
            Viewing {viewing}
          </p>
        )}
        <Composer autoFocus={autoFocus} />
      </div>
    </div>
  );
}

function SuggestionRow({ text }: { text: string }) {
  const { ask, busy } = useAssistant();
  return (
    <button type="button" disabled={busy} onClick={() => ask(text)} className="flex w-full items-center gap-2.5 rounded-medium px-2 py-1.5 text-left text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
      <Sparkles className="size-4 shrink-0 text-(--color-primary)" aria-hidden />
      {text}
    </button>
  );
}
