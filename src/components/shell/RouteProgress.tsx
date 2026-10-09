"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_START_EVENT as EVENT } from "@/lib/navEvents";

// Thin brand-orange bar across the top of the window while a page switch is in flight (the
// GitHub / YouTube / Linear pattern). It starts when Next reports a navigation (see
// src/instrumentation-client.ts), creeps towards 90% while the next page loads, then fills and
// fades once the URL has changed. A safety timeout clears it if a navigation never lands.

const SAFETY_MS = 10000;

type Bar = { value: number; visible: boolean };
let bar: Bar = { value: 0, visible: false };
const listeners = new Set<() => void>();
const set = (next: Partial<Bar>) => {
  bar = { ...bar, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

let trickle: ReturnType<typeof setInterval> | undefined;
let hide: ReturnType<typeof setTimeout> | undefined;
let safety: ReturnType<typeof setTimeout> | undefined;
let running = false;

function start() {
  clearTimeout(hide);
  clearTimeout(safety);
  clearInterval(trickle);
  running = true;
  set({ value: 0.12, visible: true });
  // Fast at first, slower as it nears 90%, so a long load still looks alive.
  trickle = setInterval(() => set({ value: bar.value + (0.9 - bar.value) * 0.12 }), 180);
  safety = setTimeout(finish, SAFETY_MS);
}

function finish() {
  if (!running) return;
  running = false;
  clearInterval(trickle);
  clearTimeout(safety);
  set({ value: 1 });
  hide = setTimeout(() => {
    set({ visible: false });
    hide = setTimeout(() => set({ value: 0 }), 250);
  }, 220);
}

export function RouteProgress() {
  const { value, visible } = useSyncExternalStore(subscribe, () => bar, () => bar);
  const path = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const onStart = (e: Event) => {
      const url = new URL((e as CustomEvent<string>).detail, window.location.href);
      // Same page (e.g. a hash link or re-clicking the current tab): nothing will load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    window.addEventListener(EVENT, onStart);
    return () => window.removeEventListener(EVENT, onStart);
  }, []);

  // The URL has changed: the new page is in place.
  useEffect(() => {
    finish();
  }, [path, search]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="relative h-full origin-left bg-(--color-primary-solid) transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${value})` }}
      >
        {/* Soft glow at the leading edge so the bar reads as moving. */}
        <span className="absolute top-0 right-0 h-full w-24 shadow-[0_0_10px_var(--color-primary-solid),0_0_4px_var(--color-primary-solid)]" />
      </div>
    </div>
  );
}
