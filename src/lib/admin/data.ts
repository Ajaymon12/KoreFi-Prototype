import type { MockFile } from "./mock";
import { getAccounts } from "./store";

// Ops admin mock data: the customers KoreFi manages, the providers whose exports ops uploads, and
// the upload history. Stand-ins until the admin API exists.

export type Category = "3pd" | "pos";
export type ProviderId = "doordash" | "ubereats" | "grubhub" | "square" | "toast";

type Columns = { date: string; store: string; id: string; amount: string };

export type Provider = {
  id: ProviderId;
  name: string;
  category: Category;
  reportTypes: string[];
  /** Headers only this provider's exports have — used to tell which provider produced a file. */
  signature: string[];
  /** Columns ingestion needs, by role. */
  columns: Columns;
};

export const PROVIDERS: Provider[] = [
  {
    id: "doordash",
    name: "DoorDash",
    category: "3pd",
    reportTypes: ["Transaction", "Detailed", "Adjustment", "Payout"],
    signature: ["doordash order id"],
    columns: { date: "Timestamp local date", store: "Store name", id: "DoorDash order ID", amount: "Subtotal" },
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    category: "3pd",
    reportTypes: ["Transaction", "Detailed", "Payout"],
    signature: ["marketplace fee", "total payout"],
    columns: { date: "Order date", store: "Store name", id: "Order ID", amount: "Sales (incl. tax)" },
  },
  {
    id: "grubhub",
    name: "Grubhub",
    category: "3pd",
    reportTypes: ["Transaction", "Adjustment"],
    signature: ["grubhub order number"],
    columns: { date: "Transaction date", store: "Restaurant", id: "Grubhub order number", amount: "Subtotal" },
  },
  {
    id: "square",
    name: "Square",
    category: "pos",
    reportTypes: ["Sales summary", "Item sales"],
    signature: ["square transaction id"],
    columns: { date: "Date", store: "Location", id: "Square transaction ID", amount: "Gross sales" },
  },
  {
    id: "toast",
    name: "Toast",
    category: "pos",
    reportTypes: ["Sales summary", "Item sales"],
    signature: ["toast check id", "business date"],
    columns: { date: "Business date", store: "Location", id: "Toast check ID", amount: "Net sales" },
  },
];

export const provider = (id: ProviderId | "") => PROVIDERS.find((p) => p.id === id);

export type Outlet = { id: string; name: string };
export type Restaurant = { id: string; name: string; outlets: Outlet[] };

export const RESTAURANTS: Restaurant[] = [
  {
    id: "eggholic",
    name: "EggHolic",
    outlets: [
      { id: "downtown", name: "Downtown" },
      { id: "midtown", name: "Midtown" },
    ],
  },
  {
    id: "ahimsa",
    name: "Ahimsa",
    outlets: [
      { id: "new-york", name: "New York" },
      { id: "chicago", name: "Chicago" },
      { id: "san-francisco", name: "San Francisco" },
    ],
  },
];

/** Customer accounts (restaurant owners). Ops picks the user first; their restaurants follow. */
export type User = { id: string; name: string; email: string; restaurantIds: string[] };

export const USERS: User[] = [
  { id: "priya", name: "Priya Shah", email: "priya@pivotkitchen.com", restaurantIds: ["eggholic"] },
  { id: "arjun", name: "Arjun Mehta", email: "arjun@ahimsa.nyc", restaurantIds: ["ahimsa"] },
  { id: "sana", name: "Sana Kapoor", email: "sana@kapoorhospitality.com", restaurantIds: ["eggholic", "ahimsa"] },
];

// Clients outside the seeded USERS / RESTAURANTS (everyone else on Clients, and anyone ops add) fall
// back to their account, so their File uploads page works with their own restaurants and outlets.
export const user = (id: string): User | undefined => {
  const seeded = USERS.find((u) => u.id === id);
  if (seeded) return seeded;
  const a = getAccounts().find((x) => x.id === id);
  return a && { id: a.id, name: a.name, email: a.email, restaurantIds: a.restaurants.map((r) => r.id) };
};

export const restaurant = (id: string): Restaurant | undefined => {
  const seeded = RESTAURANTS.find((r) => r.id === id);
  if (seeded) return seeded;
  const r = getAccounts()
    .flatMap((a) => a.restaurants)
    .find((x) => x.id === id);
  return r && { id: r.id, name: r.name, outlets: r.outlets.map((o) => ({ id: o.id, name: o.name })) };
};
export const outlet = (rid: string, oid: string) => restaurant(rid)?.outlets.find((o) => o.id === oid);

/**
 * extracting  — file uploaded, KoreFi is reading it (can take up to ~5 min)
 * needs_mapping — extraction done, ops must map each location to an outlet
 * processing  — mapped, rows are being imported
 */
export type UploadStatus = "extracting" | "needs_mapping" | "processing" | "completed" | "partial" | "rejected";

export const UPLOAD_STATUS: Record<UploadStatus, { tone: "success" | "warning" | "danger" | "info"; label: string }> = {
  extracting: { tone: "info", label: "Extracting" },
  needs_mapping: { tone: "warning", label: "Needs mapping" },
  processing: { tone: "info", label: "Processing" },
  completed: { tone: "success", label: "Completed" },
  partial: { tone: "warning", label: "Partially imported" },
  rejected: { tone: "danger", label: "Rejected" },
};

export type Upload = {
  id: string;
  fileName: string;
  size: number;
  rows: number;
  userId: string;
  restaurantId: string;
  /** Outlets the file's locations were mapped to. */
  outletIds: string[];
  /** The uploaded file (dummy stand-in for the stored file), kept so mapping can happen later. */
  source?: MockFile;
  /** Locations found in the file and the outlet each went to ("" = not mapped yet, or skipped). */
  locations?: { name: string; rows: number; externalId: string; outletId: string }[];
  provider: ProviderId;
  reportType: string;
  uploadedBy: string;
  status: UploadStatus;
  reason?: string;
  skipped?: number;
  /** Why rows were skipped, e.g. "no date". */
  skipReason?: string;
  /** ISO dates of the first and last row, for overlap checks. */
  start?: string;
  end?: string;
  at: string;
};

export const SEED_HISTORY: Upload[] = [
  {
    id: "u4",
    fileName: "detailed_EggHolic_DD_2026_Sep.csv",
    size: 412_000,
    rows: 1_284,
    userId: "priya",
    restaurantId: "eggholic",
    outletIds: ["downtown"],
    provider: "doordash",
    reportType: "Transaction",
    uploadedBy: "Nitish Agarwal",
    status: "completed",
    start: "2026-09-01",
    end: "2026-09-30",
    at: "2026-10-09T15:31:00",
  },
  {
    id: "u3",
    fileName: "eggholic_ue_payouts_oct.xlsx",
    size: 820_000,
    rows: 1_402,
    userId: "priya",
    restaurantId: "eggholic",
    outletIds: ["downtown"],
    provider: "ubereats",
    reportType: "Payout",
    uploadedBy: "Nitish Agarwal",
    status: "rejected",
    reason: "Import failed: 38 rows have a negative payout. Re-export the report and upload again.",
    at: "2026-10-09T13:25:00",
  },
  {
    id: "u2",
    fileName: "toast_sales_summary_sep.xlsx",
    size: 88_000,
    rows: 30,
    userId: "priya",
    restaurantId: "eggholic",
    outletIds: ["midtown"],
    provider: "toast",
    reportType: "Sales summary",
    uploadedBy: "Shreeya L.",
    status: "partial",
    skipped: 2,
    start: "2026-09-01",
    end: "2026-09-30",
    at: "2026-10-07T22:09:00",
  },
  {
    id: "u1",
    fileName: "detailed_New-York_GH_2026_May_Oct.csv",
    size: 640_000,
    rows: 1_086,
    userId: "arjun",
    restaurantId: "ahimsa",
    outletIds: ["new-york"],
    provider: "grubhub",
    reportType: "Transaction",
    uploadedBy: "Alex Antony",
    status: "completed",
    start: "2026-05-01",
    end: "2026-10-31",
    at: "2026-10-07T16:11:00",
  },
];
