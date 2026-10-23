import type { Store } from "./books";
import type { AppKey } from "./chargebacks";
import { reportWeek } from "./reports";

// Each delivery app's payout report, broken into its parts, for MVP 2's 3PD Payouts. Built on the same weekly
// reports as the P&L (reportWeek), so "Net revenue" here is the P&L's Net revenue to the cent; the payout adds the
// sales tax that passes through it on its way to the bank:
//   sales − commission − marketing you paid − refunds after disputes      = money in (yours)
//   + sales tax collected − tax the app withheld and remitted itself     = deposited by the app
// Tax follows each app's practice in Illinois: DoorDash and Grubhub pass it to you to remit, Uber Eats remits it.
// Mock: the parts not in reportWeek (marketing split, credits, app-funded promos, tax) are deterministic
// shares of it that leave its totals unchanged. Tips, loyalty and miscellaneous adjustments are zero here.

export type Payout = {
  orders: number;
  sales: number;
  commission: number;
  processingFee: number;
  /** Promotions you funded, before the app's credits. */
  promoSpend: number;
  adSpend: number;
  marketingFees: number;
  loyalty: number;
  /** Marketing credits the app gave back (reduces what you paid). */
  credits: number;
  /** Promotions the app paid for: shown for reference, not taken from you. */
  appFunded: number;
  refunds: number;
  wonBack: number;
  tips: number;
  misc: number;
  /** Payout lines no report column explains; should be zero. */
  unaccounted: number;
  taxCollected: number;
  taxWithheld: number;
};

export const TAX_RATE = 0.1025;
const WITHHOLDS: Record<AppKey, boolean> = { doordash: false, uber: true, grubhub: false };
const CREDIT_RATE: Record<AppKey, number> = { doordash: 0.02, uber: 0.07, grubhub: 0 };
const APP_FUNDED_RATE: Record<AppKey, number> = { doordash: 0.02, uber: 0.008, grubhub: 0.012 };

const KEYS = ["orders", "sales", "commission", "processingFee", "promoSpend", "adSpend", "marketingFees", "loyalty", "credits", "appFunded", "refunds", "wonBack", "tips", "misc", "unaccounted", "taxCollected", "taxWithheld"] as const satisfies readonly (keyof Payout)[];
export const zeroPayout = (): Payout => Object.fromEntries(KEYS.map((k) => [k, 0])) as Payout;
export const addPayout = (a: Payout, b: Payout): Payout => Object.fromEntries(KEYS.map((k) => [k, a[k] + b[k]])) as Payout;

/** One app's payout over some stores and weeks ({year, w} as in the P&L's WEEKS). */
export function payout(app: AppKey, stores: readonly Store[], weeks: readonly { year: number; w: number }[]): Payout {
  let p = zeroPayout();
  for (const s of stores) {
    for (const { year, w } of weeks) {
      const r = reportWeek(s, year, w)[app];
      const funded = r.promos - r.ads;
      // Credits come off what you funded; the spend before them is funded + credits, so the net is unchanged.
      const credits = funded * CREDIT_RATE[app];
      const tax = r.sales * TAX_RATE;
      p = addPayout(p, {
        ...zeroPayout(),
        orders: r.orders,
        sales: r.sales,
        commission: r.commission - r.processingFee,
        processingFee: r.processingFee,
        promoSpend: funded + credits,
        adSpend: r.ads * 0.85,
        marketingFees: r.ads * 0.15,
        credits,
        appFunded: r.sales * APP_FUNDED_RATE[app],
        refunds: r.chargebacks,
        wonBack: r.moneyBack,
        taxCollected: tax,
        taxWithheld: WITHHOLDS[app] ? tax : 0,
      });
    }
  }
  return p;
}

export const commissionOf = (p: Payout) => p.commission + p.processingFee;
export const marketingOf = (p: Payout) => p.promoSpend + p.adSpend + p.marketingFees + p.loyalty - p.credits;
export const refundsOf = (p: Payout) => p.refunds - p.wonBack;
export const otherOf = (p: Payout) => p.tips + p.misc + p.unaccounted;
export const moneyInOf = (p: Payout) => p.sales - commissionOf(p) - marketingOf(p) - refundsOf(p) + otherOf(p);
export const depositOf = (p: Payout) => moneyInOf(p) + p.taxCollected - p.taxWithheld;
