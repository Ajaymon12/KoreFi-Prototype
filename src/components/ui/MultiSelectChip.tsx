"use client";
import { useCallback, useRef, useState } from "react";
import { ChevronDown, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";

// Filter chip with a multi-choice menu (Mobbin: Turo's "Make & model", Navan's filters): a search field
// once the list is long, "n of N selected" with Select all / Clear, checkbox rows with a figure on the
// right, then Reset and "Show n …" to apply. Ticks are a draft until applied; a click outside drops them.
// `value` [] means all. The chip names one choice, counts several, and turns solid while filtered.

export type MultiOption = { value: string; label: string; /** Shorter name for the chip. */ short?: string; /** Right-hand figure, e.g. sales. */ meta?: string };

type Props = {
  label: string;
  /** Plural noun for counts and the apply button: "outlets". */
  noun: string;
  options: MultiOption[];
  value: string[];
  onChange: (v: string[]) => void;
  icon?: LucideIcon;
  /** Show the search field from this many options. */
  searchFrom?: number;
};

export function MultiSelectChip({ label, noun, options, value, onChange, icon: Icon, searchFrom = 6 }: Props) {
  const all = options.map((o) => o.value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(all);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  const filtered = value.length > 0 && value.length < all.length;
  const chosen = options.filter((o) => value.includes(o.value));
  const text = !filtered ? `All ${noun}` : chosen.length === 1 ? (chosen[0].short ?? chosen[0].label) : `${chosen.length} ${noun}`;

  const toggleOpen = () => {
    if (!open) {
      setDraft(filtered ? value : all);
      setQuery("");
    }
    setOpen((o) => !o);
  };
  const q = query.trim().toLowerCase();
  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q));
  const allOn = draft.length === all.length;
  const flip = (v: string) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : all.filter((x) => x === v || d.includes(x))));
  const apply = () => {
    onChange(draft.length === all.length ? [] : draft);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-medium border px-2.5 text-menu-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          filtered ? "border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-primary)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)",
        )}
      >
        {Icon && <Icon aria-hidden className="size-3.5" />}
        <span className="sr-only">{label}: </span>
        {text}
        {filtered && chosen.length > 1 && <span className="sr-only">: {chosen.map((o) => o.label).join(", ")}</span>}
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1.5 w-80 overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
        >
          {options.length >= searchFrom && (
            <div className="border-b border-(--color-border-default) p-2">
              <label className="flex h-8 items-center gap-2 rounded-medium bg-(--gray-200) px-2.5 focus-within:outline-2 focus-within:outline-(--color-focus-primary)">
                <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
                <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && draft.length > 0 && apply()} placeholder={`Search ${noun}`} aria-label={`Search ${noun}`} className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary)" />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 text-body-sm">
            <span className="text-(--color-text-secondary)">
              {draft.length} of {all.length} selected
            </span>
            <button type="button" onClick={() => setDraft(allOn ? [] : all)} className="rounded-small text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
              {allOn ? "Clear" : "Select all"}
            </button>
          </div>

          <ul className="max-h-72 overflow-y-auto p-1.5 pt-0.5">
            {shown.map((o) => {
              const on = draft.includes(o.value);
              return (
                <li key={o.value}>
                  <label className={cn("flex h-10 cursor-pointer items-center gap-2.5 rounded-medium px-2 text-body-md hover:bg-(--color-neutral-lightest)", on ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
                    <Checkbox checked={on} onChange={() => flip(o.value)} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.meta && <span className="shrink-0 text-body-sm text-(--color-text-tertiary) tabular-nums">{o.meta}</span>}
                  </label>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-6 text-center text-body-sm text-(--color-text-secondary)">No {noun} match &ldquo;{query}&rdquo;.</li>}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-(--color-border-default) px-3 py-2.5">
            <Button type="text" size="tiny" onClick={() => setDraft(all)} disabled={allOn}>
              Reset
            </Button>
            <Button type="primary" size="tiny" onClick={apply} disabled={draft.length === 0}>
              {draft.length === 0 ? `Pick at least one` : allOn ? `Show all ${noun}` : `Show ${draft.length} ${draft.length === 1 ? noun.replace(/s$/, "") : noun}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
