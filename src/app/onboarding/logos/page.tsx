"use client";
import { useRouter } from "next/navigation";
import { StepShell } from "@/components/onboarding/StepShell";
import { LogoUploadCard } from "@/components/onboarding/LogoUpload";
import { advance } from "@/components/onboarding/steps";
import { update, useOnboarding } from "@/lib/org/store";

// Step 4 (optional): a logo for each brand. One brand gets one upload; several brands get one each,
// so the owner's team can tell them apart wherever a brand shows up (location menu, lists, reports).
// Logos are saved the moment they're chosen, so the "Your workspace" card updates live.

export default function Logos() {
  const router = useRouter();
  const { state } = useOnboarding();
  const live = state.locations.filter((l) => l.included);
  const brands = state.brands.filter((b) => live.some((l) => l.brandId === b.id));
  const added = brands.filter((b) => b.logo).length;
  const many = brands.length > 1;

  const setLogo = (id: string, logo: string | undefined) => update((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, logo } : b)) }));
  const finish = (skipped: boolean) => {
    update((s) => ({ skipped: skipped ? [...new Set([...s.skipped, "logos" as const])] : s.skipped.filter((x) => x !== "logos") }));
    router.push(advance("logos", state.step));
  };

  return (
    <StepShell
      step="logos"
      title={many ? "Add your restaurant logos" : "Add your logo"}
      description={
        many
          ? `You run ${brands.length} brands, so add a logo for each one. They show next to every location, so your team can tell them apart at a glance.`
          : "Your logo shows next to your locations across KoreFi. You can add or change it later."
      }
      status={`${added} of ${brands.length} ${brands.length === 1 ? "logo" : "logos"} added`}
      onContinue={() => finish(added === 0)}
      onSkip={() => finish(true)}
    >
      <div className="space-y-3">
        {brands.map((b) => (
          <LogoUploadCard key={b.id} brand={b} locationCount={live.filter((l) => l.brandId === b.id).length} onChange={(logo) => setLogo(b.id, logo)} />
        ))}
      </div>
    </StepShell>
  );
}
