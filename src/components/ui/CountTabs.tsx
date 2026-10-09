"use client";
import { cn } from "@/lib/utils";

export type CountTab<K extends string> = { key: K; label: string; count?: number };

// Underlined tabs with a count chip (Mercury Bill Pay: "Inbox 1 · Needs approval · Scheduled 1").
export function CountTabs<K extends string>({ tabs, value, onChange, label }: { tabs: CountTab<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 overflow-x-auto border-b border-(--color-border-default)">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-menu-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
              active ? "border-(--color-text-primary) text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-small px-1.5 text-body-sm tabular-nums", active ? "bg-(--color-neutral-light) text-(--color-text-primary)" : "bg-(--color-neutral-lightest) text-(--color-text-secondary)")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
