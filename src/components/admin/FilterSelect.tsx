"use client";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";

/** "All status ⌄" dropdown from the Ops filter bar (Figma 1431:28143): shows the choice, or the "all" label when unfiltered. */
export function FilterSelect<K extends string>({ label, allLabel, value, onChange, options }: { label: string; allLabel: string; value: K | "all"; onChange: (v: K | "all") => void; options: { value: K; label: string; count?: number }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  const current = options.find((o) => o.value === value);
  const pick = (v: K | "all") => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? allLabel}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-medium border px-2.5 text-body-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          current ? "border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-primary)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)",
        )}
      >
        {current?.label ?? allLabel}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute top-full left-0 z-30 mt-1.5 min-w-52 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-md">
          {[{ value: "all" as const, label: allLabel, count: undefined }, ...options].map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={value === o.value} onClick={() => pick(o.value)} className="flex h-8 w-full items-center gap-2 rounded-small px-2 text-left text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-lightest)">
                <Check className={cn("size-3.5 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.count !== undefined && <span className="text-body-sm tabular-nums text-(--color-text-secondary)">{o.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
