"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { AuthCard, AuthFrame } from "@/components/onboarding/AuthFrame";
import { update, useOnboarding } from "@/lib/org/store";
import type { Account, JobTitle } from "@/lib/org/types";

// Step A2: who the owner is. Name for greetings and the avatar; mobile for account security and
// urgent payout alerts (owners act on texts, not email); job title so KoreFi knows who it's talking to.

const TITLES: JobTitle[] = ["Owner", "Operator", "Partner", "General manager"];

/** "5551234567" → "(555) 123-4567", formatting as the digits arrive. */
const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10);
  if (d.length < 4) return d.length ? `(${d}` : "";
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export default function Profile() {
  const router = useRouter();
  const { ready, state } = useOnboarding();

  useEffect(() => {
    if (ready && !state.account.email) router.replace("/get-started");
  }, [ready, state.account.email, router]);

  return (
    <AuthFrame>
      <AuthCard title="Tell us about you" description="We’ll use this to set up your account. You can change it later in Settings.">
        <ProfileForm key={ready ? "ready" : "ssr"} account={state.account} />
      </AuthCard>
    </AuthFrame>
  );
}

function ProfileForm({ account }: { account: Account }) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: account.firstName, lastName: account.lastName, phone: account.phone, title: account.title });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: k === "phone" ? formatPhone(e.target.value) : e.target.value }));

  const errors = {
    firstName: !form.firstName.trim() && "Enter your first name",
    lastName: !form.lastName.trim() && "Enter your last name",
    phone: form.phone.replace(/\D/g, "").length !== 10 && "Enter a 10-digit US mobile number",
    title: !form.title && "Choose your role",
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] || undefined : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (Object.values(errors).some(Boolean)) return;
        setBusy(true);
        setTimeout(() => {
          update((s) => ({ account: { ...s.account, firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone, title: form.title as JobTitle }, step: "business" }));
          router.push("/onboarding/business");
        }, 400);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <TextField label="First name" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} error={show("firstName")} containerClassName="flex-1" />
        <TextField label="Last name" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} error={show("lastName")} containerClassName="flex-1" />
      </div>
      <TextField
        label="Mobile phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(555) 555-5555"
        value={form.phone}
        onChange={set("phone")}
        hint="For account security and urgent payout alerts. We won’t share it."
        error={show("phone")}
      />
      <Select
        label="Your role"
        placeholder="Choose one"
        value={form.title}
        onChange={set("title")}
        options={TITLES.map((t) => ({ value: t, label: t }))}
        error={show("title")}
      />
      <Button type="primary" size="medium" htmlType="submit" block className="mt-4" loading={busy}>
        Continue
      </Button>
    </form>
  );
}
