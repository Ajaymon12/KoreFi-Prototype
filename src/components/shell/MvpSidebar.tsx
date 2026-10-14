"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MVP_FOOTER, MVP_GROUPS, MVP_TOP, type MvpGroup, type NavChild } from "@/lib/nav";
import { CoworkAvatar } from "@/components/module/CoworkAvatar";
import { NavDrawer } from "./NavDrawer";
import { navItemClass } from "./navItem";

// The MVP's only sidebar: "Workspace", Overview and the brief, then the reports grouped under the
// cowork that produces them (avatar + name, collapsible), with Mercury's nested-link look: a rail
// down the left and an accent bar on the current page. Reports marked "soon" are listed but not
// links yet. Integrations and Settings pin to the bottom. The restaurant picker is in the top bar.

const isCurrent = (path: string, href: string) => path === href || path.startsWith(href + "/");

function Soon() {
  return <span className="ml-auto rounded-small bg-(--color-neutral-light) px-1.5 py-px text-[10px] font-medium tracking-wide text-(--color-text-secondary) uppercase">Soon</span>;
}

function TopLinks({ items, path, onFollow, className }: { items: NavChild[]; path: string; onFollow?: () => void; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map(({ label, href, Icon }) => {
        const current = isCurrent(path, href);
        return (
          <li key={href}>
            <Link href={href} onClick={onFollow} aria-current={current ? "page" : undefined} className={navItemClass(current)}>
              <Icon aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Group({ group, path, onFollow }: { group: MvpGroup; path: string; onFollow?: () => void }) {
  const hasCurrent = group.items.some((i) => i.href && isCurrent(path, i.href));
  // Open by default; a group with the current page can't be collapsed away by accident on load.
  const [open, setOpen] = useState(true);
  const shown = open || hasCurrent;
  return (
    <li>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen(!shown)}
        className="flex min-h-9 w-full items-center gap-2 rounded-(--module-radius) px-2 py-1.5 text-left text-menu-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-light) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
      >
        <CoworkAvatar kind={group.illustration} className="size-6 shrink-0" title={group.label} />
        {/* Long names ("Delivery Apps Coworker") wrap to two lines rather than ellipsize. */}
        <span className="min-w-0 flex-1 font-medium leading-tight">{group.label}</span>
        <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-(--color-text-secondary) transition-transform", !shown && "-rotate-90")} />
      </button>
      {shown && (
        <ul className="relative mt-0.5 mb-1.5 ml-[19px] border-l border-(--color-border-default) pl-3">
          {group.items.map((item) => {
            const current = !!item.href && isCurrent(path, item.href);
            const row = cn(
              "relative flex h-8 items-center gap-2 rounded-(--module-radius) px-2 text-menu-md",
              // Mercury's accent: a short bar over the rail beside the current page.
              current && "font-medium text-(--color-text-primary) before:absolute before:top-1.5 before:bottom-1.5 before:-left-[13px] before:w-0.5 before:rounded-full before:bg-(--module-strong)",
            );
            if (!item.href) {
              return (
                <li key={item.label}>
                  <span aria-disabled="true" title="Coming soon" className={cn(row, "text-(--color-text-tertiary)")}>
                    {item.label}
                    {item.soon && <Soon />}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <Link href={item.href} onClick={onFollow} aria-current={current ? "page" : undefined} className={cn(row, !current && "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)")}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Workspace({ path, onFollow }: { path: string; onFollow?: () => void }) {
  return (
    <>
      <p className="px-2 pt-1 pb-2 text-body-sm text-(--color-text-secondary)">Workspace</p>
      <TopLinks items={MVP_TOP} path={path} onFollow={onFollow} />
      <ul className="mt-3 flex flex-col gap-1">
        {MVP_GROUPS.map((g) => (
          <Group key={g.id} group={g} path={path} onFollow={onFollow} />
        ))}
      </ul>
      <TopLinks items={MVP_FOOTER} path={path} onFollow={onFollow} className="mt-auto border-t border-(--color-border-default) pt-2" />
    </>
  );
}

export function MvpSidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-[232px] shrink-0 lg:flex flex-col border-r border-(--color-border-default) bg-(--color-background-primary)">
      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2">
        <Workspace path={path} />
      </nav>
    </aside>
  );
}

/** The same list in the top-bar drawer under lg. */
export function MvpMobileNav() {
  const path = usePathname();
  return <NavDrawer>{(close) => <Workspace path={path} onFollow={close} />}</NavDrawer>;
}
