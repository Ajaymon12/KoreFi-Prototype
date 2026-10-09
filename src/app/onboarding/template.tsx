// Each setup step fades in as it replaces the last; the header and progress line stay put.
export default function OnboardingTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col motion-safe:animate-page-in">{children}</div>;
}
