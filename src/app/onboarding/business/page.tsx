"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Coffee, Sandwich, Truck, UtensilsCrossed, Wine } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField, labelClass } from "@/components/ui/TextField";
import { StepShell } from "@/components/onboarding/StepShell";
import { OptionCard } from "@/components/onboarding/OptionCard";
import { advance } from "@/components/onboarding/steps";
import { FormError as Err } from "@/components/onboarding/parts";
import { update, useOnboarding } from "@/lib/org/store";
import type { Org, SizeBand } from "@/lib/org/types";

// Step 1: the owner's group. Size and kinds of places shape what KoreFi shows first; the group
// name heads the workspace (brands come later, from the POS). Answers save as they're given, so
// the "Your workspace" card fills in live. Option cards follow Remote / Whop onboarding (Mobbin).

const SIZES: { value: SizeBand; label: string; help: string; dots: number }[] = [
  { value: "1", label: "Just one", help: "A single restaurant or café", dots: 1 },
  { value: "2-5", label: "2–5 locations", help: "A few stores, maybe one brand", dots: 3 },
  { value: "6-15", label: "6–15 locations", help: "Several stores or brands", dots: 6 },
  { value: "16+", label: "16 or more", help: "A multi-brand group", dots: 9 },
];
const TYPES = [
  { label: "Full-service", Icon: UtensilsCrossed },
  { label: "Quick-service", Icon: Sandwich },
  { label: "Café or bakery", Icon: Coffee },
  { label: "Bar", Icon: Wine },
  { label: "Ghost kitchen", Icon: ChefHat },
  { label: "Food truck", Icon: Truck },
];

/** A tiny grid of pins standing for the number of locations. */
function Pins({ n }: { n: number }) {
  return (
    <span className="grid grid-cols-3 gap-[2px]">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={i < n ? "size-[4px] rounded-circle bg-current" : "size-[4px] rounded-circle bg-current opacity-20"} />
      ))}
    </span>
  );
}

export default function Business() {
  const router = useRouter();
  const { state } = useOnboarding();
  const org = state.org;
  const [submitted, setSubmitted] = useState(false);
  const set = (patch: Partial<Org>) => update((s) => ({ org: { ...s.org, ...patch } }));

  const errors = { name: !org.sameAsRestaurant && !org.name.trim() && "Enter your business or group name", size: !org.sizeBand && "Choose how many locations you run", types: !org.types.length && "Pick at least one" };
  const toggleType = (t: string) => set({ types: org.types.includes(t) ? org.types.filter((x) => x !== t) : [...org.types, t] });

  return (
    <StepShell
      step="business"
      title="Tell us about your business"
      description="Whether you run one café or several brands, this is the workspace everything rolls up to."
      onContinue={() => {
        setSubmitted(true);
        if (Object.values(errors).some(Boolean)) return;
        set({ name: org.name.trim() });
        router.push(advance("business", state.step));
      }}
    >
      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-3">
          <TextField
            label="Business or group name"
            placeholder={org.sameAsRestaurant ? "We’ll use your restaurant’s name" : "e.g. Alvarez Hospitality Group"}
            autoComplete="organization"
            disabled={Boolean(org.sameAsRestaurant)}
            value={org.sameAsRestaurant ? "" : org.name}
            onChange={(e) => set({ name: e.target.value })}
            hint="This is how your workspace is named in KoreFi."
            error={submitted && errors.name ? errors.name : undefined}
          />
          <Checkbox checked={Boolean(org.sameAsRestaurant)} onChange={(e) => set({ sameAsRestaurant: e.target.checked })} label="Same as my restaurant’s name" />
          {org.sameAsRestaurant && <p className="-mt-1 pl-6 text-body-sm text-(--color-text-secondary)">We’ll take it from your POS in the next step. Run several restaurants under one company? Untick this to name the group.</p>}
        </div>

        <fieldset>
          <legend className={labelClass}>How many locations do you run?</legend>
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Count every branch across all your brands.</p>
          <div role="radiogroup" aria-label="Number of locations" className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {SIZES.map((s) => (
              <OptionCard key={s.value} role="radio" selected={org.sizeBand === s.value} onClick={() => set({ sizeBand: s.value })} title={s.label} description={s.help} icon={<Pins n={s.dots} />} />
            ))}
          </div>
          {submitted && errors.size && <Err>{errors.size}</Err>}
        </fieldset>

        <fieldset>
          <legend className={labelClass}>What kinds of places?</legend>
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Choose all that apply.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {TYPES.map(({ label, Icon }) => (
              <OptionCard key={label} layout="stack" selected={org.types.includes(label)} onClick={() => toggleType(label)} title={label} icon={<Icon />} />
            ))}
          </div>
          {submitted && errors.types && <Err>{errors.types}</Err>}
        </fieldset>
      </div>
    </StepShell>
  );
}
