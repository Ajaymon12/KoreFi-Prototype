import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Selectable card for short answer sets (Remote / Whop onboarding on Mobbin): icon, title and an
// optional line of help, with a radio dot or checkbox in the corner. The caller sets the role.

type Props = {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  role?: "radio" | "checkbox";
  /** "stack" puts the icon above the title, for short labels in a dense grid. */
  layout?: "row" | "stack";
};

export function OptionCard({ selected, onClick, title, description, icon, role = "checkbox", layout = "row" }: Props) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "group relative flex w-full rounded-large border bg-(--color-background-secondary) p-4 text-left outline-none transition-[border-color,box-shadow,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)",
        layout === "stack" ? "flex-col items-start gap-3" : "items-start gap-3",
        selected
          ? "border-(--color-primary-solid) bg-(--brand-100) shadow-[0_0_0_1px_var(--color-primary-solid)]"
          : "border-(--color-border-default) hover:border-(--color-border-darker) hover:bg-(--color-background-primary)",
      )}
    >
      {icon && (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-medium transition-colors [&_svg]:size-[18px]", selected ? "bg-(--color-primary-solid) text-(--color-text-inverse-primary)" : "bg-(--color-neutral-lightest) text-(--color-text-secondary)")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 pr-6">
        <span className="block text-subtitle-sm text-(--color-text-primary)">{title}</span>
        {description && <span className="mt-0.5 block text-body-sm text-(--color-text-secondary)">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute top-4 right-4 grid size-4 place-items-center border transition-colors",
          role === "radio" ? "rounded-circle" : "rounded-small",
          selected ? "border-(--color-primary-solid) bg-(--color-primary-solid)" : "border-(--color-border-input) bg-(--color-background-secondary)",
        )}
      >
        {selected && (role === "radio" ? <span className="size-1.5 rounded-circle bg-white" /> : <Check className="size-3 text-white" strokeWidth={3} />)}
      </span>
    </button>
  );
}
