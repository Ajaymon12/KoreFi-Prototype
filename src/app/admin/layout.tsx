"use client";
import { Suspense, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Eye, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { signOut, useSession } from "@/lib/admin/session";
import { ClientSwitcher } from "@/components/admin/ClientSwitcher";
import { WorkspaceMobileBar, WorkspaceNav, isUserView, isWorkspacePage } from "@/components/admin/Workspace";
import { selectClient, useClient } from "@/lib/admin/client";

// KoreFi ops admin. Only @karboncard.com logins get in; everyone else is sent to /login.
// Same frame as the owner app (src/app/(app)/layout.tsx) with its own sidebar.

// Two levels, like StanfordTax's binders:
//   Dashboard (/admin) — no sidebar; Overview (chargeback filing across users, what needs attention)
//   and Users (every user) as tabs; Add user.
//   User workspace — opening a user (lib/admin/client) swaps the sidebar for that user's panel
//   (components/admin/Workspace): ← Dashboard, an Ops view / User's view toggle, then that view's
//   sections. Ops view: Overview, Chargebacks (update disputes), File uploads, Outlets, Account. User's
//   view: a read-only copy of the user's own dashboard. The header switcher (⌘K) changes user, shown
//   in the header on every page; User's view (/admin/as) adds a "viewing as" strip;
//   a workspace page with no user open goes back to the Dashboard.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, email, isAdmin } = useSession();
  const { client } = useClient();
  const clientPage = isWorkspacePage(pathname);

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/login");
  }, [ready, isAdmin, router]);

  // ?client= opens that user (shared links); a workspace page with no user open goes back to the Dashboard.
  useEffect(() => {
    if (!ready) return;
    const linked = new URLSearchParams(window.location.search).get("client");
    if (linked && linked !== client?.id) selectClient(linked);
    else if (clientPage && !client) router.replace("/admin");
  }, [ready, client, clientPage, pathname, router]);

  return (
    <ThemeShell product="ops" className="flex h-screen flex-col overflow-hidden border-t-[3px] border-(--color-primary) bg-(--color-background-secondary) text-(--color-text-primary)">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3 lg:h-[42px] lg:pt-1.5 lg:pb-1">
        <div className="flex items-center gap-2.5">
          <Image src={asset("/dashboard/korefi-logo.svg")} alt="KoreFi" width={83.88} height={20} priority unoptimized className="ml-1 shrink-0 [.dark_&]:invert" />
          <span className="rounded-small bg-(--color-primary) px-1.5 py-0.5 text-body-sm font-medium text-white">Ops</span>
        </div>
        {ready && isAdmin && (
          <div className="flex items-center gap-3">
            <ClientSwitcher />
            <ThemeToggle />
            <span className="hidden text-body-sm text-(--color-text-secondary) sm:inline">{email}</span>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/login");
              }}
              className="flex h-7 items-center gap-1.5 rounded-medium px-2 text-body-sm text-(--color-text-secondary) hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary)"
            >
              <LogOut className="size-3.5" aria-hidden />
              Log out
            </button>
          </div>
        )}
      </header>
      <div className="flex min-h-0 flex-1 px-0 pb-0 sm:px-2 sm:pb-2 lg:pt-1">
        <div className="flex min-w-0 flex-1 overflow-hidden border-t border-(--color-border-default) bg-(--color-background-secondary) sm:rounded-medium sm:border">
          {clientPage && client ? (
            <Suspense fallback={null}>
              <WorkspaceNav a={client} />
            </Suspense>
          ) : pathname === "/admin" ? null : (
            <nav aria-label="Admin" className="hidden w-[220px] shrink-0 flex-col gap-1 border-r border-(--color-border-default) bg-(--color-background-primary)/50 p-2 md:flex">
              <p className="px-2 pt-1.5 pb-2 text-body-sm text-(--color-text-secondary)">Workspace</p>
              <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined} className={cn("flex h-[30px] items-center gap-2 rounded-medium px-2 text-body-md", pathname === "/admin" ? "bg-(--color-primary)/12 text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)")}>
                <LayoutDashboard className={cn("size-3.5", pathname === "/admin" && "text-(--color-text-clickable)")} aria-hidden />
                Dashboard
              </Link>
              <Link href="/home" className="mt-auto flex h-9 items-center gap-2 rounded-medium px-2 text-body-sm text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
                <ArrowLeft className="size-3.5" aria-hidden />
                Customer view
              </Link>
            </nav>
          )}
          <main className="flex min-w-0 flex-1 flex-col">
            {ready && isAdmin && clientPage && client && <WorkspaceMobileBar />}
            {ready && isAdmin && client && isUserView(pathname) && (
              <p className="flex shrink-0 items-center justify-center gap-1.5 border-b border-(--color-border-default) bg-(--color-primary)/8 px-4 py-1.5 text-body-sm text-(--color-text-primary)">
                <Eye className="size-3.5 text-(--color-text-clickable)" aria-hidden />
                Viewing as {client.name} ({client.company}). This is their dashboard, read-only.
              </p>
            )}
            {ready && isAdmin && (!clientPage || client) ? children : null}
          </main>
        </div>
      </div>
    </ThemeShell>
  );
}

