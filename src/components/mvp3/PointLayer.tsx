"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportId } from "@/lib/mvp3/agents";
import type { CardRef } from "@/lib/mvp3/dashboards";
import { useAgents } from "./AgentsProvider";

// Makes a report's cards pointable in MVP 3 ("Edit in chat"), like the blocks on an agent-built dashboard.
// The reports are the shared /mvp2 components, so nothing inside them changes: this wrapper finds each card
// as a <section> with a name (aria-label, or its heading), tags it, and floats the button over the hovered one.
// The pointed card gets an outline and hidden cards are hidden, both by CSS on the tag, so a re-render keeps them.

const TAG = "data-kf-card";

function nameOf(el: HTMLElement) {
  return (el.getAttribute("aria-label") ?? el.querySelector("h2, h3")?.textContent ?? "").trim();
}
const sel = (title: string) => `[${TAG}="${title.replace(/["\\]/g, "\\$&")}"]`;

/** `className` is the wrapper's own (it stands in for the div the report used to sit in).
 *  `onPoint`: what pointing does beyond attaching the card (the full page also opens the chat). `off`: sample data. */
export function PointLayer({ report, className, onPoint, off = false, children }: { report: ReportId; className?: string; onPoint?: (r: CardRef) => void; off?: boolean; children: React.ReactNode }) {
  const { pointed, setPointed, hiddenCards } = useAgents();
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ el: HTMLElement; title: string } | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Tag every named section, and keep tagging as the report re-renders (tabs, filters, loading).
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const tag = () =>
      root.querySelectorAll<HTMLElement>("section").forEach((s) => {
        const n = nameOf(s);
        if (n && s.getAttribute(TAG) !== n) s.setAttribute(TAG, n);
      });
    tag();
    const mo = new MutationObserver(tag);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const place = useCallback(() => {
    const root = box.current;
    if (!root || !hover || !hover.el.isConnected) return setPos(null);
    const b = root.getBoundingClientRect();
    const r = hover.el.getBoundingClientRect();
    if (r.bottom < b.top + 40 || r.top > b.bottom - 20) return setPos(null);
    // Keep the button in view when the card's top has scrolled under the edge.
    setPos({ top: Math.max(r.top - b.top, 0) + 8, right: Math.max(b.right - r.right, 0) + 8 });
  }, [hover]);
  useLayoutEffect(place, [place]);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    root.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      root.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [place]);

  const isOn = (title: string) => pointed?.report === report && pointed.title === title;
  const point = (title: string) => {
    if (isOn(title)) return setPointed(null);
    const r: CardRef = { report, title };
    if (onPoint) onPoint(r);
    else setPointed(r);
  };

  const track = (t: HTMLElement) => {
    if (off || t.closest("[data-kf-point]")) return;
    // The innermost named card under the pointer.
    const el = t.closest<HTMLElement>(`[${TAG}]`);
    if (!el || !box.current?.contains(el)) return setHover(null);
    if (hover?.el !== el) setHover({ el, title: el.getAttribute(TAG)! });
  };

  const hidden = hiddenCards[report] ?? [];
  const css = [
    hidden.length ? `${hidden.map(sel).join(",")}{display:none!important}` : "",
    pointed?.report === report ? `${sel(pointed.title)}{outline:2px solid var(--module-strong);outline-offset:2px;border-radius:var(--radius-large,12px)}` : "",
  ].join("");

  return (
    <div
      ref={box}
      className={cn("relative", className)}
      onPointerMove={(e) => track(e.target as HTMLElement)}
      // Touch has no hover: a tap on a card shows its button.
      onPointerDown={(e) => track(e.target as HTMLElement)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
    >
      {children}
      {css && <style>{css}</style>}
      {!off && hover && pos && (
        <button
          type="button"
          data-kf-point
          onClick={() => point(hover.title)}
          aria-pressed={isOn(hover.title)}
          aria-label={isOn(hover.title) ? `Remove ${hover.title} from the chat` : `Edit ${hover.title} in chat`}
          style={{ top: pos.top, right: pos.right }}
          className={cn(
            "absolute z-20 inline-flex h-7 items-center gap-1.5 rounded-medium border px-2 text-body-sm font-medium shadow-[0_2px_8px_rgb(0_0_0/0.08)] outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5",
            isOn(hover.title) ? "border-transparent bg-(--module-tint) text-(--module-strong)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) hover:bg-(--color-neutral-lightest)",
          )}
        >
          {isOn(hover.title) ? <Check aria-hidden /> : <MessageSquarePlus aria-hidden />}
          {isOn(hover.title) ? "In chat" : "Edit in chat"}
        </button>
      )}
    </div>
  );
}
