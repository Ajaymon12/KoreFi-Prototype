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
  cells: { label: string; value: string; sub: string; tone?: Tone }[];
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

/** Masa Kitchen's Thursday email, word for word from the agent-journey prototype (lib/mvp3/masaFixture). */
function fixtureChargebackEmail(restaurant: string): Email {
  const top = FX.flagged[0];
  return {
    kind: "chargebacks",
    subject: `${restaurant} chargebacks, ${FX.WEEK}: ${usd(FX.charged)} · ${FX.flagged.length} outlet to look at`,
    sentAt: "Thu, Nov 12, 8:00 AM",
    lead: `Chargebacks cost you ${usd(FX.charged)} this week, ${usd(FX.charged - FX.USUAL)} more than your usual ${usd(FX.USUAL)}. We won back ${usd(FX.CBST.won)} (${FX.WON_SHARE}% of what we disputed), and ${usd(FX.CBST.todo)} is still to dispute.`,
    cells: [
      { label: "Charged back", value: usd(FX.charged), sub: `▲ ${usd(FX.charged - FX.USUAL)} vs usual`, tone: "danger" },
      { label: "Won back", value: usd(FX.CBST.won), sub: `${FX.WON_SHARE}% of ${usd(FX.DISPUTED)} disputed`, tone: "success" },
      { label: "Still to dispute", value: usd(FX.CBST.todo), sub: "not filed yet" },
    ],
    look: {
      title: top.name,
      tag: `${FX.rateLabel(top)} of app sales`,
      body: `Over your ${FX.LIMIT}% limit. ${top.errors} orders with errors, up from its usual ${top.usual}. 6 were on Wednesday and Thursday, its usual worst days.`,
      amount: usd(top.charged),
      amountSub: "this week",
    },
    note: `Everything else is under ${FX.LIMIT}%: ${FX.fine.map((x) => `${x.name} ${FX.rateLabel(x)}`).join(", ")}.`,
    fresh: "Chips & Queso at Damen: 3 complaints (2 in October).",
    footer: `Your alert limit: ${FX.LIMIT}% of app sales. Reply to this email to change it. Sent by your Chargeback recovery agent.`,
    cta: "Open in KoreFi",
    attachment: "PDF",
    agent: "Chargeback recovery",
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

export function payoutEmail(stores: readonly Store[]): Email {
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
    subject: `3PD payouts, ${wk.label}: ${usd(paid)} paid${off ? ` · ${off} orders not paid` : ""}`,
    sentAt: `${dayLabel(weekDays(LAST).email)}, 8:00 AM`,
    lead: `The apps paid you ${usd(paid)} on ${usd(now.sales)} of sales, ${usd(Math.abs(change))} ${change >= 0 ? "more" : "less"} than last week. ${off ? `${off} orders in Square (${usd(offAmt)}) were not in the apps' reports, and the KoreFi team is checking them with the apps.` : "Every order matched."}`,
    cells: [
      { label: "Paid to you", value: usd(paid), sub: `${signed(change)} vs last week`, tone: change >= 0 ? "success" : "danger" },
      { label: "Apps kept", value: `${Math.round((1 - paid / (now.sales || 1)) * 100)}%`, sub: "of app sales" },
      { label: "Not matched", value: usd(offAmt), sub: `${off} orders`, tone: off ? "danger" : undefined },
    ],
    look: off && worst
      ? { title: worst.label, tag: `${worst.missing.orders} orders not in the app`, body: `Orders Square rang up that ${worst.label} did not report. We claim them and you'll see each one's status in the dashboard.`, amount: usd(worst.missing.amount), amountSub: "not paid" }
      : undefined,
    note: `All ${status.length} payouts arrived on their usual day.`,
    cta: "Open in KoreFi",
    attachment: "Payouts.xlsx",
    agent: "Payout reconciliation",
  };
}

export const emailOf = (kind: EmailKind, stores: readonly Store[], restaurant?: string) => (kind === "chargebacks" ? chargebackEmail(stores, restaurant) : payoutEmail(stores));
