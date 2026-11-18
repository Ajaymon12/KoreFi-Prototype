"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// A centred dialog over the whole app, shared by the manager sheet and the email preview. Escape or a click
// outside closes it. It marks itself aria-modal, so popovers underneath (the schedule editor) stay open behind it.

export function Modal({ label, onClose, children, width = 720 }: { label: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={label} style={{ maxWidth: width }} className="relative flex max-h-[min(88vh,860px)] w-full flex-col overflow-hidden rounded-large bg-(--color-background-secondary) shadow-[0_24px_64px_rgb(0_0_0/0.28)] motion-safe:animate-page-in">
        <button
          ref={close}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
        >
          <X className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
