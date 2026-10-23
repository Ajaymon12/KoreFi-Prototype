// The restaurant the mock data follows: Taco Pros, a real taqueria chain, with its 34 outlets as listed on
// locations.tacopros.com (Oct 2026). Each outlet's figures come from books.ts; these are who and where they are,
// for names and for the State / City / Outlet filters. `share` is the outlet's size against the books' typical
// month, `apps` how much it leans on delivery (city stores more, small towns less), `labor`/`food` its cost pressure.

import { asset } from "@/lib/asset";

export const BRAND = "Taco Pros";
/** The cactus mark (Figma 1573:13838), for the restaurant switcher and anywhere the brand shows. */
export const BRAND_LOGO = asset("/logos/tacopros.svg");

export type StateCode = "IL" | "IN" | "OH" | "WI";
export const STATE_NAME: Record<StateCode, string> = { IL: "Illinois", IN: "Indiana", OH: "Ohio", WI: "Wisconsin" };

type Row = { name: string; state: StateCode; city: string; street: string; zip: string; share: number; apps: number; labor: number; food: number };

const ROWS = [
  { name: "Carol Stream", state: "IL", city: "Carol Stream", street: "772 W Army Trail Rd", zip: "60188", share: 0.31, apps: 0.92, labor: 0.98, food: 1.01 },
  { name: "71st & Western", state: "IL", city: "Chicago", street: "7108 S Western Ave", zip: "60636", share: 0.36, apps: 1.12, labor: 1.03, food: 0.99 },
  { name: "79th & Cicero", state: "IL", city: "Chicago", street: "7959 S Cicero Ave", zip: "60652", share: 0.38, apps: 1.05, labor: 1.01, food: 1.02 },
  { name: "87th & Stoney", state: "IL", city: "Chicago", street: "1515 E 87th St", zip: "60619", share: 0.33, apps: 1.15, labor: 1.04, food: 1.03 },
  { name: "Chicago & Halsted", state: "IL", city: "Chicago", street: "833 W Chicago Ave, Floor 1", zip: "60642", share: 0.42, apps: 1.32, labor: 1.08, food: 0.98 },
  { name: "Damen & Chicago", state: "IL", city: "Chicago", street: "1959 W Chicago Ave", zip: "60622", share: 0.37, apps: 1.25, labor: 1.06, food: 1 },
  { name: "Edgewater", state: "IL", city: "Chicago", street: "5310 N Broadway", zip: "60640", share: 0.35, apps: 1.22, labor: 1.05, food: 1.01 },
  { name: "Hyde Park", state: "IL", city: "Chicago", street: "1400 E 47th St", zip: "60653", share: 0.39, apps: 1.28, labor: 1.04, food: 0.99 },
  { name: "Montrose & N Elston", state: "IL", city: "Chicago", street: "4126 W Montrose Ave", zip: "60641", share: 0.34, apps: 1.1, labor: 1.02, food: 1.02 },
  { name: "Old Town", state: "IL", city: "Chicago", street: "1435 N Wells St", zip: "60610", share: 0.41, apps: 1.3, labor: 1.09, food: 0.97 },
  { name: "Pulaski & Belmont", state: "IL", city: "Chicago", street: "3029 N Pulaski Rd", zip: "60641", share: 0.36, apps: 1.08, labor: 1.01, food: 1.04 },
  { name: "Rogers Park", state: "IL", city: "Chicago", street: "2321 W Howard St", zip: "60645", share: 0.32, apps: 1.18, labor: 1.03, food: 1.05 },
  { name: "Taylor & Ogden", state: "IL", city: "Chicago", street: "2200 W Taylor St", zip: "60612", share: 0.4, apps: 1.26, labor: 1.05, food: 1 },
  { name: "Elburn", state: "IL", city: "Elburn", street: "782 N Main St", zip: "60119", share: 0.24, apps: 0.72, labor: 0.95, food: 1.03 },
  { name: "Franklin Park", state: "IL", city: "Franklin Park", street: "2830 Mannheim Rd", zip: "60131", share: 0.3, apps: 0.95, labor: 0.99, food: 1.02 },
  { name: "Glen Ellyn", state: "IL", city: "Glen Ellyn", street: "850 Roosevelt Rd", zip: "60137", share: 0.33, apps: 0.9, labor: 0.97, food: 0.99 },
  { name: "Green Oaks", state: "IL", city: "Green Oaks", street: "14010 W Rockland Rd", zip: "60048", share: 0.27, apps: 0.82, labor: 0.96, food: 1.01 },
  { name: "Gurnee", state: "IL", city: "Gurnee", street: "6681 Grand Ave", zip: "60031", share: 0.32, apps: 0.88, labor: 0.97, food: 1 },
  { name: "Huntley", state: "IL", city: "Huntley", street: "12902 IL-47", zip: "60142", share: 0.26, apps: 0.78, labor: 0.95, food: 1.04 },
  { name: "Joliet", state: "IL", city: "Joliet", street: "2565 Plainfield Rd", zip: "60435", share: 0.34, apps: 0.94, labor: 0.98, food: 1.02 },
  { name: "Naperville", state: "IL", city: "Naperville", street: "2860 Showplace Dr #114", zip: "60564", share: 0.37, apps: 0.98, labor: 1, food: 0.98 },
  { name: "Niles", state: "IL", city: "Niles", street: "7870 N Milwaukee Ave", zip: "60714", share: 0.33, apps: 1.02, labor: 1, food: 1.01 },
  { name: "North & Narragansett", state: "IL", city: "Oak Park", street: "6427 North Ave", zip: "60302", share: 0.31, apps: 1.06, labor: 1.01, food: 1.02 },
  { name: "Oak Park", state: "IL", city: "Oak Park", street: "2 Chicago Ave", zip: "60302", share: 0.35, apps: 1.04, labor: 1.02, food: 0.99 },
  { name: "Tinley Park", state: "IL", city: "Tinley Park", street: "15943 S Harlem Ave, Unit B", zip: "60477", share: 0.33, apps: 0.9, labor: 0.98, food: 1.01 },
  { name: "Waukegan", state: "IL", city: "Waukegan", street: "4055 Northpoint Blvd #104", zip: "60085", share: 0.29, apps: 0.86, labor: 0.97, food: 1.03 },
  { name: "Dyer", state: "IN", city: "Dyer", street: "1078-80 Joliet St", zip: "46311", share: 0.27, apps: 0.8, labor: 0.93, food: 1.02 },
  { name: "Merrillville", state: "IN", city: "Merrillville", street: "8160 Mississippi St", zip: "46410", share: 0.3, apps: 0.85, labor: 0.94, food: 1.01 },
  { name: "Valparaiso", state: "IN", city: "Valparaiso", street: "2005 Morthland Dr", zip: "46383", share: 0.26, apps: 0.76, labor: 0.92, food: 1.03 },
  { name: "Marysville", state: "OH", city: "Marysville", street: "15710 US Highway 36", zip: "43040", share: 0.22, apps: 0.7, labor: 0.92, food: 1.06 },
  { name: "Brown Deer", state: "WI", city: "Brown Deer", street: "9051 N Green Bay Rd", zip: "53209", share: 0.27, apps: 0.88, labor: 0.94, food: 1.02 },
  { name: "Mequon", state: "WI", city: "Mequon", street: "10942 N Port Washington Rd", zip: "53092", share: 0.25, apps: 0.8, labor: 0.95, food: 1 },
  { name: "Capitol Dr & Hwy 43", state: "WI", city: "Milwaukee", street: "242 E Capitol Dr", zip: "53212", share: 0.3, apps: 1.08, labor: 0.97, food: 1.02 },
  { name: "Marquette", state: "WI", city: "Milwaukee", street: "1400 W Wells St", zip: "53233", share: 0.33, apps: 1.2, labor: 0.98, food: 1 },
] as const satisfies readonly Row[];

/** An outlet's full name, as the reports carry it: "Taco Pros – Hyde Park". */
export type Store = `${typeof BRAND} – ${(typeof ROWS)[number]["name"]}`;
export type Outlet = Omit<Row, "name" | "state"> & { store: Store; name: string; state: StateCode };

export const OUTLETS: Outlet[] = ROWS.map((r) => ({ ...r, store: `${BRAND} – ${r.name}` as Store }));
export const STORES: readonly Store[] = OUTLETS.map((o) => o.store);
const BY_STORE = new Map(OUTLETS.map((o) => [o.store as string, o]));
export const outletOf = (s: Store): Outlet => BY_STORE.get(s)!;

/** The name without the brand: "Taco Pros – Hyde Park" → "Hyde Park". Any other text comes back as it is. */
export const shortStore = (s: string) => BY_STORE.get(s)?.name ?? s;
