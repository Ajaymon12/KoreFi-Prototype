// Types for the simulated source layer. No real APIs are called: each provider has a raw-shaped
// fixture and an adapter that maps it onto the normalised records below.

export type SourceGroup = "pos" | "accounting" | "marketplace" | "bank";

export type SourceId =
  | "square" | "toast" | "clover"
  | "xero" | "zoho" | "quickbooks"
  | "doordash" | "ubereats" | "grubhub"
  | "mercury";

export type SourceStatus = "healthy" | "syncing" | "error";

export type SourceConnection = {
  id: SourceId;
  name: string;
  group: SourceGroup;
  connected: boolean;
  status: SourceStatus;
  lastSyncedAt: string; // ISO timestamp
  detail?: string; // e.g. error reason
};

export const GROUP_LABELS: Record<SourceGroup, string> = {
  pos: "POS",
  accounting: "Accounting tools",
  marketplace: "3PD marketplaces",
  bank: "Banking",
};

// ---- Normalised records (what dashboards consume) ----

export type SalesSnapshot = {
  source: SourceId;
  netSales: number;
  previousNetSales: number;
  orders: number;
  previousOrders: number;
  weekly: { label: string; netSales: number }[];
  unavailableItems: { item: string; location: string }[];
};

// "open": still inside the window to dispute. "auto_refunded": the marketplace refunded the
// customer out of its own pocket, so nothing was ever charged to the restaurant.
export type DisputeStatus = "open" | "won" | "lost" | "auto_refunded";

export type Dispute = {
  source: SourceId;
  id: string;
  store: string;
  amount: number;
  status: DisputeStatus;
  date: string; // ISO date the error charge landed
  resolvedDate?: string; // ISO date a won dispute paid back
  reason: string; // category, e.g. "Missing item" — used to group in breakdown tables
  detail: string; // what actually happened on this order, e.g. "Birria tacos missing"
};

export type StorefrontStatus = {
  source: SourceId;
  store: string;
  online: boolean;
  downtimeMinutes: number;
  cause?: string;
  estLostRevenue: number;
};

/** One store on one marketplace: the order, quality and uptime numbers behind Sales, Order quality and Downtime. */
export type StoreOps = {
  source: SourceId;
  store: string;
  sales: number; // subtotal of delivered orders, excluding cancelled orders and tax
  previousSales: number;
  orders: number; // delivered orders
  previousOrders: number;
  canceled: number;
  previousCanceled: number;
  unfulfilled: number; // cancelled by the store (could not be made)
  previousUnfulfilled: number;
  itemsSold: number;
  previousItemsSold: number;
  avoidableWaitMin: number; // average gap between ready and driver pickup
  previousAvoidableWaitMin: number;
  previousInaccurate: number; // orders with a missing / wrong item last period
  previousErrorCharges: number;
  openMinutes: number; // minutes the store was scheduled open this period
  downtimeByWeekday: number[]; // Mon..Sun minutes offline during open hours
  previousDowntimeMinutes: number;
  topItems: { item: string; sold: number; canceled: number }[];
  daily: { date: string; orders: number; previousOrders: number; canceled: number; sales: number }[];
  hourly: number[]; // delivered orders by hour of day, 0-23
};

export type Payout = {
  source: SourceId;
  period: string;
  gross: number;
  fees: number;
  net: number;
  /** The same payout split per store; the rows sum to the totals above. */
  byStore: { store: string; gross: number; fees: number; net: number }[];
};

export type Deposit = {
  source: SourceId;
  date: string;
  amount: number;
  reference: string;
};

export type Balance = { source: SourceId; amount: number; previousAmount: number };

export type Invoice = {
  source: SourceId;
  vendor: string;
  amount: number;
  status: "paid" | "open" | "overdue";
  due: string;
};

export type SourceData = {
  sales?: SalesSnapshot;
  disputes?: Dispute[];
  storefronts?: StorefrontStatus[];
  ops?: StoreOps[];
  payouts?: Payout[];
  deposits?: Deposit[];
  balance?: Balance;
  invoices?: Invoice[];
};
