"use client";
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { STEP_HREF, STEP_ORDER, useOnboarding } from "@/lib/org/store";
import { orgName } from "@/lib/org/name";
import type { OnboardingState, StepKey } from "@/lib/org/types";
import { SETUP_STEPS, prevStep } from "./steps";
import { WorkspacePreview } from "./WorkspacePreview";

// Mercury's application layout, tightened with Mobbin references:
// - left: big "2 / 5" counter over the step list; done steps get a check and a one-line summary of
//   the answer (Airwallex), and stay clickable;
// - middle: the question;
// - right (wide screens): a "Your workspace" card that fills in as you go (Vanta);
// - bottom: a sticky action bar so Back / Continue never scroll away (Dropbox Dash, Melio).

type Props = {
  step: StepKey;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  busy?: boolean;
  /** Shown left of Continue for optional steps. */
  onSkip?: () => void;
  /** Wide steps (tables) drop the preview column and use its room. */
  wide?: boolean;
  /** Short status shown in the action bar, e.g. "2 selected". */
  status?: React.ReactNode;
};

const POS = { square: "Square", toast: "Toast", clover: "Clover" };

function summary(key: StepKey, s: OnboardingState): string | null {
  const live = s.locations.filter((l) => l.included);
  switch (key) {
    case "business":
      return orgName(s) || "Named after your restaurant";
    case "pos":
      return s.imported.length ? s.imported.map((p) => POS[p]).join(", ") : "Added by hand";
    case "locations":
      return live.length ? `${live.length} locations · ${s.brands.length} ${s.brands.length === 1 ? "brand" : "brands"}` : null;
    case "logos": {
      if (s.skipped.includes("logos")) return "Later";
      const brands = s.brands.filter((b) => live.some((l) => l.brandId === b.id));
      return `${brands.filter((b) => b.logo).length} of ${brands.length} added`;
    }
    case "delivery": {
      if (s.skipped.includes("delivery")) return "Later";
      const n = live.filter((l) => l.deliveryApps.length).length;
      return `${n} of ${live.length} on apps`;
    }
    case "accounting": {
      const n = s.connected.filter((id) => ["quickbooks", "xero", "zoho", "mercury"].includes(id)).length;
      return n ? `${n} connected` : "Later";
    }
    default:
      return null;
  }
}

export function StepShell({ step, title, description, children, onContinue, continueLabel, busy, onSkip, wide, status }: Props) {
  const { state } = useOnboarding();
  const index = SETUP_STEPS.findIndex((s) => s.key === step);
  const reached = STEP_ORDER.indexOf(state.step);
  const back = prevStep(step);
  const editing = reached >= STEP_ORDER.indexOf("review");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
      className="flex flex-1 flex-col"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-8 px-6 pt-10 pb-12 md:flex-row md:gap-12 md:px-10">
        <nav aria-label="Setup steps" className="shrink-0 md:sticky md:top-24 md:w-[200px] md:self-start">
          <p className="text-jumbo-sm text-(--color-text-tertiary) tabular-nums">
            <span className="text-(--color-primary-solid)">{index + 1}</span> / {SETUP_STEPS.length}
          </p>
          <ol className="mt-5 hidden md:block">
            {SETUP_STEPS.map((s, i) => {
              const done = state.completed || STEP_ORDER.indexOf(s.key) < reached;
              const current = i === index;
              const note = done && !current ? summary(s.key, state) : null;
              const row = (
                <span className={cn("flex gap-2.5 rounded-medium px-2.5 py-2", current ? "bg-(--color-neutral-lightest)" : done && "hover:bg-(--color-neutral-lightest)")}>
                  <span className="mt-0.5 shrink-0">
                    {done && !current ? (
                      <span className="grid size-4 place-items-center rounded-circle bg-(--color-success-default) text-white">
                        <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
                      </span>
                    ) : (
                      <s.Icon className={cn("size-4", current ? "text-(--color-primary-solid)" : "text-(--color-text-tertiary)")} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-body-md", current || done ? "text-(--color-text-primary)" : "text-(--color-text-tertiary)")}>{s.label}</span>
                    {note && <span className="block truncate text-body-sm text-(--color-text-secondary)">{note}</span>}
                    {done && !current && <span className="sr-only"> (done)</span>}
                  </span>
                </span>
              );
              return (
                <li key={s.key} aria-current={current ? "step" : undefined}>
                  {done && !current ? (
                    <Link href={STEP_HREF[s.key]} className="block rounded-medium outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className={cn("w-full min-w-0", wide ? "max-w-[820px] flex-1" : "max-w-[560px] flex-1")}>
          <h1 className="text-page-title text-(--color-text-primary)">{title}</h1>
          {description && <div className="mt-2 max-w-[560px] text-body-md text-(--color-text-secondary)">{description}</div>}
          <div className="mt-8">{children}</div>
        </div>

        {!wide && (
          <div className="hidden w-[280px] shrink-0 xl:block">
            <div className="sticky top-24">
              <WorkspacePreview state={state} />
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-(--color-border-default) bg-(--color-background-secondary)/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-6 md:px-10">
          {back && STEP_HREF[back].startsWith("/onboarding") ? (
            <Link href={STEP_HREF[back]} className="inline-flex h-[38px] items-center gap-1 rounded-medium pr-3 pl-2 text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Link>
          ) : (
            <span />
          )}
          {status && <span className="hidden text-body-sm text-(--color-text-secondary) sm:inline">{status}</span>}
          <div className="ml-auto flex items-center gap-2">
            {onSkip && !editing && (
              <Button type="text" size="medium" onClick={onSkip}>
                Do this later
              </Button>
            )}
            <Button type="primary" size="medium" htmlType="submit" loading={busy} className="min-w-[120px]">
              {continueLabel ?? (editing ? "Save and review" : "Continue")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
