"use client";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MVP2_GROUPS, MVP2_TOP, type MvpGroup, type MvpItem } from "@/lib/nav";
import { NavDrawer } from "./NavDrawer";
import { navItemClass } from "./navItem";
import { useNewHrefs } from "@/lib/announcements";

// MVP 2's sidebar, built like /mvp's (MvpSidebar, Mercury's interactions) with MVP 2's pages:
//  - "Workspace" and Overview, then the coworkers under one "Coworkers" heading as an accordion.
//    The group holding the current page is open; opening another closes it. Closed groups are `inert`.
//  - On hover a group's icon turns into a chevron, so the row reads as expandable.
//  - Reports sit on a rail with a sliding accent: a brand bar on the current page and a lighter one
//    that follows the pointer.
//  - Narrow mode: an icon column (button or the "[" key, remembered per browser), with hover flyouts.
// An item may point at a ?tab= of a shared page (Chargeback Transactions), so "current" checks the tab.

const ROW = 32; // px, height of a nested row (h-8); the accents move in these steps
const tabOf = (href: string) => new URLSearchParams(href.split("?")[1] ?? "").get("tab");
const pathOf = (href: string) => href.split("?")[0];

/** Current when the path matches and, for a ?tab= link, so does the tab. A plain link stays current
 *  for any tab no sibling claims (Chargeback Overview for "resolved"). */
function isCurrent(item: MvpItem, siblings: MvpItem[], path: string, tab: string | null) {
  if (!item.href || path !== pathOf(item.href)) return false;
  const own = tabOf(item.href);
  if (own) return tab === own;
  return !siblings.some((s) => s.href && pathOf(s.href) === path && tab !== null && tabOf(s.href) === tab);
}
const groupOf = (path: string) => MVP2_GROUPS.find((g) => g.items.some((i) => i.href && pathOf(i.href) === path))?.id ?? null;
const firstHref = (g: MvpGroup) => g.items.find((i) => i.href)?.href ?? MVP2_TOP[0].href;

// ---- Narrow mode, remembered per browser ----

const KEY = "kf-mvp2-sidebar";
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

/** A launched page the owner hasn't opened yet (lib/announcements). */
function NewTag() {
  return <span className="ml-auto shrink-0 rounded-small bg-(--color-primary) px-1.5 py-px text-[10px] font-medium tracking-wide text-white uppercase">New</span>;
}

function Soon() {
  return <span className="ml-auto shrink-0 rounded-small bg-(--color-neutral-light) px-1.5 py-px text-[10px] font-medium tracking-wide text-(--color-text-secondary) uppercase">Soon</span>;
}

function TopLinks({ path, onFollow }: { path: string; onFollow?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {MVP2_TOP.map(({ label, href, Icon }) => {
        const current = path === href;
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
function NestedLinks({ group, path, tab, onFollow }: { group: MvpGroup; path: string; tab: string | null; onFollow?: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const fresh = useNewHrefs();
  const active = group.items.findIndex((i) => isCurrent(i, group.items, path, tab));
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
                  {fresh.has(item.href) && <NewTag />}
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

function Group({ group, path, tab, open, onToggle, onFollow }: { group: MvpGroup; path: string; tab: string | null; open: boolean; onToggle: () => void; onFollow?: () => void }) {
  const holdsCurrent = groupOf(path) === group.id;
  const fresh = useNewHrefs();
  const hasNew = group.items.some((i) => i.href && fresh.has(i.href));
  return (
    <li>
      <div className="group/row flex h-[30px] items-center gap-2 rounded-(--module-radius) px-3 hover:bg-(--color-neutral-light)">
        {/* The icon swaps for a chevron on row hover; clicking it opens or closes the group. */}
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
        {/* The name goes to the group's first report (and opens the group). */}
        <Link
          href={firstHref(group)}
          onClick={() => {
            if (!open) onToggle();
            onFollow?.();
          }}
          className={cn(
            "min-w-0 flex-1 truncate text-menu-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
            holdsCurrent ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) group-hover/row:text-(--color-text-primary)",
          )}
        >
          {group.label}
        </Link>
        {/* folded with something new inside: say so on the group itself */}
        {hasNew && !open && <NewTag />}
      </div>
      {/* Height animates via grid rows (0fr ↔ 1fr); a closed group is inert so Tab skips it. */}
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-0.5 pb-1.5">
            <NestedLinks group={group} path={path} tab={tab} onFollow={onFollow} />
          </div>
        </div>
      </div>
    </li>
  );
}

/** The full list: Workspace links, then the coworkers as an accordion. */
function Workspace({ path, tab, onFollow, onCollapse }: { path: string; tab: string | null; onFollow?: () => void; onCollapse?: () => void }) {
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
      <TopLinks path={path} onFollow={onFollow} />
      <p className="px-2 pt-4 pb-2 text-body-sm text-(--color-text-secondary)">Coworkers</p>
      <ul className="flex flex-col gap-1">
        {MVP2_GROUPS.map((g) => (
          <Group key={g.id} group={g} path={path} tab={tab} open={openId === g.id} onToggle={() => setOpenId((o) => (o === g.id ? null : g.id))} onFollow={onFollow} />
        ))}
      </ul>
    </>
  );
}

// ---- Narrow mode ----

type Flyout = { key: string; top: number; left: number; content: React.ReactNode };

/** Icon column with hover flyouts. Flyouts are `fixed` so the panel's overflow can't clip them. */
function Narrow({ path, tab, onExpand }: { path: string; tab: string | null; onExpand: () => void }) {
  const [fly, setFly] = useState<Flyout | null>(null);
  const fresh = useNewHrefs();
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

  return (
    <>
      <button type="button" onClick={onExpand} aria-label="Expand sidebar" className={icon(false)} {...hover("expand", label("Expand sidebar  ["))}>
        <PanelLeftOpen aria-hidden />
      </button>
      <ul className="mt-2 flex flex-col items-center gap-1">
        {MVP2_TOP.map(({ label: l, href, Icon }) => (
          <li key={href}>
            <Link href={href} aria-label={l} aria-current={path === href ? "page" : undefined} className={icon(path === href)} {...hover(href, label(l))}>
              <Icon aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-col items-center gap-1 border-t border-(--color-border-default) pt-3">
        {MVP2_GROUPS.map((g) => {
          const menu = (
            <div className="w-56 p-1.5">
              <p className="px-2 pt-1 pb-1.5 text-subtitle-xs text-(--color-text-secondary)">{g.label} coworker</p>
              <NestedLinks group={g} path={path} tab={tab} onFollow={() => setFly(null)} />
            </div>
          );
          return (
            <li key={g.id}>
              <Link href={firstHref(g)} aria-label={`${g.label} coworker`} className={cn(icon(groupOf(path) === g.id), "relative")} {...hover(g.id, menu)}>
                <g.Icon aria-hidden />
                {/* something new inside, until it's opened */}
                {g.items.some((i) => i.href && fresh.has(i.href)) && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-circle bg-(--color-primary) ring-2 ring-(--color-background-secondary)" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {fly && (
        <div role="menu" onMouseEnter={keep} onMouseLeave={close} style={{ top: fly.top, left: fly.left }} className="fixed z-50 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          {fly.content}
        </div>
      )}
    </>
  );
}

/** The ?tab= for the current-item check. Read under Suspense so the pages stay static. */
function WithTab({ children }: { children: (tab: string | null) => React.ReactNode }) {
  return children(useSearchParams().get("tab"));
}

export function Mvp2Sidebar() {
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

  const list = (tab: string | null) =>
    narrow ? <Narrow path={path} tab={tab} onExpand={() => setNarrow(false)} /> : <Workspace path={path} tab={tab} onCollapse={() => setNarrow(true)} />;
  return (
    <aside className={cn("hidden shrink-0 flex-col overflow-hidden border-r border-(--color-border-default) bg-(--color-background-primary) transition-[width] duration-200 ease-out lg:flex", narrow ? "w-14" : "w-[220px]")}>
      <nav aria-label="Workspace" className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto py-2", narrow ? "items-center px-2" : "px-3")}>
        <Suspense fallback={list(null)}>
          <WithTab>{list}</WithTab>
        </Suspense>
      </nav>
    </aside>
  );
}

/** The same list in the top-bar drawer under lg (always wide). */
export function Mvp2MobileNav() {
  const path = usePathname();
  return (
    <NavDrawer>
      {(close) => (
        <Suspense fallback={<Workspace path={path} tab={null} onFollow={close} />}>
          <WithTab>{(tab) => <Workspace path={path} tab={tab} onFollow={close} />}</WithTab>
        </Suspense>
      )}
    </NavDrawer>
  );
}
