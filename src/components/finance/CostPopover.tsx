"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { cn } from "@/lib/utils";
import { COSTS, type CostKey, type CostSetting } from "@/lib/finance/costSettings";
import type { CostEdit } from "./PnlStory";

// MVP 2's cost editor: the cost row shows a pencil (its setting on hover), which opens a
// popover with just two linked fields, % of sales ⇄ $ a month. Type in either and the other follows, from the
// chosen stores' average monthly sales; the table behind follows too. Whichever was typed last is what's saved:
// a %, or a monthly amount (split evenly across the stores; food, set only as a %, converts it). A warning shows
// only when the cost passes half of sales. Enter saves, Escape or a click outside cancels. Portalled and
// `fixed`, so the table's scroll box can't clip it; it flips above the button when there's no room below.

const GAP = 6;
const WIDTH = 340;

type Props = {
  costKey: CostKey;
  edit: CostEdit;
  /** The cost for the period at the current setting (kept for callers; the editor works in months). */
  amount?: number;
};

const num = (t: string) => Number(t.replace(/[^0-9.]/g, "")) || 0;
const round = (n: number, d = 0) => String(Math.round(n * 10 ** d) / 10 ** d);

export function CostPopover({ costKey, edit }: Props) {
  const meta = COSTS.find((c) => c.key === costKey)!;
  const d = edit.draft?.key === costKey ? edit.draft.setting : null;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { cancel } = edit;
  const close = useCallback(() => cancel(), [cancel]);
  useDismiss(panel, !!d, close);

  // Follow the button through page and table scrolls; flip above it when the bottom is too close.
  useLayoutEffect(() => {
    if (!d) return;
    const place = () => {
      const b = trigger.current?.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 0;
      if (!b) return;
      const below = b.bottom + GAP + h <= window.innerHeight - 8;
      setPos({ top: below ? b.bottom + GAP : Math.max(8, b.top - GAP - h), left: Math.min(b.left, window.innerWidth - WIDTH - 8) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [d]);

  const value = edit.value(costKey);
  // The field being typed in keeps its own text, so the other one can follow without reformatting it.
  const [typing, setTyping] = useState<{ field: "pct" | "amount"; text: string } | null>(null);
  const { monthlySales, stores } = edit;
  const pctOfSetting = (c: CostSetting) => (c.mode === "pct" ? c.value : monthlySales ? ((c.value * stores) / monthlySales) * 100 : 0);
  const monthOfSetting = (c: CostSetting) => (c.mode === "month" ? c.value * stores : (c.value / 100) * monthlySales);
  const pct = d ? pctOfSetting(d) : 0;
  const month = d ? monthOfSetting(d) : 0;
  const typePct = (text: string) => {
    setTyping({ field: "pct", text });
    edit.change({ mode: "pct", value: num(text) });
  };
  // A monthly amount: kept as one where the cost can be (split across the stores), else turned into a %.
  const typeAmount = (text: string) => {
    setTyping({ field: "amount", text });
    const total = num(text);
    edit.change(meta.modes.includes("month") ? { mode: "month", value: total / Math.max(1, stores) } : { mode: "pct", value: monthlySales ? Math.round((total / monthlySales) * 1000) / 10 : 0 });
  };
  // Over half of sales is almost always a slip: a year typed as a month, or a group figure as a store's.
  const odd = pct > 50;

  return (
    <>
      {/* A pencil; the setting itself is in its tooltip and the editor. */}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={!!d}
        aria-label={`Change ${meta.label}: ${edit.note(costKey)}`}
        title={`${meta.label}: ${value.text}`}
        // While open, the outside-click handler would close it and this click reopen it: keep it closing.
        onPointerDown={(e) => d && e.stopPropagation()}
        onClick={() => (d ? edit.cancel() : edit.start(costKey))}
        className={cn(
          "grid size-6 place-items-center rounded-small text-(--color-text-secondary) outline-none transition-colors hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          d && "bg-(--color-neutral-light) text-(--color-text-primary)",
        )}
      >
        <Pencil aria-hidden className="size-3.5" />
      </button>

      {d &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={`Edit ${meta.label.toLowerCase()}`}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: WIDTH }}
            onKeyDown={(e) => (e.key === "Enter" ? edit.save() : undefined)}
            className="fixed z-50 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) text-left shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
          >
            <div className="space-y-2.5 p-4">
              <p className="text-subtitle-sm font-medium text-(--color-text-primary)">{meta.label}</p>
              <div className="flex items-center gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{meta.label} as a percentage of sales</span>
                  <input
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={() => setTyping(null)}
                    inputMode="decimal"
                    value={typing?.field === "pct" ? typing.text : round(pct, 1)}
                    onChange={(e) => typePct(e.target.value)}
                    className="h-9 w-full rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) pr-[72px] pl-2.5 text-body-md text-(--color-text-primary) tabular-nums outline-none focus:border-(--color-focus-primary)"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-body-sm text-(--color-text-secondary)">% of sales</span>
                </label>
                <ArrowLeftRight aria-hidden className="size-3.5 shrink-0 text-(--color-text-tertiary)" />
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{meta.label} in dollars a month</span>
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-body-md text-(--color-text-secondary)">$</span>
                  <input
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={() => setTyping(null)}
                    inputMode="decimal"
                    value={typing?.field === "amount" ? typing.text : Math.round(month).toLocaleString("en-US")}
                    onChange={(e) => typeAmount(e.target.value)}
                    className="h-9 w-full rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) pr-[52px] pl-6 text-body-md text-(--color-text-primary) tabular-nums outline-none focus:border-(--color-focus-primary)"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-body-sm text-(--color-text-secondary)">a month</span>
                </label>
              </div>
              {odd && (
                <p className="flex items-start gap-1.5 text-body-sm text-(--color-text-danger)">
                  <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  That&apos;s over half of sales. Check the figure.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-(--color-border-default) px-4 py-3">
              <Button type="default" size="small" onClick={edit.cancel}>
                Cancel
              </Button>
              <Button type="primary" size="small" onClick={edit.save}>
                Save
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
