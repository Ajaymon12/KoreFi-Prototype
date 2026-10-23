import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

// Mercury's account-creation frame: logo top-left, "Log in" top-right, one white card on a soft
// canvas asking one thing at a time.

export function AuthFrame({ children, right, backdrop }: { children: React.ReactNode; right?: React.ReactNode; backdrop?: React.ReactNode }) {
  return (
    <ThemeShell className="relative isolate flex min-h-screen flex-col bg-(--color-background-primary) text-(--color-text-primary)">
      {backdrop && <div className="absolute inset-0 -z-10 overflow-hidden">{backdrop}</div>}
      <header className="flex h-[72px] shrink-0 items-center justify-between px-6 sm:px-12">
        <Image src={asset("/get-started/logo.svg")} alt="KoreFi" width={84} height={20} priority unoptimized className="ml-2 [.dark_&]:invert" />
        <div className="flex items-center gap-5">
          <ThemeToggle />
          {right ?? (
          <Link href="/login" className="flex items-center gap-1 rounded-small text-body-md text-(--color-text-primary) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            Log in
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          )}
        </div>
      </header>
      {/* Card sits in the optical centre of tall screens (a little above true centre) and simply
          flows from the top on short ones — auto margins never push it off-screen. */}
      <main className="flex flex-1 px-3 pt-8 pb-10 sm:pb-[8vh]">
        <div className="m-auto flex w-full justify-center">{children}</div>
      </main>
    </ThemeShell>
  );
}

export function AuthCard({ title, description, children, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-[440px] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-6 py-8 sm:px-8", className)}>
      <h1 className="text-page-title text-(--color-text-primary)">{title}</h1>
      {description && <p className="mt-2 text-body-md text-(--color-text-secondary)">{description}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}
