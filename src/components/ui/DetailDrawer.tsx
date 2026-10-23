"use client";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp, ExternalLink, Link2, Maximize2, Minimize2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { useDock } from "./Dock";

/** Docked panels lay label/value fields out as Mercury does: a two-column grid, label above value. */
const FieldLayout = createContext<"rows" | "grid">("rows");

// Right-hand detail panel in the Mercury style (Mobbin: Mercury web transaction / reimbursement
// drawers): a compact title row, then flat sections split by full-width hairlines (amount →
// timeline → label/value details → notes), and a slim footer. Previous / next row buttons.
//
// Two ways to show it:
//  - Docked (inside a DockArea, the MVP): the page splits, as in Mercury Books' Invoices; the list
//    stays usable beside it and the panel can expand to the full width. Closes on ✕ or Escape.
//  - Overlay (anywhere else): an inset panel over a dimmed page. Closes on ✕, Escape or a click outside.

type Props = {
  open: boolean;
  onClose: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Small line under the title, e.g. an order ID or date. */
  meta?: React.ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  footer?: React.ReactNode;
  /** Small icon before the eyebrow (Mercury's "▤ TRANSACTION"). */
  icon?: LucideIcon;
  /** A badge beside the title (Mercury's "$14,301.06  Money in"). */
  status?: React.ReactNode;
  /** In-app path that reopens this item (e.g. "/mvp/chargebacks?open=…"): enables Copy link and Open in new tab. */
  permalink?: string;
  children: React.ReactNode;
};

const navBtn = "grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:pointer-events-none disabled:opacity-40";
/** Mercury's docked toolbar: round grey buttons. */
const roundBtn = "grid size-8 place-items-center rounded-circle bg-(--color-neutral-light) text-(--color-text-primary) outline-none transition-colors hover:bg-(--gray-500) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-4";

function PrevNext({ onPrev, onNext, round }: { onPrev?: () => void; onNext?: () => void; round?: boolean }) {
  if (!onPrev && !onNext) return null;
  const cls = round ? roundBtn : navBtn;
  return (
    <>
      <button type="button" aria-label="Previous item" aria-keyshortcuts="K" title="Previous  K" disabled={!onPrev} onClick={onPrev} className={cls}>
        <ChevronUp className="size-4" />
      </button>
      <button type="button" aria-label="Next item" aria-keyshortcuts="J" title="Next  J" disabled={!onNext} onClick={onNext} className={cls}>
        <ChevronDown className="size-4" />
      </button>
    </>
  );
}

/** Copy link, with a check for a moment once it's on the clipboard. */
function CopyLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : "Copy link"}
      title={copied ? "Link copied" : "Copy link"}
      onClick={() => {
        navigator.clipboard?.writeText(new URL(asset(href), window.location.origin).href).then(() => setCopied(true), () => {});
      }}
      className={roundBtn}
    >
      {copied ? <Check className="text-(--color-text-success)" /> : <Link2 />}
      <span aria-live="polite" className="sr-only">{copied ? "Link copied" : ""}</span>
    </button>
  );
}

export function DetailDrawer(props: Props) {
  return useDock() ? <DockedPanel {...props} /> : <OverlayDrawer {...props} />;
}

/** Docked: renders into the DockArea slot beside the page. */
function DockedPanel({ open, onClose, eyebrow, title, meta, onPrev, onNext, footer, icon: Icon, status, permalink, children }: Props) {
  const dock = useDock()!;
  const id = useId();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const { claim, release, owner } = dock;

  // Opening takes the dock; closing gives it back. Another panel taking it closes this one.
  useEffect(() => {
    if (!open) return;
    claim(id);
    return () => release(id);
  }, [open, id, claim, release]);
  // Close only after this panel has held the dock and lost it (not on the render where it's still claiming).
  const held = useRef(false);
  useEffect(() => {
    if (!open) held.current = false;
    else if (owner === id) held.current = true;
    else if (held.current && owner !== id) {
      held.current = false;
      onClose();
    }
  }, [open, owner, id, onClose]);
  useEffect(() => {
    if (open && owner === id) closeBtn.current?.focus({ preventScroll: true });
  }, [open, owner, id]);

  // Escape closes; J / K step through rows, as in Mercury's tables (not while typing).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "j" && onNext) onNext();
      else if (e.key === "k" && onPrev) onPrev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, onNext, onPrev]);

  if (!open || !dock.slot || dock.owner !== id) return null;
  const expanded = dock.expanded;

  return createPortal(
    // Mercury's split view: the panel is a tinted surface, the detail a raised white card on it, so
    // it never reads as part of the page beside it.
    <aside
      role="complementary"
      aria-label="Details"
      className={cn(
        "flex w-[min(480px,44%)] min-w-[380px] shrink-0 flex-col overflow-hidden border-l border-(--color-border-default) bg-(--color-background-primary) motion-safe:animate-page-in",
        // Under lg the page can't split; the panel covers it instead.
        "max-lg:fixed max-lg:inset-x-2 max-lg:top-[54px] max-lg:bottom-2 max-lg:z-40 max-lg:w-auto max-lg:min-w-0 max-lg:rounded-large max-lg:border max-lg:shadow-[0_8px_32px_rgb(0_0_0/0.12)]",
      )}
    >
      {/* Toolbar: step through rows and copy the link on the left; open in a new tab, expand, close on the right. */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-1.5">
          <PrevNext onPrev={onPrev} onNext={onNext} round />
          {permalink && (
            <>
              {(onPrev || onNext) && <span aria-hidden className="mx-1 h-5 w-px bg-(--color-border-darker)" />}
              <CopyLink href={permalink} />
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {permalink && (
            <a href={asset(permalink)} target="_blank" rel="noopener" aria-label="Open in a new tab" title="Open in a new tab" className={roundBtn}>
              <ExternalLink />
            </a>
          )}
          <button type="button" aria-label={expanded ? "Show the list again" : "Expand details"} title={expanded ? "Show the list again" : "Expand"} aria-pressed={expanded} onClick={() => dock.setExpanded(!expanded)} className={cn(roundBtn, "max-lg:hidden")}>
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </button>
          <button ref={closeBtn} type="button" aria-label="Close details" title="Close  Esc" onClick={onClose} className={roundBtn}>
            <X />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className={cn("overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.05)]", expanded && "mx-auto max-w-[760px]")}>
          <header className="px-6 pt-6 pb-2">
            {eyebrow && (
              <p className="flex items-center gap-2 text-subtitle-xs tracking-wider text-(--color-text-secondary) uppercase">
                {Icon && <Icon aria-hidden className="size-4" />}
                <span className="truncate">{eyebrow}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="min-w-0 text-jumbo-sm leading-tight text-(--color-text-primary) tabular-nums">{title}</h2>
              {status}
            </div>
            {meta && <p className="mt-2 text-body-md text-(--color-text-secondary)">{meta}</p>}
          </header>
          {/* Each top-level child is a section; hairlines run edge to edge between them. */}
          <FieldLayout.Provider value="grid">
            <div className="divide-y divide-(--color-border-default) [&>*]:px-6 [&>*]:py-5">{children}</div>
          </FieldLayout.Provider>
          {footer && <footer className="border-t border-(--color-border-default) px-6 py-3.5">{footer}</footer>}
        </div>
      </div>
    </aside>,
    dock.slot,
  );
}

/** Overlay: the original inset drawer over a dimmed page. */
function OverlayDrawer({ open, onClose, eyebrow, title, meta, onPrev, onNext, footer, children }: Props) {
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useDismiss(panel, open, onClose);
  useEffect(() => {
    if (open) closeBtn.current?.focus();
  }, [open]);

  return (
    <>
      {/* Backdrop: dims the page while the drawer is open. Clicks on it count as outside clicks, which close the drawer. */}
      <div aria-hidden className={cn("fixed inset-0 z-30 bg-black/30 transition-opacity duration-200 motion-reduce:transition-none", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <aside
        ref={panel}
        role="dialog"
        aria-label="Details"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          // Sits inside the shell's gutters: below the 42px top bar, 8px in from the edges.
          "fixed top-[46px] right-2 bottom-2 z-40 flex w-[calc(100%-1rem)] max-w-[520px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_32px_rgb(0_0_0/0.10)] transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none",
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
                <PrevNext onPrev={onPrev} onNext={onNext} />
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

/** Plain label / value rows, label left in grey, value right (Mercury "Date of expense … Oct 13").
 *  In a docked panel: Mercury's field grid instead, two columns, small grey label above the value. */
export function DetailList({ title, rows }: { title?: string; rows: { label: string; value: React.ReactNode }[] }) {
  const layout = useContext(FieldLayout);
  if (layout === "grid") {
    return (
      <section>
        {title && <h3 className="mb-3 text-body-sm text-(--color-text-secondary)">{title}</h3>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-body-sm text-(--color-text-secondary)">{r.label}</dt>
              <dd className="mt-1 text-body-lg text-(--color-text-primary) tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
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
