"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthFrame } from "@/components/onboarding/AuthFrame";
import { SignupShowcase } from "@/components/onboarding/SignupShowcase";
import { EMPTY, update, useOnboarding } from "@/lib/org/store";

// Step A1 of onboarding: work email + password (Mercury asks for credentials first, the name on
// the card after). The "found money" showcase panel stays on this first screen only.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Stand-in for "already registered" until there's a backend. */
const TAKEN = ["priya@pivotkitchen.com"];
const RULES = [
  { label: "At least 10 characters", test: (p: string) => p.length >= 10 },
  { label: "One letter", test: (p: string) => /[a-z]/i.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
];

export default function GetStarted() {
  const { ready, state } = useOnboarding();
  return (
    <AuthFrame>
      <div className="flex w-full max-w-[910px] overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
        {/* Remount once storage is read so "Wrong email? Change it" comes back prefilled. */}
        <CredentialsForm key={ready ? "ready" : "ssr"} initialEmail={state.account.viaGoogle ? "" : state.account.email} />
        <div className="relative hidden w-[455px] shrink-0 self-stretch bg-[#12100e] md:block">
          <SignupShowcase />
        </div>
      </div>
    </AuthFrame>
  );
}

function CredentialsForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const emailProblem = !EMAIL.test(cleanEmail) ? "invalid" : TAKEN.includes(cleanEmail) ? "taken" : null;
  const passwordOk = RULES.every((r) => r.test(password));
  // Errors appear after the field is left or the form is sent, never while typing.
  const showEmailError = (touched.email || submitted) && emailProblem;
  const showRules = touched.password || submitted;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (emailProblem || !passwordOk) return;
    setBusy("email");
    setTimeout(() => {
      update({ ...EMPTY, account: { ...EMPTY.account, email: cleanEmail, hasPassword: true }, step: "profile" });
      router.push("/get-started/profile");
    }, 500);
  };

  // Mock Google sign-in: Google vouches for the email and the name, so we go straight to "About you".
  const google = () => {
    setBusy("google");
    setTimeout(() => {
      update({ ...EMPTY, account: { ...EMPTY.account, email: "jane.alvarez@gmail.com", firstName: "Jane", lastName: "Alvarez", viaGoogle: true }, step: "profile" });
      router.push("/get-started/profile");
    }, 700);
  };

  return (
    <form noValidate onSubmit={submit} className="w-full shrink-0 px-6 pt-10 pb-8 sm:px-8 md:w-[455px] md:border-r md:border-(--color-border-default)">
      <h1 className="text-page-title text-(--color-text-primary)">Create your KoreFi account</h1>
      <p className="mt-2 text-body-md text-(--color-text-secondary)">Start with your work email. You’ll add your restaurants and locations next.</p>

      <Button type="default" size="medium" block className="mt-8" loading={busy === "google"} disabled={busy !== null} iconLeft={<GoogleMark />} onClick={google}>
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-body-sm text-(--color-text-secondary)">
        <span className="h-px flex-1 bg-(--color-border-default)" />
        or
        <span className="h-px flex-1 bg-(--color-border-default)" />
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          label="Work email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@yourrestaurant.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={
            showEmailError &&
            (emailProblem === "taken" ? (
              <span>
                An account with this email already exists.{" "}
                <Link href="/login" className="underline">
                  Log in instead
                </Link>
              </span>
            ) : (
              "Enter a valid email, like jane@yourrestaurant.com"
            ))
          }
        />

        <div className="flex flex-col gap-2">
          <TextField
            label="Create password"
            type={show ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            aria-invalid={showRules && !passwordOk ? true : undefined}
            suffix={
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                className="flex size-8 items-center justify-center rounded-small text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            }
          />
          <ul aria-label="Password needs" className="flex flex-wrap gap-x-4 gap-y-1">
            {RULES.map((r) => {
              const met = r.test(password);
              const bad = showRules && !met;
              return (
                <li key={r.label} className={cn("flex items-center gap-1 text-body-sm", met ? "text-(--color-text-success)" : bad ? "text-(--color-text-danger)" : "text-(--color-text-secondary)")}>
                  {met ? <Check className="size-3.5" aria-hidden /> : bad ? <X className="size-3.5" aria-hidden /> : <span aria-hidden className="mx-1 size-1.5 rounded-circle bg-current" />}
                  {r.label}
                  <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Button type="primary" size="medium" htmlType="submit" block className="mt-8" loading={busy === "email"} disabled={busy !== null}>
        Create account
      </Button>

      <p className="mt-4 text-body-sm text-(--color-text-secondary)">
        By continuing you agree to KoreFi’s <span className="underline decoration-dotted">Terms</span> and <span className="underline decoration-dotted">Privacy Policy</span>.
      </p>
    </form>
  );
}

/** Google's "G" mark, as Google's sign-in guidelines require on the button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
