"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { TextField, fieldClass, labelClass } from "@/components/ui/TextField";
import { AppName } from "@/components/ui/ReportTable";
import { short } from "@/components/finance/PnlStory";
import { APPS, OPS_STATUS_LABEL, WINDOW_DAYS, appLabel, daysBetween, type CbStatus, type Chargeback } from "@/lib/finance/chargebacks";

// Ops-only "Update dispute" (Chargebacks → Transactions, pencil or the row drawer). Same fields as the
// dev ops app's modal, with what ops need to decide in view: the order, amount and the app's deadline.
// Status is four cards instead of a dropdown; Won asks what came back (full by default, partial or
// more allowed); Declined takes an optional reason. Save stays off until something changed.

const STATUSES: { value: CbStatus; blurb: string }[] = [
  { value: "new", blurb: "Not filed with the app yet" },
  { value: "disputing", blurb: "Filed, waiting on the app" },
  { value: "won", blurb: "The app paid it back" },
  { value: "lost", blurb: "The app kept it" },
];
const DOT: Record<CbStatus, string> = { new: "bg-(--color-text-tertiary)", disputing: "bg-(--chart-open)", won: "bg-(--chart-won)", lost: "bg-(--chart-lost)" };

const cents = (n: number) => `$${n.toFixed(2)}`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export type DisputeChange = { status: CbStatus; recovered?: number; reason?: string; note: string };

export function UpdateDisputeDialog({ c, asOf, onClose, onSave }: { c: Chargeback; asOf: string; onClose: () => void; onSave: (change: DisputeChange) => void }) {
  const [status, setStatus] = useState<CbStatus>(c.status);
  const [amount, setAmount] = useState(c.status === "won" && c.wonBack !== c.amount ? c.wonBack.toFixed(2) : "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const parsed = amount.trim() === "" ? undefined : Number(amount.replace(/[$,\s]/g, ""));
  const badAmount = parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0);
  const recovered = status === "won" ? (parsed ?? c.amount) : 0;
  const changed = status !== c.status || (status === "won" && Math.abs(recovered - c.wonBack) > 0.004) || note.trim() !== "" || reason.trim() !== "";
  const canSave = changed && !badAmount;

  const windowDays = WINDOW_DAYS[c.app];
  const left = c.windowCloses ? daysBetween(asOf, c.windowCloses) : null;
  const deadline = {
    v: !windowDays ? "None" : left === null ? `${windowDays} days` : left < 0 ? "Closed" : `${left} ${left === 1 ? "day" : "days"} left`,
    sub: !windowDays ? "No fixed window" : c.windowCloses ? `${left !== null && left < 0 ? "Closed" : "Closes"} ${day(c.windowCloses)}` : `${windowDays}-day window`,
  };

  const save = () => {
    if (!canSave) return;
    onSave({ status, recovered: status === "won" ? recovered : undefined, reason: status === "lost" && reason.trim() ? reason.trim() : undefined, note: note.trim() });
  };

  // Portalled into the ops theme root; the drawer's transform would otherwise trap a fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-3 sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dispute-title"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_16px_48px_rgb(0_0_0/0.18)]"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-(--color-border-default) px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="update-dispute-title" className="text-subtitle-md text-(--color-text-primary)">
              Update dispute
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-(--color-text-secondary)">
              <AppName source={APPS.find((x) => x.key === c.app)!.source} name={`${appLabel(c.app)} · ${c.id}`} />
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-1.5 grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* What ops are deciding on */}
          <dl className="grid grid-cols-3 divide-x divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest)/60">
            {[
              { k: "Charged back", v: cents(c.amount), sub: `${day(c.date)} · ${c.reason}` },
              { k: "Outlet", v: short(c.store), sub: c.store },
              { k: "Deadline", ...deadline },
            ].map((x) => (
              <div key={x.k} className="min-w-0 px-3 py-2.5">
                <dt className="text-body-sm text-(--color-text-secondary)">{x.k}</dt>
                <dd className="truncate text-subtitle-md text-(--color-text-primary) tabular-nums">{x.v}</dd>
                <dd className="truncate text-body-sm text-(--color-text-tertiary)" title={x.sub}>
                  {x.sub}
                </dd>
              </div>
            ))}
          </dl>

          <fieldset>
            <legend className={cn(labelClass, "mb-1.5")}>Status</legend>
            <div role="radiogroup" aria-label="Dispute status" className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={status === s.value}
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-medium border px-3 py-2.5 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                    status === s.value ? "border-(--color-primary) bg-(--color-primary)/8" : "border-(--color-border-default) hover:border-(--color-border-darker)",
                  )}
                >
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-circle", DOT[s.value])} />
                  <span className="min-w-0">
                    <span className="block text-body-md font-medium text-(--color-text-primary)">
                      {OPS_STATUS_LABEL[s.value]}
                      {s.value === c.status && <span className="ml-1.5 font-normal text-(--color-text-tertiary)">· now</span>}
                    </span>
                    <span className="block text-body-sm text-(--color-text-secondary)">{s.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {status === "won" && (
            <TextField
              label="Recovered amount"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={c.amount.toFixed(2)}
              error={badAmount ? "Enter an amount above $0" : undefined}
              hint={
                parsed === undefined || badAmount
                  ? `Leave blank if the full ${cents(c.amount)} came back.`
                  : parsed < c.amount
                    ? `Partial: ${cents(c.amount - parsed)} short of the charge.`
                    : parsed > c.amount
                      ? `${cents(parsed - c.amount)} more than the charge.`
                      : "Full amount."
              }
            />
          )}
          {status === "lost" && <TextField label="Why the app declined (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer photo showed the missing item" />}

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Note (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Context for the team: what was sent, case number, follow-up…" className={cn(fieldClass, "h-auto resize-y py-2")} />
            <span className="text-body-sm text-(--color-text-tertiary)">Only KoreFi ops see notes. The client sees the status and amount.</span>
          </label>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-(--color-border-default) px-5 py-3">
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button type="primary" size="small" htmlType="submit" disabled={!canSave}>
            Save changes
          </Button>
        </footer>
      </form>
    </div>,
    document.querySelector("[data-product]") ?? document.body,
  );
}
