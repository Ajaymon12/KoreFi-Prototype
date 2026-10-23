"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Toast } from "@/components/ui/Toast";
import { useClient } from "@/lib/admin/client";
import { AccountPanel, type ToastMsg } from "./AccountPanel";

// User workspace → Account (invitation, onboarding, connections, details) and → Outlets (add or
// remove). Add client lands on Account with ?added=sent|link to confirm the invite.

export function ClientDetails({ tab }: { tab: "overview" | "outlets" }) {
  const params = useSearchParams();
  const { client } = useClient();
  const added = params.get("added");
  const [toast, setToast] = useState<ToastMsg | null>(() =>
    client && added ? { message: added === "sent" ? `Invitation sent to ${client.email}` : `${client.company} added. Share the invite link to get them started.` } : null,
  );
  const dismissToast = useCallback(() => setToast(null), []);

  // Drop ?added= so a reload doesn't confirm the invite again.
  useEffect(() => {
    if (added) window.history.replaceState(null, "", window.location.pathname);
  }, [added]);

  if (!client) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={tab === "outlets" ? "Outlets" : "Details"} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 py-6 sm:px-6">
          <AccountPanel bare a={client} tab={tab} onToast={setToast} />
        </div>
      </div>
      <Toast message={toast?.message ?? null} action={toast?.action} onDismiss={dismissToast} />
    </div>
  );
}
