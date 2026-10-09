"use client";
import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";

// Right-hand detail panel in the Mercury style (Mobbin: Mercury web transaction / reimbursement
// drawers): an inset panel under the top bar, a compact title row, then flat sections split by
// full-width hairlines (amount → timeline → label/value details → notes), and a slim footer.
// No scrim — the list stays visible and its selected row stays highlighted. Previous / next row
// buttons after Midday. Closes on ✕, Escape, or a click outside; clicking another row swaps it.

export function DetailDrawer({
  open,
  onClose,
  eyebrow,
  title,
  meta,
  onPrev,
  onNext,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Small line under the title, e.g. an order ID or date. */
  meta?: React.ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useDismiss(panel, open, onClose);
  useEffect(() => {
    if (open) closeBtn.current?.focus();
  }, [open]);

  const navBtn = "grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:pointer-events-none disabled:opacity-40";

  return (
    <>
      <aside
        ref={panel}
        role="dialog"
        aria-label="Details"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          // Sits inside the shell's gutters: below the 42px top bar, 8px in from the edges.
          "fixed top-[46px] right-2 bottom-2 z-40 flex w-[calc(100%-1rem)] max-w-[420px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_32px_rgb(0_0_0/0.10)] transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+1rem)] opacity-0",
        )}
      >
        <header className="flex items-start justify-between gap-3 pt-3.5 pr-3 pb-1 pl-5">
          <div className="min-w-0 pt-0.5">
            {eyebrow && <p className="truncate text-body-sm text-(--color-text-secondary)">{eyebrow}</p>}
            <div className="truncate text-body-md font-medium text-(--color-text-primary)">{title}</div>
            {meta && <p className="truncate text-body-sm text-(--color-text-secondary)">{meta}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {(onPrev || onNext) && (
              <>
                <button type="button" aria-label="Previous item" disabled={!onPrev} onClick={onPrev} className={navBtn}>
                  <ChevronUp className="size-4" />
                </button>
                <button type="button" aria-label="Next item" disabled={!onNext} onClick={onNext} className={navBtn}>
                  <ChevronDown className="size-4" />
                </button>
                <span aria-hidden className="mx-1 h-4 w-px bg-(--color-border-default)" />
              </>
            )}
            <button ref={closeBtn} type="button" aria-label="Close details" onClick={onClose} className={navBtn}>
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Each top-level child is a section; hairlines run edge to edge between them. */}
        <div className="min-h-0 flex-1 divide-y divide-(--color-border-default) overflow-y-auto [&>*]:px-5 [&>*]:py-4">{children}</div>

        {footer && <footer className="border-t border-(--color-border-default) px-5 py-3">{footer}</footer>}
      </aside>
    </>
  );
}

/** A flat drawer section: small grey label, then content. Content written with its own px-4
 *  (rows, notes) is pulled back out so it lines up with the label. */
export function DrawerSection({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section>
      {title && <h3 className="mb-1.5 text-body-sm text-(--color-text-secondary)">{title}</h3>}
      <div className={cn("-mx-4", className)}>{children}</div>
    </section>
  );
}

export type TimelineStep = { label: string; date?: string; state: "done" | "current" | "failed" | "upcoming" };

const MARKER: Record<TimelineStep["state"], string> = {
  done: "rounded-circle bg-(--color-text-secondary)",
  failed: "rounded-circle bg-(--color-danger-default)",
  current: "rounded-[2px] bg-(--color-primary)",
  upcoming: "rounded-circle border-[1.5px] border-(--color-border-darker) bg-(--color-background-secondary)",
};

/** Mercury-style timeline: small markers on a hairline, step name over a grey "when" line. The
 *  current step is a square in brand orange; what's still to come is a hollow ring. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="px-4">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className={cn("relative flex gap-3", !last && "pb-3.5")}>
            {!last && <span aria-hidden className={cn("absolute top-3 bottom-0 left-[3.5px] w-px", steps[i + 1].state === "upcoming" ? "bg-(--color-border-default)" : "bg-(--color-border-darker)")} />}
            <span aria-hidden className={cn("relative z-[1] mt-[5px] size-2 shrink-0", MARKER[s.state])} />
            <div className="min-w-0">
              <p className={cn("text-body-md font-medium", s.state === "upcoming" ? "text-(--color-text-secondary)" : s.state === "failed" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{s.label}</p>
              {s.date && <p className="text-body-sm text-(--color-text-secondary)">{s.date}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Plain label / value rows, label left in grey, value right (Mercury "Date of expense … Oct 13"). */
export function DetailList({ title, rows }: { title?: string; rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <DrawerSection title={title}>
      <dl>
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-1.5 text-body-md">
            <dt className="shrink-0 text-(--color-text-secondary)">{r.label}</dt>
            <dd className="min-w-0 text-right text-(--color-text-primary)">{r.value}</dd>
          </div>
        ))}
      </dl>
    </DrawerSection>
  );
}
