"use client";
import { usePath } from "@/lib/mvp3/usePath";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Blocks, Bot, ChartColumn, CalendarClock, FileText, House, LayoutDashboard, MessagesSquare, PanelLeftClose, PanelLeftOpen, Search, Settings, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavDrawer } from "@/components/shell/NavDrawer";
import { navItemClass } from "@/components/shell/navItem";
import { CHAT_BUCKETS, chatBucket, type Thread } from "@/lib/mvp3/agents";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { ChatSearch, openChatSearch } from "./ChatSearch";
import { useOnboarding } from "./Onboarding";
import { useAccount } from "./AccountSwitcher";
import { iconButton } from "@/components/mvp3/styles";

// MVP 3's sidebar, built like MVP 2's (components/shell/Mvp2Sidebar.tsx) with MVP 3's pages:
//  - "Workspace": Home (Taco Pros only), New chat, Search chats (ChatGPT-style dialog, also ⌘K) and Agents (presets, drafts, New agent).
//  - "Dashboards": what the owner pinned from a chat (shown once there is one).
//  - "Recent chats": every thread, unread ones bold with a dot. Picking one opens it on /mvp3.
//  - Integrations and Settings pinned to the bottom.
//  - A `limited` account (Masa Kitchen) drops New chat.
//  - Narrow mode: an icon column (button or "[", remembered per browser) with hover flyouts.

const HOME = "/";
/** The live summary page, above New chat. Only accounts with `home` (Taco Pros) get it. */
const HOME_PAGE = "/home";
const useHasHome = () => !!useAccount().account.home;
/** A `limited` account (Masa Kitchen) gets no New chat. */
const useLimited = () => !!useAccount().account.limited;

/** Where Home goes: the Home page, for every account with one (Masa Kitchen included). */
function useHomeNav(path: string) {
  return { href: HOME_PAGE, on: path === HOME_PAGE, onClick: undefined as (() => void) | undefined };
}

/** Open a pinned dashboard in its chat, with the dashboard in the canvas, and fold the sidebar to icons so the
 *  chat and dashboard get the room. False (do nothing) when the dashboard has no chat; the caller falls back to its page. */
export function useOpenPinned() {
  const { openDashboard } = useAgents();
  const router = useRouter();
  const path = usePath();
  return (id: string) => {
    if (!openDashboard(id)) return false;
    setNarrow(true);
    if (path !== HOME) router.push(HOME);
    return true;
  };
}
const AGENTS_HREF = "/agents";
const PNL_HREF = "/pnl";
/** Agents stays lit in the editor and on the old Drafts link. */
const onAgents = (path: string) => /^\/(agents|agent|drafts)\b/.test(path);
const dashHref = (id: string) => `/dashboard?id=${id}`;

/** Pinned dashboards, in the order they were built. Suspense: it reads ?id= (the static export needs a boundary). */
function PinnedList(props: { path: string; onFollow?: () => void; big?: boolean }) {
  return (
    <Suspense fallback={null}>
      <PinnedRows {...props} />
    </Suspense>
  );
}
function PinnedRows({ path, onFollow, big = false }: { path: string; onFollow?: () => void; big?: boolean }) {
  const { dashboards, active, canvas } = useAgents();
  const id = useSearchParams().get("id");
  const openPinned = useOpenPinned();
  const hasHome = useHasHome();
  const pinned = dashboards.filter((d) => d.pinned);
  if (!pinned.length) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {pinned.map((d) => {
        const on = (path.startsWith("/dashboard") && id === d.id) || (path === HOME && !!d.thread && active?.id === d.thread && canvas === (d.report ?? `dash:${d.id}`));
        return (
          <li key={d.id}>
            <Link
              href={dashHref(d.id)}
              onClick={(e) => {
                // Taco Pros: open the dashboard in its chat (chat left, dashboard right) with the sidebar folded.
                if (hasHome && openPinned(d.id)) e.preventDefault();
                onFollow?.();
              }}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-(--module-radius) outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-4",
                big ? "min-h-11 px-3 text-body-md" : "h-[30px] px-3 text-menu-md",
                on ? "bg-(--module-tint) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
              )}
            >
              {d.report ? <FileText aria-hidden className="shrink-0" /> : <LayoutDashboard aria-hidden className="shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              {d.automation && <CalendarClock aria-label={d.automation.schedule} className="!size-3.5 shrink-0 text-(--color-text-tertiary)" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
const BOTTOM = [
  { href: "/integrations", label: "Integrations", Icon: Blocks },
  { href: "/settings", label: "Settings", Icon: Settings },
];
const useBottom = () => BOTTOM;

// ---- Narrow mode, remembered per browser ----

const KEY = "kf-mvp3-sidebar";
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

export function StatusDot({ status }: { status: "watching" | "learning" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-body-sm font-normal", status === "watching" ? "text-(--color-text-success)" : "text-(--color-text-secondary)")}>
      <span className={cn("relative size-1.5 rounded-circle", status === "watching" ? "bg-(--color-success-default)" : "bg-(--color-border-darker)")}>
        {status === "watching" && <span className="absolute inset-0 rounded-circle bg-(--color-success-default) motion-safe:animate-ping" />}
      </span>
      {status === "watching" ? "Watching" : "Learning"}
    </span>
  );
}

/** Open a chat or start a new one; both live on /mvp3, so come back there from another page. */
function useGo() {
  const path = usePath();
  const router = useRouter();
  return (fn: () => void) => {
    fn();
    if (path !== HOME) router.push(HOME);
  };
}

/** New chat, and whether the home's empty chat is showing. Once the welcome chat is in Recent chats,
 *  New chat leaves it for a fresh home (before that, the welcome chat is the new chat). */
function useNewChat(path: string) {
  const { active, newChat } = useAgents();
  const { stage, welcomeChat, finish } = useOnboarding();
  const inWelcome = stage === "welcome" && welcomeChat !== null;
  const start = () => {
    newChat();
    if (welcomeChat) finish();
  };
  return { start, on: path === HOME && !active && !inWelcome };
}

function TopLinks({ path, onFollow }: { path: string; onFollow?: () => void }) {
  const fresh = useNewChat(path);
  const go = useGo();
  const hasHome = useHasHome();
  const limited = useLimited();
  const home = useHomeNav(path);
  return (
    <ul data-tour="workspace" className="flex flex-col gap-1">
      {hasHome && (
        <li>
          <Link
            href={home.href}
            onClick={() => {
              home.onClick?.();
              onFollow?.();
            }}
            aria-current={home.on ? "page" : undefined}
            className={navItemClass(home.on)}
          >
            <House aria-hidden />
            Home
          </Link>
        </li>
      )}
      {!limited && (
        <li>
          <button
            type="button"
            onClick={() => {
              go(fresh.start);
              onFollow?.();
            }}
            aria-current={fresh.on ? "page" : undefined}
            className={cn(navItemClass(fresh.on), "outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)")}
          >
            <SquarePen aria-hidden />
            New chat
          </button>
        </li>
      )}
      <li>
        <button
          type="button"
          onClick={() => {
            onFollow?.();
            openChatSearch();
          }}
          className={cn(navItemClass(false), "group/search outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)")}
        >
          <Search aria-hidden />
          Search chats
          <kbd className="ml-auto font-sans text-[11px] text-(--color-text-tertiary) opacity-0 transition-opacity group-hover/search:opacity-100">⌘K</kbd>
        </button>
      </li>
      <li>
        <Link href={AGENTS_HREF} onClick={onFollow} aria-current={onAgents(path) ? "page" : undefined} className={navItemClass(onAgents(path))}>
          <Bot aria-hidden />
          Agents
        </Link>
      </li>
      <li>
        <Link href={PNL_HREF} onClick={onFollow} aria-current={path === PNL_HREF ? "page" : undefined} className={navItemClass(path === PNL_HREF)}>
          <ChartColumn aria-hidden />
          P&amp;L
        </Link>
      </li>
    </ul>
  );
}

function BottomLinks({ path, onFollow }: { path: string; onFollow?: () => void }) {
  const bottom = useBottom();
  return (
    <ul data-tour="settings" className="flex flex-col gap-1 pt-2">
      {bottom.map(({ href, label, Icon }) => (
        <li key={href}>
          <Link href={href} onClick={onFollow} aria-current={path.startsWith(href) ? "page" : undefined} className={navItemClass(path.startsWith(href))}>
            <Icon aria-hidden />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Every thread, newest first. Used in the wide sidebar, the narrow flyout and the phone drawer. */
function ChatList({ path, onFollow, big = false }: { path: string; onFollow?: () => void; big?: boolean }) {
  const { threads: all, active, open, newChat } = useAgents();
  const threads = all.filter((t) => !t.hidden);
  const { stage, welcomeChat, openWelcome } = useOnboarding();
  const go = useGo();
  const row = (on: boolean, bold = false) =>
    cn(
      "flex w-full items-center gap-2 rounded-(--module-radius) text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
      big ? "min-h-11 px-3 text-body-md" : "h-[30px] px-3 text-menu-md",
      on ? "bg-(--module-tint) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
      bold && "font-medium text-(--color-text-primary)",
    );
  const welcomeOn = path === HOME && !active && stage === "welcome";
  // Grouped by when they happened: Today, Yesterday, Previous 30 days. A heading shows only when there's more than one group.
  const groups = CHAT_BUCKETS.map((b) => ({ b, items: threads.filter((t) => chatBucket(t.at) === b) })).filter((g) => g.items.length);
  const headed = groups.length > 1;
  const rows = groups.flatMap((g) => [{ head: g.b } as const, ...g.items.map((t) => ({ t }))]);
  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((r, i) => {
        if ("head" in r) {
          if (!headed) return null;
          return (
            <li key={`h-${r.head}`} role="presentation" className={cn("px-3 text-body-sm text-(--color-text-tertiary)", i > 0 ? "pt-3 pb-1" : "pb-1")}>
              {r.head}
            </li>
          );
        }
        const t: Thread = r.t;
        const on = path === HOME && active?.id === t.id;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => {
                go(() => open(t.id));
                onFollow?.();
              }}
              aria-current={on ? "page" : undefined}
              title={t.title}
              className={row(on, t.unread)}
            >
              <AgentAvatar agent={t.agent} size={big ? 24 : 16} />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              {t.unread && <span aria-label="Unread" className="size-1.5 shrink-0 rounded-circle bg-(--color-primary)" />}
            </button>
          </li>
        );
      })}
      {/* The welcome chat, once the owner has answered in it. It's the oldest chat, so it sits last. */}
      {welcomeChat && (
        <li>
          <button
            type="button"
            onClick={() => {
              go(() => {
                newChat();
                openWelcome();
              });
              onFollow?.();
            }}
            aria-current={welcomeOn ? "page" : undefined}
            title={welcomeChat}
            className={row(welcomeOn)}
          >
            <AgentAvatar agent="operations" size={big ? 24 : 16} />
            <span className="min-w-0 flex-1 truncate">{welcomeChat}</span>
          </button>
        </li>
      )}
    </ul>
  );
}

function PinnedSection({ path, big = false, onFollow }: { path: string; big?: boolean; onFollow?: () => void }) {
  const { dashboards } = useAgents();
  // Nothing pinned at the start (leadership flows, 2026-11-20): the heading stays, with a hint.
  const none = !dashboards.some((d) => d.pinned);
  return (
    <>
      <p className={cn("pt-4 pb-2 text-body-sm text-(--color-text-secondary)", big ? "px-3 pt-5 pb-1.5" : "px-2")}>Dashboards</p>
      {none ? <p className={cn("pb-1 text-body-sm text-(--color-text-tertiary)", big ? "px-3" : "px-2")}>Pin a dashboard to keep it here.</p> : <PinnedList path={path} big={big} onFollow={onFollow} />}
    </>
  );
}

/** The full list: Workspace, Dashboards, Chats, then Integrations and Settings. */
function Workspace({ path, onCollapse }: { path: string; onCollapse: () => void }) {
  // Workspace, Dashboards and the Recent chats heading stay put at the top, Integrations and Settings at the bottom; only the chats scroll.
  // The bottom links cast a soft shadow only while chats run on below them; a short list gets no separator.
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);
  return (
    <>
      <div className="shrink-0">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <p className="text-body-sm text-(--color-text-secondary)">Workspace</p>
          <button type="button" onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar  [" className={cn(iconButton, "-mr-1 size-7")}>
            <PanelLeftClose className="size-4" aria-hidden />
          </button>
        </div>
        <TopLinks path={path} />
        <PinnedSection path={path} />
      </div>
      <div data-tour="chats" className="flex min-h-0 flex-1 flex-col">
        <p className="shrink-0 px-2 pt-4 pb-2 text-body-sm text-(--color-text-secondary)">Recent chats</p>
        <div ref={scroller} className="-mx-3 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          <div>
            <ChatList path={path} />
          </div>
        </div>
      </div>
      <div className={cn("relative z-10 -mx-3 shrink-0 bg-(--color-background-primary) px-3 pb-1 transition-shadow duration-200", more && "shadow-[0_-8px_16px_-8px_rgb(0_0_0/0.12)]")}>
        <BottomLinks path={path} />
      </div>
    </>
  );
}

// ---- Narrow mode ----

type Flyout = { key: string; top: number; left: number; content: React.ReactNode };

/** Icon column with hover flyouts. Flyouts are `fixed` so the panel's overflow can't clip them. */
function Narrow({ path, onExpand }: { path: string; onExpand: () => void }) {
  const { threads, active, dashboards, canvas } = useAgents();
  const { stage, welcomeChat } = useOnboarding();
  const fresh = useNewChat(path);
  const go = useGo();
  const hasHome = useHasHome();
  const limited = useLimited();
  const bottom = useBottom();
  const home = useHomeNav(path);
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
  const unread = threads.filter((t) => t.unread && !t.hidden).length;

  const icon = (current: boolean) =>
    cn(
      "relative grid size-9 place-items-center rounded-(--module-radius) outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-4",
      current ? "bg-(--module-tint) text-(--module-strong)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
    );
  const label = (text: string) => <span className="block px-2.5 py-1.5 text-menu-md whitespace-nowrap text-(--color-text-primary)">{text}</span>;
  // A pinned dashboard open in its chat lights Dashboards, not Recent chats.
  const dashOpen = hasHome && path === HOME && dashboards.some((d) => d.pinned && d.thread === active?.id && canvas === (d.report ?? `dash:${d.id}`));
  const onChats = path === HOME && !dashOpen && (!!active || (stage === "welcome" && welcomeChat !== null));

  return (
    <>
      <button type="button" onClick={onExpand} aria-label="Expand sidebar" className={icon(false)} {...hover("expand", label("Expand sidebar  ["))}>
        <PanelLeftOpen aria-hidden />
      </button>
      <ul className="mt-2 flex flex-col items-center gap-1">
        {hasHome && (
          <li>
            <Link href={home.href} onClick={home.onClick} aria-label="Home" aria-current={home.on ? "page" : undefined} className={icon(home.on)} {...hover("home", label("Home"))}>
              <House aria-hidden />
            </Link>
          </li>
        )}
        {!limited && (
          <li>
            <button type="button" onClick={() => go(fresh.start)} aria-label="New chat" className={icon(fresh.on)} {...hover("new", label("New chat"))}>
              <SquarePen aria-hidden />
            </button>
          </li>
        )}
        <li>
          <button type="button" onClick={openChatSearch} aria-label="Search chats" className={icon(false)} {...hover("search", label("Search chats  ⌘K"))}>
            <Search aria-hidden />
          </button>
        </li>
        <li>
          <Link href={AGENTS_HREF} aria-label="Agents" className={icon(onAgents(path))} {...hover("agents", label("Agents"))}>
            <Bot aria-hidden />
          </Link>
        </li>
        <li>
          <Link href={PNL_HREF} aria-label="P&L" className={icon(path === PNL_HREF)} {...hover("pnl", label("P&L"))}>
            <ChartColumn aria-hidden />
          </Link>
        </li>
        {(
          <li>
            <button
              type="button"
              aria-label="Dashboards"
              className={icon(path.startsWith("/dashboard") || dashOpen)}
              {...hover(
                "dashboards",
                <div className="w-60 p-1.5">
                  <p className="px-2 pt-1 pb-1.5 text-subtitle-xs text-(--color-text-secondary)">Dashboards</p>
                  {dashboards.some((d) => d.pinned) ? <PinnedList path={path} onFollow={() => setFly(null)} /> : <p className="px-2 pb-1.5 text-body-sm text-(--color-text-tertiary)">Pin a dashboard to keep it here.</p>}
                </div>,
              )}
            >
              <LayoutDashboard aria-hidden />
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            aria-label={unread ? `Recent chats, ${unread} unread` : "Recent chats"}
            className={icon(onChats)}
            {...hover(
              "chats",
              <div className="w-64 p-1.5">
                <p className="px-2 pt-1 pb-1.5 text-subtitle-xs text-(--color-text-secondary)">Recent chats</p>
                <div className="max-h-[60vh] overflow-y-auto">
                  <ChatList path={path} onFollow={() => setFly(null)} />
                </div>
              </div>,
            )}
          >
            <MessagesSquare aria-hidden />
            {unread > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-circle bg-(--color-primary) ring-2 ring-(--color-background-primary)" />}
          </button>
        </li>
      </ul>
      <ul className="mt-auto flex flex-col items-center gap-1 pt-3">
        {bottom.map(({ href, label: l, Icon }) => (
          <li key={href}>
            <Link href={href} aria-label={l} aria-current={path.startsWith(href) ? "page" : undefined} className={icon(path.startsWith(href))} {...hover(href, label(l))}>
              <Icon aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {fly && (
        <div role="menu" onMouseEnter={keep} onMouseLeave={close} style={{ top: fly.top, left: fly.left }} className="fixed z-50 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          {fly.content}
        </div>
      )}
    </>
  );
}

export function Mvp3Sidebar() {
  const path = usePath();
  const narrow = useNarrow();

  // "[" folds and unfolds the sidebar, unless the user is typing (the composer is a textarea).
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
    <aside className={cn("hidden shrink-0 flex-col overflow-hidden border-r border-(--color-border-default) bg-(--color-background-primary) transition-[width] duration-200 ease-out lg:flex", narrow ? "w-14" : "w-[220px]")}>
      <nav aria-label="Workspace" className={cn("flex min-h-0 flex-1 flex-col py-2", narrow ? "items-center overflow-y-auto px-2" : "px-3")}>
        {narrow ? <Narrow path={path} onExpand={() => setNarrow(false)} /> : <Workspace path={path} onCollapse={() => setNarrow(true)} />}
      </nav>
      {/* rendered into <body>, so it works under lg too, where this sidebar is hidden */}
      <ChatSearch />
    </aside>
  );
}

// ---- Phone drawer ----

/** The same pages in the top-bar drawer under lg, built for a thumb like MVP 2's drawer: 48px rows, the current
 *  page a tinted row. */
function MobileWorkspace({ path, onFollow }: { path: string; onFollow: () => void }) {
  const fresh = useNewChat(path);
  const go = useGo();
  const row = "flex min-h-12 w-full items-center gap-3 rounded-medium px-3 text-left text-body-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";
  const tile = (on: boolean) => cn("grid size-8 shrink-0 place-items-center rounded-(--module-radius) [&_svg]:size-4", on ? "bg-(--module-tint) text-(--module-strong)" : "bg-(--color-neutral-lightest) text-(--color-text-secondary)");
  const rowOn = (on: boolean) => cn(row, on ? "bg-(--module-tint) font-medium text-(--color-text-primary)" : "text-(--color-text-primary) active:bg-(--color-neutral-light)");
  const homeOn = fresh.on;
  const hasHome = useHasHome();
  const limited = useLimited();
  const bottom = useBottom();
  const home = useHomeNav(path);
  // The drawer sits in the top bar, outside the page's data-module, so it carries the module's tints itself.
  return (
    <div data-module="mvp">
      <p className="px-3 pt-1 pb-1.5 text-body-sm text-(--color-text-secondary)">Workspace</p>
      <ul>
        {hasHome && (
          <li>
            <Link
              href={home.href}
              onClick={() => {
                home.onClick?.();
                onFollow();
              }}
              aria-current={home.on ? "page" : undefined}
              className={rowOn(home.on)}
            >
              <span className={tile(home.on)}>
                <House aria-hidden />
              </span>
              Home
            </Link>
          </li>
        )}
        {!limited && (
          <li>
            <button
              type="button"
              onClick={() => {
                go(fresh.start);
                onFollow();
              }}
              aria-current={homeOn ? "page" : undefined}
              className={rowOn(homeOn)}
            >
              <span className={tile(homeOn)}>
                <SquarePen aria-hidden />
              </span>
              New chat
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            onClick={() => {
              onFollow();
              openChatSearch();
            }}
            className={rowOn(false)}
          >
            <span className={tile(false)}>
              <Search aria-hidden />
            </span>
            Search chats
          </button>
        </li>
        {[{ href: AGENTS_HREF, label: "Agents", Icon: Bot }, { href: PNL_HREF, label: "P&L", Icon: ChartColumn }, ...bottom].map(({ href, label, Icon }) => {
          const on = href === AGENTS_HREF ? onAgents(path) : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} onClick={onFollow} aria-current={on ? "page" : undefined} className={rowOn(on)}>
                <span className={tile(on)}>
                  <Icon aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <PinnedSection path={path} onFollow={onFollow} big />
      <p className="px-3 pt-5 pb-1.5 text-body-sm text-(--color-text-secondary)">Recent chats</p>
      <ChatList path={path} onFollow={onFollow} big />
    </div>
  );
}

export function Mvp3MobileNav() {
  const path = usePath();
  return (
    <NavDrawer>
      {(close) => <MobileWorkspace path={path} onFollow={close} />}
    </NavDrawer>
  );
}
