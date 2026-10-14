"use client";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Database, LayoutDashboard, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { signOut, useSession } from "@/lib/admin/session";

// KoreFi ops admin. Only @karboncard.com logins get in; everyone else is sent to /login.
// Same frame as the owner app (src/app/(app)/layout.tsx) with its own sidebar.

// Sidebar as designed (Figma 1431:28101): Dashboard, Users, then the Data ingestion group.
const TOP = [
  { label: "Dashboard", href: "/admin", Icon: LayoutDashboard, exact: true },
  { label: "Users", href: "/admin/users", Icon: Users, exact: false },
];
const INGESTION = [{ label: "File uploads", href: "/admin/uploads" }];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, email, isAdmin } = useSession();
  const inIngestion = INGESTION.some((i) => pathname.startsWith(i.href));

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/login");
  }, [ready, isAdmin, router]);

  return (
    <ThemeShell product="ops" className="flex h-screen flex-col overflow-hidden border-t-[3px] border-(--color-primary) bg-(--color-background-secondary) text-(--color-text-primary)">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3 lg:h-[42px] lg:pt-1.5 lg:pb-1">
        <div className="flex items-center gap-2.5">
          <Image src={asset("/dashboard/korefi-logo.svg")} alt="KoreFi" width={83.88} height={20} priority unoptimized className="ml-1 shrink-0 [.dark_&]:invert" />
          <span className="rounded-small bg-(--color-primary) px-1.5 py-0.5 text-body-sm font-medium text-white">Ops</span>
        </div>
        {ready && isAdmin && (
          <div className="flex items-center gap-3">
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
          <nav aria-label="Admin" className="hidden w-[200px] shrink-0 flex-col gap-1 border-r border-(--color-border-default) bg-(--color-background-primary)/50 p-2 md:flex">
            <p className="px-2 pt-1.5 pb-2 text-body-sm text-(--color-text-secondary)">Workspace</p>
            {TOP.map(({ label, href, Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex h-[30px] items-center gap-2 rounded-medium px-2 text-body-md", active ? "bg-(--color-primary)/12 text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)")}>
                  <Icon className={cn("size-3.5", active && "text-(--color-text-clickable)")} aria-hidden />
                  {label}
                </Link>
              );
            })}
            <div className={cn("flex h-[30px] items-center justify-between rounded-medium px-2 text-body-md", inIngestion ? "bg-(--color-primary)/12 text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
              <span className="flex items-center gap-2">
                <Database className={cn("size-3.5", inIngestion && "text-(--color-text-clickable)")} aria-hidden />
                Data ingestion
              </span>
              <ChevronDown className="size-4" aria-hidden />
            </div>
            <div className="flex flex-col">
              {INGESTION.map(({ label, href }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("relative flex h-[34px] items-center pl-[30px] text-body-md", active ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)")}>
                    <span aria-hidden className="absolute top-0 bottom-0 left-[13px] w-0.5 bg-(--color-border-default)" />
                    {active && <span aria-hidden className="absolute top-2 bottom-2 left-[13px] w-0.5 bg-(--color-primary)" />}
                    {label}
                  </Link>
                );
              })}
            </div>
            <Link href="/home" className="mt-auto flex h-9 items-center gap-2 rounded-medium px-2 text-body-sm text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
              <ArrowLeft className="size-3.5" aria-hidden />
              Customer view
            </Link>
          </nav>
          <main className="flex min-w-0 flex-1 flex-col">{ready && isAdmin ? children : null}</main>
        </div>
      </div>
    </ThemeShell>
  );
}
