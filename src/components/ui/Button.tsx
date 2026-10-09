import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";

/**
 * ❖ Button — Design System – Master File (Figma tvX0AUyr9MTicoUXE7Peil, page 24:2).
 *
 * Types, most to least emphasis: Primary (strong positive action, use sparingly),
 * Default (most actions), Secondary (config changes), Outline, Dashed (add / empty
 * states), Link, Text (ghost), Danger (destructive), Warning (side effects).
 * Sizes: tiny 26 (dense UI) · small 34 (forms) · medium 38 · large 42 · xlarge 50 (marketing).
 * Loading swaps the left icon for the _Spinner (45:4) and keeps the Enabled look; Disabled is 50% opacity; Pressed scales to 97%,
 * `block` fills the container width. Colours are Foundation alias tokens (src/app/foundation.css).
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-medium border border-transparent font-normal leading-[1.5]",
    "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
    // Focus ring: 2px, 1px gap outside the button edge (Figma "Focus Ring", inset -3/-4px).
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary)",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  ],
  {
    variants: {
      type: {
        primary:
          "border-(--color-focus-secondary) bg-(--color-primary-solid) text-(--color-text-inverse-primary) hover:bg-(--color-primary) active:bg-(--brand-1200)",
        default:
          "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) shadow-[0_1px_1px_var(--color-border-default)] hover:border-(--color-border-darker) hover:bg-(--color-background-primary) active:border-(--color-border-darker) active:bg-(--color-neutral-light)",
        // Figma exports no colour change for Secondary hover/pressed; the screenshot shows the
        // surface lightening, reproduced here by mixing toward the page background.
        secondary:
          "bg-(--gray-1200) text-(--color-text-inverse-primary) shadow-[0_1px_1px_var(--color-border-default)] hover:bg-[color-mix(in_srgb,var(--gray-1200)_88%,var(--color-background-secondary))] active:bg-[color-mix(in_srgb,var(--gray-1200)_78%,var(--color-background-secondary))]",
        outline:
          "border-(--color-border-darker) bg-transparent text-(--color-text-primary) hover:border-(--color-border-input) active:border-(--color-border-input) active:bg-(--color-neutral-lightest)",
        dashed:
          "border-dashed border-(--color-border-darker) bg-transparent text-(--color-text-primary) hover:border-(--color-border-input) active:border-(--color-border-input) active:bg-(--color-neutral-lightest)",
        // Hover/pressed tints of --color-primary (opacity read from the Figma screenshot).
        link: "bg-transparent text-(--color-text-clickable) hover:bg-(--color-primary)/15 active:bg-(--color-primary)/25",
        text: "bg-transparent text-(--color-text-primary) hover:bg-(--color-neutral-light) active:bg-(--gray-500)",
        danger:
          "bg-(--color-danger-default) text-(--color-text-inverse-primary) shadow-[0_1px_1px_var(--color-border-default)] hover:bg-(--color-danger-dark) active:bg-(--color-danger-darkest) focus-visible:outline-(--color-focus-danger)",
        warning:
          "bg-(--color-warning-default) text-(--color-text-primary) shadow-[0_1px_1px_var(--color-border-default)] hover:bg-(--color-warning-dark) active:bg-(--color-warning-darkest)",
      },
      size: {
        tiny: "h-[26px] px-3 text-sm [&_svg]:size-4",
        small: "h-[34px] px-4 text-sm [&_svg]:size-[18px]",
        medium: "h-[38px] px-5 text-sm [&_svg]:size-[18px]",
        large: "h-[42px] px-6 text-base [&_svg]:size-5",
        xlarge: "h-[50px] px-8 text-base [&_svg]:size-5",
      },
      iconOnly: { true: "aspect-square px-0" },
      block: { true: "w-full" },
      // Loading keeps the Enabled styling (Figma "state = Loading") but blocks interaction.
      loading: { true: "pointer-events-none" },
    },
    defaultVariants: { type: "default", size: "tiny" },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

const SPINNER_SIZE = { tiny: 16, small: 18, medium: 18, large: 20, xlarge: 20 } as const;

/** _Spinner (Figma 45:4): the exported arc, used as a mask so it takes the label colour. */
function Spinner({ size }: { size: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 animate-spin bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
      style={{ width: size, height: size, maskImage: `url(${asset("/ds/spinner.svg")})`, WebkitMaskImage: `url(${asset("/ds/spinner.svg")})` }}
    />
  );
}

type ButtonProps = Omit<React.ComponentProps<"button">, "type"> &
  Omit<ButtonVariantProps, "iconOnly" | "loading"> & {
    /** Native button type (the visual type is `type`). */
    htmlType?: "button" | "submit" | "reset";
    iconLeft?: React.ReactNode;
    iconRight?: React.ReactNode;
    /** Icon-only button — always pair with `aria-label` (and a tooltip). */
    icon?: React.ReactNode;
    loading?: boolean;
  };

export function Button({
  className,
  type,
  size,
  block,
  htmlType = "button",
  iconLeft,
  iconRight,
  icon,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const leading = loading ? <Spinner size={SPINNER_SIZE[size ?? "tiny"]} /> : icon ?? iconLeft;
  return (
    <button
      type={htmlType}
      className={cn(buttonVariants({ type, size, block, loading, iconOnly: Boolean(icon) && !children }), className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      tabIndex={loading ? -1 : props.tabIndex}
      {...props}
    >
      {leading}
      {children}
      {!loading && !icon && iconRight}
    </button>
  );
}
