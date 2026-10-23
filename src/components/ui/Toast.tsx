"use client";
import { useEffect } from "react";
import { Check, X } from "lucide-react";

// Otter-style confirmation toast, bottom centre, gone after a few seconds. An optional action
// (e.g. Undo) sits before the close button and keeps it up a little longer.

export function Toast({ message, onDismiss, action }: { message: string | null; onDismiss: () => void; action?: { label: string; onClick: () => void } }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, action ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [message, onDismiss, action]);

  return (
    <div aria-live="polite" data-dismiss-ignore className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {message && (
        <div role="status" className="pointer-events-auto flex items-center gap-2.5 rounded-medium bg-(--gray-1200) py-2.5 pr-2.5 pl-3.5 text-body-md text-(--color-text-inverse-primary) shadow-[0_8px_24px_rgb(0_0_0/0.2)]">
          <Check className="size-4 shrink-0 text-(--color-success-default)" aria-hidden />
          {message}
          {action && (
            <button
              type="button"
              onClick={() => {
                action.onClick();
                onDismiss();
              }}
              className="ml-1 rounded-small px-1.5 py-0.5 font-medium text-(--color-text-inverse-primary) underline-offset-2 hover:bg-white/10 hover:underline"
            >
              {action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={onDismiss} className="grid size-6 place-items-center rounded-small hover:bg-white/10">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
