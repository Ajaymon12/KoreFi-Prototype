"use client";
import { useEffect } from "react";

// Shows an element's scrollbar only while it is being scrolled: marks it `data-scrolling`
// on scroll and removes the mark shortly after scrolling stops (see globals.css).
export function ScrollbarReveal({ hideAfterMs = 900 }: { hideAfterMs?: number }) {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.documentElement;
      el.setAttribute("data-scrolling", "");
      window.clearTimeout(timers.get(el));
      timers.set(el, window.setTimeout(() => el.removeAttribute("data-scrolling"), hideAfterMs));
    };
    // scroll doesn't bubble, so listen in the capture phase to catch every scroll container
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [hideAfterMs]);
  return null;
}
