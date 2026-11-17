"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";

// Below the lg breakpoint the sidebars don't fit, so the top bar gets a menu button that opens
// this drawer. The list inside comes from the caller (`children` gets `close` to collapse the
// drawer after a link is followed) so the module app and the MVP share the same drawer.

export function NavDrawer({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(panel, open, close);

  // Mounted a frame before it slides in, so the slide runs.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const f = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(f);
      setShown(false);
    };
  }, [open]);

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
        className="grid size-10 place-items-center rounded-medium text-(--color-text-primary) hover:bg-(--color-neutral-light) lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className={cn("fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none lg:hidden", shown ? "opacity-100" : "opacity-0")}>
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className={cn(
              "flex h-dvh w-[min(320px,86vw)] flex-col bg-(--color-background-secondary) shadow-[8px_0_32px_rgb(0_0_0/0.18)] transition-transform duration-250 ease-out motion-reduce:transition-none",
              shown ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--color-border-default) pr-2 pl-4">
              <Image src={asset("/dashboard/korefi-logo.svg")} alt="KoreFi" width={83.88} height={20} unoptimized className="[.dark_&]:invert" />
              <button type="button" aria-label="Close menu" onClick={close} className="grid size-10 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light)">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="Modules" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              {children(close)}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
