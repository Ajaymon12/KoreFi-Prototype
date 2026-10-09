import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell, fieldClass } from "./TextField";

// Native select dressed as a field: keyboard, mobile pickers and autofill all work for free.

type Option = { value: string; label: string };

type SelectProps = React.ComponentProps<"select"> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  options: Option[];
  placeholder?: string;
  containerClassName?: string;
};

export function SelectControl({ options, placeholder, className, ...select }: Omit<SelectProps, "label" | "hint" | "error" | "containerClassName">) {
  return (
    <div className="relative min-w-0">
      <select className={cn(fieldClass, "appearance-none pr-9", !select.value && placeholder && "text-(--color-text-tertiary)", className)} {...select}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-(--color-text-primary)">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-(--color-text-secondary)" />
    </div>
  );
}

export function Select({ label, hint, error, containerClassName, ...rest }: SelectProps) {
  const id = useId();
  if (!label) return <SelectControl id={id} {...rest} />;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={containerClassName}>
      <SelectControl id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...rest} />
    </FieldShell>
  );
}
