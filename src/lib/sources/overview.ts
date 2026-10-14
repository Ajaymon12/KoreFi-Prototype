import { channelName, moneyByStore, pctChange, reconcile, sum, type DashboardData, type StoreMoney } from "./dashboard";
import { fmtCents } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import type { Dispute } from "./types";

// Selectors behind Home / Overview: the store scope, the weekly brief, the ranked "things to
// know" and the rows that feed "Follow your money" and "Your stores". Everything returned here
// is plain data so the client pieces (food-cost slider, Simplify switch) can work on it.

export type Scope = { store: string | null; stores: string[]; label: string };

export function scopeFor(param: string | undefined, all: string[]): Scope {
  const store = param && all.includes(param) ? param : null;
  return { store, stores: store ? [store] : all, label: store ?? (all.length === 2 ? "Both stores" : `All ${all.length} stores`) };
}

/** "Tue 6 Oct" for an ISO date. */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const weekday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const cents = (n: number) => `${Math.round(n * 100)}¢`;
const signedPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;

// ---- Your stores ----

export type StoreRow = StoreMoney & { change: number };

/** Store money plus the sales change vs the previous period (from each app's store report). */
export function storeRows(d: DashboardData, scope: Scope): StoreRow[] {
  return moneyByStore(d.payouts, d.storefronts, scope.stores).map((s) => {
    const ops = d.ops.filter((o) => o.store === s.store);
    return { ...s, change: pctChange(sum(ops.map((o) => o.sales)), sum(ops.map((o) => o.previousSales))) };
  });
}

// ---- Weekly brief ----

/** The strip shows `amount` + `amountLabel`, the `change` chip and the `flag`; `headline` and
 * `note` (one labelled line per topic) are the weekly note behind it. */
export type Brief = {
  eyebrow: string;
  date: string;
  amount: number;
  amountLabel: string;
  change?: { value: number; label: string };
  flag?: string;
  headline: string;
  note: { label: string; text: string; lines?: string[] }[];
};

export function briefFor(d: DashboardData, scope: Scope, rows: StoreRow[]): Brief {
  const open = d.disputes.filter((x) => x.status === "open" && scope.stores.includes(x.store));
  const flag = open.length ? `${open.length} chargeback${open.length > 1 ? "s" : ""} in dispute` : undefined;
  const date = weekday(PERIOD.end);
  const eyebrow = `Weekly brief · ${date}`;
  if (scope.store) {
    const paid = sum(rows.map((r) => r.net));
    return {
      eyebrow,
      date,
      amount: paid,
      amountLabel: "paid by the apps this period",
      change: { value: rows[0]?.change ?? 0, label: "app sales" },
      flag,
      headline: `${fmtCents(paid)} paid to ${scope.store} by the delivery apps`,
      note: [
        { label: "Paid to you", text: fmtCents(paid), lines: rows[0]?.channels.map((c) => `${c.name} ${fmtCents(c.net)}`) },
        { label: "App sales", text: `${fmtCents(rows[0]?.gross ?? 0)}, ${signedPct(rows[0]?.change ?? 0)} on the period before` },
      ],
    };
  }
  // Bank deposits aren't split by store, so the brief only reads them for all stores.
  const deps = d.deposits.filter((x) => /DOORDASH|UBER/i.test(x.reference)).sort((a, b) => a.date.localeCompare(b.date));
  const pos = d.sales.find((s) => s.source === "square");
  const [prev, last] = pos ? pos.weekly.slice(-2).map((w) => w.netSales) : [0, 0];
  return {
    eyebrow,
    date,
    amount: sum(deps.map((x) => x.amount)),
    amountLabel: "reached your bank this week",
    change: prev ? { value: pctChange(last, prev), label: "sales vs last week" } : undefined,
    flag,
    headline: `${fmtCents(sum(deps.map((x) => x.amount)))} reached your bank from the delivery apps this week`,
    note: [
      { label: "Money in", text: fmtCents(sum(deps.map((x) => x.amount))), lines: deps.map((x) => `${/UBER/i.test(x.reference) ? "Uber Eats" : "DoorDash"} ${fmtCents(x.amount)} · ${weekday(x.date)}`) },
      { label: "By store", text: "Paid this period", lines: rows.map((r) => `${r.store} ${fmtCents(r.net)}`) },
      ...(prev ? [{ label: "Sales", text: `${fmtCents(last)} last week, ${last >= prev ? "up" : "down"} ${Math.abs(pctChange(last, prev) * 100).toFixed(1)}% on ${fmtCents(prev)} the week before` }] : []),
    ],
  };
}

// ---- Things to know ----

export type InsightTag = "onit" | "watch" | "good" | "info";
export type Step = { label: string; value: string; src?: string; result?: "bad" | "good" | "plain" };
/** The MVP report an insight belongs on. "overview" = only on the overview's top list. */
export type InsightPage = "profit" | "payouts" | "chargebacks" | "promos" | "overview";
export type Insight = {
  id: string;
  cowork: "finance" | "operations" | "growth";
  page: InsightPage;
  tag: InsightTag;
  sure: boolean;
  big: string;
  bigTone?: "danger" | "success";
  bigSub: string;
  title: string;
  line: string;
  steps: Step[];
  source: string;
  wrong?: string;
  href: string;
  /** Dollar effect on profit, used to rank. */
  impact: number;
};

const where = (x: { store: string; source: string }) => `${x.store} · ${channelName(x.source)}`;
const disputeSteps = (rows: Dispute[]) => rows.map((x) => ({ label: x.detail, value: fmtCents(x.amount), src: `${weekday(x.date)} · ${where(x)}` }));

/** Every finding we can make from the data, ranked: things being handled or worth watching by
 * dollar effect, then good news, then the rest. The page shows the top three. */
export function insightsFor(d: DashboardData, scope: Scope, rows: StoreRow[]): Insight[] {
  const out: Insight[] = [];
  const inScope = <T extends { store: string }>(xs: T[]) => xs.filter((x) => scope.stores.includes(x.store));
  const disputes = inScope(d.disputes);

  // Payout vs bank: deposits aren't split by store, so only for all stores.
  if (!scope.store) {
    for (const p of d.payouts) {
      const r = reconcile([p], d.deposits)[0];
      if (r.delta >= 0) continue;
      const dep = d.deposits.find((x) => x.reference.toUpperCase().includes(r.channel.toUpperCase()));
      out.push({
        id: `gap-${p.source}`, cowork: "finance", page: "payouts", tag: "onit", sure: true,
        big: `−${fmtCents(-r.delta)}`, bigTone: "danger", bigSub: "not in your bank yet",
        title: `${r.channel} paid out ${fmtCents(-r.delta)} more than reached your bank`,
        line: `KoreFi is following it up with ${r.channel}. Nothing for you to do.`,
        steps: [
          { label: `${r.channel} says it paid you`, value: fmtCents(r.expected), src: `${r.channel} payout report · ${p.period}` },
          { label: "Deposit in your bank", value: fmtCents(r.deposited), src: dep ? `Mercury · ${weekday(dep.date)}` : "Mercury" },
          { label: "Missing", value: `−${fmtCents(-r.delta)}`, result: "bad" },
        ],
        source: `${r.channel} payout report and Mercury`,
        wrong: `${r.channel} split the payout and the rest lands in a later deposit.`,
        href: "/finance/reconciliation", impact: -r.delta,
      });
    }
  }

  // Paused on an app.
  const down = inScope(d.storefronts).filter((s) => s.downtimeMinutes > 0).sort((a, b) => b.estLostRevenue - a.estLostRevenue);
  if (down.length) {
    const lost = sum(down.map((s) => s.estLostRevenue));
    const w = down[0];
    out.push({
      id: "down", cowork: "operations", page: "profit", tag: "watch", sure: false,
      big: `−${fmtCents(lost)}`, bigTone: "danger", bigSub: "sales missed while paused",
      title: `${w.store} was paused on ${channelName(w.source)} for ${w.downtimeMinutes} min${w.cause ? ` (${w.cause.toLowerCase()})` : ""}`,
      line: `${sum(down.map((s) => s.downtimeMinutes))} minutes closed on the apps this period, across ${down.length} storefront${down.length > 1 ? "s" : ""}.`,
      steps: [
        ...down.map((s) => ({ label: where(s), value: fmtCents(s.estLostRevenue), src: `${s.downtimeMinutes} min closed${s.cause ? ` · ${s.cause}` : ""}` })),
        ...(down.length > 1 ? [{ label: "Sales missed", value: `−${fmtCents(lost)}`, result: "bad" as const }] : []),
      ],
      source: "DoorDash store report and Uber Eats downtime report. Sales missed = minutes closed × your usual sales per minute on that app.",
      wrong: "Some customers wait and order later, so the real loss can be smaller.",
      href: "/operations/wait-and-downtime", impact: lost,
    });
  }

  // Chargebacks: being disputed, won back, lost.
  const open = disputes.filter((x) => x.status === "open");
  if (open.length) {
    const amt = sum(open.map((x) => x.amount));
    out.push({
      id: "open", cowork: "operations", page: "chargebacks", tag: "onit", sure: true,
      big: fmtCents(amt), bigTone: "success", bigSub: "you can still get back",
      title: `${open.length} chargeback${open.length > 1 ? "s are" : " is"} being disputed for you`,
      line: `KoreFi's operations team filed ${open.length > 1 ? "them" : "it"} and is following up with the apps. Nothing for you to do.`,
      steps: [...disputeSteps(open), { label: "Being disputed", value: fmtCents(amt), result: "good" }],
      source: "DoorDash and Uber Eats order-error reports", href: "/operations/chargeback", impact: amt,
    });
  }
  const won = disputes.filter((x) => x.status === "won");
  if (won.length) {
    const amt = sum(won.map((x) => x.amount));
    out.push({
      id: "won", cowork: "operations", page: "chargebacks", tag: "good", sure: true,
      big: fmtCents(amt), bigTone: "success", bigSub: `won back on ${won.length} chargeback${won.length > 1 ? "s" : ""}`,
      title: `${fmtCents(amt)} of chargebacks came back to you`,
      line: "Paid back by the apps after KoreFi disputed them.",
      steps: [...disputeSteps(won), { label: "Won back", value: fmtCents(amt), result: "good" }],
      source: "DoorDash and Uber Eats payout reports", href: "/operations/chargeback", impact: amt,
    });
  }
  const lost = disputes.filter((x) => x.status === "lost");
  if (lost.length) {
    const amt = sum(lost.map((x) => x.amount));
    const reasons = lost.map((x) => x.reason);
    const top = [...new Set(reasons)].sort((a, b) => reasons.filter((r) => r === b).length - reasons.filter((r) => r === a).length)[0];
    out.push({
      id: "lost", cowork: "operations", page: "chargebacks", tag: "info", sure: true,
      big: `−${fmtCents(amt)}`, bigTone: "danger", bigSub: "chargebacks the apps kept",
      title: `${lost.length} chargeback${lost.length > 1 ? "s" : ""} couldn't be won back, mostly "${top.toLowerCase()}"`,
      line: "These were disputed but the apps sided with the customer.",
      steps: [...disputeSteps(lost), { label: "Lost", value: `−${fmtCents(amt)}`, result: "bad" }],
      source: "DoorDash and Uber Eats order-error reports", href: "/operations/order-quality", impact: amt,
    });
  }

  // Driver waits that got worse.
  const waits = inScope(d.ops).filter((o) => o.avoidableWaitMin > o.previousAvoidableWaitMin).sort((a, b) => b.avoidableWaitMin - a.avoidableWaitMin);
  if (waits.length) {
    const w = waits[0];
    out.push({
      id: "wait", cowork: "operations", page: "overview", tag: "watch", sure: true,
      big: `${w.avoidableWaitMin.toFixed(1)} min`, bigSub: `driver wait · ${channelName(w.source)}`,
      title: `Drivers wait longer at ${w.store} on ${channelName(w.source)}`,
      line: `Up from ${w.previousAvoidableWaitMin.toFixed(1)} min the period before. Long waits can push the app to show you less.`,
      steps: inScope(d.ops).map((o) => ({ label: where(o), value: `${o.avoidableWaitMin.toFixed(1)} min`, src: `was ${o.previousAvoidableWaitMin.toFixed(1)} min` })),
      source: "Time between order ready and driver pickup, DoorDash and Uber Eats", href: "/operations/wait-and-downtime", impact: 0,
    });
  }

  // Which app pays more of every $1.
  const apps = d.payouts
    .map((p) => {
      const s = p.byStore.filter((x) => scope.stores.includes(x.store));
      return { name: channelName(p.source), gross: sum(s.map((x) => x.gross)), net: sum(s.map((x) => x.net)) };
    })
    .filter((a) => a.gross > 0);
  if (apps.length > 1) {
    const [hi, lo] = [...apps].sort((a, b) => b.net / b.gross - a.net / a.gross);
    out.push({
      id: "per", cowork: "finance", page: "profit", tag: "info", sure: true,
      big: `${cents(hi.net / hi.gross)} vs ${cents(lo.net / lo.gross)}`, bigSub: `paid to you of every $1: ${hi.name} vs ${lo.name}`,
      title: `${hi.name} pays you a little more of every $1 than ${lo.name}`,
      line: "After commission, fees and promos, before food cost.",
      steps: [
        ...apps.map((a) => ({ label: `${a.name} paid you`, value: `${cents(a.net / a.gross)} of every $1`, src: `${fmtCents(a.net)} of ${fmtCents(a.gross)} sold` })),
      ],
      source: `DoorDash and Uber Eats payout reports, ${PERIOD.range}`, href: "/operations/fees-and-commissions", impact: 0,
    });
  }

  // Orders across every channel (POS + apps), all stores only; needs a POS to count every channel.
  if (!scope.store && d.sales.length) {
    const orders = sum(d.sales.map((s) => s.orders));
    const prev = sum(d.sales.map((s) => s.previousOrders));
    const up = orders >= prev;
    out.push({
      id: "orders", cowork: "growth", page: "profit", tag: up ? "good" : "watch", sure: true,
      big: `${up ? "+" : "−"}${Math.abs(orders - prev).toLocaleString("en-US")}`, bigTone: up ? "success" : "danger", bigSub: "orders vs the 30 days before",
      title: `Orders are ${up ? "up" : "down"} ${Math.abs(pctChange(orders, prev) * 100).toFixed(1)}% across all channels`,
      line: `${orders.toLocaleString("en-US")} orders in ${PERIOD.range}.`,
      steps: [
        { label: "This period", value: orders.toLocaleString("en-US"), src: PERIOD.range },
        { label: "The 30 days before", value: prev.toLocaleString("en-US") },
        { label: "Change", value: signedPct(pctChange(orders, prev)), result: up ? "good" : "bad" },
      ],
      source: "Square and the delivery apps", href: "/growth/repeat-customers", impact: 0,
    });
  }

  // Biggest store (all stores only).
  if (rows.length > 1) {
    const total = sum(rows.map((r) => r.gross));
    const top = [...rows].sort((a, b) => b.gross - a.gross);
    out.push({
      id: "share", cowork: "finance", page: "profit", tag: "info", sure: true,
      big: `${Math.round((top[0].gross / total) * 100)}%`, bigSub: `of your delivery sales · ${top[0].store}`,
      title: `${top[0].store} brings in most of your app sales`,
      line: `${fmtCents(top[0].gross)} of ${fmtCents(total)} sold on the apps.`,
      steps: [...top.map((r) => ({ label: r.store, value: fmtCents(r.gross), src: `${Math.round((r.gross / total) * 100)}% of all` })), { label: "All stores", value: fmtCents(total), result: "plain" }],
      source: `DoorDash and Uber Eats, ${PERIOD.range}`, href: "/operations/sales", impact: 0,
    });
  }

  // Promos: which ones pay, and what they cost overall.
  const promos = inScope(d.promos).filter((p) => p.spend > 0);
  if (promos.length > 1) {
    const per = (p: { sales: number; spend: number }) => p.sales / p.spend;
    const ranked = [...promos].sort((a, b) => per(b) - per(a));
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const avg = sum(promos.map((p) => p.sales)) / sum(promos.map((p) => p.spend));
    const promoWhere = (p: { store: string; source: string; campaign: string }) => `${p.campaign} · ${where(p)}`;
    out.push({
      id: "promo-best", cowork: "growth", page: "promos", tag: "good", sure: true,
      big: `$${per(best).toFixed(2)}`, bigTone: "success", bigSub: `in sales per $1 · ${best.campaign} on ${channelName(best.source)}`,
      title: `"${best.campaign}" on ${channelName(best.source)} is your best-paying promo`,
      line: `${fmtCents(best.sales)} of orders for ${fmtCents(best.spend)} of discounts${best.newCustomers ? `, ${best.newCustomers} from first-time customers` : ""}.`,
      steps: ranked.map((p) => ({ label: promoWhere(p), value: `$${per(p).toFixed(2)} per $1`, src: `${fmtCents(p.sales)} on ${fmtCents(p.spend)}` })),
      source: "DoorDash Marketing and Uber Eats Offers reports", href: "/mvp/promos", impact: 0,
    });
    if (per(worst) < avg * 0.6) {
      out.push({
        id: "promo-worst", cowork: "growth", page: "promos", tag: "watch", sure: true,
        big: `$${per(worst).toFixed(2)}`, bigTone: "danger", bigSub: `in sales per $1 · ${worst.campaign} on ${channelName(worst.source)}`,
        title: `"${worst.campaign}" on ${channelName(worst.source)} brings in less than your other promos`,
        line: `$${per(worst).toFixed(2)} back per $1 against $${avg.toFixed(2)} across all promos.`,
        steps: [{ label: promoWhere(worst), value: `$${per(worst).toFixed(2)} per $1`, src: `${fmtCents(worst.sales)} on ${fmtCents(worst.spend)}` }, { label: "All promos", value: `$${avg.toFixed(2)} per $1` }],
        source: "DoorDash Marketing and Uber Eats Offers reports", href: "/mvp/promos?tab=campaigns", impact: worst.spend,
      });
    }
    const spend = sum(promos.map((p) => p.spend));
    const touched = sum(promos.map((p) => p.sales));
    out.push({
      id: "promo-cost", cowork: "growth", page: "promos", tag: "info", sure: true,
      big: fmtCents(spend), bigSub: "spent on promos and ads",
      title: `Promos cost ${(100 * spend / touched).toFixed(1)}% of the sales they touched`,
      line: `${fmtCents(touched)} of orders used a promo this period; the apps charged ${fmtCents(spend)} for them.`,
      steps: [
        ...[...new Set(promos.map((p) => p.source))].map((s) => ({ label: channelName(s), value: fmtCents(sum(promos.filter((p) => p.source === s).map((p) => p.spend))), src: `${promos.filter((p) => p.source === s).length} campaigns` })),
        { label: "All promos", value: fmtCents(spend), result: "plain" as const },
      ],
      source: "DoorDash Marketing and Uber Eats Offers reports", href: "/mvp/promos?tab=apps", impact: 0,
    });
  }

  const order: Record<InsightTag, number> = { onit: 0, watch: 0, good: 1, info: 2 };
  return out.sort((a, b) => order[a.tag] - order[b.tag] || b.impact - a.impact);
}
