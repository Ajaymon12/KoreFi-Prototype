import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { APPS, appLabel, type AppKey } from "@/lib/finance/chargebacks";
import { reconcile } from "@/lib/finance/reconcile";
import type { Store } from "@/lib/finance/outlets";

// MVP 3 / 3PD Payouts, week by week. A payout week isn't finished the day it ends: each app's report and its
// payout land on their own days, and the KoreFi agent checks a week as its reports arrive. Until the Thursday
// email the owner can open KoreFi and see which apps are checked ("mid-week"); a week the email already covered
// is complete. The figures are the real reconcile() for that week; the arrival days are each app's usual schedule,
// counted back from the email so the week reads the same whichever week it is.
//   DoorDash    report 4 days before the email, pays the day before it
//   Uber Eats   pays 4 days before the email, its order report arrives 2 days before it (so it's the last one in)
//   Grubhub     daily reports, pays 2 days before the email
// The email goes out on the first Thursday a week or more after the week ends, so every arrival is after the week's end.
// Prototype: the schedule is fixed; in the product it comes from each app's payout history.

const DAY = 86_400_000;
const SCHEDULE: Record<AppKey, { report: number; pay: number; reports: string; payNote?: string }> = {
  doordash: { report: -4, pay: -1, reports: "Weekly report" },
  uber: { report: -2, pay: -4, reports: "Weekly report", payNote: "Paid before its order report arrives" },
  grubhub: { report: -8, pay: -2, reports: "Daily reports" },
};

/** Which day of a payout week the owner looks at it: before the email, or once it has gone out. */
export type AsOf = "mid" | "sent";

const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The week's end, the day its email goes out (the first Thursday a week or more after it) and the mid-week day (3 days before it). */
export function weekDays(week: number) {
  const end = WEEKS[week].start.getTime() + 6 * DAY;
  let email = end + 7 * DAY;
  while (new Date(email).getUTCDay() !== 4) email += DAY;
  return { end, email, mid: email - 3 * DAY };
}

export type AppStatus = {
  app: AppKey;
  label: string;
  /** "Arrived Mon, Sep 28" or "Due Wed, Sep 30". */
  report: string;
  reportIn: boolean;
  /** "1,319 of 1,322 matched", or "Not checked yet". */
  orders: string;
  /** In Square, not in the app: what the app hasn't paid for. */
  missing: { orders: number; amount: number };
  payout: string;
  paid: boolean;
  state: "paid" | "checked" | "waiting";
};

export function appStatuses(week: number, stores: readonly Store[], asOf: AsOf): AppStatus[] {
  const days = weekDays(week);
  const now = asOf === "mid" && week === LAST ? days.mid : days.email;
  return APPS.map((a) => {
    const s = SCHEDULE[a.key];
    const rec = reconcile(a.key, stores, [WEEKS[week]]);
    const reportAt = days.email + s.report * DAY;
    const payAt = days.email + s.pay * DAY;
    const reportIn = reportAt <= now;
    const paid = payAt <= now;
    const total = rec.matchedOrders + rec.posOnly.orders;
    // Nothing is checked until the app's report is in.
    const missing = reportIn ? { orders: rec.posOnly.orders, amount: rec.posOnly.amount } : { orders: 0, amount: 0 };
    const daily = a.key === "grubhub";
    return {
      app: a.key,
      label: appLabel(a.key),
      report: daily ? (reportIn ? "Daily, in through week end" : "Daily, still coming") : reportIn ? `Arrived ${fmt(reportAt)}` : `Due ${fmt(reportAt)}`,
      reportIn,
      orders: !reportIn ? "Not checked yet" : `${rec.matchedOrders.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} matched${missing.orders ? ` · ${missing.orders} not in the app (${money(missing.amount)})` : ""}`,
      missing,
      payout: paid ? `Paid ${fmt(payAt)}` : `Due ${fmt(payAt)}`,
      paid,
      state: !reportIn ? "waiting" : paid ? "paid" : "checked",
    };
  });
}

/** What comes next in a week that isn't finished, soonest first. */
export function nextSteps(week: number, stores: readonly Store[]): { day: string; what: string }[] {
  const days = weekDays(week);
  const rows: { at: number; what: string }[] = [];
  for (const st of appStatuses(week, stores, "mid")) {
    const s = SCHEDULE[st.app];
    if (!st.reportIn) rows.push({ at: days.email + s.report * DAY, what: `${st.label} report arrives and its orders are checked.` });
    if (!st.paid) rows.push({ at: days.email + s.pay * DAY, what: `${st.label} pays.` });
  }
  rows.push({ at: days.email, what: "You get one email with the full payout check, at 8 AM." });
  return rows.sort((a, b) => a.at - b.at).map((r) => ({ day: fmt(r.at), what: r.what }));
}

export const weekRangeLabel = (week: number) => WEEKS[week].label;
export const asOfLabel = (week: number, asOf: AsOf) => fmt(asOf === "mid" && week === LAST ? weekDays(week).mid : weekDays(week).email);
export { fmt as dayLabel };
