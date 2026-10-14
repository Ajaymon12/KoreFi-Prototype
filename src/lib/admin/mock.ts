import { provider, restaurant, type ProviderId, type Upload } from "./data";

// Dummy file reading for the ops upload prototype. Nothing is parsed: every file (a picked one or
// a built-in sample) becomes a MockFile, and its columns, store names, preview rows and checks are
// generated from it and from what ops picked in the form.

export type Problem = "unsupported" | "tooLarge" | "empty" | "password";

/** A location (store) found in the file, as the provider names it. */
export type SourceLocation = { name: string; rows: number; externalId: string };

export type MockFile = {
  name: string;
  size: number;
  rows: number;
  /** What's "inside" the file. `undefined` means it matches whatever ops picked. */
  provider?: ProviderId;
  reportType?: string;
  /** Locations in the file. Default: one location per outlet of the restaurant, rows split evenly. */
  stores?: SourceLocation[];
  sheets: string[];
  missingDates?: number;
  start: string;
  end: string;
  problem?: Problem;
};

export const MAX_BYTES = 20 * 1024 * 1024;
const OK_EXT = ["csv", "xlsx", "xls"];
export const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export type Sample = { label: string; hint: string; file: MockFile };

/** Sample files that walk through each state of the flow. Best tried with Priya Shah › EggHolic › DoorDash. */
export const SAMPLES: Sample[] = [
  {
    label: "Good file, with warnings",
    hint: "Overlaps an earlier upload · 12 rows without dates · 2 sheets",
    file: { name: "detailed_EggHolic_DD_2026_Sep_Oct.xlsx", size: 1_120_000, rows: 2_940, sheets: ["Transactions", "Summary"], missingDates: 12, start: "2026-09-01", end: "2026-10-31" },
  },
  {
    label: "Two locations in one file",
    hint: "Downtown + Midtown, matched automatically",
    file: {
      name: "eggholic_dd_all_stores_oct.csv",
      size: 760_000,
      rows: 2_210,
      stores: [
        { name: "EggHolic (Downtown)", rows: 1_402, externalId: "455501" },
        { name: "EggHolic (Midtown)", rows: 808, externalId: "455502" },
      ],
      sheets: ["eggholic_dd_all_stores_oct"],
      start: "2026-10-01",
      end: "2026-10-31",
    },
  },
  {
    label: "Unknown location",
    hint: "A store that isn’t one of the outlets yet",
    file: {
      name: "doordash_export_custom.csv",
      size: 498_000,
      rows: 1_530,
      stores: [
        { name: "EggHolic (Downtown)", rows: 1_310, externalId: "455501" },
        { name: "EggHolic Airport Kiosk", rows: 220, externalId: "455590" },
      ],
      sheets: ["doordash_export_custom"],
      start: "2026-10-01",
      end: "2026-10-31",
    },
  },
  {
    label: "Wrong provider",
    hint: "An Uber Eats payout file",
    file: { name: "eggholic_ue_payouts_oct.xlsx", size: 820_000, rows: 1_402, provider: "ubereats", reportType: "Payout", sheets: ["Payouts"], start: "2026-10-01", end: "2026-10-28" },
  },
  {
    label: "Already uploaded",
    hint: "Same file uploaded on Oct 9",
    file: { name: "detailed_EggHolic_DD_2026_Sep.csv", size: 412_000, rows: 1_284, sheets: ["detailed_EggHolic_DD_2026_Sep"], start: "2026-09-01", end: "2026-09-30" },
  },
  { label: "Password-protected Excel", hint: "Can’t be opened", file: { name: "eggholic_q3_locked.xlsx", size: 96_000, rows: 0, sheets: [], start: "", end: "", problem: "password" } },
  { label: "Empty file", hint: "Headers only", file: { name: "orders_export (3).csv", size: 210, rows: 0, sheets: ["orders_export (3)"], start: "", end: "", problem: "empty" } },
  { label: "PDF", hint: "Unsupported type", file: { name: "menu_photo.pdf", size: 2_400_000, rows: 0, sheets: [], start: "", end: "", problem: "unsupported" } },
  { label: "Too large", hint: "24.6 MB", file: { name: "doordash_full_year_2026.csv", size: 25_800_000, rows: 0, sheets: [], start: "", end: "", problem: "tooLarge" } },
];

/** A file picked from disk: only its name and size are real. */
export function fromPicked(f: File): MockFile {
  const base: MockFile = { name: f.name, size: f.size, rows: 1_860, sheets: [f.name.replace(/\.[^.]+$/, "")], start: "2026-09-01", end: "2026-10-31" };
  if (!OK_EXT.includes(ext(f.name))) return { ...base, rows: 0, problem: "unsupported" };
  if (f.size > MAX_BYTES) return { ...base, rows: 0, problem: "tooLarge" };
  if (ext(f.name) !== "csv") base.sheets = ["Transactions", "Summary"];
  return base;
}

export const formatBytes = (n: number) => (n >= 1_000_000 ? `${(n / 1_048_576).toFixed(1)} MB` : n >= 1_000 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const day = (s: string, y: boolean) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}) });
export const formatRange = (a: string, b: string) => `${day(a, false)} – ${day(b, true)}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export type CheckAction = { label: string; kind: "provider" | "keepBoth"; value?: string };
export type Check = { id: string; tone: "ok" | "error" | "warning"; title: string; detail?: string; action?: CheckAction };

/** The provider the file really came from, and the report type read from its columns. */
export const fileProvider = (file: MockFile, picked: ProviderId) => file.provider ?? picked;
export const reportTypeOf = (file: MockFile, picked: ProviderId) => file.reportType ?? provider(fileProvider(file, picked))!.reportTypes[0];

/** Step 1 — can the file be used at all? Blocking problems only. */
export function fileChecks(file: MockFile, picked: ProviderId | "", history: Upload[]): Check[] {
  const e = ext(file.name);
  if (file.problem === "unsupported") return [{ id: "type", tone: "error", title: "Unsupported file type", detail: `.${e} files can’t be imported. Use CSV, XLSX or XLS.` }];
  if (file.problem === "tooLarge") return [{ id: "size", tone: "error", title: "File is too large", detail: `${formatBytes(file.size)} is over the 20 MB limit. Export a shorter date range.` }];
  if (file.problem === "password") return [{ id: "open", tone: "error", title: "File is password-protected", detail: "Remove the password in Excel, save, and pick the file again." }];
  if (file.problem === "empty") return [{ id: "empty", tone: "error", title: "File has no rows", detail: "Only a header row was found. Check the export’s date range." }];
  const out: Check[] = [];
  const dup = history.find((h) => h.fileName === file.name && h.size === file.size && h.status !== "rejected");
  if (dup) out.push({ id: "dup", tone: "error", title: "This file was already uploaded", detail: `${dup.uploadedBy} uploaded it on ${shortDate(dup.at)}. Nothing new to import.` });
  const p = provider(picked);
  if (p && file.provider && file.provider !== p.id) {
    const actual = provider(file.provider)!;
    out.push({
      id: "provider",
      tone: "error",
      title: `This looks like a ${actual.name} report, not ${p.name}`,
      detail: `Its columns match the ${actual.name} ${file.reportType ?? "export"}.`,
      action: actual.category === p.category ? { label: `Switch to ${actual.name}`, kind: "provider", value: actual.id } : undefined,
    });
  }
  return out;
}

// ---------- Step 2: outlet mapping ----------

export function storesIn(file: MockFile, restaurantId: string): SourceLocation[] {
  if (file.stores) return file.stores;
  const r = restaurant(restaurantId) ?? restaurant("eggholic")!;
  const n = r.outlets.length;
  return r.outlets.map((o, i) => ({ name: `${r.name} (${o.name})`, rows: Math.floor(file.rows / n) + (i === 0 ? file.rows % n : 0), externalId: String(455501 + i) }));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Location → outlet id when the name has the restaurant's name and the outlet's. */
export function autoMatchStores(file: MockFile, restaurantId: string): Record<string, string> {
  const r = restaurant(restaurantId);
  return Object.fromEntries(
    storesIn(file, restaurantId).map((s) => {
      const o = r?.outlets.find((x) => norm(s.name).includes(norm(r.name)) && norm(s.name).includes(norm(x.name)));
      return [s.name, o?.id ?? ""];
    }),
  );
}

// ---------- Step 3: review ----------

export function reviewChecks(file: MockFile, picked: ProviderId, outletIds: string[], skippedRows: number, history: Upload[], keepBoth: boolean): Check[] {
  const p = provider(fileProvider(file, picked))!;
  const type = reportTypeOf(file, picked);
  const out: Check[] = [
    { id: "type", tone: "ok", title: "File type and size", detail: `${ext(file.name).toUpperCase()} · ${formatBytes(file.size)} (limit 20 MB)` },
    { id: "provider", tone: "ok", title: `${p.name} ${type} report`, detail: "Report type detected from the columns" },
    { id: "outlets", tone: "ok", title: `${outletIds.length} location${outletIds.length > 1 ? "s" : ""} mapped to outlets`, detail: "Every row goes to a KoreFi outlet" },
    { id: "period", tone: "ok", title: `Period: ${formatRange(file.start, file.end)}`, detail: "No future dates" },
  ];
  if (skippedRows) out.push({ id: "skipStores", tone: "warning", title: `${skippedRows.toLocaleString()} rows will be skipped`, detail: "You chose to skip locations that aren’t one of this restaurant’s outlets." });
  if (file.missingDates) out.push({ id: "dates", tone: "warning", title: `${file.missingDates} rows have no order date`, detail: "They’ll be skipped on import." });
  if (file.sheets.length > 1) out.push({ id: "sheets", tone: "warning", title: `${file.sheets.length} sheets found`, detail: `Importing “${file.sheets[0]}”. Other sheets are ignored.` });
  const prev = history.find((h) => h.status !== "rejected" && h.provider === p.id && h.reportType === type && h.outletIds.some((o) => outletIds.includes(o)) && h.start && h.end && h.start <= file.end && file.start <= h.end);
  if (prev)
    out.push({
      id: "overlap",
      tone: "warning",
      title: "Overlaps an earlier upload",
      detail: keepBoth
        ? `Keeping both — orders from ${formatRange(prev.start!, prev.end!)} may be counted twice.`
        : `${formatRange(prev.start!, prev.end!)} was uploaded on ${shortDate(prev.at)}. Overlapping orders will be replaced.`,
      action: keepBoth ? undefined : { label: "Keep both", kind: "keepBoth" },
    });
  return out;
}

/** A report whose extraction already finished: shows up in the table as "Needs mapping". */
export const SEED_NEEDS_MAPPING: Upload = {
  id: "seed-needs-mapping",
  fileName: "doordash_export_custom.csv",
  size: 498_000,
  rows: 1_530,
  userId: "priya",
  restaurantId: "eggholic",
  outletIds: [],
  provider: "doordash",
  reportType: "Transaction",
  uploadedBy: "Nitish Agarwal",
  status: "needs_mapping",
  start: "2026-10-01",
  end: "2026-10-31",
  at: "2026-10-12T14:20:00",
  source: SAMPLES[2].file,
  locations: SAMPLES[2].file.stores!.map((l) => ({ ...l, outletId: "" })),
};
