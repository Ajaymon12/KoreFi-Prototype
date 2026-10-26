"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// A phone's bottom sheet, after Asana's iOS filter sheets (Mobbin: Asana "Time periods", "Assigned to"): a grabber,
// a header with an action each side (Clear / Back, Done) around the title, a scrolling body, and a full-width
// button pinned under it. It slides up over a dimmed page; a tap on the dim, the grabber's Done or Escape closes it.
// Portalled to the body so no scroll box or sticky layer of the page can clip it. Phones only: callers show it under md.

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Header's left action (Clear, Back); the right is always Done. */
  left?: React.ReactNode;
  /** The pinned full-width button's label; it closes the sheet unless `onAction` says otherwise. */
  action?: React.ReactNode;
  onAction?: () => void;
  children: React.ReactNode;
};

export function BottomSheet({ open, onClose, title, left, action, onAction, children }: Props) {
  // Mounted a frame before it slides, so the slide runs.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const f = requestAnimationFrame(() => setShown(true));
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(f);
      setShown(false);
      window.removeEventListener("keydown", key);
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <div aria-hidden onClick={onClose} className={cn("absolute inset-0 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none", shown ? "opacity-100" : "opacity-0")} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-(--color-background-secondary) shadow-[0_-8px_32px_rgb(0_0_0/0.16)] transition-transform duration-250 ease-out motion-reduce:transition-none",
          shown ? "translate-y-0" : "translate-y-full",
        )}
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-circle bg-(--gray-600)" />
        <div className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4">
          <span className="justify-self-start text-body-md text-(--color-text-clickable)">{left}</span>
          <h2 className="text-subtitle-sm text-(--color-text-primary)">{title}</h2>
          <button type="button" onClick={onClose} className="h-8 justify-self-end rounded-small px-1 text-body-md font-medium text-(--color-text-clickable) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-(--color-border-default)">{children}</div>
        {action && (
          <div className="shrink-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onAction ?? onClose}
              className="h-11 w-full rounded-large bg-(--color-primary-solid) text-body-md font-medium text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)"
            >
              {action}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
