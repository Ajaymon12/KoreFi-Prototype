import { channelName, pctChange, sum } from "./dashboard";
import type { Dispute, SourceId, StoreOps } from "./types";

// Selectors behind Sales, Order quality and Wait & downtime. All of them take the StoreOps rows
// (already limited to connected, healthy marketplaces) and roll them up over any slice of stores.

export type Channel = "all" | SourceId;

export const pickChannel = (ops: StoreOps[], channel: Channel) => (channel === "all" ? ops : ops.filter((o) => o.source === channel));
export const parseChannel = (v: string | undefined, ops: StoreOps[]): Channel => (ops.some((o) => o.source === v) ? (v as SourceId) : "all");
export const channelsIn = (ops: StoreOps[]) => [...new Set(ops.map((o) => o.source))].map((id) => ({ id, name: channelName(id) }));

const ratio = (n: number, d: number) => (d ? n / d : 0);
const merge = (rows: StoreOps[], key: "sold" | "canceled") => {
  const m = new Map<string, number>();
  for (const r of rows) for (const i of r.topItems) m.set(i.item, (m.get(i.item) ?? 0) + i[key]);
  return [...m].map(([item, n]) => ({ item, n })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
};

export function salesTotals(rows: StoreOps[]) {
  const t = (k: keyof StoreOps) => sum(rows.map((r) => r[k] as number));
  const sales = t("sales"), previousSales = t("previousSales"), orders = t("orders"), previousOrders = t("previousOrders");
  const canceled = t("canceled"), previousCanceled = t("previousCanceled"), itemsSold = t("itemsSold"), previousItemsSold = t("previousItemsSold");
  return {
    sales, previousSales, salesChange: pctChange(sales, previousSales),
    avgTicket: ratio(sales, orders), previousAvgTicket: ratio(previousSales, previousOrders),
    orders, previousOrders, ordersChange: pctChange(orders, previousOrders),
    itemsSold, itemsChange: pctChange(itemsSold, previousItemsSold),
    canceled, canceledChange: pctChange(canceled, previousCanceled), cancelRate: ratio(canceled, orders + canceled),
    topSold: merge(rows, "sold"), topCanceled: merge(rows, "canceled"),
  };
}

export function dailyTotals(rows: StoreOps[]) {
  const dates = rows[0]?.daily.map((d) => d.date) ?? [];
  return dates.map((date, i) => ({
    date,
    orders: sum(rows.map((r) => r.daily[i].orders)),
    previousOrders: sum(rows.map((r) => r.daily[i].previousOrders)),
    canceled: sum(rows.map((r) => r.daily[i].canceled)),
    sales: sum(rows.map((r) => r.daily[i].sales)),
  }));
}

export const hourlyTotals = (rows: StoreOps[]) => Array.from({ length: 24 }, (_, h) => sum(rows.map((r) => r.hourly[h])));

export const storesIn = (rows: StoreOps[]) => [...new Set(rows.map((r) => r.store))];
export const forStore = (rows: StoreOps[], store: string) => rows.filter((r) => r.store === store);

/** Order quality for a slice of stores. Inaccurate orders and error charges come straight from the chargebacks. */
export function qualityTotals(rows: StoreOps[], disputes: Dispute[]) {
  const stores = new Set(rows.map((r) => r.store));
  const sources = new Set(rows.map((r) => r.source));
  const mine = disputes.filter((d) => stores.has(d.store) && sources.has(d.source));
  const orders = sum(rows.map((r) => r.orders));
  const previousOrders = sum(rows.map((r) => r.previousOrders));
  const inaccurate = mine.length;
  const previousInaccurate = sum(rows.map((r) => r.previousInaccurate));
  const errorCharges = sum(mine.map((d) => d.amount));
  const previousErrorCharges = sum(rows.map((r) => r.previousErrorCharges));
  const unfulfilled = sum(rows.map((r) => r.unfulfilled));
  const previousUnfulfilled = sum(rows.map((r) => r.previousUnfulfilled));
  const placed = orders + sum(rows.map((r) => r.canceled));
  const previousPlaced = previousOrders + sum(rows.map((r) => r.previousCanceled));
  const issues = new Map<string, { count: number; cost: number }>();
  for (const d of mine) {
    const cur = issues.get(d.reason) ?? { count: 0, cost: 0 };
    issues.set(d.reason, { count: cur.count + 1, cost: cur.cost + d.amount });
  }
  return {
    orders,
    inaccurate,
    inaccurateRate: ratio(inaccurate, orders),
    previousInaccurateRate: ratio(previousInaccurate, previousOrders),
    errorCharges,
    previousErrorCharges,
    errorChange: pctChange(errorCharges, previousErrorCharges),
    unfulfilled,
    unfulfilledRate: ratio(unfulfilled, placed),
    previousUnfulfilledRate: ratio(previousUnfulfilled, previousPlaced),
    wait: ratio(sum(rows.map((r) => r.avoidableWaitMin * r.orders)), orders),
    previousWait: ratio(sum(rows.map((r) => r.previousAvoidableWaitMin * r.previousOrders)), previousOrders),
    issues: [...issues].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.cost - a.cost),
  };
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function downtimeTotals(rows: StoreOps[]) {
  const byWeekday = WEEKDAYS.map((day, d) => ({ day, minutes: sum(rows.map((r) => r.downtimeByWeekday[d])) }));
  const minutes = sum(byWeekday.map((d) => d.minutes));
  const open = sum(rows.map((r) => r.openMinutes));
  const previous = sum(rows.map((r) => r.previousDowntimeMinutes));
  const peak = Math.max(...byWeekday.map((d) => d.minutes));
  return { minutes, open, pct: ratio(minutes, open), previous, previousPct: ratio(previous, open), byWeekday, worstDay: peak > 0 ? byWeekday.find((d) => d.minutes === peak)!.day : undefined };
}
