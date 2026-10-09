"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOOTER_MODULES, NAV_MODULES, isInModule, moduleEntryHref, type NavModule } from "@/lib/nav";
import { useDismiss } from "@/components/dashboard/useDismiss";

// Below the lg breakpoint the icon rail and section sidebar don't fit, so the top bar gets a menu
// button that opens this drawer: every module with its sections listed under it (the rail and
// sidebar folded into one list), Integrations and Settings at the bottom.

export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(panel, open, close);

  // Keep the page behind still while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const row = (m: NavModule) => {
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
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-8 place-items-center rounded-medium text-(--color-text-primary) hover:bg-(--color-neutral-light) lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden">
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Menu" className="flex h-full w-[min(300px,85vw)] flex-col bg-(--color-background-secondary) shadow-[8px_0_32px_rgb(0_0_0/0.18)]">
            <div className="flex h-12 items-center justify-between border-b border-(--color-border-default) px-3">
              <span className="pl-1 text-subtitle-sm text-(--color-text-primary)">Menu</span>
              <button type="button" aria-label="Close menu" onClick={close} className="grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light)">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <nav aria-label="Modules" className="flex flex-1 flex-col overflow-y-auto p-2">
              <ul className="space-y-0.5">{NAV_MODULES.map(row)}</ul>
              <ul className="mt-auto space-y-0.5 border-t border-(--color-border-default) pt-2">{FOOTER_MODULES.map(row)}</ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
