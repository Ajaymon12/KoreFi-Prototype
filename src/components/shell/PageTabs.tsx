import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageTab = { key: string; label: string; Icon?: LucideIcon };

// Mercury-style view tabs under the page header (Books / Transactions: "All · Bank · Credit card"):
// plain labels, the current one in bold with a brand underline sitting on the divider. The active
// tab lives in `?tab=`, so each view is a real URL (shareable, back-button friendly) and the page
// stays a server component.
export function PageTabs({ tabs, active, basePath }: { tabs: PageTab[]; active: string; basePath: string }) {
  return (
    <nav aria-label="Views" className="flex h-11 shrink-0 items-end gap-6 border-b border-(--color-border-default) bg-(--color-background-secondary) px-5">
      {tabs.map(({ key, label }, i) => {
        const current = key === active;
        return (
          <Link
            key={key}
            href={i === 0 ? basePath : `${basePath}?tab=${key}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative -mb-px flex h-10 items-center border-b-2 text-body-md whitespace-nowrap outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)",
              current ? "border-(--color-primary-solid) font-medium text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
