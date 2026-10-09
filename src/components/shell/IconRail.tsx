"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FOOTER_MODULES, NAV_MODULES, isInModule, moduleEntryHref, type NavModule } from "@/lib/nav";

// Global sidebar: slim (56px) always-dark rail, icon tile with a short label underneath (the
// Slack / ClickUp rail pattern from Mobbin, design-refs/clickup). A `.dark` scope makes the
// Foundation tokens render dark. When the whole app is dark the rail would melt into the page,
// so it lifts by a faint tint of white, a tone step like light mode, no outline (`.dark &` = an ancestor is dark).
function RailLink({ module, active }: { module: NavModule; active: boolean }) {
  const { label, Icon } = module;
  return (
    <Link
      href={moduleEntryHref(module)}
      data-module={module.id}
      aria-current={active ? "page" : undefined}
      title={label}
      className="group flex w-full flex-col items-center gap-1 rounded-medium py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-primary)"
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-(--module-radius) transition-colors [&_svg]:size-[18px]",
          active
            ? "bg-(--module-tint) text-(--module-strong)"
            : "text-(--color-text-secondary) group-hover:bg-(--module-tint) group-hover:text-(--module-strong)",
        )}
      >
        <Icon />
      </span>
      {/* 10px and truncated, as in ClickUp's rail: long labels ("Integrations") ellipsize
          instead of widening the rail */}
      <span
        className={cn(
          "w-full truncate px-0.5 text-center text-[10px] leading-[13px] transition-colors",
          active ? "text-(--module-strong)" : "text-(--color-text-secondary) group-hover:text-(--color-text-primary)",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function IconRail() {
  const path = usePathname();
  return (
    <nav aria-label="Modules" className="dark hidden w-14 shrink-0 flex-col lg:flex items-center gap-0.5 rounded-large bg-(--color-background-secondary) px-0.5 py-2 [.dark_&]:bg-[color-mix(in_srgb,white_2.5%,var(--gray-100))]">
      {NAV_MODULES.map((m) => (
        <RailLink key={m.id} module={m} active={isInModule(path, m)} />
      ))}
      <div className="mt-auto flex w-full flex-col items-center gap-0.5">
        {FOOTER_MODULES.map((m) => (
          <RailLink key={m.id} module={m} active={isInModule(path, m)} />
        ))}
      </div>
    </nav>
  );
}
