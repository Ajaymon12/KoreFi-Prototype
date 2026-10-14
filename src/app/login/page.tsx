"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthFrame } from "@/components/onboarding/AuthFrame";
import { LoginShowcase } from "@/components/onboarding/LoginShowcase";
import { resumeHref, useOnboarding } from "@/lib/org/store";
import { isAdminEmail, signIn } from "@/lib/admin/session";
import { OWNER_HOME } from "@/lib/nav";

// Mock login. Someone who left setup half-way ("Save and exit") picks up where they stopped;
// everyone else lands on the dashboard. KoreFi ops (@karboncard.com) go to the admin area.

export default function Login() {
  const router = useRouter();
  const { state } = useOnboarding();
  const resuming = Boolean(state.account.email) && !state.completed;

  return (
    <AuthFrame
      right={
        <Link href="/get-started" className="text-body-md text-(--color-text-primary) hover:underline">
          Create account
        </Link>
      }
    >
      <div className="flex w-full max-w-[910px] overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
        <div className="w-full shrink-0 px-6 pt-10 pb-8 sm:px-8 md:flex md:min-h-[556px] md:w-[455px] md:flex-col md:justify-center md:border-r md:border-(--color-border-default)">
          <h1 className="text-page-title text-(--color-text-primary)">Log in to KoreFi</h1>
          {resuming && <p className="mt-2 text-body-md text-(--color-text-secondary)">Your setup is saved. Log in to pick up where you left off.</p>}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get("email") ?? "");
              signIn(email);
              router.push(isAdminEmail(email) ? "/admin" : resuming ? resumeHref(state) : OWNER_HOME);
            }}
            className="mt-7 flex flex-col gap-4"
          >
            <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={state.account.email || "priya@pivotkitchen.com"} key={state.account.email} />
            <TextField label="Password" type="password" autoComplete="current-password" defaultValue="password" />
            <Button type="primary" size="medium" htmlType="submit" block className="mt-2">
              {resuming ? "Log in and continue setup" : "Log in"}
            </Button>
            <p className="text-body-sm text-(--color-text-secondary)">KoreFi team? Log in with your @karboncard.com email to open Ops admin.</p>
          </form>
        </div>
        <div className="relative hidden w-[455px] shrink-0 self-stretch bg-[#12100e] md:block">
          <LoginShowcase />
        </div>
      </div>
    </AuthFrame>
  );
}
