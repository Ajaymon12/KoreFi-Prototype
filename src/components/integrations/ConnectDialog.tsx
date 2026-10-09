"use client";
import { useEffect, useRef, useState } from "react";
import { AppWindow, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { CATALOG } from "@/lib/sources/catalog";
import type { SourceId } from "@/lib/sources/types";
import { SourceLogo } from "./SourceLogo";

// WRITER-style "Connecting to X" dialog (Mobbin reference): what KoreFi will read → a simulated
// sign-in window → done. Also the "Disconnect X?" confirmation. Used by Integrations and onboarding.

const SIGN_IN_MS = 2200;

type Props = {
  source: { id: SourceId; name: string };
  mode: "connect" | "disconnect";
  onClose: () => void;
  onConnected?: () => void;
  onDisconnect?: () => void;
};

export function ConnectDialog({ source, mode, onClose, onConnected, onDisconnect }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"review" | "waiting" | "disconnect">(mode === "disconnect" ? "disconnect" : "review");
  useDismiss(panel, true, onClose);
  const reads = CATALOG[source.id]?.reads ?? [];
  const title = step === "disconnect" ? `Disconnect ${source.name}?` : `Connecting to ${source.name}`;

  // The simulated sign-in window "completes" after a moment.
  const done = useRef(onConnected);
  useEffect(() => {
    done.current = onConnected;
  });
  useEffect(() => {
    if (step !== "waiting") return;
    const t = setTimeout(() => done.current?.(), SIGN_IN_MS);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6 shadow-[0_16px_48px_rgb(0_0_0/0.18)]">
        <div className="flex items-center gap-3">
          <SourceLogo id={source.id} name={source.name} size="lg" />
          <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>
        </div>

        {step === "review" && (
          <>
            <div className="mt-4 space-y-3">
              <p className="text-body-md text-(--color-text-secondary)">You will sign in to {source.name} in a new window. KoreFi will be able to read:</p>
              <ul className="space-y-1.5">
                {reads.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-body-md text-(--color-text-primary)">
                    <Check className="size-4 shrink-0 text-(--color-success-default)" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="flex items-start gap-2 rounded-medium bg-(--color-neutral-lightest) p-3 text-body-sm text-(--color-text-secondary)">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                Read-only. KoreFi cannot change, move or spend anything. You can disconnect any time.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="outline" size="small" onClick={onClose}>Cancel</Button>
              <Button type="primary" size="small" onClick={() => setStep("waiting")}>Continue to {source.name}</Button>
            </div>
          </>
        )}

        {step === "waiting" && (
          <>
            <div className="mt-5 grid place-items-center">
              <span className="grid size-24 place-items-center rounded-circle bg-(--brand-200)">
                <AppWindow className="size-9 text-(--color-primary-solid)" aria-hidden />
              </span>
            </div>
            <p className="mt-4 text-center text-body-md text-(--color-text-secondary)">
              A {source.name} sign-in window has been opened. Return here after you have signed in.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button type="outline" size="small" onClick={onClose}>Cancel</Button>
              <Button type="primary" size="small" loading disabled>Waiting for sign-in</Button>
            </div>
          </>
        )}

        {step === "disconnect" && (
          <>
            <p className="mt-4 text-body-md text-(--color-text-secondary)">
              KoreFi will stop syncing from {source.name}. Pages that use it will show less until you connect it again. Past data stays.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="outline" size="small" onClick={onClose}>Keep connected</Button>
              <Button type="danger" size="small" onClick={onDisconnect}>Disconnect</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
