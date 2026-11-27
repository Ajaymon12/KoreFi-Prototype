import { redirect } from "next/navigation";

// Retired (2026-11-17): sign-up now happens inside /mvp3 (components/mvp3/Onboarding.tsx), which asks only for the
// account, a name and the restaurant's name, then the delivery-app checklist. The old pages stay in the repo, unused.
export default function GetStartedLayout() {
  redirect("/");
}
