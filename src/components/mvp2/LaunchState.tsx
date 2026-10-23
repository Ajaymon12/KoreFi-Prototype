"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// What a report page shows for a restaurant with no reports yet (Brand.awaitingReports): a launch
// page instead of $0 everywhere. A headline and what the page will do on the left, what it's waiting
// on below that, and a carousel of the page's features (each with a sample preview) on the right.
// Report-only like the rest of the owner app: the "waiting on" rows are status, not buttons, since
// the KoreFi team uploads the reports. Shared so every page can launch the same way; each page
// passes its own copy and previews.
// The page itself never scrolls sideways. The cards drift left slowly and without end (the set is
// drawn twice, so the second copy takes over seamlessly); the arrows nudge it a card either way.
// Hovering or focusing the row pauses the drift, and it stays still for reduced motion.
// `soon` is for pages that aren't built yet: the same page, tagged "Coming soon", with nothing to wait on.

export type LaunchFeature = {
  title: string;
  body: string;
  preview: React.ReactNode;
};
export type LaunchSource = {
  icon: React.ReactNode;
  name: string;
  status: string;
};

/** Drift speed, in px per second. */
const SPEED = 24;
const GAP = 16;

export function LaunchState({
  eyebrow,
  title,
  body,
  sources,
  note,
  features,
  soon = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  sources?: LaunchSource[];
  note?: string;
  features: LaunchFeature[];
  /** Not built yet: a grey "Coming soon" tag instead of "New", and nothing to wait on. */
  soon?: boolean;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const nudge = useRef(0);
  const step = (dir: 1 | -1) => {
    const card = rail.current?.querySelector("article");
    if (card) nudge.current += dir * (card.offsetWidth + GAP);
  };

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let offset = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const el = rail.current;
      if (el) {
        // One copy of the set, gap included: wrapping by exactly this is invisible.
        const loop = el.scrollWidth / 2;
        const move = nudge.current * Math.min(1, dt * 8);
        nudge.current -= move;
        if (Math.abs(nudge.current) < 0.5) nudge.current = 0;
        offset += move + (still || paused.current || document.hidden ? 0 : SPEED * dt);
        offset = ((offset % loop) + loop) % loop;
        el.style.transform = `translate3d(${-offset}px,0,0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const card = (f: LaunchFeature, copy: boolean) => (
    <article
      key={`${copy ? "b" : "a"}-${f.title}`}
      role={copy ? undefined : "listitem"}
      aria-hidden={copy || undefined}
      className="w-[min(380px,82vw)] shrink-0 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-5 shadow-[0_6px_24px_rgb(0_0_0/0.06)]"
      style={{ marginRight: GAP }}
    >
      <div aria-hidden className="h-[230px] overflow-hidden rounded-medium border border-(--color-border-default) bg-(--color-background-primary)">
        {f.preview}
      </div>
      <h3 className="mt-5 text-subtitle-lg text-(--color-text-primary)">{f.title}</h3>
      <p className="mt-2 text-body-md leading-[1.5] text-(--color-text-secondary)">{f.body}</p>
    </article>
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
      {/* Faint slanted grid behind everything, like a blank canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--color-border-default)_1px,transparent_1px),linear-gradient(90deg,var(--color-border-default)_1px,transparent_1px)] [background-size:220px_220px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
          style={{ transform: "skewY(-4deg) scale(1.2)" }}
        />
      </div>
      <div className="relative mx-auto flex min-h-full max-w-[1400px] flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-12 lg:pr-0 lg:pl-16">
        <div className="max-w-[440px] shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) py-0.5 pr-2.5 pl-1 text-body-sm text-(--color-text-secondary)">
            <span
              className={cn(
                "rounded-circle px-1.5 text-[11px] leading-[18px] font-medium",
                soon
                  ? "bg-(--color-neutral-light) text-(--color-text-secondary)"
                  : "bg-(--color-primary) text-white",
              )}
            >
              {soon ? "Coming soon" : "New"}
            </span>
            {eyebrow}
          </span>
          <h2 className="mt-5 text-jumbo-lg font-semibold tracking-[-0.025em] text-(--color-text-primary) lg:text-[52px] lg:leading-[1.05]">
            {title}
          </h2>
          <p className="mt-5 text-subtitle-md leading-[1.5] text-(--color-text-secondary)">
            {body}
          </p>

          {sources?.length ? (
            <>
          <p className="mt-10 text-body-sm text-(--color-text-secondary)">
            Waiting on
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sources.map((s) => (
              <li
                key={s.name}
                className="flex h-11 items-center gap-2.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) pr-3.5 pl-3 shadow-[0_1px_2px_rgb(0_0_0/0.05)]"
              >
                {s.icon}
                <span className="text-body-md text-(--color-text-primary)">
                  {s.name}
                </span>
                <span className="flex items-center gap-1.5 text-body-sm text-(--color-text-tertiary)">
                  <span
                    aria-hidden
                    className="size-1.5 animate-pulse rounded-circle bg-(--color-warning-default)"
                  />
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
            </>
          ) : null}
          {note && (
            <p className={cn("text-body-sm text-(--color-text-tertiary)", sources?.length ? "mt-3" : "mt-8")}>
              {note}
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            role="list"
            aria-label="What's in this report"
            onMouseEnter={() => (paused.current = true)}
            onMouseLeave={() => (paused.current = false)}
            onFocus={() => (paused.current = true)}
            onBlur={() => (paused.current = false)}
            className="overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,black_6%,black_90%,transparent)]"
          >
            <div ref={rail} className="flex w-max will-change-transform">
              {features.map((f) => card(f, false))}
              {features.map((f) => card(f, true))}
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2 lg:pr-16">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => step(d)}
                aria-label={d < 0 ? "Previous" : "Next"}
                className={cn(
                  "grid size-9 place-items-center rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:bg-(--color-neutral-lightest)",
                )}
              >
                {d < 0 ? (
                  <ArrowLeft className="size-4" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
