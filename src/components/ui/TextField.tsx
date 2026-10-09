import { useId } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Text input with label, hint and error (Mercury: label above, grey hint below, red error with an
// icon that replaces the hint). The look is the one first used on /get-started.

export const fieldClass =
  "h-10 w-full min-w-0 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest)/70 px-3 text-field-md text-(--color-text-primary) shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-(--color-text-tertiary)/70 hover:border-(--color-border-darker) focus-visible:border-(--color-focus-primary) focus-visible:bg-(--color-background-secondary) focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-primary)_18%,transparent)] aria-invalid:border-(--color-danger-default) aria-invalid:focus-visible:border-(--color-focus-danger) aria-invalid:focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-danger)_20%,transparent)] disabled:cursor-not-allowed disabled:bg-(--color-neutral-lightest) disabled:text-(--color-text-disabled) disabled:shadow-none disabled:hover:border-(--color-border-default)";
export const labelClass = "text-label-sm text-(--color-text-secondary)";

type FieldShellProps = { id: string; label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; className?: string; children: React.ReactNode };

/** Label + control + hint/error, with ids wired for `aria-describedby`. */
export function FieldShell({ id, label, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="flex items-center gap-1.5 text-body-sm text-(--color-text-danger)">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-body-sm text-(--color-text-secondary)">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type TextFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Rendered flush to the right of the input, e.g. a show-password button. */
  suffix?: React.ReactNode;
  containerClassName?: string;
};

export function TextField({ label, hint, error, suffix, containerClassName, className, ...input }: TextFieldProps) {
  const id = useId();
  const described = error || hint ? `${id}-msg` : undefined;
  const el = <input id={id} aria-invalid={error ? true : undefined} aria-describedby={described} className={cn(fieldClass, suffix && "pr-11", className)} {...input} />;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={containerClassName}>
      {suffix ? (
        <div className="relative">
          {el}
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{suffix}</div>
        </div>
      ) : (
        el
      )}
    </FieldShell>
  );
}
