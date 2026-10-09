import type { LedgerRow } from "@/components/dashboard/LedgerTable";
import { fmtCents } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import { channelName, daysLeft, reconcile, windowCloses } from "./dashboard";
import type { Deposit, Dispute, DisputeStatus, Payout } from "./types";

// Turns source records into ledger rows (date, description, amount, status, and the detail the
// drawer shows). Every row is a report of what happened — no step asks the owner to act.

const logo = (source: string) => `/dashboard/${source}.png`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const DISPUTE_STATUS: Record<DisputeStatus, { label: string; tone: LedgerRow["status"]["tone"] }> = {
  won: { label: "Won back", tone: "success" },
  open: { label: "Being disputed", tone: "warning" },
  lost: { label: "Lost", tone: "danger" },
  auto_refunded: { label: "App paid it", tone: "neutral" },
};

export function chargebackRows(disputes: Dispute[], link?: LedgerRow["detail"]["link"]): LedgerRow[] {
  return [...disputes]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => {
      const app = channelName(d.source);
      const signed = d.status === "won" || d.status === "lost";
      const timeline: LedgerRow["detail"]["timeline"] = [{ label: `${app} charged it back`, date: day(d.date), state: "done" }];
      if (d.status === "auto_refunded") timeline.push({ label: `${app} refunded the customer itself`, state: "done" });
      else {
        timeline.push({ label: d.status === "open" ? "KoreFi is disputing it" : "KoreFi disputed it", state: d.status === "open" ? "current" : "done" });
        if (d.status === "won") timeline.push({ label: "Won back", date: d.resolvedDate ? day(d.resolvedDate) : undefined, state: "done" });
        if (d.status === "lost") timeline.push({ label: `Lost. ${app} kept the charge`, state: "failed" });
        if (d.status === "open") {
          const closes = windowCloses(d);
          const left = closes ? daysLeft(closes, PERIOD.end) : undefined;
          timeline.push({ label: closes ? `${app} window closes ${day(closes)}${left! >= 0 ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""}` : `Decision from ${app}`, state: "upcoming" });
        }
      }
      return {
        id: `${d.source}-${d.id}`,
        date: d.date,
        title: d.detail,
        subtitle: `${app} · ${d.reason}`,
        logo: logo(d.source),
        store: d.store,
        app,
        reason: d.reason,
        amount: d.status === "won" ? d.amount : d.status === "lost" ? -d.amount : d.amount,
        signed,
        status: DISPUTE_STATUS[d.status],
        tabs: [d.status, ...(d.status === "won" ? ["in"] : d.status === "lost" ? ["out"] : [])],
        detail: {
          eyebrow: `${app} chargeback`,
          heading: d.detail,
          timeline,
          facts: [
            { label: "Order", value: d.id },
            { label: "Store", value: d.store },
            { label: "Reason", value: d.reason },
            { label: "Charged", value: fmtCents(d.amount) },
          ],
          note:
            d.status === "open"
              ? "KoreFi's team filed this dispute. Nothing is needed from you."
              : d.status === "auto_refunded"
                ? `${app} refunded the customer out of its own pocket, so nothing was charged to you.`
                : undefined,
          link,
        },
      };
    });
}

/** Marketplace payouts as money in (what landed in the bank) and their fees as money out. */
export function payoutRows(payouts: Payout[], deposits: Deposit[]): LedgerRow[] {
  return payouts.flatMap((p) => {
    const app = channelName(p.source);
    const r = reconcile([p], deposits)[0];
    const dep = deposits.find((x) => x.reference.toUpperCase().includes(app.toUpperCase()));
    const short = r.delta < 0;
    const rate = p.gross ? Math.round((p.fees / p.gross) * 100) : 0;
    const rows: LedgerRow[] = [];
    if (dep) {
      rows.push({
        id: `deposit-${p.source}`,
        date: dep.date,
        title: `${app} payout`,
        subtitle: `To Mercury · sales ${p.period}`,
        logo: logo(p.source),
        store: "All stores",
        app,
        amount: dep.amount,
        signed: true,
        status: short ? { label: `${fmtCents(Math.abs(r.delta))} short`, tone: "danger" } : { label: "Matched", tone: "success" },
        tabs: ["in"],
        detail: {
          eyebrow: `${app} → Mercury`,
          heading: `${app} payout`,
          timeline: [
            { label: `Sales period ${p.period}`, state: "done" },
            { label: `${app} paid out ${fmtCents(p.net)}`, state: "done" },
            { label: `${fmtCents(dep.amount)} landed in Mercury`, date: day(dep.date), state: "done" },
            ...(short ? [{ label: `KoreFi is following up on ${fmtCents(Math.abs(r.delta))}`, state: "current" as const }] : []),
          ],
          facts: [
            { label: "Sales", value: fmtCents(p.gross) },
            { label: "Fees", value: `−${fmtCents(p.fees)}` },
            { label: "Paid out", value: fmtCents(p.net) },
            { label: "Reached your bank", value: fmtCents(dep.amount) },
            { label: "Difference", value: short ? `−${fmtCents(Math.abs(r.delta))}` : "None" },
          ],
          link: { label: "Open Payouts", href: "/finance/payout" },
        },
      });
    }
    rows.push({
      id: `fees-${p.source}`,
      date: PERIOD.end,
      title: `${app} commission & fees`,
      subtitle: `${rate}% of sales · ${p.period}`,
      logo: logo(p.source),
      store: "All stores",
      app,
      amount: -p.fees,
      signed: true,
      status: { label: "Taken from payout", tone: "neutral" },
      tabs: ["out"],
      detail: {
        eyebrow: `${app} fees`,
        heading: `${app} commission & fees`,
        timeline: [
          { label: `Sales period ${p.period}`, state: "done" },
          { label: `${app} kept ${fmtCents(p.fees)} before paying out`, state: "done" },
        ],
        facts: [
          { label: "Sales", value: fmtCents(p.gross) },
          { label: "Fees", value: fmtCents(p.fees) },
          { label: "Rate", value: `${rate}% of sales` },
        ],
        link: { label: "Open What you keep", href: "/finance/what-you-keep" },
      },
    });
    return rows;
  });
}
