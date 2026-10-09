import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingChrome>{children}</OnboardingChrome>;
}
