import type { SourceGroup, SourceId } from "./types";

// What each source gives KoreFi, in plain words. Shown on the Integrations page cards and in the
// connect dialog. Delivery apps (DoorDash, Uber Eats, Grubhub) connect differently: the owner adds a KoreFi
// reports-only user in the app's merchant portal and the KoreFi team verifies access (MVP 3 lists them;
// the older Integrations page still hides them via SHOWN_GROUPS).

export type CatalogEntry = { blurb: string; reads: string[]; tint: string };

export const CATALOG: Partial<Record<SourceId, CatalogEntry>> = {
  square: { blurb: "In-store sales, orders and items sold.", reads: ["Sales and orders", "Menu items and sold-out items", "Locations"], tint: "bg-(--gray-1200)" },
  toast: { blurb: "In-store sales, orders and items sold.", reads: ["Sales and orders", "Menu items and sold-out items", "Locations"], tint: "bg-(--color-warning-darkest)" },
  clover: { blurb: "In-store sales, orders and items sold.", reads: ["Sales and orders", "Menu items and sold-out items", "Locations"], tint: "bg-(--color-success-darkest)" },
  zoho: { blurb: "Vendor bills and what is due.", reads: ["Bills and due dates", "Vendors", "Payment status"], tint: "bg-(--color-danger-darkest)" },
  xero: { blurb: "Vendor bills and what is due.", reads: ["Bills and due dates", "Vendors", "Payment status"], tint: "bg-(--color-info-darkest)" },
  quickbooks: { blurb: "Vendor bills and what is due.", reads: ["Bills and due dates", "Vendors", "Payment status"], tint: "bg-(--color-success-darkest)" },
  doordash: { blurb: "Orders, payouts, fees and chargebacks.", reads: ["Orders and payouts", "Fees, commissions and promos", "Chargebacks and adjustments", "Stores"], tint: "bg-(--color-danger-default)" },
  ubereats: { blurb: "Orders, payouts, fees and chargebacks.", reads: ["Orders and payouts", "Fees, commissions and promos", "Chargebacks and adjustments", "Stores"], tint: "bg-(--gray-1200)" },
  grubhub: { blurb: "Orders, payouts, fees and chargebacks.", reads: ["Orders and payouts", "Fees, commissions and promos", "Chargebacks and adjustments", "Stores"], tint: "bg-(--color-danger-dark)" },
  mercury: { blurb: "Bank balance and deposits, to check every payout landed.", reads: ["Account balance", "Deposits and transactions"], tint: "bg-(--color-primary-solid)" },
};

export const SHOWN_GROUPS: SourceGroup[] = ["pos", "accounting", "bank"];
