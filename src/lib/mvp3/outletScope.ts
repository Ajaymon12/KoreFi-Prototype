import { OUTLETS, STATE_NAME, STORES, type Store } from "@/lib/finance/outlets";

// MVP 3: which outlets the agents and dashboards cover.
//  - The open restaurant's outlets (set by the /mvp3 switcher through setAccountStores in lib/mvp3/agents).
//  - Outlets named in a chat message ("How did Hyde Park do?", "only show Chicago", "without Wisconsin"):
//    outlet names first, then cities, then states, always within the restaurant's own outlets.
// Prototype: plain text matching, no model.

let current: readonly Store[] = STORES;
export const accountStores = () => current;
export function setScopeStores(next: readonly Store[]) {
  current = next;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (s: string) => new RegExp(`(^|[^a-z0-9])${esc(s)}(?=$|[^a-z0-9])`);

/** The outlets a message names, within `within` (the open restaurant by default), in report order. */
export function findOutlets(text: string, within: readonly Store[] = current): Store[] {
  let s = text.toLowerCase().replace(/[’]/g, "'");
  const mine = OUTLETS.filter((o) => within.includes(o.store));
  const hits = new Set<Store>();
  const take = (re: RegExp, stores: Store[]) => {
    if (!re.test(s)) return;
    stores.forEach((x) => hits.add(x));
    s = s.replace(re, "$1 ");
  };
  // Longest names first, so "Oak Park" (the outlet) wins over Oak Park (the city), and "Chicago & Halsted" over Chicago.
  for (const o of [...mine].sort((a, b) => b.name.length - a.name.length)) {
    const name = o.name.toLowerCase();
    take(word(name), [o.store]);
    if (name.includes("&")) take(word(name.replace("&", "and")), [o.store]);
  }
  for (const city of new Set(mine.map((o) => o.city))) take(word(city.toLowerCase()), mine.filter((o) => o.city === city).map((o) => o.store));
  for (const [code, name] of Object.entries(STATE_NAME)) take(word(name.toLowerCase()), mine.filter((o) => o.state === code).map((o) => o.store));
  return mine.filter((o) => hits.has(o.store)).map((o) => o.store);
}

const nameOf = (s: Store) => OUTLETS.find((o) => o.store === s)?.name ?? s;

/** "Hyde Park", "Hyde Park and Old Town", "5 outlets". */
export function outletsLabel(stores: readonly Store[]) {
  if (stores.length === 1) return nameOf(stores[0]);
  if (stores.length === 2) return `${nameOf(stores[0])} and ${nameOf(stores[1])}`;
  return `${stores.length} outlets`;
}

/** A looser read for a single outlet: the first word of its name alone ("Why is Damen high?" → Damen & Chicago).
 *  Used only when nothing matched by name, city or state, and only when exactly one outlet has that word. */
export function findOutletLoose(text: string, within: readonly Store[] = current): Store[] {
  const s = text.toLowerCase().replace(/[’]/g, "'");
  const hits = OUTLETS.filter((o) => within.includes(o.store)).filter((o) => {
    const first = o.name.toLowerCase().split(/[\s&]+/)[0];
    return first.length >= 4 && word(first).test(s);
  });
  return hits.length === 1 ? [hits[0].store] : [];
}
