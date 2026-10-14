import type { ProviderId } from "./data";

// Ops "Users" tab and Dashboard: every customer account KoreFi manages, dummy data until the admin
// API exists. The first three share ids with USERS in ./data.ts (the upload form's user picker).

/** The prototype's "today", fixed so seeded relative dates render the same on server and client. */
export const NOW = new Date("2026-10-12T14:30:00");

export type AccountStatus = "active" | "onboarding" | "stalled" | "invited" | "suspended";
export type DataHealth = "fresh" | "stale" | "none";

/** Onboarding order (src/app/onboarding): Business → Locations → POS → Delivery → Accounting → Review. */
export const STEPS = [
  { id: "business", label: "Business" },
  { id: "locations", label: "Locations" },
  { id: "pos", label: "POS" },
  { id: "delivery", label: "Delivery apps" },
  { id: "accounting", label: "Accounting" },
  { id: "review", label: "Review" },
  { id: "done", label: "Complete" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];
export const stepLabel = (id: StepId) => STEPS.find((s) => s.id === id)!.label;

export type Account = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Manager";
  company: string;
  outlets: number;
  status: AccountStatus;
  step: StepId;
  /** ISO timestamp of the last sign-in; null if they never signed in (invited). */
  lastActive: string | null;
  joined: string;
  pos?: ProviderId;
  delivery: ProviderId[];
  /** How recent the newest uploaded data is: stale = nothing for 7+ days. */
  data: DataHealth;
  openChargebacks: number;
};

type Seed = [id: string, name: string, company: string, outlets: number, status: AccountStatus, step: StepId, lastActive: string | null, joined: string, pos: ProviderId | undefined, delivery: ProviderId[], data: DataHealth, openChargebacks: number, role?: Account["role"]];

const SEEDS: Seed[] = [
  ["priya", "Priya Shah", "EggHolic", 2, "active", "done", "2026-10-12T12:52:00", "2026-03-04", "toast", ["doordash", "ubereats"], "fresh", 2],
  ["mark", "Mark Chen", "Burger Bliss", 3, "active", "done", "2026-10-12T13:15:00", "2026-02-11", "square", ["doordash", "ubereats", "grubhub"], "fresh", 1],
  ["lara", "Lara Gomez", "Pasta Paradise", 4, "active", "done", "2026-10-12T13:45:00", "2026-01-20", "toast", ["doordash", "grubhub"], "fresh", 0],
  ["kaito", "Kaito Tanaka", "Sushi Haven", 5, "active", "done", "2026-10-11T18:02:00", "2025-12-09", "toast", ["ubereats", "doordash"], "fresh", 3],
  ["lucia", "Lucia Martinez", "Taco Fiesta", 6, "active", "done", "2026-10-12T14:30:00", "2025-11-18", "square", ["doordash", "ubereats", "grubhub"], "fresh", 4],
  ["arjun", "Arjun Mehta", "Ahimsa", 3, "active", "done", "2026-10-10T09:40:00", "2026-04-02", "toast", ["grubhub"], "stale", 0],
  ["sana", "Sana Kapoor", "Kapoor Hospitality", 5, "active", "done", "2026-10-09T16:20:00", "2026-04-15", "toast", ["doordash", "ubereats"], "stale", 1, "Owner"],
  ["dev", "Dev Patel", "Masala Lane", 2, "active", "done", "2026-10-08T11:05:00", "2026-05-06", "square", ["doordash"], "fresh", 0],
  ["nora", "Nora Fitzgerald", "Harbor Oyster Co.", 1, "active", "done", "2026-10-12T10:14:00", "2026-05-22", "toast", ["ubereats"], "fresh", 0],
  ["omar", "Omar Haddad", "Cedar & Salt", 3, "active", "done", "2026-09-28T15:33:00", "2026-03-30", "square", ["doordash", "grubhub"], "stale", 2],
  ["ines", "Inês Carvalho", "Brasa Grill", 2, "active", "done", "2026-10-11T09:12:00", "2026-06-12", "toast", ["doordash", "ubereats"], "fresh", 0],
  ["jonas", "Jonas Berg", "Nordic Bakehouse", 4, "active", "done", "2026-10-07T08:48:00", "2026-06-25", "square", ["doordash"], "fresh", 1, "Manager"],
  ["mei", "Mei Lin", "Dumpling Society", 3, "active", "done", "2026-10-12T11:27:00", "2026-07-08", "toast", ["doordash", "ubereats", "grubhub"], "fresh", 0],
  ["rahul", "Rahul Verma", "Chaat House", 2, "onboarding", "delivery", "2026-10-12T09:03:00", "2026-10-11", "toast", [], "none", 0],
  ["ana", "Ana Souza", "Pão & Co.", 1, "onboarding", "pos", "2026-10-12T13:58:00", "2026-10-12", undefined, [], "none", 0],
  ["tom", "Tom Alvarez", "Alvarez Tacos", 3, "onboarding", "accounting", "2026-10-11T17:41:00", "2026-10-08", "square", ["ubereats"], "none", 0],
  ["hana", "Hana Kim", "Seoul Kitchen", 2, "stalled", "pos", "2026-10-01T10:15:00", "2026-09-28", undefined, [], "none", 0],
  ["luca", "Luca Romano", "Trattoria Nove", 1, "stalled", "locations", "2026-09-26T19:20:00", "2026-09-24", undefined, [], "none", 0],
  ["zoe", "Zoë Williams", "Green Bowl", 4, "stalled", "delivery", "2026-09-30T12:09:00", "2026-09-19", "square", [], "none", 0],
  ["sam", "Sam Okafor", "Jollof Junction", 2, "stalled", "business", "2026-09-29T08:30:00", "2026-09-29", undefined, [], "none", 0],
  ["priyanka", "Priyanka Nair", "Dosa Republic", 3, "invited", "business", null, "2026-10-10", undefined, [], "none", 0],
  ["greg", "Greg Hoffman", "Smokehouse 51", 5, "invited", "business", null, "2026-10-09", undefined, [], "none", 0],
  ["fatima", "Fatima Rahman", "Bombay Bites", 2, "invited", "business", null, "2026-10-12", undefined, [], "none", 0],
  ["victor", "Victor Lee", "Wok Express", 6, "suspended", "done", "2026-08-14T10:00:00", "2025-10-02", "square", ["doordash", "grubhub"], "stale", 0],
  ["claire", "Claire Dubois", "Maison Crêpe", 2, "active", "done", "2026-10-06T14:44:00", "2026-07-30", "toast", ["ubereats", "doordash"], "stale", 0],
];

export const ACCOUNTS: Account[] = SEEDS.map(([id, name, company, outlets, status, step, lastActive, joined, pos, delivery, data, openChargebacks, role]) => ({
  id,
  name,
  email: `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@${company.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "")}.com`,
  role: role ?? "Owner",
  company,
  outlets,
  status,
  step,
  lastActive,
  joined,
  pos,
  delivery,
  data,
  openChargebacks,
}));

export const STATUS_META: Record<AccountStatus, { label: string; tone: "success" | "info" | "warning" | "neutral" | "danger" }> = {
  active: { label: "Active", tone: "success" },
  onboarding: { label: "Onboarding", tone: "info" },
  stalled: { label: "Stalled", tone: "warning" },
  invited: { label: "Invited", tone: "neutral" },
  suspended: { label: "Suspended", tone: "danger" },
};

export const DATA_META: Record<DataHealth, { label: string; tone: "success" | "warning" | "neutral" }> = {
  fresh: { label: "Up to date", tone: "success" },
  stale: { label: "Stale", tone: "warning" },
  none: { label: "No data yet", tone: "neutral" },
};

const DAY = 86_400_000;
export const daysAgo = (iso: string) => Math.floor((NOW.getTime() - new Date(iso).getTime()) / DAY);

/** "2h ago" / "3d ago" / "Never" — the Last active column. */
export function ago(iso: string | null) {
  if (!iso) return "Never";
  const ms = NOW.getTime() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const activeWithin = (a: Account, days: number) => a.lastActive !== null && daysAgo(a.lastActive) < days;
