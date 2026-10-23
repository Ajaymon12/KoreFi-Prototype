import { BRAND, BRAND_LOGO, OUTLETS } from "@/lib/finance/outlets";
import type { Brand, Location, OnboardingState, PosId } from "./types";

// Mock "pull locations from your POS". Taco Pros runs on Square, Bean & Bloom on Toast, so a
// multi-brand owner has to connect both — the case onboarding is built around. Taco Pros' 34 stores are
// the real chain's (lib/finance/outlets, which the reports follow), so the switcher and the reports agree;
// its Oak Park pair share a ZIP, so the "tell nearby stores apart" step still has something to show.

type Raw = Omit<Location, "id" | "brandId" | "name" | "included" | "deliveryApps" | "posSource">;

const RAW: Record<PosId, Raw[]> = {
  square: [
    ...OUTLETS.map((o) => ({ posName: `${BRAND} – ${o.name}`, address: { street: o.street, city: o.city, state: o.state, zip: o.zip }, neighborhood: o.city })),
    { posName: "TP Training Store (do not use)", address: { street: "1435 N Wells St", city: "Chicago", state: "IL", zip: "60610" }, neighborhood: "Chicago", looksLikeTest: true },
  ],
  toast: [
    { posName: "Bean & Bloom Café", address: { street: "88 Orchard St", city: "New York", state: "NY", zip: "10002" }, neighborhood: "Lower East Side", lat: 40.7189, lng: -73.9903 },
    { posName: "Bean & Bloom – Williamsburg", address: { street: "145 Bedford Ave", city: "Brooklyn", state: "NY", zip: "11211" }, neighborhood: "Williamsburg", lat: 40.7193, lng: -73.9576 },
    { posName: "Bean & Bloom – Park Slope", address: { street: "301 7th Ave", city: "Brooklyn", state: "NY", zip: "11215" }, neighborhood: "Park Slope", lat: 40.672, lng: -73.9778 },
  ],
  clover: [
    { posName: "Alvarez Taqueria – Astoria", address: { street: "31-07 Ditmars Blvd", city: "Astoria", state: "NY", zip: "11105" }, neighborhood: "Astoria", lat: 40.7747, lng: -73.9118 },
    { posName: "Alvarez Taqueria – LIC", address: { street: "47-10 Vernon Blvd", city: "Long Island City", state: "NY", zip: "11101" }, neighborhood: "Long Island City", lat: 40.7447, lng: -73.9536 },
  ],
};

const SEP = /\s+[–—-]\s+/;
const uid = () => Math.random().toString(36).slice(2, 9);

/** The part after "Brand – ", else the neighbourhood: "Taco Pros – Hyde Park" → "Hyde Park". */
function shortName(r: Raw) {
  const parts = r.posName.split(SEP);
  return parts.length > 1 ? parts.slice(1).join(" – ") : r.neighborhood;
}

/** Brand guess from the POS name: words before " – ", minus a trailing "Kitchen"/"Café". */
function brandGuess(posName: string) {
  return posName.split(SEP)[0].replace(/\s+(Kitchen|Café|Cafe|Restaurant|Bar)$/i, "").trim();
}

/** Turns a POS's locations into rows, reusing or creating brands by name. */
export function importFromPos(pos: PosId, brands: Brand[]): { brands: Brand[]; locations: Location[] } {
  const next = [...brands];
  const brandFor = (name: string) => {
    const hit = next.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit.id;
    const b: Brand = { id: `b_${uid()}`, name, ...(name === BRAND && { logo: BRAND_LOGO }) };
    next.push(b);
    return b.id;
  };
  const locations = RAW[pos].map<Location>((r) => ({
    ...r,
    id: `l_${uid()}`,
    posSource: pos,
    name: r.looksLikeTest ? r.posName : shortName(r),
    brandId: r.looksLikeTest ? null : brandFor(brandGuess(r.posName)),
    included: !r.looksLikeTest,
    deliveryApps: [],
  }));
  return { brands: next, locations };
}

export const importCount = (pos: PosId) => RAW[pos].length;

const miles = (a: Location, b: Location) => {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const r = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
};

/** Groups of 2+ included locations of the same brand that sit within a mile (or share a ZIP)
 * of another in the group — the stores an owner is most likely to mix up. */
export function nearbyClusters(locations: Location[]): Location[][] {
  const live = locations.filter((l) => l.included && l.brandId);
  const parent = new Map(live.map((l) => [l.id, l.id]));
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  for (const a of live)
    for (const b of live)
      if (a.id < b.id && a.brandId === b.brandId && (a.address.zip === b.address.zip || miles(a, b) <= 1)) parent.set(find(a.id), find(b.id));
  const groups = new Map<string, Location[]>();
  for (const l of live) groups.set(find(l.id), [...(groups.get(find(l.id)) ?? []), l]);
  return [...groups.values()].filter((g) => g.length > 1);
}

/** "512 5th Ave" → "5th Ave"; "31-07 Ditmars Blvd" → "Ditmars Blvd". */
const streetName = (street: string) => street.replace(/^[\d-]+\s+/, "").replace(/\bLexington\b/, "Lex");

/** Name suggestion that tells nearby stores apart: neighbourhood + street. */
export const suggestName = (l: Location) => `${l.neighborhood} · ${streetName(l.address.street)}`;

export const formatAddress = (l: Location) => `${l.address.street}, ${l.address.city}, ${l.address.state} ${l.address.zip}`;

/** Setups saved while the sample restaurant was Casa Alvarez: that brand becomes Taco Pros, with its logo and its
 *  34 stores in place of the old ones (keeping their delivery apps). Ids are fixed so the change is the same on
 *  every read. A Taco Pros saved without the logo gets it. */
export function toTacoPros(s: OnboardingState): OnboardingState {
  const old = s.brands.find((b) => b.name.trim().toLowerCase() === "casa alvarez");
  if (!old) {
    const tp = s.brands.find((b) => b.name === BRAND && !b.logo);
    return tp ? { ...s, brands: s.brands.map((b) => (b === tp ? { ...b, logo: BRAND_LOGO } : b)) } : s;
  }
  const mine = s.locations.filter((l) => l.brandId === old.id);
  const at = s.locations.findIndex((l) => l.brandId === old.id);
  const stores = OUTLETS.map<Location>((o, i) => ({
    id: `l_tp${i}`,
    brandId: old.id,
    name: o.name,
    posName: `${BRAND} – ${o.name}`,
    posSource: mine[0]?.posSource ?? "square",
    address: { street: o.street, city: o.city, state: o.state, zip: o.zip },
    neighborhood: o.city,
    included: true,
    deliveryApps: mine[0]?.deliveryApps ?? [],
  }));
  const rest = s.locations.filter((l) => l.brandId !== old.id);
  const locations = at < 0 ? [...rest, ...stores] : [...rest.slice(0, at), ...stores, ...rest.slice(at)];
  return { ...s, brands: s.brands.map((b) => (b === old ? { ...b, name: BRAND, logo: BRAND_LOGO } : b)), locations };
}
