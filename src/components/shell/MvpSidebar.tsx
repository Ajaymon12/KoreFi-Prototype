"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MVP_FOOTER, MVP_GROUPS, MVP_TOP, type MvpGroup, type NavChild } from "@/lib/nav";
import { NavDrawer } from "./NavDrawer";
import { navItemClass } from "./navItem";

// The MVP's only sidebar, with Mercury's interactions (Mobbin: Mercury web, Books + Banking nav):
//  - Accordion groups. The group holding the current page is open; opening another closes it.
//    The open/close is animated (row height), and closed groups are `inert` for keyboard users.
//  - On hover a group's avatar turns into a chevron, so the row reads as expandable.
//  - Nested links sit on a rail with a sliding accent: a brand bar on the current page and a
//    lighter one that follows the pointer, both gliding between rows.
//  - Narrow mode: the sidebar folds to an icon column (button or the "[" key, remembered per
//    browser). Hovering a cowork opens a flyout with its reports; icons show their label.
// Reports marked "soon" are listed but not links yet. The restaurant picker is in the top bar.

const isCurrent = (path: string, href: string) => path === href || path.startsWith(href + "/");
const ROW = 32; // px, height of a nested row (h-8); the accents move in these steps
const groupOf = (path: string) => MVP_GROUPS.find((g) => g.items.some((i) => i.href && isCurrent(path, i.href)))?.id ?? null;
const firstHref = (g: MvpGroup) => g.items.find((i) => i.href)?.href ?? "/mvp/overview";

// ---- Narrow mode, remembered per browser ----

const KEY = "kf-mvp-sidebar";
const listeners = new Set<() => void>();
const readNarrow = () => {
  try {
    return localStorage.getItem(KEY) === "narrow";
  } catch {
    return false;
  }
};
const setNarrow = (v: boolean) => {
  try {
    localStorage.setItem(KEY, v ? "narrow" : "wide");
  } catch {}
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useNarrow = () => useSyncExternalStore(subscribe, readNarrow, () => false);

function Soon() {
  return <span className="ml-auto shrink-0 rounded-small bg-(--color-neutral-light) px-1.5 py-px text-[10px] font-medium tracking-wide text-(--color-text-secondary) uppercase">Soon</span>;
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

/** A group's reports on a rail, with the current page's accent and a hover accent that glide between rows. */
function NestedLinks({ group, path, onFollow }: { group: MvpGroup; path: string; onFollow?: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = group.items.findIndex((i) => i.href && isCurrent(path, i.href));
  const bar = (i: number) => ({ transform: `translateY(${i * ROW + 7}px)`, height: ROW - 14 });
  return (
    <div className="relative ml-[19px] pl-2" onMouseLeave={() => setHover(null)}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-(--color-border-default)" />
      <span aria-hidden className={cn("absolute top-0 -left-px w-[3px] rounded-full bg-(--color-border-darker) transition-[transform,opacity] duration-200 ease-out", hover === null || hover === active ? "opacity-0" : "opacity-100")} style={bar(hover ?? Math.max(active, 0))} />
      <span aria-hidden className={cn("absolute top-0 -left-px w-[3px] rounded-full bg-(--module-strong) transition-transform duration-200 ease-out", active < 0 && "opacity-0")} style={bar(Math.max(active, 0))} />
      <ul>
        {group.items.map((item, i) => {
          const current = i === active;
          const row = "flex h-8 items-center gap-1.5 rounded-(--module-radius) px-2 text-menu-md whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";
          return (
            <li key={item.label} onMouseEnter={() => setHover(i)}>
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={onFollow}
                  onFocus={() => setHover(i)}
                  aria-current={current ? "page" : undefined}
                  className={cn(row, current ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)")}
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              ) : (
                <span aria-disabled="true" title="Coming soon" className={cn(row, "text-(--color-text-tertiary)")}>
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.soon && <Soon />}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Group({ group, path, open, onToggle, onFollow }: { group: MvpGroup; path: string; open: boolean; onToggle: () => void; onFollow?: () => void }) {
  const holdsCurrent = groupOf(path) === group.id;
  return (
    <li>
      {/* Same height, padding and icon size as every other row (navItemClass), so the icons line up. */}
      <div className="group/row flex h-[30px] items-center gap-2 rounded-(--module-radius) px-3 hover:bg-(--color-neutral-light)">
        {/* Mercury's L1 icon: swapped for a chevron on row hover; clicking it opens or closes the group. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} ${group.label} reports`}
          onClick={onToggle}
          className="relative -m-1 grid shrink-0 place-items-center rounded-small p-1 outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
        >
          <group.Icon aria-hidden className={cn("size-3.5 transition-opacity duration-150 group-hover/row:opacity-0 group-focus-within/row:opacity-0", holdsCurrent ? "text-(--module-strong)" : "text-(--color-text-secondary)")} />
          <ChevronDown aria-hidden className={cn("absolute size-3.5 text-(--color-text-secondary) opacity-0 transition-[opacity,transform] duration-200 group-hover/row:opacity-100 group-focus-within/row:opacity-100", !open && "-rotate-90")} />
        </button>
        {/* The name goes to the group's first report (and opens the group), as Mercury's L1 links do. */}
        <Link
          href={firstHref(group)}
          onClick={() => {
            if (!open) onToggle();
            onFollow?.();
          }}
          // Same weight and colour as every other nav link (as in Mercury); only the group you're in is darker.
          className={cn(
            "min-w-0 flex-1 truncate text-menu-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
            holdsCurrent ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) group-hover/row:text-(--color-text-primary)",
          )}
        >
          {group.label}
        </Link>
      </div>
      {/* Height animates via grid rows (0fr ↔ 1fr); a closed group is inert so Tab skips it. */}
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-0.5 pb-1.5">
            <NestedLinks group={group} path={path} onFollow={onFollow} />
          </div>
        </div>
      </div>
    </li>
  );
}

/** The full list: Workspace links, the cowork groups as an accordion, then Integrations and Settings. */
function Workspace({ path, onFollow, onCollapse }: { path: string; onFollow?: () => void; onCollapse?: () => void }) {
  const current = groupOf(path);
  const [openId, setOpenId] = useState<string | null>(current);
  // Moving to a page in another group opens that group (and closes the rest).
  const [seen, setSeen] = useState(current);
  if (current !== seen) {
    setSeen(current);
    if (current) setOpenId(current);
  }
  return (
    <>
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <p className="text-body-sm text-(--color-text-secondary)">Workspace</p>
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar  [" className="-mr-1 grid size-7 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            <PanelLeftClose className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <TopLinks items={MVP_TOP} path={path} onFollow={onFollow} />
      {/* One heading for the coworks (Mercury's "Workflows"), so each row is just its area. */}
      <p className="px-2 pt-4 pb-2 text-body-sm text-(--color-text-secondary)">Coworkers</p>
      <ul className="flex flex-col gap-1">
        {MVP_GROUPS.map((g) => (
          <Group key={g.id} group={g} path={path} open={openId === g.id} onToggle={() => setOpenId((o) => (o === g.id ? null : g.id))} onFollow={onFollow} />
        ))}
      </ul>
      <TopLinks items={MVP_FOOTER} path={path} onFollow={onFollow} className="mt-auto border-t border-(--color-border-default) pt-2" />
    </>
  );
}

// ---- Narrow mode ----

type Flyout = { key: string; top: number; left: number; content: React.ReactNode };

/** Icon column with hover flyouts. Flyouts are `fixed` so the panel's overflow can't clip them. */
function Narrow({ path, onExpand }: { path: string; onExpand: () => void }) {
  const [fly, setFly] = useState<Flyout | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keep = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const close = useCallback(() => {
    keep();
    timer.current = setTimeout(() => setFly(null), 120);
  }, []);
  useEffect(() => () => keep(), []);
  const show = (key: string, content: React.ReactNode) => (e: React.SyntheticEvent<HTMLElement>) => {
    keep();
    const r = e.currentTarget.getBoundingClientRect();
    setFly({ key, top: r.top, left: r.right + 8, content });
  };
  const hover = (key: string, content: React.ReactNode) => ({ onMouseEnter: show(key, content), onFocus: show(key, content), onMouseLeave: close, onBlur: close });

  const icon = (current: boolean) =>
    cn(
      "grid size-9 place-items-center rounded-(--module-radius) outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-4",
      current ? "bg-(--module-tint) text-(--module-strong)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
    );
  const label = (text: string) => <span className="block px-2.5 py-1.5 text-menu-md whitespace-nowrap text-(--color-text-primary)">{text}</span>;
  const iconLinks = (items: NavChild[]) =>
    items.map(({ label: l, href, Icon }) => (
      <li key={href}>
        <Link href={href} aria-label={l} aria-current={isCurrent(path, href) ? "page" : undefined} className={icon(isCurrent(path, href))} {...hover(href, label(l))}>
          <Icon aria-hidden />
        </Link>
      </li>
    ));

  return (
    <>
      <button type="button" onClick={onExpand} aria-label="Expand sidebar" className={icon(false)} {...hover("expand", label("Expand sidebar  ["))}>
        <PanelLeftOpen aria-hidden />
      </button>
      <ul className="mt-2 flex flex-col items-center gap-1">{iconLinks(MVP_TOP)}</ul>
      <ul className="mt-3 flex flex-col items-center gap-1 border-t border-(--color-border-default) pt-3">
        {MVP_GROUPS.map((g) => {
          const current = groupOf(path) === g.id;
          const menu = (
            <div className="w-52 p-1.5">
              <p className="px-2 pt-1 pb-1.5 text-subtitle-xs text-(--color-text-secondary)">{g.label} coworker</p>
              <NestedLinks group={g} path={path} onFollow={() => setFly(null)} />
            </div>
          );
          return (
            <li key={g.id}>
              <Link href={firstHref(g)} aria-label={`${g.label} coworker`} className={icon(current)} {...hover(g.id, menu)}>
                <g.Icon aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="mt-auto flex flex-col items-center gap-1 border-t border-(--color-border-default) pt-2">{iconLinks(MVP_FOOTER)}</ul>

      {fly && (
        <div role="menu" onMouseEnter={keep} onMouseLeave={close} style={{ top: fly.top, left: fly.left }} className="fixed z-50 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          {fly.content}
        </div>
      )}
    </>
  );
}

export function MvpSidebar() {
  const path = usePathname();
  const narrow = useNarrow();

  // "[" folds and unfolds the sidebar, unless the user is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      setNarrow(!readNarrow());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className={cn("hidden shrink-0 flex-col overflow-hidden border-r border-(--color-border-default) bg-(--color-background-primary) transition-[width] duration-200 ease-out lg:flex", narrow ? "w-14" : "w-[200px]")}>
      <nav aria-label="Workspace" className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto py-2", narrow ? "items-center px-2" : "px-3")}>
        {narrow ? <Narrow path={path} onExpand={() => setNarrow(false)} /> : <Workspace path={path} onCollapse={() => setNarrow(true)} />}
      </nav>
    </aside>
  );
}

/** The same list in the top-bar drawer under lg (always wide). */
export function MvpMobileNav() {
  const path = usePathname();
  return <NavDrawer>{(close) => <Workspace path={path} onFollow={close} />}</NavDrawer>;
}
