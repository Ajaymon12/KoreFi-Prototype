import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Square checkbox: a real <input> (keyboard + screen readers) under a drawn box. `mixed` shows a
// dash, for "some of these are on" header cells.

type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & { mixed?: boolean; label?: React.ReactNode };

export function Checkbox({ mixed, label, className, checked, ...input }: CheckboxProps) {
  const on = checked || mixed;
  const box = (
    <span className={cn("relative inline-grid size-4 shrink-0 place-items-center", className)}>
      <input
        type="checkbox"
        checked={checked}
        aria-checked={mixed ? "mixed" : checked}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-small border border-(--color-border-input) bg-(--color-background-secondary) outline-none checked:border-(--color-text-primary) checked:bg-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary) aria-[checked=mixed]:border-(--color-text-primary) aria-[checked=mixed]:bg-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-50"
        {...input}
      />
      {on && (mixed ? <Minus aria-hidden className="pointer-events-none relative size-3 text-(--color-background-secondary)" strokeWidth={3} /> : <Check aria-hidden className="pointer-events-none relative size-3 text-(--color-background-secondary)" strokeWidth={3} />)}
    </span>
  );
  if (!label) return box;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-body-md text-(--color-text-primary)">
      {box}
      {label}
    </label>
  );
}
