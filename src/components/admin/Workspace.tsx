"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Eye, LayoutDashboard, MapPinned, ShieldAlert, UploadCloud, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { MVP2_GROUPS, MVP2_TOP } from "@/lib/nav";
import type { Account } from "@/lib/admin/accounts";
import { clearClient } from "@/lib/admin/client";
import { requestUpload } from "@/lib/admin/pending";
import { useTasks } from "@/lib/admin/tasks";

// The user workspace (StanfordTax's "binder"): everything ops do for one user, reached from the
// Dashboard. The side panel, top to bottom:
//   ← Dashboard        the way back, always in the same place;
//   Ops | User's view  Ops view (default) is where ops work on the user. Work: Overview (their to-dos,
//                      summary, details, activity), Chargebacks (update disputes), File uploads; Account:
//                      Outlets, Details. Counts show what's waiting. Then a drop zone for reports.
//                      User's view is a read-only copy of the user's own dashboard (MVP 2's pages and
//                      nav, under /admin/as), with their data, so ops see exactly what the user sees;
//   sections           for the chosen view.
// Which user is in the header switcher (⌘K). Below md the panel is hidden and WorkspaceMobileBar
// gives the back link and the view toggle.

type Item = { label: string; href: string; Icon: typeof LayoutDashboard; group: "Work" | "Account"; tabs?: { label: string; tab: string }[] };

// Ops view, grouped like a practice tool's client page (Mobbin: Lightfield, Twenty, Attio): the work
// first, each with a count of what's waiting; then who the user is.
export const WORKSPACE: Item[] = [
  { label: "Overview", href: "/admin/overview", Icon: LayoutDashboard, group: "Work" },
  { label: "Chargebacks", href: "/admin/chargebacks", Icon: ShieldAlert, group: "Work" },
  { label: "File uploads", href: "/admin/uploads", Icon: UploadCloud, group: "Work" },
  { label: "Outlets", href: "/admin/outlets", Icon: MapPinned, group: "Account" },
  { label: "Details", href: "/admin/client", Icon: Building2, group: "Account" },
];
/** The user's own dashboard (MVP 2's nav), mounted under /admin/as. "Soon" items have no page. */
export const USER_VIEW_BASE = "/admin/as";
const asUser = (href: string) => href.replace(/^\/mvp2/, USER_VIEW_BASE);
const USER_TOP = MVP2_TOP.map((i) => ({ ...i, href: asUser(i.href) }));
const USER_GROUPS = MVP2_GROUPS.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, href: i.href && asUser(i.href) })) }));

export const isUserView = (path: string) => path.startsWith(USER_VIEW_BASE);
export const isWorkspacePage = (path: string) => isUserView(path) || WORKSPACE.some((p) => path.startsWith(p.href));

function BackLink({ className }: { className?: string }) {
  return (
    <Link href="/admin" onClick={clearClient} className={cn("inline-flex items-center gap-1.5 rounded-medium text-body-md text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", className)}>
      <ArrowLeft className="size-4" aria-hidden />
      Dashboard
    </Link>
  );
}

/** Ops view (where ops work) or User's view (what the user sees), as MVP 2's Segmented control. */
function ViewToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const user = isUserView(pathname);
  const opts = [
    { key: "ops", label: "Ops view", Icon: Wrench, href: "/admin/overview" },
    { key: "user", label: "User's view", Icon: Eye, href: `${USER_VIEW_BASE}/overview` },
  ] as const;
  return (
    <div role="tablist" aria-label="View" className={cn("flex h-8 items-center rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-0.5", className)}>
      {opts.map((o) => {
        const on = (o.key === "user") === user;
        return (
          <Link
            key={o.key}
            href={o.href}
            role="tab"
            aria-selected={on}
            className={cn("flex h-full flex-1 items-center justify-center gap-1.5 rounded-small px-2.5 text-menu-sm whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", on ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)")}
          >
            <o.Icon className="size-3.5" aria-hidden />
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/** The user's own nav: Overview, then MVP 2's coworker groups with their reports. */
function UserViewLinks({ pathname, tab }: { pathname: string; tab: string }) {
  const current = (href: string) => {
    const [path, q] = href.split("?");
    return pathname === path && (new URLSearchParams(q ?? "").get("tab") ?? "") === tab;
  };
  const row = (on: boolean) => cn("flex h-[30px] items-center gap-2 rounded-medium px-2 text-body-md", on ? "bg-(--color-primary)/12 text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)");
  return (
    <>
      {USER_TOP.map(({ label, href, Icon }) => (
        <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} className={row(current(href))}>
          <Icon className={cn("size-3.5", current(href) && "text-(--color-text-clickable)")} aria-hidden />
          {label}
        </Link>
      ))}
      {USER_GROUPS.map((g) => (
        <div key={g.id} className="mt-2">
          <p className="flex items-center gap-2 px-2 pb-1 text-body-sm text-(--color-text-tertiary)">
            <g.Icon className="size-3.5" aria-hidden />
            {g.label}
          </p>
          {g.items.map((i) =>
            i.href ? (
              <Link key={i.label} href={i.href} aria-current={current(i.href) ? "page" : undefined} className={cn(row(current(i.href)), "pl-[30px]")}>
                {i.label}
              </Link>
            ) : (
              <span key={i.label} className="flex h-[30px] items-center gap-2 pr-2 pl-[30px] text-body-md text-(--color-text-tertiary)">
                {i.label}
                <span className="ml-auto rounded-small bg-(--color-neutral-light) px-1.5 py-px text-[10px] font-medium tracking-wide uppercase">Soon</span>
              </span>
            ),
          )}
        </div>
      ))}
    </>
  );
}

/** Left panel: the way back, who you're working on (switch from here), their sections, a drop zone. */
export function WorkspaceNav({ a }: { a: Account }) {
  const pathname = usePathname();
  const router = useRouter();
  const tab = useSearchParams().get("tab") ?? "";

  const upload = (f?: File) => {
    requestUpload(f);
    if (pathname.startsWith("/admin/uploads")) window.dispatchEvent(new Event("kf-admin-upload"));
    else router.push("/admin/uploads");
  };

  return (
    <nav aria-label={`${a.company} workspace`} className="hidden w-[248px] shrink-0 flex-col gap-1 border-r border-(--color-border-default) bg-(--color-background-primary)/50 p-2 md:flex">
      <BackLink className="mx-1 mt-1 mb-2 self-start px-1 py-0.5" />
      <ViewToggle className="mb-3" />
      {isUserView(pathname) ? <UserViewLinks pathname={pathname} tab={tab} /> : <OpsLinks a={a} pathname={pathname} tab={tab} upload={upload} />}
    </nav>
  );
}

/** Ops view's sections and the drop zone. */
function OpsLinks({ a, pathname, tab, upload }: { a: Account; pathname: string; tab: string; upload: (f?: File) => void }) {
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const go = useCallback((_: string, to: string) => router.push(to), [router]);
  const tasks = useTasks(go).filter((t) => t.accountId === a.id);
  const listed = a.restaurants.reduce((n, r) => n + r.outlets.length, 0) || a.outlets;
  // What's waiting in each section: urgent counts are red.
  const toFile = tasks.find((t) => t.cat === "chargebacks");
  const counts: Record<string, { n: number; urgent?: boolean } | undefined> = {
    Overview: tasks.length ? { n: tasks.length, urgent: tasks.some((t) => t.urgency <= 3) } : undefined,
    Chargebacks: toFile ? { n: Number(/^(\d+)/.exec(toFile.detail)?.[1] ?? 0), urgent: toFile.urgency <= 3 } : undefined,
    "File uploads": tasks.some((t) => t.cat === "files") ? { n: tasks.filter((t) => t.cat === "files").length, urgent: true } : undefined,
    Outlets: { n: listed },
  };
  return (
    <>
      {(["Work", "Account"] as const).map((g) => (
        <div key={g} className="mb-2">
          <p className="px-2 pb-1 text-body-sm text-(--color-text-tertiary)">{g}</p>
          {WORKSPACE.filter((i) => i.group === g).map(({ label, href, Icon, tabs }) => {
            const active = pathname.startsWith(href);
            const c = counts[label];
            return (
              <div key={href}>
                <Link href={href} aria-current={active && !tabs ? "page" : undefined} className={cn("flex h-[30px] items-center gap-2 rounded-medium px-2 text-body-md", active ? "bg-(--color-primary)/12 text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)")}>
                  <Icon className={cn("size-3.5", active && "text-(--color-text-clickable)")} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {c && <span className={cn("min-w-5 rounded-circle px-1.5 text-center text-body-sm tabular-nums", c.urgent ? "bg-(--color-danger-lightest) text-(--color-danger-darkest)" : "text-(--color-text-tertiary)")}>{c.n}</span>}
                </Link>
                {tabs && active && (
                  <div className="flex flex-col">
                    {tabs.map((t) => {
                      const on = tab === t.tab;
                      return (
                        <Link key={t.label} href={t.tab ? `${href}?tab=${t.tab}` : href} aria-current={on ? "page" : undefined} className={cn("relative flex h-[30px] items-center pl-[30px] text-body-md", on ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)")}>
                          <span aria-hidden className="absolute top-0 bottom-0 left-[13px] w-0.5 bg-(--color-border-default)" />
                          {on && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-[13px] w-0.5 bg-(--color-primary)" />}
                          {t.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Drop a report here to start an upload for this user. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
        className={cn("mt-auto flex flex-col items-center gap-1 rounded-medium border border-dashed px-3 py-4 text-center transition-colors", over ? "border-(--color-primary) bg-(--color-primary)/8" : "border-(--color-border-darker) bg-(--color-background-secondary)")}
      >
        <UploadCloud className="size-5 text-(--color-text-secondary)" aria-hidden />
        <p className="text-body-sm text-(--color-text-primary)">
          Drop a report or{" "}
          <button type="button" onClick={() => fileRef.current?.click()} className="text-(--color-text-clickable) hover:underline">
            browse
          </button>
        </p>
        <p className="text-body-sm text-(--color-text-tertiary)">CSV or XLSX export</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
      </div>
    </>
  );
}

/** Below md, where the panel is hidden: the way back and the view toggle in one slim bar. */
export function WorkspaceMobileBar() {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border-default) px-3 py-2 md:hidden">
      <BackLink className="shrink-0" />
      <ViewToggle className="ml-auto" />
    </div>
  );
}
