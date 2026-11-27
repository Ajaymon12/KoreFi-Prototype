import { CHANNELS, LAST, WEEKS, totals } from "@/components/finance/PnlStory";
import type { Preset, TimelineWeek } from "@/components/finance/TimelineRange";
import { TYPICAL } from "@/lib/finance/costSettings";
import { shortStore, type Store } from "@/lib/finance/outlets";
import * as FX from "./masaFixture";
import { runHistory } from "./runs";

// MVP 3 / Home › At a glance (components/mvp3/AgentHome): the figures behind the Summary and Breakdown tabs.
// Everything comes from the weekly agent runs: the page covers the 13 weeks the agents have run (`RUNS`), and a
// period outside them has nothing to show. The team-pinned account (Masa Kitchen) reads its fixed sample week
// (lib/mvp3/masaFixture) and is dated as the prototype dates it (the sample week is Nov 1–7, 2026); every other
// account reads the shared reports for its own outlets.

export const APP_KEYS = ["doordash", "uber", "grubhub"] as const;
export type HomeApp = (typeof APP_KEYS)[number];
/** One app's week(s): what the app reported and what the chargeback agent found. */
export type AppFig = { sales: number; commission: number; ads: number; promos: number; errors: number; won: number; orders: number };
export type OutletFig = { name: string; apps: number; instore: number };
/** Per run week, oldest first (index 0 is week `RUN_FROM`). */
export type Series = { paid: number[]; charged: number[]; won: number[]; unmatched: number[]; unmatchedOrders: number[] };

/** Weeks the agents have run, newest last. */
export const RUNS = 13;
export const RUN_FROM = LAST - RUNS + 1;
/** The part of a period the agents ran in, or null when they ran in none of it. */
export const clip = ([a, b]: [number, number]): [number, number] | null => (b < RUN_FROM ? null : [Math.max(a, RUN_FROM), b]);

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
const slice = (xs: number[], [a, b]: [number, number]) => xs.slice(a - RUN_FROM, b - RUN_FROM + 1);
export const before = (f: AppFig) => f.sales - f.commission - f.ads - f.promos;
export const net = (f: AppFig) => before(f) - f.errors + f.won;
const FIELDS = ["sales", "commission", "ads", "promos", "errors", "won", "orders"] as const satisfies readonly (keyof AppFig)[];
/** The three apps added up (the Total column). */
export const totalOf = (figs: Record<HomeApp, AppFig>) => Object.fromEntries(FIELDS.map((f) => [f, APP_KEYS.reduce((n, k) => n + figs[k][f], 0)])) as AppFig;

export type HomeData = {
  /** The weeks as this account dates them (for the period chip). */
  weeks: TimelineWeek[];
  series: Series;
  byApp: (range: [number, number]) => Record<HomeApp, AppFig>;
  byOutlet: (range: [number, number]) => OutletFig[];
  /** Matched / all orders in the latest run (the payout card's second line). */
  orders: { matched: number; all: number };
  /** "Thu 8:00 AM" per agent, when the account fixes it. */
  ran?: Partial<Record<string, string>>;
};

// ───────── Masa Kitchen: the sample week, scaled by each week's payout for longer periods ─────────

const FX_APP: Record<HomeApp, FX.PayKey> = { doordash: "dd", uber: "ue", grubhub: "gh" };
/** The shared report weeks, moved so the newest one is the sample week (Nov 1–7, 2026). */
const fixtureWeeks = (): TimelineWeek[] => {
  const shift = Date.UTC(2026, 10, 1) - WEEKS[LAST].start.getTime();
  return WEEKS.map((w) => ({ ...w, start: new Date(w.start.getTime() + shift) }));
};

function fixture(): HomeData {
  const s = FX.HOME_SERIES;
  const last = s.paid[RUNS - 1];
  const scale = (range: [number, number]) => sum(slice(s.paid, range)) / last;
  return {
    weeks: fixtureWeeks(),
    series: s,
    byApp: (range) => {
      const k = scale(range);
      const charged = sum(slice(s.charged, range));
      const won = sum(slice(s.won, range));
      return Object.fromEntries(
        APP_KEYS.map((app) => {
          const p = FX.PAY.find((x) => x.app === FX_APP[app])!;
          const cb = FX.BY_APP.find((x) => x.app === app)!;
          const r = (n: number) => Math.round(n * k);
          return [app, { sales: r(p.sales), commission: r(p.commission), ads: r(p.ads), promos: r(p.promos), orders: r(p.orders), errors: Math.round((charged * cb.charged) / FX.charged), won: Math.round((won * cb.won) / FX.CBST.won) }];
        }),
      ) as Record<HomeApp, AppFig>;
    },
    byOutlet: (range) => {
      const k = scale(range);
      return FX.FX_OUTLETS.map((o) => ({ name: o.name, apps: Math.round(o.sales * k), instore: Math.round(FX.HOME_INSTORE[o.name] * k) }));
    },
    orders: { matched: FX.ORDERS.paid, all: FX.ORDERS.toast },
    ran: FX.HOME_RAN,
  };
}

// ───────── Every other account: the shared reports and the agents' run history ─────────

const metric = (r: { metrics: { label: string; value: number }[] }, label: string) => r.metrics.find((m) => m.label === label)?.value ?? 0;

function fromReports(stores: readonly Store[]): HomeData {
  const week = (i: number) => totals(stores, i, i, () => TYPICAL);
  const appFigs = (t: ReturnType<typeof week>) =>
    Object.fromEntries(APP_KEYS.map((k) => [k, { sales: t.cols[k].sales, commission: t.cols[k].commission, ads: t.cols[k].ads, promos: t.cols[k].promos, errors: t.cols[k].chargebacks, won: t.cols[k].moneyBack, orders: t.cols[k].orders }])) as Record<HomeApp, AppFig>;
  // Runs come newest first; the series read oldest first.
  const cbs = [...runHistory("chargebacks")].reverse();
  const pays = [...runHistory("payouts")].reverse();
  const weekly = Array.from({ length: RUNS }, (_, k) => week(RUN_FROM + k));
  const latest = appFigs(weekly[RUNS - 1]);
  // The payout run's headline leads with the orders that didn't match ("4 orders don't match Toast"); 0 when all did.
  const unmatchedOrders = pays.map((r) => parseInt(r.headline, 10) || 0);
  const allOrders = totalOf(latest).orders;
  return {
    weeks: WEEKS,
    series: {
      paid: weekly.map((t) => net(totalOf(appFigs(t)))),
      charged: cbs.map((r) => metric(r, "Charged back")),
      won: cbs.map((r) => metric(r, "Won back")),
      unmatched: pays.map((r) => metric(r, "In Toast only") + metric(r, "In app only")),
      unmatchedOrders,
    },
    byApp: ([a, b]) => appFigs(totals(stores, a, b, () => TYPICAL)),
    byOutlet: ([a, b]) =>
      stores
        .map((s) => {
          const t = totals([s], a, b, () => TYPICAL);
          const apps = CHANNELS.filter((c) => c.app).reduce((n, c) => n + t.cols[c.key].sales, 0);
          return { name: shortStore(s), apps, instore: t.all.sales - apps };
        })
        .sort((x, y) => y.apps + y.instore - (x.apps + x.instore)),
    orders: { matched: allOrders - (unmatchedOrders[RUNS - 1] ?? 0), all: allOrders },
  };
}

export const homeData = (stores: readonly Store[]): HomeData => (FX.masaFixture() ? fixture() : fromReports(stores));
/** A series added up over the run weeks of a period (already clipped). */
export const over = (xs: number[], range: [number, number]) => sum(slice(xs, range));

/** The period chip: last week first (the default), then 4 and 13 weeks, and the calendar years as this account dates
 *  its weeks (the sample account's are moved to end Nov 7, so its "2025" isn't the shared reports' 2025). */
export function periodsFor(weeks: TimelineWeek[]): Preset[] {
  const year = weeks[LAST].start.getUTCFullYear();
  const first = (y: number) => weeks.findIndex((w) => w.start.getUTCFullYear() === y);
  const thisYear = first(year);
  const lastYear = first(year - 1);
  return [
    { label: "Last week", range: [LAST, LAST] },
    { label: "Last 4 weeks", range: [LAST - 3, LAST] },
    { label: "Last 13 weeks", range: [LAST - 12, LAST] },
    ...(thisYear >= 0 ? [{ label: `${year} so far`, range: [thisYear, LAST] as [number, number] }] : []),
    ...(lastYear >= 0 && thisYear > 0 ? [{ label: String(year - 1), range: [lastYear, thisYear - 1] as [number, number] }] : []),
  ];
}
