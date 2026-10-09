"use client";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { asset } from "@/lib/asset";
import { usePathname, useRouter } from "next/navigation";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { STEP_HREF, STEP_ORDER, resumeHref, useOnboarding } from "@/lib/org/store";
import type { StepKey } from "@/lib/org/types";
import { SETUP_STEPS } from "./steps";

// Frame around every /onboarding page (Mercury's application header): logo, who's signed in,
// "Save and exit", and a brand-coloured hairline that fills as the setup steps are done.

const keyFor = (path: string) => (Object.entries(STEP_HREF).find(([, href]) => href === path)?.[0] ?? "business") as StepKey;

export function OnboardingChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { ready, state } = useOnboarding();
  const key = keyFor(path);

  // No skipping ahead: a step past the bookmark (or no account yet) sends the owner back to it.
  useEffect(() => {
    if (!ready || state.completed) return;
    if (!state.account.firstName || STEP_ORDER.indexOf(key) > STEP_ORDER.indexOf(state.step)) router.replace(resumeHref(state));
  }, [ready, state, key, router]);

  const index = SETUP_STEPS.findIndex((s) => s.key === key);
  const progress = key === "review" ? 1 : index < 0 ? 0 : index / SETUP_STEPS.length;
  const name = [state.account.firstName, state.account.lastName].filter(Boolean).join(" ");

  return (
    <ThemeShell className="flex min-h-screen flex-col bg-(--color-background-secondary) text-(--color-text-primary)">
      <header className="sticky top-0 z-30 bg-(--color-background-secondary)">
        <div className="flex h-16 items-center justify-between px-6 sm:px-10">
          <Image src={asset("/get-started/logo.svg")} alt="KoreFi" width={84} height={20} priority unoptimized className="[.dark_&]:invert" />
          <div className="flex items-center gap-5 text-body-md">
            {name && <span className="hidden text-(--color-text-secondary) sm:inline">{name}</span>}
            <ThemeToggle />
            {key !== "ready" && (
              <Link href="/login" className="rounded-small text-(--color-text-primary) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                Save and exit
              </Link>
            )}
          </div>
        </div>
        {key !== "ready" && (
          <div className="h-0.5 bg-(--color-border-default)" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="h-full bg-(--color-primary-solid) transition-[width] duration-500" style={{ width: `${Math.max(progress, 0.04) * 100}%` }} />
          </div>
        )}
      </header>
      {/* Hold the page until storage is read, so it never flashes empty answers. */}
      <div className="flex flex-1 flex-col">{ready ? children : null}</div>
    </ThemeShell>
  );
}
