import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageTab = { key: string; label: string; Icon: LucideIcon };

// ClickUp-style view tabs under the page header. The active tab lives in `?tab=`, so each view is
// a real URL (shareable, back-button friendly) and the page stays a server component.
export function PageTabs({ tabs, active, basePath }: { tabs: PageTab[]; active: string; basePath: string }) {
  return (
    <nav aria-label="Views" className="flex h-10 shrink-0 items-center gap-1 border-b border-(--color-border-default) bg-(--color-background-secondary) px-3">
      {tabs.map(({ key, label, Icon }, i) => {
        const current = key === active;
        return (
          <Link
            key={key}
            href={i === 0 ? basePath : `${basePath}?tab=${key}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-medium px-2 text-menu-md transition-colors [&>svg]:size-3.5",
              current
                ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary) [&>svg]:text-(--color-primary-solid)"
                : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
            )}
          >
            <Icon aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
