import type { SourceGroup, SourceId } from "./types";

// What each source gives KoreFi, in plain words. Shown on the Integrations page cards and in the
// connect dialog. Delivery apps (DoorDash, Uber Eats, Grubhub) are not here: there is no integration, the
// KoreFi ops team uploads that data, so an owner never connects them.

export type CatalogEntry = { blurb: string; reads: string[]; tint: string };

export const CATALOG: Partial<Record<SourceId, CatalogEntry>> = {
  square: { blurb: "In-store sales, orders and items sold.", reads: ["Sales and orders", "Menu items and sold-out items", "Locations"], tint: "bg-(--gray-1200)" },
  toast: { blurb: "In-store sales, orders and items sold.", reads: ["Sales and orders", "Menu items and sold-out items", "Locations"], tint: "bg-(--color-warning-darkest)" },
  clover: { blurb: "In-store sales, orders and items sold.", reads: ["Sales and orders", "Menu items and sold-out items", "Locations"], tint: "bg-(--color-success-darkest)" },
  zoho: { blurb: "Vendor bills and what is due.", reads: ["Bills and due dates", "Vendors", "Payment status"], tint: "bg-(--color-danger-darkest)" },
  xero: { blurb: "Vendor bills and what is due.", reads: ["Bills and due dates", "Vendors", "Payment status"], tint: "bg-(--color-info-darkest)" },
  quickbooks: { blurb: "Vendor bills and what is due.", reads: ["Bills and due dates", "Vendors", "Payment status"], tint: "bg-(--color-success-darkest)" },
  mercury: { blurb: "Bank balance and deposits, to check every payout landed.", reads: ["Account balance", "Deposits and transactions"], tint: "bg-(--color-primary-solid)" },
};

export const SHOWN_GROUPS: SourceGroup[] = ["pos", "accounting", "bank"];
