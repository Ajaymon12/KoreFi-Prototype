"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";
import { ConnectDialog } from "@/components/integrations/ConnectDialog";
import { StepShell } from "@/components/onboarding/StepShell";
import { SourceCard, cardGrid } from "@/components/onboarding/parts";
import { advance } from "@/components/onboarding/steps";
import { update, useOnboarding } from "@/lib/org/store";
import type { SourceId } from "@/lib/sources/types";

// Step 5 (optional): accounting and bank, so KoreFi can show what's left after fees and check every
// payout landed. Skipping is fine — both can be connected later from Integrations.

const GROUPS: { title: string; note: string; items: { id: SourceId; name: string }[] }[] = [
  { title: "Accounting", note: "Bills, vendors and what’s due.", items: [{ id: "quickbooks", name: "QuickBooks" }, { id: "xero", name: "Xero" }, { id: "zoho", name: "Zoho Books" }] },
  { title: "Bank", note: "Deposits, to match every payout to your account.", items: [{ id: "mercury", name: "Mercury" }] },
];
const ALL = GROUPS.flatMap((g) => g.items);

export default function Accounting() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [open, setOpen] = useState<SourceId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const any = ALL.some((s) => state.connected.includes(s.id));

  const finish = (skipped: boolean) => {
    update((s) => ({ skipped: skipped ? [...new Set([...s.skipped, "accounting" as const])] : s.skipped.filter((x) => x !== "accounting") }));
    router.push(advance("accounting", state.step));
  };

  return (
    <StepShell
      step="accounting"
      title="Connect accounting and bank"
      description="Connect at least one to see what you keep after fees and to check that every payout landed. You can also do this later."
      onContinue={() => finish(!any)}
      onSkip={any ? undefined : () => finish(true)}
    >
      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`grp-${g.title}`}>
            <h2 id={`grp-${g.title}`} className="text-subtitle-md text-(--color-text-primary)">
              {g.title}
            </h2>
            <p className="mt-0.5 mb-3 text-body-sm text-(--color-text-secondary)">{g.note}</p>
            <ul className={cardGrid}>
              {g.items.map((s) => (
                <SourceCard key={s.id} id={s.id} name={s.name} tag={g.title} connectedNote={state.connected.includes(s.id) ? "First sync started" : undefined} onConnect={() => setOpen(s.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {open && (
        <ConnectDialog
          source={ALL.find((s) => s.id === open)!}
          mode="connect"
          onClose={() => setOpen(null)}
          onConnected={() => {
            update((s) => ({ connected: [...new Set([...s.connected, open])] }));
            setToast(`Connected ${ALL.find((s) => s.id === open)!.name}.`);
            setOpen(null);
          }}
        />
      )}
      <Toast message={toast} onDismiss={dismiss} />
    </StepShell>
  );
}
