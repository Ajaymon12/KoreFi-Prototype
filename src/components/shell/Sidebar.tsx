"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { CoworkAvatar } from "@/components/module/CoworkAvatar";
import { getActiveModule } from "@/lib/nav";
import { navItemClass as itemClass } from "./navItem";

// Sub sidebar (Figma 337:22222): the active module's sub modules. Modules without any
// (Integrations, Settings) render no sub sidebar, so their page runs full width.
export function Sidebar() {
  const path = usePathname();
  const active = getActiveModule(path);
  if (!active?.children) return null;
  return (
    <aside className="hidden w-[200px] shrink-0 flex-col lg:flex gap-1 overflow-y-auto border-r border-(--color-border-default) bg-(--color-background-primary)">
      <div className="flex h-9 items-center justify-between px-3 pt-1">
        <span className="text-body-sm text-(--color-text-secondary)">{active.label}</span>
        <button aria-label="Collapse sidebar" className="grid size-7 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light)">
          <PanelLeft className="size-4" />
        </button>
      </div>
      <nav aria-label={`${active.label} sections`} className="flex flex-col gap-1 px-3">
        {active.children.map((c) => {
          const current = path === c.href;
          const { Icon } = c;
          return (
            <Link key={c.href} href={c.href} className={itemClass(current)} aria-current={current ? "page" : undefined}>
              <Icon aria-hidden />
              {c.label}
            </Link>
          );
        })}
      </nav>
      {/* Persona sits below the nav, compact, so it adds character without competing with the
          links for first glance. */}
      {active.persona && (
        <div className="mx-3 mt-auto mb-3 flex items-center gap-2.5 rounded-(--module-radius) border border-(--color-border-default) bg-(--color-background-primary) p-2">
          <CoworkAvatar kind={active.persona.illustration} className="size-9" title={active.persona.role} />
          <div className="min-w-0">
            <p className="truncate text-subtitle-sm text-(--color-text-primary)">{active.persona.role}</p>
            <p className="truncate text-body-sm text-(--color-text-secondary)">{active.persona.tagline}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
