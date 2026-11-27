"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { emailKindOf, emailOf, type Email, type EmailKind } from "@/lib/mvp3/emails";
import { useAccount } from "./AccountSwitcher";
import { useOnboarding } from "./Onboarding";
import { Modal } from "./Modal";
import { useOpenPinned } from "./Mvp3Sidebar";
import { Button } from "@/components/ui/Button";
import { OrderAction } from "./OrderAction";

// MVP 3: the weekly email a pinned dashboard sends, shown where the owner decides to get it or checks what it says:
//   - the schedule popover, under "Email the summary"
//   - the dashboard's "Runs every Thursday, emails you" line
//   - the agent's page, beside "Emails <address>"
// The email is the owner's first look at the week: the headline, three numbers, what needs a look, and one button
// into KoreFi. It has the same figures as the dashboard it comes from.

const DASH: Record<EmailKind, string> = { chargebacks: "dash-chargebacks", payouts: "report-payouts" };
const tone = (t?: "success" | "danger") => (t === "danger" ? "text-(--color-text-danger)" : t === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)");

/** A link-style button that opens the email for a workflow's dashboard. Nothing for a workflow that sends none. */
export function EmailPreviewButton({ workflow, label = "Preview the email", className }: { workflow: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const kind = emailKindOf(workflow);
  if (!kind) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5", className)}>
        <Mail aria-hidden />
        {label}
      </button>
      {open && <EmailModal kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EmailModal({ kind, onClose }: { kind: EmailKind; onClose: () => void }) {
  const { account } = useAccount();
  const { profile, isNew } = useOnboarding();
  const to = isNew && profile.email ? profile.email : user.email;
  const mail = useMemo<Email>(() => emailOf(kind, account.stores, account.name), [kind, account.stores, account.name]);
  const openPinned = useOpenPinned();
  const router = useRouter();
  const go = () => {
    onClose();
    if (!openPinned(DASH[kind])) router.push(`/dashboard?id=${DASH[kind]}`);
  };
  return (
    <Modal label="Weekly email" onClose={onClose} width={680}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-(--color-neutral-lightest) p-3 pt-12 sm:p-6 sm:pt-12">
        <p className="mb-2 text-center text-body-sm text-(--color-text-secondary)">This is the email you get, with this week&apos;s figures.</p>
        <EmailBody mail={mail} to={to} onCta={go} />
      </div>
    </Modal>
  );
}

/** The email itself: header, greeting, figures, what needs a look, the button into KoreFi.
 *  `bare`: no card or header, for a mail client that shows the subject and sender itself (the demo inbox). */
/** **text** in bold (the email's key figures). */
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") ? <b key={i} className="font-semibold">{part.slice(2, -2)}</b> : part));
}

export function EmailBody({ mail, to, onCta, bare = false }: { mail: Email; to: string; onCta: () => void; bare?: boolean }) {
  return (
  <article className={cn("overflow-hidden bg-white text-(--color-text-primary)", bare ? "" : "rounded-large border border-(--color-border-default) shadow-sm")}>
    {!bare && (
    <header className="space-y-1 border-b border-(--color-border-default) px-5 py-4">
      <h2 className="text-subtitle-md font-medium">{mail.subject}</h2>
      <p className="text-body-sm text-(--color-text-secondary)">
        KoreFi &lt;reports@korefi.com&gt; to {user.firstName} ({to}) · {mail.sentAt}
      </p>
    </header>
    )}
    <div className="space-y-4 px-5 py-5">
      <p className="text-body-lg">
        Hi {user.firstName},<br />
        {rich(mail.lead)}
      </p>
      {mail.cells && (
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-border-default)">
        {mail.cells.map((c) => (
          <div key={c.label} className="min-w-0 bg-white px-3 py-2.5">
            <dt className="truncate text-body-sm text-(--color-text-secondary)">{c.label}</dt>
            <dd className={cn("text-subtitle-lg font-medium tabular-nums", tone(c.tone))}>{c.value}</dd>
            <dd className="truncate text-body-sm text-(--color-text-secondary)">{c.sub}</dd>
          </div>
        ))}
      </dl>
      )}
      {mail.table && (
        <table className="w-full overflow-hidden rounded-large border border-(--color-border-default) text-left text-body-md">
          <thead className="bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary)">
            <tr>{mail.table.head.map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 font-medium", i > 0 && "text-right")}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-(--color-border-default)">
            {mail.table.rows.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i} className={cn("px-3 py-2 tabular-nums", i > 0 && "text-right", i === 2 && c === "All matched" && "text-(--color-text-success)")}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      {mail.action && <OrderAction />}
      {mail.looks && (
        <section aria-label="Needs a look" className="space-y-1">
          <h3 className="text-body-md font-semibold">Needs a look</h3>
          {mail.looks.map((l) => (
            <p key={l} className="text-body-md">{rich(l)}</p>
          ))}
        </section>
      )}
      {mail.look && (
        <section aria-label="Needs a look" className="space-y-2">
          <h3 className="text-body-md font-medium">Needs a look</h3>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 rounded-large border border-(--color-border-default) border-l-[3px] border-l-(--color-danger-darkest) p-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <b className="font-medium">{mail.look.title}</b>
                <span className="rounded-circle bg-(--color-danger-lightest) px-2 py-0.5 text-body-sm text-(--color-danger-darkest)">{mail.look.tag}</span>
              </p>
              <p className="mt-1 text-body-sm text-(--color-text-secondary)">{mail.look.body}</p>
            </div>
            <p className="text-right text-subtitle-lg font-medium tabular-nums">
              {mail.look.amount}
              <span className="block text-body-sm font-normal text-(--color-text-secondary)">{mail.look.amountSub}</span>
            </p>
          </div>
        </section>
      )}
      {mail.note && <p className={mail.looks ? "text-body-md" : "text-body-sm text-(--color-text-secondary)"}>{mail.note}</p>}
      {mail.fresh && (
        <p className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
          <span className="rounded-circle bg-(--color-warning-lightest) px-2 py-0.5 font-medium text-(--color-warning-darkest)">New</span>
          {mail.fresh}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="primary" size="medium" onClick={onCta}>
          {mail.cta}
        </Button>
        <span className="inline-flex items-center gap-1 text-body-sm text-(--color-text-secondary)">
          <Paperclip className="size-3.5" aria-hidden /> {mail.attachmentLine ?? `or see the ${mail.attachment} attached`}
        </span>
      </div>
      {mail.closing && <p className="text-body-md">{mail.closing}</p>}
    </div>
    {mail.footer !== "" && (
    <footer className="border-t border-(--color-border-default) px-5 py-3 text-body-sm text-(--color-text-secondary)">
      {mail.footer ?? `Sent by your ${mail.agent} agent, every Thursday at 8:00 AM. Change or turn this off from the dashboard's schedule.`}
    </footer>
    )}
  </article>
  );
}
