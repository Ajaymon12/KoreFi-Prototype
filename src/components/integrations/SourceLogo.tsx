import { cn } from "@/lib/utils";
import { CATALOG } from "@/lib/sources/catalog";
import type { SourceId } from "@/lib/sources/types";

/** Letter mark on the source's catalog tint, until real logos are licensed. */
export function SourceLogo({ id, name, size = "md" }: { id: SourceId; name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-medium text-(--color-text-inverse-primary)",
        CATALOG[id]?.tint ?? "bg-(--gray-1200)",
        size === "lg" ? "size-10 text-subtitle-md" : size === "sm" ? "size-7 text-menu-sm" : "size-9 text-menu-md",
      )}
    >
      {name.charAt(0)}
    </span>
  );
}
