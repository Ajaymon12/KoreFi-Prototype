import { redirect } from "next/navigation";

// Retired (2026-11-17): the six-step setup wizard (business, POS, locations, logos, delivery, accounting) is replaced
// by /mvp3's onboarding (components/mvp3/Onboarding.tsx). KoreFi finds locations from the delivery apps, so none of
// these questions are asked any more. The old pages stay in the repo, unused; OnboardingChrome was their frame.
export default function OnboardingLayout() {
  redirect("/");
}
