"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogSurface, iconButton, scrim } from "@/components/mvp3/styles";

// A centred dialog over the whole app, shared by the manager sheet and the email preview. Escape or a click
// outside closes it; Tab stays inside while it's open. It marks itself aria-modal, so popovers underneath (the schedule editor) stay open behind it.

export function Modal({ label, onClose, children, width = 720 }: { label: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const close = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    // Focus moves in on open, Tab cycles inside the dialog, and focus returns to what opened it on close.
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = box.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      opener?.focus?.();
    };
  }, []);
  return createPortal(
    <div className={cn(scrim, "z-50 grid place-items-center p-4")} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={label} style={{ maxWidth: width }} className={cn(dialogSurface, "relative flex max-h-[min(calc(100dvh-2rem),860px)] w-full flex-col overflow-hidden motion-safe:animate-page-in")}>
        <button
          ref={close}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(iconButton, "absolute top-3 right-3 z-10 size-8")}
        >
          <X className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
