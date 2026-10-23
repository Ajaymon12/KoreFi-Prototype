"use client";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";

/** MVP 2's toolbar control: 32px, outlined, small type, grey until hovered. Filter chips, the Outlets and
 *  Date chips, and plain toolbar buttons (Export, Update) all share it. */
export const chipClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-menu-sm whitespace-nowrap text-(--color-text-secondary) outline-none transition-colors hover:border-(--color-border-darker) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5";

/** A plain button in MVP 2's chip style, for toolbar and row actions. */
export function ChipButton({ icon: Icon, children, className, ...rest }: React.ComponentProps<"button"> & { icon?: LucideIcon }) {
  return (
    <button type="button" className={cn(chipClass, className)} {...rest}>
      {Icon && <Icon aria-hidden />}
      {children}
    </button>
  );
}

// Filter chip with a single-choice menu (Mercury's "Date ⌄ · Keywords ⌄ · Amount ⌄" toolbar).
// `null` means "any" (or `anyLabel`, e.g. a default period); the chip shows the chosen value and turns solid while a filter is set.
export function FilterChip({ label, options, value, onChange, icon: Icon, anyLabel }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void; icon?: LucideIcon; anyLabel?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-medium border px-2.5 text-menu-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          value
            ? "border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-primary)"
            : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)",
        )}
      >
        {Icon && <Icon aria-hidden className="size-3.5" />}
        {value ? `${label}: ${value}` : label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute top-full left-0 z-30 mt-1.5 min-w-48 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-md">
          {[null, ...options].map((o) => (
            <li key={o ?? "__any"}>
              <button
                type="button"
                role="option"
                aria-selected={value === o}
                onClick={() => pick(o)}
                className="flex h-8 w-full items-center gap-2 rounded-small px-2 text-left text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-lightest)"
              >
                <Check className={cn("size-3.5 shrink-0", value === o ? "opacity-100" : "opacity-0")} />
                {o ?? anyLabel ?? `Any ${label.toLowerCase()}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
