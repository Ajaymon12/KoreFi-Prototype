import { useEffect, type RefObject } from "react";

/** A modal dialog opened from inside `el` (e.g. "Add outlets" in a drawer) and not part of it. */
const modalAbove = (el: HTMLElement) => [...document.querySelectorAll('[aria-modal="true"]')].some((m) => !el.contains(m) && !m.contains(el));

/** Closes a popover on outside pointer-down or Escape. Clicks inside a modal stacked on top of it,
 * or on anything marked `data-dismiss-ignore` (toasts), don't count; nor does Escape while that modal is up. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const el = ref.current;
      const t = e.target as Element;
      if (!el || el.contains(t) || t.closest?.("[data-dismiss-ignore]") || modalAbove(el)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && !(ref.current && modalAbove(ref.current)) && onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [ref, open, onClose]);
}
