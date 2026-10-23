import { OUTLETS, STATE_NAME, type Outlet, type StateCode, type Store } from "./outlets";

// Which outlets a report covers, as Asana filters tasks: quick filters (one-click presets) and rules
// ("State is Illinois", "City is not Chicago"), all of which must hold. No quick filters and no rules = every outlet.
// The toolbar's State / City / Outlet pills edit each field's "is" rule; the Filters panel shows every rule.

export type Field = "state" | "city" | "outlet";
export type Op = "is" | "isNot";
export type Rule = { id: string; field: Field; op: Op; values: string[] };

/** Per-outlet figures for the period, for the quick filters that rank or compare outlets. */
export type OutletStats = Map<Store, { sales: number; appShare: number }>;
type Quick = { key: string; label: string; test: (o: Outlet, stats: OutletStats) => boolean };

export const FIELDS: { key: Field; label: string; noun: string; find: string }[] = [
  { key: "state", label: "State", noun: "states", find: "Find a state" },
  { key: "city", label: "City", noun: "cities", find: "Find a city" },
  { key: "outlet", label: "Outlet", noun: "outlets", find: "Find an outlet" },
];
export const OPS: { key: Op; label: string }[] = [
  { key: "is", label: "is" },
  { key: "isNot", label: "is not" },
];

const topBySales = (n: number) => (o: Outlet, stats: OutletStats) => {
  const mine = stats.get(o.store)?.sales ?? 0;
  return [...stats.values()].filter((x) => x.sales > mine).length < n;
};
export const QUICK: Quick[] = [
  { key: "chicago", label: "Chicago", test: (o) => o.city === "Chicago" },
  { key: "suburbs", label: "Chicago suburbs", test: (o) => o.state === "IL" && o.city !== "Chicago" },
  { key: "outside", label: "Outside Illinois", test: (o) => o.state !== "IL" },
  { key: "top10", label: "Top 10 by sales", test: topBySales(10) },
  { key: "delivery", label: "Delivery over 35%", test: (o, stats) => (stats.get(o.store)?.appShare ?? 0) > 0.35 },
];

export type OutletFilter = { quick: string[]; rules: Rule[] };
export const NO_FILTER: OutletFilter = { quick: [], rules: [] };

/** The value a rule compares for an outlet. */
const valueOf = (o: Outlet, f: Field) => (f === "state" ? o.state : f === "city" ? o.city : o.store);
const passes = (o: Outlet, r: Rule) => !r.values.length || r.values.includes(valueOf(o, r.field)) === (r.op === "is");

export function matches(o: Outlet, f: OutletFilter, stats: OutletStats, skip?: Rule) {
  return f.quick.every((k) => QUICK.find((q) => q.key === k)?.test(o, stats) ?? true) && f.rules.every((r) => r === skip || passes(o, r));
}
export const filterStores = (f: OutletFilter, stats: OutletStats): Store[] => OUTLETS.filter((o) => matches(o, f, stats)).map((o) => o.store);

/** Filters in use: quick filters on, and rules with something picked. */
export const activeCount = (f: OutletFilter) => f.quick.length + f.rules.filter((r) => r.values.length).length;

/** Every value a field can take, with how many outlets have it, in the order people look for them. */
export function choices(field: Field, within: Outlet[] = OUTLETS) {
  const count = new Map<string, number>();
  for (const o of within) count.set(valueOf(o, field), (count.get(valueOf(o, field)) ?? 0) + 1);
  const all = field === "state" ? (Object.keys(STATE_NAME) as StateCode[]) : field === "city" ? [...new Set(OUTLETS.map((o) => o.city))].sort() : OUTLETS.map((o) => o.store);
  return all.map((v) => ({ value: v, count: count.get(v) ?? 0 }));
}

/** A value as people read it: "Illinois", "Chicago", "Hyde Park". */
export function valueLabel(field: Field, v: string) {
  if (field === "state") return STATE_NAME[v as StateCode] ?? v;
  if (field === "outlet") return OUTLETS.find((o) => o.store === v)?.name ?? v;
  return v;
}

let seq = 0;
export const newRule = (field: Field, values: string[] = [], op: Op = "is"): Rule => ({ id: `r${++seq}`, field, op, values });

/** The toolbar pill's rule for a field: its first "is" rule. */
export const pillRule = (f: OutletFilter, field: Field) => f.rules.find((r) => r.field === field && r.op === "is");

/** Sets the pill's values, creating its rule on first pick and dropping it when cleared. */
export function setPill(f: OutletFilter, field: Field, values: string[]): OutletFilter {
  const r = pillRule(f, field);
  if (!r) return values.length ? { ...f, rules: [...f.rules, newRule(field, values)] } : f;
  return { ...f, rules: values.length ? f.rules.map((x) => (x === r ? { ...x, values } : x)) : f.rules.filter((x) => x !== r) };
}
