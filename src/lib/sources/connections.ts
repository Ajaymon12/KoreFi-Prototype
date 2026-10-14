import type { SourceConnection } from "./types";

// Demo connection state. Flip `connected` to see dashboards change; every page reads through this.
export const CONNECTIONS: SourceConnection[] = [
  { id: "square", name: "Square", group: "pos", connected: true, status: "healthy", lastSyncedAt: "2026-10-08T11:38:00Z" },
  { id: "toast", name: "Toast", group: "pos", connected: false, status: "healthy", lastSyncedAt: "" },
  { id: "clover", name: "Clover", group: "pos", connected: false, status: "healthy", lastSyncedAt: "" },
  { id: "xero", name: "Xero", group: "accounting", connected: false, status: "healthy", lastSyncedAt: "" },
  { id: "zoho", name: "Zoho Books", group: "accounting", connected: true, status: "healthy", lastSyncedAt: "2026-10-08T11:20:00Z" },
  { id: "quickbooks", name: "QuickBooks", group: "accounting", connected: false, status: "healthy", lastSyncedAt: "" },
  { id: "doordash", name: "DoorDash", group: "marketplace", connected: true, status: "healthy", lastSyncedAt: "2026-10-08T11:38:00Z" },
  { id: "ubereats", name: "Uber Eats", group: "marketplace", connected: true, status: "syncing", lastSyncedAt: "2026-10-08T09:05:00Z" },
  { id: "grubhub", name: "Grubhub", group: "marketplace", connected: true, status: "error", lastSyncedAt: "2026-10-06T18:42:00Z", detail: "Latest upload is out of date. KoreFi will refresh it." },
  { id: "mercury", name: "Mercury", group: "bank", connected: true, status: "healthy", lastSyncedAt: "2026-10-08T11:00:00Z" },
];
