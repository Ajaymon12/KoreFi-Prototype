import type { Insight, InsightPage } from "@/lib/sources/overview";

// The insights are generated once (overview.ts) with links into the module app. The MVP shows
// each one on its own report and links within /mvp instead.

const PAGE_HREF: Record<InsightPage, string> = {
  profit: "/mvp/profit",
  payouts: "/mvp/payouts",
  chargebacks: "/mvp/chargebacks",
  promos: "/mvp/promos",
  overview: "/mvp/overview",
};

/** Deeper links for findings that have a natural tab. */
const BY_ID: Record<string, string> = {
  "gap-doordash": "/mvp/payouts?tab=reconciliation",
  "gap-ubereats": "/mvp/payouts?tab=reconciliation",
  "gap-grubhub": "/mvp/payouts?tab=reconciliation",
  lost: "/mvp/chargebacks?tab=resolved",
  won: "/mvp/chargebacks?tab=resolved",
  per: "/mvp/profit?tab=channel",
  share: "/mvp/profit?tab=store",
  "promo-worst": "/mvp/promos?tab=campaigns",
  "promo-cost": "/mvp/promos?tab=apps",
};

export const mvpHref = (x: Insight) => BY_ID[x.id] ?? (x.href.startsWith("/mvp/") ? x.href : PAGE_HREF[x.page]);

/** Up to `n` findings for one report, in the ranked order they came in. */
export const forPage = (insights: Insight[], page: InsightPage, n = 3) => insights.filter((x) => x.page === page).slice(0, n);
