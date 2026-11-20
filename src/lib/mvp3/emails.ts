import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { APPS, chargebacks } from "@/lib/finance/chargebacks";
import { addPayout, moneyInOf, payout, zeroPayout } from "@/lib/finance/payouts";
import { shortStore, type Store } from "@/lib/finance/outlets";
import { appStatuses, dayLabel, weekDays } from "./payoutStatus";
import { outletDive, topOutlet } from "./outletDive";
import * as FX from "./masaFixture";

// MVP 3: the weekly email each pinned dashboard sends ("Every Thursday, 8:00 AM · email + dashboard"). The email is
// the owner's first look at the week, so it carries the same headline, three numbers and "needs a look" the dashboard
// opens on, and one button into KoreFi. Where it is shown in the product: the schedule popover and the dashboard's
// "emails you" line (components/mvp3/EmailPreview). Figures come from the same sources as the dashboards.

export type EmailKind = "chargebacks" | "payouts";
export type Tone = "success" | "danger";
export type Email = {
  kind: EmailKind;
  subject: string;
  /** "Thu, Oct 1, 8:00 AM" */
  sentAt: string;
  lead: string;
  /** Left out for a short email (the chargebacks email: no tiles, the PDF holds the detail). */
  cells?: { label: string; value: string; sub: string; tone?: Tone }[];
  /** "Needs a look" paragraphs; **text** is bold. */
  looks?: string[];
  /** The order only the owner can answer (Masa's payout week), as a Yes/No card. */
  action?: boolean;
  /** Replaces "or see the … attached" beside the button ("Full review attached (PDF)"). */
  attachmentLine?: string;
  /** A small table under the lead (the payouts email: orders and mismatches by app). */
  table?: { head: string[]; rows: string[][] };
  /** The last line ("Nothing is needed from you."). */
  closing?: string;
  look?: { title: string; tag: string; body: string; amount: string; amountSub: string };
  note?: string;
  /** A "New" item under the note ("Chips & Queso at Damen: 3 complaints"). */
  fresh?: string;
  /** Replaces the default footer. */
  footer?: string;
  cta: string;
  attachment: string;
  /** "Sent by your Chargeback recovery agent." */
  agent: string;
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const signed = (n: number) => `${n < 0 ? "−" : "+"}${usd(Math.abs(n))}`;

/** The workflow ids that email a dashboard. */
export const emailKindOf = (workflow: string): EmailKind | null => (workflow === "chargebacks" ? "chargebacks" : workflow === "payouts" ? "payouts" : null);

/** Masa Kitchen's Thursday chargebacks email (leadership flow 1, 2026-11-20): short, read on a phone. No tiles, no
 *  per-outlet list; the 2-page PDF attached holds the detail. **text** is bold. */
function fixtureChargebackEmail(restaurant: string): Email {
  const top = FX.flagged[0];
  return {
    kind: "chargebacks",
    subject: `${restaurant} chargebacks, ${FX.WEEK}: ${usd(FX.charged)} charged, ${usd(FX.CBST.won)} won back`,
    sentAt: "Thu, Nov 12, 8:00 AM",
    lead: `Chargebacks cost you **${usd(FX.charged)}** for ${FX.WEEK}, ${usd(FX.charged - FX.USUAL)} more than your usual ${usd(FX.USUAL)}. We've won back **${usd(FX.CBST.won)}** so far and are filing disputes for the other ${usd(FX.CBST.todo)}.`,
    looks: [`**${top.name}: ${usd(top.charged)}, ${FX.rateLabel(top)} of app sales** (your limit is ${FX.LIMIT}%). ${top.errors} orders with errors, up from its usual ${top.usual}.`],
    note: `All other outlets are under ${FX.LIMIT}%.`,
    footer: "",
    cta: "Open in KoreFi",
    attachment: "PDF",
    attachmentLine: "Full review attached (PDF)",
    agent: "Chargeback recovery",
  };
}

/** The same email in a quiet week, when no outlet is over the limit (leadership flow 1). Not used by the demo week. */
export function quietChargebackEmail(restaurant = "Masa Kitchen", charged = 290): Email {
  return {
    kind: "chargebacks",
    subject: `${restaurant} chargebacks, ${FX.WEEK}: ${usd(charged)} charged`,
    sentAt: "Thu, Nov 12, 8:00 AM",
    lead: `Chargebacks for ${FX.WEEK} were **${usd(charged)}**, below your usual ${usd(FX.USUAL)}. No outlet is over your ${FX.LIMIT}% limit. Nothing is needed from you.`,
    footer: "",
    cta: "Open in KoreFi",
    attachment: "PDF",
    attachmentLine: "Full review attached (PDF)",
    agent: "Chargeback recovery",
  };
}

/** Masa Kitchen's Friday payouts email (2026-11-20 revision): only whether each app's orders matched Toast, and how
 *  many didn't. KoreFi follows up on those with the apps, so nothing is needed from the owner. */
function fixturePayoutEmail(restaurant: string): Email {
  const off = (app: FX.PayKey) => FX.UNMATCHED.filter((u) => u.app === app);
  return {
    kind: "payouts",
    subject: `${restaurant} payouts, ${FX.WEEK}: ${FX.ORDERS.unpaid} of ${FX.ORDERS.toast.toLocaleString("en-US")} orders didn't match`,
    sentAt: "Fri, Nov 13, 8:00 AM",
    lead: `For ${FX.WEEK}, ${FX.ORDERS.paid.toLocaleString("en-US")} of ${FX.ORDERS.toast.toLocaleString("en-US")} delivery orders matched between Toast and the apps. ${FX.ORDERS.unpaid} orders (${FX.usd2(FX.UNPAID)}) didn't, and we're following up with the apps.`,
    table: {
      head: ["App", "Orders", "Not matched"],
      rows: FX.PAY.map((p) => {
        const o = off(p.app);
        return [FX.PAY_APP[p.app], p.orders.toLocaleString("en-US"), o.length ? `${o.length} · ${FX.usd2(o.reduce((n, u) => n + u.amount, 0))}` : "All matched"];
      }),
    },
    footer: "",
    cta: "Open in KoreFi",
    attachment: "Excel",
    attachmentLine: "Details attached (Excel)",
    closing: "Nothing is needed from you.",
    agent: "Payout reconciliation",
  };
}

/** The same email in a clean week, when every order matched. Not used by the demo week. */
export function cleanPayoutEmail(restaurant = "Masa Kitchen"): Email {
  return {
    kind: "payouts",
    subject: `${restaurant} payouts, ${FX.WEEK}: all ${FX.ORDERS.toast.toLocaleString("en-US")} orders matched`,
    sentAt: "Fri, Nov 13, 8:00 AM",
    lead: `For ${FX.WEEK}, all ${FX.ORDERS.toast.toLocaleString("en-US")} delivery orders matched between Toast and the apps. Nothing is needed from you.`,
    footer: "",
    cta: "Open in KoreFi",
    attachment: "Excel",
    attachmentLine: "Details attached (Excel)",
    agent: "Payout reconciliation",
  };
}

export function chargebackEmail(stores: readonly Store[], restaurant = "Your"): Email {
  if (FX.masaFixture()) return fixtureChargebackEmail(restaurant);
  const week = WEEKS[LAST];
  const rows = chargebacks(WEEKS, LAST, LAST, stores);
  const before = chargebacks(WEEKS, LAST - 4, LAST - 1, stores);
  const charged = rows.reduce((n, c) => n + c.amount, 0);
  const usual = before.reduce((n, c) => n + c.amount, 0) / 4;
  const won = rows.reduce((n, c) => n + c.wonBack, 0);
  const open = rows.filter((c) => c.status === "disputing" || c.status === "new").reduce((n, c) => n + c.amount, 0);
  const top = topOutlet(stores);
  const d = top ? outletDive(top) : null;
  const sent = dayLabel(weekDays(LAST).email);
  return {
    kind: "chargebacks",
    subject: `Chargebacks, ${week.label}: ${usd(charged)}${d ? ` · ${shortStore(d.store)} needs a look` : ""}`,
    sentAt: `${sent}, 8:00 AM`,
    lead: `Chargebacks cost you ${usd(charged)} this week, ${usd(Math.abs(charged - usual))} ${charged >= usual ? "more" : "less"} than your usual ${usd(usual)}. We have won back ${usd(won)}, and ${usd(open)} is still being disputed.`,
    cells: [
      { label: "Charged back", value: usd(charged), sub: `${rows.length} orders`, tone: charged > usual ? "danger" : undefined },
      { label: "Won back", value: usd(won), sub: "so far", tone: "success" },
      { label: "Being disputed", value: usd(open), sub: "the KoreFi team is on it" },
    ],
    look: d && d.n
      ? {
          title: d.name,
          tag: `${d.n} orders with errors, usual ${d.usual}`,
          body: d.findings.join(" "),
          amount: usd(d.charged),
          amountSub: "this week",
        }
      : undefined,
    note: (() => {
      const others = new Set(rows.filter((c) => c.store !== top).map((c) => c.store)).size;
      return others ? `${others} other ${others === 1 ? "outlet" : "outlets"} had chargebacks. The dashboard lists them all.` : undefined;
    })(),
    cta: "Open in KoreFi",
    attachment: "Chargebacks.pdf",
    agent: "Chargeback recovery",
  };
}

export function payoutEmail(stores: readonly Store[], restaurant = "Your"): Email {
  if (FX.masaFixture()) return fixturePayoutEmail(restaurant);
  const wk = WEEKS[LAST];
  const total = (w: number) => APPS.reduce((n, a) => addPayout(n, payout(a.key, stores, [WEEKS[w]])), zeroPayout());
  const now = total(LAST);
  const prev = total(LAST - 1);
  const paid = moneyInOf(now);
  const change = paid - moneyInOf(prev);
  const status = appStatuses(LAST, stores, "sent");
  const off = status.reduce((n, s) => n + s.missing.orders, 0);
  const offAmt = status.reduce((n, s) => n + s.missing.amount, 0);
  const worst = [...status].sort((a, b) => b.missing.amount - a.missing.amount)[0];
  return {
    kind: "payouts",
    subject: `Delivery payouts, ${wk.label}: ${usd(paid)} paid${off ? ` · ${off} orders not paid` : ""}`,
    sentAt: `${dayLabel(weekDays(LAST).email)}, 8:00 AM`,
    lead: `The apps paid you ${usd(paid)} on ${usd(now.sales)} of sales, ${usd(Math.abs(change))} ${change >= 0 ? "more" : "less"} than last week. ${off ? `${off} orders in Toast (${usd(offAmt)}) were not in the apps' reports, and the KoreFi team is checking them with the apps.` : "Every order matched."}`,
    cells: [
      { label: "Paid to you", value: usd(paid), sub: `${signed(change)} vs last week`, tone: change >= 0 ? "success" : "danger" },
      { label: "Apps kept", value: `${Math.round((1 - paid / (now.sales || 1)) * 100)}%`, sub: "of app sales" },
      { label: "Not matched", value: usd(offAmt), sub: `${off} orders`, tone: off ? "danger" : undefined },
    ],
    look: off && worst
      ? { title: worst.label, tag: `${worst.missing.orders} orders not in the app`, body: `Orders Toast rang up that ${worst.label} did not report. We claim them and you'll see each one's status in the dashboard.`, amount: usd(worst.missing.amount), amountSub: "not paid" }
      : undefined,
    note: `All ${status.length} payouts arrived on their usual day.`,
    cta: "Open in KoreFi",
    attachment: "Payouts.xlsx",
    agent: "Payout reconciliation",
  };
}

export const emailOf = (kind: EmailKind, stores: readonly Store[], restaurant?: string) => (kind === "chargebacks" ? chargebackEmail(stores, restaurant) : payoutEmail(stores, restaurant));
