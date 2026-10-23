import type { Address } from "./types";

// Mock Google Maps (Places API) lookup for "Add a restaurant". Shaped like the real thing so the UI
// is built for its timing, not for instant fake data:
//   • autocomplete answers in ~0.3–0.8 s, so typing is debounced and stale requests are aborted;
//   • a chain's stores come back as Text Search pages of up to 20, at most 60 in all, and Google
//     makes you wait ~2 s before the next page token works — so results stream in, page by page.
// Both calls take an AbortSignal and cache their answers, so going Back and forth is instant.

export type Place = { placeId: string; name: string; address: Address; neighborhood: string; lat: number; lng: number };

/** One autocomplete hit: a chain (many stores share the name) or a single place. */
export type Suggestion = { kind: "chain"; id: string; name: string; estimate: number; cities: string[] } | { kind: "place"; id: string; name: string; place: Place };

export type Page = { places: Place[]; total: number; done: boolean };

export const PAGE_SIZE = 20;
export const MAX_RESULTS = 60;

// ── Fixture data ──────────────────────────────────────────────────────────────────────────────

type Hood = { hood: string; city: string; state: string; zip: string; lat: number; lng: number; streets: string[] };

const HOODS: Hood[] = [
  { hood: "Koreatown", city: "New York", state: "NY", zip: "10001", lat: 40.7476, lng: -73.9867, streets: ["W 32nd St", "Broadway", "W 35th St"] },
  { hood: "Midtown", city: "New York", state: "NY", zip: "10036", lat: 40.7547, lng: -73.9806, streets: ["5th Ave", "W 44th St", "6th Ave"] },
  { hood: "Midtown East", city: "New York", state: "NY", zip: "10022", lat: 40.7593, lng: -73.9701, streets: ["Lexington Ave", "3rd Ave", "E 51st St"] },
  { hood: "Chelsea", city: "New York", state: "NY", zip: "10011", lat: 40.7465, lng: -74.0014, streets: ["8th Ave", "W 23rd St", "9th Ave"] },
  { hood: "Flatiron", city: "New York", state: "NY", zip: "10010", lat: 40.7411, lng: -73.9897, streets: ["Park Ave S", "E 20th St"] },
  { hood: "Union Square", city: "New York", state: "NY", zip: "10003", lat: 40.7359, lng: -73.9911, streets: ["E 14th St", "University Pl"] },
  { hood: "East Village", city: "New York", state: "NY", zip: "10009", lat: 40.7265, lng: -73.9815, streets: ["Avenue A", "St Marks Pl", "1st Ave"] },
  { hood: "West Village", city: "New York", state: "NY", zip: "10014", lat: 40.7358, lng: -74.0036, streets: ["Bleecker St", "Hudson St"] },
  { hood: "SoHo", city: "New York", state: "NY", zip: "10012", lat: 40.7233, lng: -74.003, streets: ["Spring St", "Prince St"] },
  { hood: "Lower East Side", city: "New York", state: "NY", zip: "10002", lat: 40.7189, lng: -73.9903, streets: ["Orchard St", "Delancey St"] },
  { hood: "Financial District", city: "New York", state: "NY", zip: "10004", lat: 40.7075, lng: -74.0113, streets: ["Broad St", "Water St", "John St"] },
  { hood: "Tribeca", city: "New York", state: "NY", zip: "10013", lat: 40.7163, lng: -74.0086, streets: ["Greenwich St", "Hudson St"] },
  { hood: "Upper West Side", city: "New York", state: "NY", zip: "10024", lat: 40.787, lng: -73.9754, streets: ["Amsterdam Ave", "Columbus Ave", "Broadway"] },
  { hood: "Upper East Side", city: "New York", state: "NY", zip: "10028", lat: 40.7736, lng: -73.9566, streets: ["2nd Ave", "Lexington Ave", "E 86th St"] },
  { hood: "Harlem", city: "New York", state: "NY", zip: "10027", lat: 40.8116, lng: -73.9465, streets: ["Frederick Douglass Blvd", "W 125th St"] },
  { hood: "Washington Heights", city: "New York", state: "NY", zip: "10033", lat: 40.8417, lng: -73.9394, streets: ["St Nicholas Ave", "Broadway"] },
  { hood: "Hell's Kitchen", city: "New York", state: "NY", zip: "10019", lat: 40.7638, lng: -73.9918, streets: ["9th Ave", "10th Ave"] },
  { hood: "Carroll Gardens", city: "Brooklyn", state: "NY", zip: "11231", lat: 40.6826, lng: -73.993, streets: ["Smith St", "Court St"] },
  { hood: "Williamsburg", city: "Brooklyn", state: "NY", zip: "11211", lat: 40.7193, lng: -73.9576, streets: ["Bedford Ave", "Grand St", "N 6th St"] },
  { hood: "Park Slope", city: "Brooklyn", state: "NY", zip: "11215", lat: 40.672, lng: -73.9778, streets: ["7th Ave", "5th Ave"] },
  { hood: "DUMBO", city: "Brooklyn", state: "NY", zip: "11201", lat: 40.7033, lng: -73.9881, streets: ["Front St", "Water St"] },
  { hood: "Bushwick", city: "Brooklyn", state: "NY", zip: "11237", lat: 40.6958, lng: -73.9171, streets: ["Wyckoff Ave", "Knickerbocker Ave"] },
  { hood: "Greenpoint", city: "Brooklyn", state: "NY", zip: "11222", lat: 40.7299, lng: -73.9542, streets: ["Manhattan Ave", "Franklin St"] },
  { hood: "Bay Ridge", city: "Brooklyn", state: "NY", zip: "11209", lat: 40.6262, lng: -74.0329, streets: ["3rd Ave", "86th St"] },
  { hood: "Crown Heights", city: "Brooklyn", state: "NY", zip: "11225", lat: 40.6694, lng: -73.9422, streets: ["Franklin Ave", "Nostrand Ave"] },
  { hood: "Astoria", city: "Astoria", state: "NY", zip: "11105", lat: 40.7747, lng: -73.9118, streets: ["Ditmars Blvd", "30th Ave", "Steinway St"] },
  { hood: "Long Island City", city: "Long Island City", state: "NY", zip: "11101", lat: 40.7447, lng: -73.9536, streets: ["Vernon Blvd", "Jackson Ave"] },
  { hood: "Flushing", city: "Flushing", state: "NY", zip: "11354", lat: 40.7675, lng: -73.833, streets: ["Main St", "Roosevelt Ave"] },
  { hood: "Jackson Heights", city: "Jackson Heights", state: "NY", zip: "11372", lat: 40.7557, lng: -73.8831, streets: ["37th Ave", "Roosevelt Ave"] },
  { hood: "Forest Hills", city: "Forest Hills", state: "NY", zip: "11375", lat: 40.7181, lng: -73.8448, streets: ["Austin St", "Queens Blvd"] },
  { hood: "Mott Haven", city: "Bronx", state: "NY", zip: "10454", lat: 40.8091, lng: -73.9229, streets: ["Willis Ave", "E 138th St"] },
  { hood: "Fordham", city: "Bronx", state: "NY", zip: "10458", lat: 40.8615, lng: -73.8904, streets: ["Fordham Rd", "Arthur Ave"] },
  { hood: "St. George", city: "Staten Island", state: "NY", zip: "10301", lat: 40.6437, lng: -74.0736, streets: ["Bay St", "Victory Blvd"] },
  { hood: "Downtown", city: "Jersey City", state: "NJ", zip: "07302", lat: 40.7178, lng: -74.0431, streets: ["Newark Ave", "Grove St"] },
  { hood: "Journal Square", city: "Jersey City", state: "NJ", zip: "07306", lat: 40.7327, lng: -74.0634, streets: ["Kennedy Blvd", "Sip Ave"] },
  { hood: "Hoboken", city: "Hoboken", state: "NJ", zip: "07030", lat: 40.744, lng: -74.0324, streets: ["Washington St", "Hudson St"] },
  { hood: "Downtown", city: "Newark", state: "NJ", zip: "07102", lat: 40.7357, lng: -74.1724, streets: ["Market St", "Broad St"] },
  { hood: "Downtown", city: "White Plains", state: "NY", zip: "10601", lat: 41.033, lng: -73.7629, streets: ["Mamaroneck Ave", "Main St"] },
  { hood: "Downtown", city: "Stamford", state: "CT", zip: "06901", lat: 41.0534, lng: -73.5387, streets: ["Bedford St", "Atlantic St"] },
  { hood: "Mineola", city: "Mineola", state: "NY", zip: "11501", lat: 40.7493, lng: -73.6407, streets: ["Jericho Tpke", "Mineola Blvd"] },
];

// Seeded so a chain's stores (and their order) are the same on every search.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** `fixed`: stores the owner already has (from the POS fixtures), so the dedupe path is exercised. */
function chainPlaces(slug: string, name: string, count: number, seed: number, fixed: Omit<Place, "placeId" | "name">[] = []): Place[] {
  const r = rng(seed);
  const out: Place[] = fixed.map((f, i) => ({ ...f, placeId: `${slug}_${i}`, name }));
  const used = new Set(out.map((p) => p.address.street));
  for (let i = 0; out.length < count && i < 500; i++) {
    const h = HOODS[Math.floor(r() * HOODS.length)];
    const street = `${10 + Math.floor(r() * 890)} ${h.streets[Math.floor(r() * h.streets.length)]}`;
    if (used.has(street)) continue;
    used.add(street);
    out.push({
      placeId: `${slug}_${out.length}`,
      name,
      address: { street, city: h.city, state: h.state, zip: h.zip },
      neighborhood: h.hood === "Downtown" ? `${h.city}` : h.hood,
      lat: h.lat + (r() - 0.5) * 0.012,
      lng: h.lng + (r() - 0.5) * 0.012,
    });
  }
  return out;
}

const at = (hood: string, street: string, city = "New York") => {
  const h = HOODS.find((x) => x.hood === hood && x.city === city)!;
  return { address: { street, city: h.city, state: h.state, zip: h.zip }, neighborhood: hood, lat: h.lat, lng: h.lng };
};

// The first four Casa Alvarez stores match the POS fixtures (src/lib/org/posImport.ts), so the
// owner sees them as "Already added". 52 stores = three Text Search pages (20 + 20 + 12).
const CHAINS: { id: string; name: string; places: Place[] }[] = [
  {
    id: "casa-alvarez",
    name: "Casa Alvarez",
    places: chainPlaces("ca", "Casa Alvarez", 52, 7, [at("Koreatown", "34 W 32nd St"), at("Midtown", "512 5th Ave"), at("Midtown East", "655 Lexington Ave"), at("Carroll Gardens", "241 Smith St", "Brooklyn")]),
  },
  { id: "bean-bloom", name: "Bean & Bloom", places: chainPlaces("bb", "Bean & Bloom", 9, 11, [at("Lower East Side", "88 Orchard St"), at("Williamsburg", "145 Bedford Ave", "Brooklyn"), at("Park Slope", "301 7th Ave", "Brooklyn")]) },
  { id: "halal-corner", name: "Halal Corner", places: chainPlaces("hc", "Halal Corner", 60, 23) },
  { id: "nonnas-slice", name: "Nonna's Slice", places: chainPlaces("ns", "Nonna's Slice", 23, 31) },
  { id: "pho-saigon-house", name: "Pho Saigon House", places: chainPlaces("ps", "Pho Saigon House", 6, 41) },
  { id: "taqueria-luz", name: "Taqueria Luz", places: chainPlaces("tl", "Taqueria Luz", 1, 53) },
  { id: "the-green-fork", name: "The Green Fork", places: chainPlaces("gf", "The Green Fork", 14, 61) },
];

// Ops demo customers (src/lib/admin/accounts.ts): Google has a few more stores than each account
// has added, so ops can find and add the rest. Their seeded outlets are the first N of these.
const OPS_CHAINS: [name: string, total: number][] = [
  ["EggHolic", 5], ["Burger Bliss", 8], ["Pasta Paradise", 7], ["Sushi Haven", 9], ["Taco Fiesta", 14], ["Ahimsa", 6],
  ["Masala Lane", 4], ["Harbor Oyster Co.", 3], ["Cedar & Salt", 6], ["Brasa Grill", 5], ["Nordic Bakehouse", 7], ["Dumpling Society", 11],
  ["Chaat House", 4], ["Pão & Co.", 2], ["Alvarez Tacos", 5], ["Seoul Kitchen", 4], ["Trattoria Nove", 2], ["Green Bowl", 8],
  ["Jollof Junction", 3], ["Dosa Republic", 6], ["Smokehouse 51", 7], ["Bombay Bites", 4], ["Wok Express", 12], ["Maison Crêpe", 4],
];
OPS_CHAINS.forEach(([name, total], i) => {
  const id = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  CHAINS.push({ id, name, places: chainPlaces(id, name, total, 101 + i * 7) });
});

/** The first `n` stores Google has for a chain: seed data for accounts that already have outlets. */
export const seedPlaces = (name: string, n: number) => (CHAINS.find((c) => norm(c.name) === norm(name))?.places ?? []).slice(0, n);

// ── Network simulation ────────────────────────────────────────────────────────────────────────

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });
const jitter = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const suggestCache = new Map<string, Suggestion[]>();

/** Places Autocomplete. Chains first (with how many stores Google roughly has), then single places. */
export async function suggest(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = norm(query);
  if (q.length < 2) return [];
  const hit = suggestCache.get(q);
  if (hit) return hit;
  await wait(jitter(300, 800), signal);
  const chains = CHAINS.filter((c) => norm(c.name).includes(q));
  const out: Suggestion[] = [];
  for (const c of chains) {
    const cities = [...new Set(c.places.map((p) => p.address.city))];
    if (c.places.length > 1) out.push({ kind: "chain", id: c.id, name: c.name, estimate: c.places.length, cities });
  }
  // Google also lists single stores; one per chain is enough to show "or just this one".
  for (const c of chains.slice(0, 3)) out.push({ kind: "place", id: c.places[0].placeId, name: c.name, place: c.places[0] });
  const result = out.slice(0, 6);
  suggestCache.set(q, result);
  return result;
}

/** The chain whose name matches best, for "Add locations" to a restaurant the owner already has. */
export function chainFor(name: string): string | null {
  const q = norm(name);
  return CHAINS.find((c) => norm(c.name) === q)?.id ?? CHAINS.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name)))?.id ?? null;
}

const pageCache = new Map<string, Page[]>();

/** Text Search for every store of a chain, one page at a time (onPage fires per page).
 * Resolves when the last page lands; rejects with the abort reason if cancelled. */
export async function streamChain(chainId: string, onPage: (page: Page) => void, signal?: AbortSignal): Promise<void> {
  const chain = CHAINS.find((c) => c.id === chainId);
  const all = chain ? chain.places.slice(0, MAX_RESULTS) : [];
  const cached = pageCache.get(chainId);
  if (cached) return cached.forEach(onPage);
  const pages: Page[] = [];
  for (let i = 0; i === 0 || i * PAGE_SIZE < all.length; i++) {
    // First page ≈ 1 s; every later page waits for Google's next_page_token (≈ 2 s).
    await wait(i === 0 ? jitter(900, 1400) : jitter(1700, 2300), signal);
    const page = { places: all.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE), total: all.length, done: (i + 1) * PAGE_SIZE >= all.length };
    pages.push(page);
    onPage(page);
  }
  pageCache.set(chainId, pages);
}

/** "Midtown · 5th Ave": the neighbourhood, plus the street when the chain has two in one area,
 * plus the house number when they're on the same street too ("Park Slope · 168 7th Ave"). */
export function branchName(p: Place, all: Place[]) {
  const road = (x: Place) => x.address.street.replace(/^[\d-]+\s+/, "");
  const area = all.filter((o) => o.placeId !== p.placeId && o.neighborhood === p.neighborhood);
  if (!area.length) return p.neighborhood;
  return `${p.neighborhood} · ${area.some((o) => road(o) === road(p)) ? p.address.street : road(p)}`;
}
