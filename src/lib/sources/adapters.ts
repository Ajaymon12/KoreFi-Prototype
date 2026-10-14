import { RAW } from "./fixtures";
import type { Dispute, DisputeStatus, Invoice, Promo, PromoType, SourceData, SourceId, StoreOps } from "./types";
import { PERIOD } from "@/lib/period";

// One adapter per provider: raw payload in, normalised records out. Swapping in a real API later
// only means replacing the fixture read with a network call inside the adapter.

const cents = (n: number) => n / 100;
const disputeStatus = (s: string): DisputeStatus => (s === "won" || s === "lost" || s === "auto_refunded" ? s : "open");
const promoType = (s: string): PromoType => (s === "BOGO" ? "bogo" : s === "FREE_DELIVERY" ? "free_delivery" : s === "SPONSORED" ? "sponsored" : "percent_off");

// ---- Order detail ----
// Providers only report period totals, so the daily and hourly curves are spread from them with a
// fixed shape (busier weekends, lunch and dinner peaks). Every curve sums back to its total.

const DAYS = 30;
const WEEKDAY_WEIGHT = [0.9, 0.85, 0.9, 1, 1.25, 1.4, 1.1]; // Mon..Sun
const HOUR_WEIGHT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 7, 6, 3, 2, 3, 6, 9, 8, 5, 2, 0, 0];

/** Splits `total` into whole parts proportional to `weights`; the parts always add up to `total`. */
function spread(total: number, weights: number[]): number[] {
  const w = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((x) => (x / w) * total);
  const out = exact.map(Math.floor);
  const left = total - out.reduce((a, b) => a + b, 0);
  [...exact.keys()].sort((a, b) => (exact[b] - out[b]) - (exact[a] - out[a])).slice(0, left).forEach((i) => out[i]++);
  return out;
}

const isoDay = (i: number) => new Date(Date.parse(`${PERIOD.start}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
const weekday = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
/** Stable 0.85–1.15 wobble per day so the curve is not a perfect weekly sawtooth. */
const jitter = (i: number, salt: number) => 0.85 + (((i * 7919 + salt * 104729) % 31) / 30) * 0.3;

function buildOps(o: {
  source: SourceId; store: string; sales: number; previousSales: number; orders: number; previousOrders: number; canceled: number; previousCanceled: number;
  unfulfilled: number; previousUnfulfilled: number; itemsSold: number; previousItemsSold: number; wait: number; previousWait: number;
  previousInaccurate: number; previousErrorCharges: number; openMinutes: number; offline: number[]; previousOffline: number; items: (string | number)[][];
}): StoreOps {
  const salt = o.source.length + o.store.length;
  const dates = Array.from({ length: DAYS }, (_, i) => isoDay(i));
  const dayW = dates.map((d, i) => WEEKDAY_WEIGHT[weekday(d)] * jitter(i, salt));
  const orders = spread(o.orders, dayW);
  const previous = spread(o.previousOrders, dates.map((d, i) => WEEKDAY_WEIGHT[weekday(d)] * jitter(i, salt + 3)));
  const canceled = spread(o.canceled, dayW.map((x, i) => x * jitter(i, salt + 5)));
  const salesCents = spread(Math.round(o.sales * 100), orders.map((n, i) => n * jitter(i, salt + 9)));
  return {
    source: o.source, store: o.store,
    sales: o.sales, previousSales: o.previousSales, orders: o.orders, previousOrders: o.previousOrders,
    canceled: o.canceled, previousCanceled: o.previousCanceled, unfulfilled: o.unfulfilled, previousUnfulfilled: o.previousUnfulfilled,
    itemsSold: o.itemsSold, previousItemsSold: o.previousItemsSold, avoidableWaitMin: o.wait, previousAvoidableWaitMin: o.previousWait,
    previousInaccurate: o.previousInaccurate, previousErrorCharges: o.previousErrorCharges, openMinutes: o.openMinutes,
    downtimeByWeekday: o.offline, previousDowntimeMinutes: o.previousOffline,
    topItems: o.items.map(([item, sold, c]) => ({ item: item as string, sold: sold as number, canceled: c as number })),
    daily: dates.map((date, i) => ({ date, orders: orders[i], previousOrders: previous[i], canceled: canceled[i], sales: salesCents[i] / 100 })),
    hourly: spread(o.orders, HOUR_WEIGHT),
  };
}

const adapters: Record<SourceId, () => SourceData> = {
  square: () => ({
    sales: {
      source: "square",
      netSales: cents(RAW.square.summary.net_sales_money.amount),
      previousNetSales: cents(RAW.square.summary.prior_period_net_sales_money.amount),
      orders: RAW.square.summary.order_count,
      previousOrders: RAW.square.summary.prior_period_order_count,
      weekly: RAW.square.weekly_net_sales.map((w) => ({ label: w.label, netSales: w.amount })),
      unavailableItems: RAW.square.sold_out_items.map((i) => ({ item: i.name, location: i.location })),
    },
  }),
  toast: () => ({}),
  clover: () => ({}),

  zoho: () => ({
    invoices: RAW.zoho.bills.map<Invoice>((b) => ({
      source: "zoho",
      vendor: b.vendor_name,
      amount: b.total,
      status: b.status as Invoice["status"],
      due: b.due_date,
    })),
  }),
  xero: () => ({}),
  quickbooks: () => ({}),

  doordash: () => ({
    payouts: RAW.doordash.payouts.map((p) => ({
      source: "doordash",
      period: p.period,
      gross: p.subtotal,
      fees: p.commission,
      net: p.net_payout,
      byStore: p.by_store.map((s) => ({ store: s.store_name, gross: s.subtotal, fees: s.commission, net: s.net_payout })),
    })),
    disputes: RAW.doordash.error_charges.map<Dispute>((d) => ({
      source: "doordash",
      id: d.order_id,
      store: d.store_name,
      amount: d.error_charge,
      status: disputeStatus(d.resolution),
      date: d.date,
      resolvedDate: d.resolved_on,
      reason: d.category,
      detail: d.detail,
    })),
    ops: RAW.doordash.ops.map((s) =>
      buildOps({ source: "doordash", store: s.store_name, sales: s.subtotal, previousSales: s.prior_subtotal, orders: s.orders, previousOrders: s.prior_orders, canceled: s.cancelled, previousCanceled: s.prior_cancelled, unfulfilled: s.store_cancelled, previousUnfulfilled: s.prior_store_cancelled, itemsSold: s.items, previousItemsSold: s.prior_items, wait: s.wait_min, previousWait: s.prior_wait_min, previousInaccurate: s.prior_inaccurate, previousErrorCharges: s.prior_error_charges, openMinutes: s.open_minutes, offline: s.offline_by_weekday, previousOffline: s.prior_offline_minutes, items: s.top_items }),
    ),
    storefronts: RAW.doordash.stores.map((s) => ({
      source: "doordash",
      store: s.name,
      online: s.is_open,
      downtimeMinutes: s.offline_minutes,
      cause: s.offline_reason ?? undefined,
      estLostRevenue: s.offline_minutes * 4.5,
    })),
    promos: RAW.doordash.promotions.map<Promo>((p) => ({
      source: "doordash",
      store: p.store_name,
      campaign: p.name,
      type: promoType(p.kind),
      spend: p.merchant_funded + p.ad_spend,
      orders: p.orders,
      newCustomers: p.new_customer_orders,
      sales: p.order_subtotal,
      weeklySpend: p.weekly_cost,
    })),
  }),
  ubereats: () => ({
    payouts: RAW.ubereats.payouts.map((p) => ({
      source: "ubereats",
      period: p.period,
      gross: cents(p.gross_cents),
      fees: cents(p.fees_cents),
      net: cents(p.net_cents),
      byStore: p.restaurants.map((s) => ({ store: s.name, gross: cents(s.gross_cents), fees: cents(s.fees_cents), net: cents(s.net_cents) })),
    })),
    disputes: RAW.ubereats.incidents.map<Dispute>((d) => ({
      source: "ubereats",
      id: d.ticket,
      store: d.restaurant,
      amount: cents(d.amount_cents),
      status: disputeStatus(d.outcome),
      date: d.date,
      resolvedDate: d.resolved_on,
      reason: d.category,
      detail: d.detail,
    })),
    ops: RAW.ubereats.ops.map((s) =>
      buildOps({ source: "ubereats", store: s.restaurant, sales: cents(s.subtotal_cents), previousSales: cents(s.prior_subtotal_cents), orders: s.delivered, previousOrders: s.prior_delivered, canceled: s.cancelled, previousCanceled: s.prior_cancelled, unfulfilled: s.restaurant_cancelled, previousUnfulfilled: s.prior_restaurant_cancelled, itemsSold: s.units, previousItemsSold: s.prior_units, wait: s.avoidable_wait_min, previousWait: s.prior_avoidable_wait_min, previousInaccurate: s.prior_inaccurate, previousErrorCharges: cents(s.prior_error_cents), openMinutes: s.open_minutes, offline: s.offline_by_weekday, previousOffline: s.prior_offline_minutes, items: s.top_items }),
    ),
    storefronts: RAW.ubereats.restaurants.map((s) => ({
      source: "ubereats",
      store: s.name,
      online: s.status === "ONLINE",
      downtimeMinutes: s.minutes_offline,
      cause: s.reason ?? undefined,
      estLostRevenue: cents(s.lost_sales_cents),
    })),
    promos: RAW.ubereats.offers.map<Promo>((o) => ({
      source: "ubereats",
      store: o.restaurant,
      campaign: o.title,
      type: promoType(o.offer_type),
      spend: cents(o.cost_cents + o.ad_cents),
      orders: o.redemptions,
      newCustomers: o.first_time_redemptions,
      sales: cents(o.basket_cents),
      weeklySpend: o.weekly_cost_cents.map(cents),
    })),
  }),
  grubhub: () => ({
    payouts: [],
    disputes: RAW.grubhub.adjustments.map<Dispute>((a) => ({ source: "grubhub", id: a.id, store: a.location, amount: Number(a.amt), status: disputeStatus(a.state), date: a.date, resolvedDate: a.resolved_on, reason: a.why, detail: a.what })),
    storefronts: [],
  }),

  mercury: () => ({
    balance: { source: "mercury", amount: RAW.mercury.balance, previousAmount: RAW.mercury.prior_balance },
    deposits: RAW.mercury.transactions.map((t) => ({ source: "mercury", date: t.postedAt, amount: t.amount, reference: t.note })),
  }),
};

export const adapt = (id: SourceId): SourceData => adapters[id]();
