"use client";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { TextQuote } from "lucide-react";
import { cn } from "@/lib/utils";

// Page-wide view settings for Overview: the "Simplify charts & tables" switch (every report card
// swaps its body for a few plain sentences) and the food-cost assumption behind "You keep".
// Both are remembered per browser; the page renders the same without storage.

const KEY = "kf-overview";
export const FOOD_RANGE = { min: 25, max: 30, step: 0.5, initial: 28 };

type State = { simple: boolean; setSimple: (v: boolean) => void; food: number; setFood: (v: number) => void };
const Ctx = createContext<State>({ simple: false, setSimple: () => {}, food: FOOD_RANGE.initial, setFood: () => {} });
export const useOverview = () => useContext(Ctx);

// Settings live in localStorage when it's available, and in memory when it isn't.
let memory = "{}";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const write = (patch: object) => {
  memory = JSON.stringify({ ...JSON.parse(read()), ...patch });
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

export function OverviewProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  const value = useMemo(() => {
    let s: { simple?: unknown; food?: unknown } = {};
    try {
      s = JSON.parse(raw);
    } catch {}
    const food = typeof s.food === "number" && s.food >= FOOD_RANGE.min && s.food <= FOOD_RANGE.max ? s.food : FOOD_RANGE.initial;
    return { simple: s.simple === true, food, setSimple: (v: boolean) => write({ simple: v }), setFood: (v: number) => write({ food: v }) };
  }, [raw]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Page-wide switch: every report card shows "In short" sentences instead of its chart or table. */
export function SimplifySwitch() {
  const { simple, setSimple } = useOverview();
  return (
    <button
      type="button"
      aria-pressed={simple}
      onClick={() => setSimple(!simple)}
      className="flex h-9 items-center gap-2.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) pr-1.5 pl-3.5 text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
    >
      Simplify charts &amp; tables
      <span className={cn("relative h-5.5 w-9.5 rounded-circle transition-colors", simple ? "bg-(--color-text-primary)" : "bg-(--color-neutral-light)")}>
        <span className={cn("absolute top-0.75 left-0.75 size-4 rounded-circle bg-white shadow-sm transition-transform", simple && "translate-x-4")} />
      </span>
    </button>
  );
}

/** A report card: title, caption, optional controls, and "In short" bullets that replace the
 * body when Simplify is on. `say` items may contain <b> for the key figure. */
export function ReportCard({ title, caption, right, say, children }: { title: string; caption?: string; right?: React.ReactNode; say: React.ReactNode[]; children: React.ReactNode }) {
  const { simple } = useOverview();
  return (
    <section className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-6 py-5.5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-subtitle-lg text-(--color-text-primary)">{title}</h2>
          {caption && <p className="mt-1 text-body-sm text-(--color-text-secondary)">{caption}</p>}
        </div>
        {!simple && right && <div className="flex flex-wrap items-center gap-2.5">{right}</div>}
      </div>
      {simple ? (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-subtitle-xs tracking-wide text-(--color-text-secondary) uppercase">
            <TextQuote className="size-3.5" />
            In short
          </p>
          <ul className="space-y-2.5">
            {say.map((s, i) => (
              <li key={i} className="relative pl-4.5 text-body-lg text-(--color-text-primary) before:absolute before:top-[0.6em] before:left-0 before:size-1.75 before:rounded-circle before:bg-(--color-text-primary) [&_b]:font-semibold">
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** The food-cost assumption, shown beside the figure it changes. */
export function FoodCostSlider() {
  const { food, setFood } = useOverview();
  return (
    <label className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
      Food cost
      <input
        type="range"
        min={FOOD_RANGE.min}
        max={FOOD_RANGE.max}
        step={FOOD_RANGE.step}
        value={food}
        onChange={(e) => setFood(Number(e.target.value))}
        className="w-24 accent-(--color-text-primary)"
      />
      <b className="min-w-10 font-medium text-(--color-text-primary) tabular-nums">{food}%</b>
    </label>
  );
}
