"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, PenLine } from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { ConnectDialog } from "@/components/integrations/ConnectDialog";
import { SourceLogo } from "@/components/integrations/SourceLogo";
import { StepShell } from "@/components/onboarding/StepShell";
import { FormError, SourceCard, cardGrid } from "@/components/onboarding/parts";
import { advance } from "@/components/onboarding/steps";
import { update, useOnboarding } from "@/lib/org/store";
import { importFromPos } from "@/lib/org/posImport";
import type { PosId } from "@/lib/org/types";

// Step 2: connect the POS. Connecting is also how KoreFi learns the owner's locations: each POS
// hands over its store list, which step 3 turns into brands and branches. Brands on different POS
// systems are common, so more than one can be connected. What each connection found is shown
// right away (Cosmos "We found 2 boards" on Mobbin).

const POS: { id: PosId; name: string }[] = [
  { id: "square", name: "Square" },
  { id: "toast", name: "Toast" },
  { id: "clover", name: "Clover" },
];

export default function PointOfSale() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [open, setOpen] = useState<PosId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const dismiss = useCallback(() => setToast(null), []);

  const from = (id: PosId) => state.locations.filter((l) => l.posSource === id);
  const any = state.imported.length > 0;
  const total = state.locations.filter((l) => l.posSource !== "manual").length;

  const connected = (id: PosId) => {
    update((s) => {
      if (s.imported.includes(id)) return {};
      const r = importFromPos(id, s.brands);
      return { connected: [...s.connected, id], imported: [...s.imported, id], brands: r.brands, locations: [...s.locations, ...r.locations] };
    });
    setOpen(null);
    setError(false);
    setToast(`Connected ${POS.find((p) => p.id === id)!.name}. We found your locations.`);
  };

  return (
    <StepShell
      step="pos"
      title="Connect your point of sale"
      description="KoreFi reads your sales and pulls in every location from your POS, so you don’t have to type them in. Running brands on different systems? Connect each one."
      status={any ? `${total} locations found` : undefined}
      onContinue={() => {
        if (!any) return setError(true);
        router.push(advance("pos", state.step));
      }}
    >
      <ul className={cardGrid}>
        {POS.map((p) => (
          <SourceCard key={p.id} id={p.id} name={p.name} connectedNote={state.imported.includes(p.id) ? `${from(p.id).length} locations found` : undefined} onConnect={() => setOpen(p.id)} />
        ))}
      </ul>
      {error && <FormError>Connect your POS to continue, or add your locations by hand.</FormError>}

      {any && (
        <section aria-label="Locations found" className="mt-6 rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
          <header className="flex items-center gap-2 border-b border-(--color-border-default) px-4 py-3">
            <MapPin className="size-4 text-(--color-primary-solid)" aria-hidden />
            <p className="text-subtitle-sm text-(--color-text-primary)">We found {total} locations</p>
            <span className="ml-auto text-body-sm text-(--color-text-secondary)">You’ll confirm them next</span>
          </header>
          <ul className="divide-y divide-(--color-border-default)">
            {state.imported.map((id) => (
              <li key={id} className="flex items-start gap-3 px-4 py-3">
                <SourceLogo id={id} name={POS.find((p) => p.id === id)!.name} size="sm" />
                <p className="min-w-0 flex-1 text-body-sm text-(--color-text-secondary)">
                  <span className="text-(--color-text-primary)">{POS.find((p) => p.id === id)!.name}</span> · {from(id).map((l) => l.posName).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => router.push(advance("pos", state.step))}
        className="mt-6 flex w-full items-center gap-3 rounded-large border border-dashed border-(--color-border-darker) px-4 py-3.5 text-left outline-none hover:bg-(--color-background-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
      >
        <span className="grid size-9 place-items-center rounded-medium bg-(--color-neutral-lightest) text-(--color-text-secondary)">
          <PenLine className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-subtitle-sm text-(--color-text-primary)">Use a different POS?</span>
          <span className="block text-body-sm text-(--color-text-secondary)">Add your locations by hand. Our team will help connect it.</span>
        </span>
      </button>

      {open && <ConnectDialog source={POS.find((p) => p.id === open)!} mode="connect" onClose={() => setOpen(null)} onConnected={() => connected(open)} />}
      <Toast message={toast} onDismiss={dismiss} />
    </StepShell>
  );
}
