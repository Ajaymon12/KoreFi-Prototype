"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FOOTER_MODULES, NAV_MODULES, isInModule, moduleEntryHref, type NavModule } from "@/lib/nav";
import { NavDrawer } from "./NavDrawer";

// The module app's drawer: every module with its sections listed under it (the rail and sidebar
// folded into one list), Integrations and Settings at the bottom.

export function MobileNav() {
  const path = usePathname();

  const row = (m: NavModule, close: () => void) => {
    const active = isInModule(path, m);
    return (
      <li key={m.id} data-module={m.id}>
        <Link
          href={moduleEntryHref(m)}
          onClick={close}
          aria-current={active && !m.children ? "page" : undefined}
          className={cn("flex h-10 items-center gap-3 rounded-medium px-3 text-menu-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", active ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light)")}
        >
          <span className={cn("grid size-7 place-items-center rounded-(--module-radius) [&_svg]:size-4", active ? "bg-(--module-tint) text-(--module-strong)" : "text-(--color-text-secondary)")}>
            <m.Icon aria-hidden />
          </span>
          {m.label}
        </Link>
        {active && m.children && (
          <ul className="mt-0.5 mb-2 ml-[26px] space-y-0.5 border-l border-(--color-border-default) pl-3">
            {m.children.map((c) => {
              const current = path === c.href;
              return (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    onClick={close}
                    aria-current={current ? "page" : undefined}
                    className={cn("flex h-9 items-center gap-2 rounded-medium px-2.5 text-menu-md [&>svg]:size-3.5", current ? "bg-(--module-tint) font-medium text-(--color-text-primary) [&>svg]:text-(--module-strong)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light)")}
                  >
                    <c.Icon aria-hidden />
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <NavDrawer>
      {(close) => (
        <>
          <ul className="space-y-0.5">{NAV_MODULES.map((m) => row(m, close))}</ul>
          <ul className="mt-auto space-y-0.5 border-t border-(--color-border-default) pt-2">{FOOTER_MODULES.map((m) => row(m, close))}</ul>
        </>
      )}
    </NavDrawer>
  );
}
