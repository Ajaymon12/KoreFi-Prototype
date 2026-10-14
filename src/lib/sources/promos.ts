import { channelName, sum } from "./dashboard";
import type { Promo, PromoType, SourceId } from "./types";

// Selectors behind MVP / Promos: what the promotions and ads on the apps cost, what they brought
// in, and the return per dollar, by campaign and by app. Report only: it says which promos pay,
// it never offers to change them.

export const PROMO_TYPE_LABEL: Record<PromoType, string> = {
  percent_off: "% off",
  bogo: "Buy one get one",
  free_delivery: "Free delivery",
  sponsored: "Sponsored listing",
};

export type PromoStats = {
  spend: number;
  sales: number;
  orders: number;
  newCustomers: number;
  /** Sales brought in per $1 of promo spend. */
  perDollar: number;
  /** Spend as a share of the sales it touched. */
  costRate: number;
};

export function promoStats(promos: Promo[]): PromoStats {
  const spend = sum(promos.map((p) => p.spend));
  const sales = sum(promos.map((p) => p.sales));
  return {
    spend,
    sales,
    orders: sum(promos.map((p) => p.orders)),
    newCustomers: sum(promos.map((p) => p.newCustomers)),
    perDollar: spend ? sales / spend : 0,
    costRate: sales ? spend / sales : 0,
  };
}

export type CampaignRow = Promo & { key: string; app: string; typeLabel: string; perDollar: number; costRate: number; newShare: number };

/** One row per campaign × store, best return first. */
export function promosByCampaign(promos: Promo[]): CampaignRow[] {
  return promos
    .map((p) => ({
      ...p,
      key: `${p.source}-${p.store}-${p.campaign}`,
      app: channelName(p.source),
      typeLabel: PROMO_TYPE_LABEL[p.type],
      perDollar: p.spend ? p.sales / p.spend : 0,
      costRate: p.sales ? p.spend / p.sales : 0,
      newShare: p.orders ? p.newCustomers / p.orders : 0,
    }))
    .sort((a, b) => b.perDollar - a.perDollar);
}

export type AppRow = PromoStats & { source: SourceId; app: string; campaigns: number };

/** Totals per app, biggest spend first. */
export function promosByApp(promos: Promo[]): AppRow[] {
  const sources = [...new Set(promos.map((p) => p.source))];
  return sources
    .map((source) => {
      const rows = promos.filter((p) => p.source === source);
      return { source, app: channelName(source), campaigns: rows.length, ...promoStats(rows) };
    })
    .sort((a, b) => b.spend - a.spend);
}

export type TypeRow = PromoStats & { type: PromoType; label: string; campaigns: number };

/** Totals per kind of promo, best return first. */
export function promosByType(promos: Promo[]): TypeRow[] {
  const types = [...new Set(promos.map((p) => p.type))];
  return types
    .map((type) => {
      const rows = promos.filter((p) => p.type === type);
      return { type, label: PROMO_TYPE_LABEL[type], campaigns: rows.length, ...promoStats(rows) };
    })
    .sort((a, b) => b.perDollar - a.perDollar);
}

/** Spend by week across every promo, oldest first. */
export function promoTrend(promos: Promo[]): number[] {
  const weeks = Math.max(0, ...promos.map((p) => p.weeklySpend.length));
  return Array.from({ length: weeks }, (_, i) => sum(promos.map((p) => p.weeklySpend[i] ?? 0)));
}
