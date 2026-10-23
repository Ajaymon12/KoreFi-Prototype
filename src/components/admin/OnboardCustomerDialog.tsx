"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Link2, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { TextField, FieldShell, fieldClass } from "@/components/ui/TextField";
import { ProviderLogo } from "./ProviderLogo";
import { PROVIDERS, type ProviderId } from "@/lib/admin/data";
import { STEPS, type Account } from "@/lib/admin/accounts";
import { emailTaken, inviteCustomer, inviteLink, type NewCustomer } from "@/lib/admin/store";

// "Add user" (Dashboard): ops creates the account, optionally pre-connects sources, and sends the invite.
// Flow modelled on Mobbin invite patterns: stepper counter + split form/preview (Attio), role cards
// with a one-line description each (Uxcel), copyable invite link (Canva), confirmation toast.

const STEP_TITLES = ["Who are they?", "What should we set up?", "Review and invite"] as const;

const ROLES: { value: Account["role"]; label: string; blurb: string }[] = [
  { value: "Owner", label: "Owner", blurb: "Sees every outlet, finance and tax-credit figure, and can invite their own team." },
  { value: "Manager", label: "Manager", blurb: "Sees operations for the outlets they run. No finance or billing." },
];

const POS = PROVIDERS.filter((p) => p.category === "pos");
const DELIVERY = PROVIDERS.filter((p) => p.category === "3pd");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = { name: string; email: string; company: string; role: Account["role"]; outlets: number; pos?: ProviderId; delivery: ProviderId[]; note: string };
const EMPTY: Draft = { name: "", email: "", company: "", role: "Owner", outlets: 1, delivery: [], note: "" };

export function OnboardCustomerDialog({ accounts, onClose, onDone }: { accounts: Account[]; onClose: () => void; onDone: (a: Account, sent: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const errors = {
    name: d.name.trim() ? "" : "Enter their name.",
    email: !EMAIL.test(d.email.trim()) ? "Enter a valid email address." : emailTaken(accounts, d.email) ? "An account with this email already exists." : "",
    company: d.company.trim() ? "" : "Enter the restaurant group's name.",
  };
  const step0Ok = !errors.name && !errors.email && !errors.company;

  const next = () => {
    if (step === 0 && !step0Ok) return setTouched(true);
    setStep((s) => s + 1);
  };

  const submit = (send: boolean) => {
    const payload: NewCustomer = { name: d.name.trim(), email: d.email.trim(), company: d.company.trim(), role: d.role, outlets: d.outlets, pos: d.pos, delivery: d.delivery };
    onDone(inviteCustomer(payload), send);
  };

  const link = inviteLink({ id: d.name.trim() ? d.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") : "your-link" });
  const copy = () => {
    void navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-3 sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Add user" className="flex max-h-full w-full max-w-[920px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_16px_48px_rgb(0_0_0/0.18)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border-default) px-5 py-3.5">
          <h2 className="min-w-0 flex-1 text-subtitle-md text-(--color-text-primary)">Add user</h2>
          <ol className="hidden items-center gap-1.5 sm:flex" aria-label="Progress">
            {STEP_TITLES.map((_, i) => (
              <li key={i} aria-current={i === step ? "step" : undefined} className={cn("h-1 w-10 rounded-full transition-colors", i <= step ? "bg-(--color-primary)" : "bg-(--color-border-default)")} />
            ))}
          </ol>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-1.5 grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5 px-5 py-5 sm:px-7">
            <div>
              <p className="text-body-sm text-(--color-text-secondary)">Step {step + 1} of 3</p>
              <h3 className="mt-0.5 text-subtitle-lg text-(--color-text-primary)">{STEP_TITLES[step]}</h3>
            </div>

            {step === 0 && (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Full name" autoFocus value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Priya Shah" error={touched && errors.name} />
                  <TextField label="Work email" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="priya@egghoric.com" error={touched && errors.email} />
                </div>
                <TextField label="Restaurant group" value={d.company} onChange={(e) => set("company", e.target.value)} placeholder="EggHolic" hint="Becomes the organization they'll see in the dashboard." error={touched && errors.company} />
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-label-sm text-(--color-text-secondary)">Role</legend>
                  {ROLES.map((r) => (
                    <label key={r.value} className={cn("flex cursor-pointer items-start gap-3 rounded-medium border px-3 py-2.5 transition-colors", d.role === r.value ? "border-(--color-primary) bg-(--color-primary)/8" : "border-(--color-border-default) hover:bg-(--color-neutral-lightest)/60")}>
                      <input type="radio" name="role" className="mt-1 accent-(--color-primary)" checked={d.role === r.value} onChange={() => set("role", r.value)} />
                      <span>
                        <span className="block text-body-md font-medium text-(--color-text-primary)">{r.label}</span>
                        <span className="block text-body-sm text-(--color-text-secondary)">{r.blurb}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-5">
                <FieldShell id="outlets" label="Number of outlets" hint="They'll confirm each location during onboarding.">
                  <div className="flex w-fit items-center rounded-medium border border-(--color-border-default)">
                    <button type="button" aria-label="Fewer outlets" disabled={d.outlets <= 1} onClick={() => set("outlets", d.outlets - 1)} className="h-10 w-10 text-body-lg text-(--color-text-secondary) hover:bg-(--color-neutral-lightest) disabled:opacity-40">
                      −
                    </button>
                    <input id="outlets" inputMode="numeric" aria-label="Outlets" value={d.outlets} onChange={(e) => set("outlets", Math.min(50, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))} className={cn(fieldClass, "h-10 w-14 rounded-none border-0 border-x text-center")} />
                    <button type="button" aria-label="More outlets" disabled={d.outlets >= 50} onClick={() => set("outlets", d.outlets + 1)} className="h-10 w-10 text-body-lg text-(--color-text-secondary) hover:bg-(--color-neutral-lightest) disabled:opacity-40">
                      +
                    </button>
                  </div>
                </FieldShell>
                <Choice legend="Point of sale" hint="Pick one if you already know it. They can connect it themselves later.">
                  {POS.map((p) => (
                    <Card key={p.id} on={d.pos === p.id} onClick={() => set("pos", d.pos === p.id ? undefined : p.id)} id={p.id} name={p.name} />
                  ))}
                </Choice>
                <Choice legend="Delivery apps" hint="KoreFi connects these for them. Select all that apply.">
                  {DELIVERY.map((p) => (
                    <Card key={p.id} on={d.delivery.includes(p.id)} onClick={() => set("delivery", d.delivery.includes(p.id) ? d.delivery.filter((x) => x !== p.id) : [...d.delivery, p.id])} id={p.id} name={p.name} />
                  ))}
                </Choice>
                <p className="text-body-sm text-(--color-text-secondary)">Nothing here is required. Skip it and the customer picks their own sources in onboarding.</p>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <dl className="divide-y divide-(--color-border-default) rounded-medium border border-(--color-border-default) text-body-md">
                  {[
                    ["Customer", `${d.name} · ${d.role}`],
                    ["Email", d.email],
                    ["Restaurant group", `${d.company} · ${d.outlets} ${d.outlets === 1 ? "outlet" : "outlets"}`],
                    ["POS", d.pos ? PROVIDERS.find((p) => p.id === d.pos)!.name : "Customer chooses"],
                    ["Delivery apps", d.delivery.length ? d.delivery.map((x) => PROVIDERS.find((p) => p.id === x)!.name).join(", ") : "Customer chooses"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-3 py-2">
                      <dt className="text-(--color-text-secondary)">{k}</dt>
                      <dd className="min-w-0 truncate text-right text-(--color-text-primary)">{v}</dd>
                    </div>
                  ))}
                </dl>
                <FieldShell id="note" label="Personal note (optional)" hint="Shown in the invite email.">
                  <textarea id="note" rows={3} value={d.note} onChange={(e) => set("note", e.target.value)} placeholder="Welcome aboard! Reply here if you get stuck." className={cn(fieldClass, "h-auto py-2")} />
                </FieldShell>
                <div className="flex flex-col gap-1.5">
                  <span className="text-label-sm text-(--color-text-secondary)">Invite link</span>
                  <div className="flex items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest)/60 py-1 pr-1 pl-3">
                    <Link2 className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-body-md text-(--color-text-secondary)">{link}</span>
                    <Button size="tiny" onClick={copy} iconLeft={copied ? <Check aria-hidden /> : <Copy aria-hidden />}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-body-sm text-(--color-text-secondary)">Works once and expires in 7 days.</p>
                </div>
              </div>
            )}
          </div>

          <aside className="hidden flex-col gap-3 border-l border-(--color-border-default) bg-(--color-neutral-lightest)/50 p-5 md:flex" aria-label="What the customer will see">
            <p className="text-label-sm text-(--color-text-secondary)">{step === 2 ? "Invite email preview" : "What they'll go through"}</p>
            {step === 2 ? <EmailPreview d={d} /> : <JourneyPreview d={d} step={step} />}
          </aside>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-(--color-border-default) px-5 py-3">
          {step > 0 ? (
            <Button size="small" onClick={() => setStep(step - 1)} iconLeft={<ArrowLeft aria-hidden />}>
              Back
            </Button>
          ) : (
            <Button size="small" onClick={onClose}>
              Cancel
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step === 1 && (
              <Button type="text" size="small" onClick={next}>
                Skip for now
              </Button>
            )}
            {step < 2 ? (
              <Button type="primary" size="small" onClick={next}>
                Continue
              </Button>
            ) : (
              <>
                <Button size="small" onClick={() => submit(false)}>
                  Create without emailing
                </Button>
                <Button type="primary" size="small" onClick={() => submit(true)} iconLeft={<Mail aria-hidden />}>
                  Send invite
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice({ legend, hint, children }: { legend: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-label-sm text-(--color-text-secondary)">{legend}</legend>
      <p className="mb-1 text-body-sm text-(--color-text-secondary)">{hint}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Card({ on, onClick, id, name }: { on: boolean; onClick: () => void; id: ProviderId; name: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("flex h-10 items-center gap-2 rounded-medium border px-3 text-body-md transition-colors", on ? "border-(--color-primary) bg-(--color-primary)/8 text-(--color-text-primary)" : "border-(--color-border-default) text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)")}>
      <ProviderLogo id={id} size={18} />
      {name}
      {on && <Check className="size-3.5 text-(--color-text-clickable)" aria-hidden />}
    </button>
  );
}

/** Right rail on steps 1-2: the customer's own onboarding, so ops knows what they're handing over. */
function JourneyPreview({ d, step }: { d: Draft; step: number }) {
  const skipped = (id: string) => (id === "pos" && d.pos) || (id === "delivery" && d.delivery.length > 0);
  return (
    <div className="rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-4">
      <p className="text-body-md font-medium text-(--color-text-primary)">{d.company.trim() || "Their restaurant group"}</p>
      <p className="mb-3 text-body-sm text-(--color-text-secondary)">{step === 0 ? "After accepting the invite" : "Steps already handled by you are pre-filled"}</p>
      <ol className="flex flex-col gap-2.5">
        {STEPS.filter((s) => s.id !== "done").map((s, i) => (
          <li key={s.id} className="flex items-center gap-2.5 text-body-md">
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px]", skipped(s.id) ? "bg-(--color-success-default) text-white" : "border border-(--color-border-darker) text-(--color-text-secondary)")}>{skipped(s.id) ? <Check className="size-3" aria-hidden /> : i + 1}</span>
            <span className="text-(--color-text-primary)">{s.label}</span>
            {skipped(s.id) && <span className="ml-auto text-body-sm text-(--color-text-secondary)">Pre-connected</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmailPreview({ d }: { d: Draft }) {
  const first = d.name.trim().split(" ")[0] || "there";
  return (
    <div className="rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-4 text-body-sm text-(--color-text-secondary)">
      <p>
        To: <span className="text-(--color-text-primary)">{d.email}</span>
      </p>
      <p className="mb-3 border-b border-(--color-border-default) pb-2">
        Subject: <span className="text-(--color-text-primary)">You&rsquo;re invited to KoreFi</span>
      </p>
      <p className="text-body-md text-(--color-text-primary)">Hi {first},</p>
      <p className="mt-2">KoreFi will track sales, payouts and tax credits for {d.company || "your restaurants"}. It takes about 10 minutes to set up.</p>
      {d.note.trim() && <p className="mt-2 border-l-2 border-(--color-primary) pl-2 whitespace-pre-wrap text-(--color-text-primary)">{d.note}</p>}
      <span className="mt-3 inline-block rounded-medium bg-(--color-primary-solid) px-3 py-1.5 text-body-md text-(--color-text-inverse-primary)">Set up your account</span>
    </div>
  );
}
