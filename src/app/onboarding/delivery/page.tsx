"use client";
import { useRouter } from "next/navigation";
import { Headset } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { StepShell } from "@/components/onboarding/StepShell";
import { advance } from "@/components/onboarding/steps";
import { AppLogo, BrandMark } from "@/components/onboarding/marks";
import { update, useOnboarding } from "@/lib/org/store";
import type { DeliveryApp, OnboardingState } from "@/lib/org/types";

// Step 4: which delivery apps each location is on. The owner only ticks boxes — KoreFi's ops team
// uploads their DoorDash, Uber Eats and Grubhub data (there is no integration), so no logins are asked for here.

const APPS: { id: DeliveryApp; label: string }[] = [
  { id: "doordash", label: "DoorDash" },
  { id: "ubereats", label: "Uber Eats" },
  { id: "grubhub", label: "Grubhub" },
  { id: "other", label: "Other" },
];

const skip = (s: OnboardingState, on: boolean) => ({ skipped: on ? [...new Set([...s.skipped, "delivery" as const])] : s.skipped.filter((x) => x !== "delivery") });

export default function Delivery() {
  const router = useRouter();
  const { state } = useOnboarding();
  const live = state.locations.filter((l) => l.included);

  const set = (ids: string[], app: DeliveryApp, on: boolean) =>
    update((s) => ({ locations: s.locations.map((l) => (ids.includes(l.id) ? { ...l, deliveryApps: on ? [...new Set([...l.deliveryApps, app])] : l.deliveryApps.filter((a) => a !== app) } : l)) }));

  return (
    <StepShell
      step="delivery"
      wide
      title="Which delivery apps do you use?"
      status={`${live.filter((l) => l.deliveryApps.length).length} of ${live.length} locations on delivery apps`}
      description="Tick the apps each location sells on. Our ops team uploads your delivery app data, so there’s nothing to connect and no logins to share."
      onContinue={() => {
        update((s) => skip(s, false));
        router.push(advance("delivery", state.step));
      }}
      onSkip={() => {
        update((s) => skip(s, true));
        router.push(advance("delivery", state.step));
      }}
    >
      <div className="space-y-6">
        {state.brands.map((b) => {
          const rows = live.filter((l) => l.brandId === b.id);
          if (!rows.length) return null;
          const ids = rows.map((l) => l.id);
          return (
            <section key={b.id} className="overflow-x-auto rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <caption className="sr-only">Delivery apps for {b.name}</caption>
                <thead>
                  <tr className="border-b border-(--color-border-default)">
                    <th scope="col" className="px-4 py-3 text-subtitle-md font-normal text-(--color-text-primary)">
                      <span className="flex items-center gap-2.5">
                        <BrandMark brand={b} brands={state.brands} />
                        {b.name}
                      </span>
                    </th>
                    {APPS.map((a) => (
                      <th key={a.id} scope="col" className="w-[92px] px-2 py-3 text-center text-body-sm font-normal text-(--color-text-secondary)">
                        <span className="flex flex-col items-center gap-1.5">
                          <AppLogo app={a.id} size={22} />
                          {a.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border-default)">
                  {rows.length > 1 && (
                    <tr className="bg-(--color-background-primary)">
                      <th scope="row" className="px-4 py-2.5 text-body-sm font-normal text-(--color-text-secondary)">
                        Same for all {rows.length} {b.name} locations
                      </th>
                      {APPS.map((a) => {
                        const n = rows.filter((l) => l.deliveryApps.includes(a.id)).length;
                        return (
                          <td key={a.id} className="px-2 py-2.5 text-center">
                            <Checkbox checked={n === rows.length} mixed={n > 0 && n < rows.length} onChange={() => set(ids, a.id, n < rows.length)} aria-label={`${a.label} at every ${b.name} location`} />
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <th scope="row" className="px-4 py-3 font-normal">
                        <span className="block text-body-md text-(--color-text-primary)">{l.name}</span>
                        <span className="block text-body-sm text-(--color-text-secondary)">{l.address.street}</span>
                      </th>
                      {APPS.map((a) => (
                        <td key={a.id} className="px-2 py-3 text-center">
                          <Checkbox checked={l.deliveryApps.includes(a.id)} onChange={(e) => set([l.id], a.id, e.target.checked)} aria-label={`${a.label} at ${l.name}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}

        <p className="flex items-start gap-2.5 rounded-medium bg-(--color-neutral-lightest) p-3.5 text-body-sm text-(--color-text-secondary)">
          <Headset className="mt-0.5 size-4 shrink-0" aria-hidden />
          After setup, our ops team uploads each store’s delivery app data. It usually takes 1–2 business days, and we’ll email you when it’s in.
        </p>
      </div>
    </StepShell>
  );
}
