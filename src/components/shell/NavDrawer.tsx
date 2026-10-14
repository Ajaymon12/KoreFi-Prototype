"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useDismiss } from "@/components/dashboard/useDismiss";

// Below the lg breakpoint the sidebars don't fit, so the top bar gets a menu button that opens
// this drawer. The list inside comes from the caller (`children` gets `close` to collapse the
// drawer after a link is followed) so the module app and the MVP share the same drawer.

export function NavDrawer({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(panel, open, close);

  // Keep the page behind still while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-8 place-items-center rounded-medium text-(--color-text-primary) hover:bg-(--color-neutral-light) lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden">
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Menu" className="flex h-full w-[min(300px,85vw)] flex-col bg-(--color-background-secondary) shadow-[8px_0_32px_rgb(0_0_0/0.18)]">
            <div className="flex h-12 items-center justify-between border-b border-(--color-border-default) px-3">
              <span className="pl-1 text-subtitle-sm text-(--color-text-primary)">Menu</span>
              <button type="button" aria-label="Close menu" onClick={close} className="grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light)">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <nav aria-label="Modules" className="flex flex-1 flex-col overflow-y-auto p-2">
              {children(close)}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
