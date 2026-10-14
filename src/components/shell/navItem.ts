import { cn } from "@/lib/utils";

/** One row in a section sidebar (Figma 337:22222): icon + label, tinted when current. Shared by
 * the module sub sidebar and the MVP sidebar so both lists look the same. */
export const navItemClass = (active: boolean) =>
  cn(
    "flex h-[30px] w-full items-center gap-2 rounded-(--module-radius) px-3 text-menu-md transition-colors [&>svg]:size-3.5 [&>svg]:shrink-0",
    active
      ? "bg-(--module-tint) font-medium text-(--color-text-primary) [&>svg]:text-(--module-strong)"
      : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
  );
