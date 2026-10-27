"use client";
import { useState } from "react";
import { Check, Download, FileCheck2, Pencil, X } from "lucide-react";
import { AppName } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import { LATEST, STORES, WEEKS_IN_YEAR, closedWeeks, weekLabel, type Store } from "@/lib/finance/books";
import { shortStore } from "@/lib/finance/outlets";
import { REPORTS_UPLOADED, REPORT_SOURCES, reportWeek, type ChannelKey, type ChannelReport } from "@/lib/finance/reports";
import { reconcile, type Recon } from "@/lib/finance/reconcile";
import type { AppKey } from "@/lib/finance/chargebacks";
import { COSTS, TYPICAL, saveCostSettings, settingText, settingsFor, useCostSettings, type CostKey, type CostMode, type CostSetting, type CostSettings } from "@/lib/finance/costSettings";
import { TimelineRange, type Preset, type TimelineWeek } from "./TimelineRange";
import { Segmented, downloadCsv, usd } from "./parts";
import { PnlTable } from "./PnlTable";

// MVP / Profit / P&L, the A/B partner to the Statement tab. Built on what KoreFi actually receives:
// the reports ops uploads (Square, DoorDash, Uber Eats, Grubhub) give sales, card fees, app commission,
// app promos and chargebacks after money back. Food and staff never arrive, so:
//   facts        sales down to Net after fees, per channel, shown plainly
//   estimates    below a band that says so: food and staff from the owner's cost settings (typical
//                restaurant figures until they set theirs), every figure marked ≈, profit "estimated".
//                Each cost's setting sits under its label and edits in place; the figures follow as you type.
//   channels     each stops at its contribution (net revenue − food); staff is shared, so it comes
//                off once, in All. Splitting fixed costs by sales would make the apps look loss-making.
// Top: store pills, the week timeline, then one "where your money went" panel: the net profit margin as the
// headline, beside a waterfall from what you sold, down through cost of selling (per $1 by channel) and
// the estimated costs, to profit.
// Phones: the panel stacks (headline, then waterfall) and the table becomes one channel at a time.
// /mvp2's P&L Summary (PnlSummary.tsx) reuses the figures (usePnl), the cards and the cost editor.

const FIRST_YEAR = LATEST.year - 1;
const DAY = 86_400_000;
export const DEFAULT_WEEKS = 4;
const WEEKS_PER_MONTH = 52 / 12;

export type Channel = { key: ChannelKey; label: string; source: string; app: boolean; color: string };
export const CHANNELS: Channel[] = [
  { key: "instore", label: "In store & website", source: "instore", app: false, color: "var(--brand-900)" },
  { key: "doordash", label: "DoorDash", source: "doordash", app: true, color: "var(--red-900)" },
  { key: "uber", label: "Uber Eats", source: "ubereats", app: true, color: "var(--green-900)" },
  { key: "grubhub", label: "Grubhub", source: "grubhub", app: true, color: "var(--gray-900)" },
];
export const short = (s: Store) => shortStore(s);

// Every closed week from January last year, as one list the timeline indexes into.
export const WEEKS: (TimelineWeek & { year: number; w: number })[] = [FIRST_YEAR, LATEST.year].flatMap((year) =>
  Array.from({ length: year === LATEST.year ? closedWeeks(year) : WEEKS_IN_YEAR }, (_, w) => ({ year, w, start: new Date(Date.UTC(year, 0, 1) + w * 7 * DAY), label: weekLabel(year, w) })),
);
export const LAST = WEEKS.length - 1;
const THIS_YEAR = WEEKS.findIndex((x) => x.year === LATEST.year);
export const PRESETS: Preset[] = [
  { label: "Last 4 weeks", range: [LAST - 3, LAST] },
  { label: "Last 13 weeks", range: [LAST - 12, LAST] },
  { label: `${LATEST.year} so far`, range: [THIS_YEAR, LAST] },
  { label: String(FIRST_YEAR), range: [0, THIS_YEAR - 1] },
];

export const pctOf = (n: number, of: number) => (of ? n / of : 0);
export const pct0 = (n: number) => (n !== 0 && Math.abs(n) < 0.005 ? "<1%" : `${n < 0 ? "−" : ""}${Math.abs(Math.round(n * 100))}%`);
const day = (d: Date, end = false) => {
  const t = new Date(d.getTime() + (end ? 6 * DAY : 0));
  return `${t.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${t.getUTCDate()}`;
};

// ───────────────────────── Figures ─────────────────────────

export type Col = ChannelReport & { chargebacksNet: number; moneyIn: number; food: number; contribution: number };
export type Totals = { cols: Record<ChannelKey, Col>; all: Col & { staff: number; profit: number }; weekly: number[] };

const REPORT_KEYS = ["orders", "sales", "grossSales", "discounts", "refunds", "serviceCharges", "cardFees", "commission", "processingFee", "promos", "ads", "chargebacks", "moneyBack"] as const satisfies readonly (keyof ChannelReport)[];
const zero = (): ChannelReport => Object.fromEntries(REPORT_KEYS.map((k) => [k, 0])) as ChannelReport;
const plus = (a: ChannelReport, b: ChannelReport): ChannelReport => Object.fromEntries(REPORT_KEYS.map((k) => [k, a[k] + b[k]])) as ChannelReport;
const finish = (r: ChannelReport, food: number): Col => {
  const chargebacksNet = r.chargebacks - r.moneyBack;
  const moneyIn = r.sales - r.cardFees - r.commission - r.promos - chargebacksNet;
  return { ...r, chargebacksNet, moneyIn, food, contribution: moneyIn - food };
};
/** A cost for one store over `weeks` weeks: a share of its sales, or its monthly amount pro rata. */
const cost = (c: CostSettings[CostKey], sales: number, weeks: number) => (c.mode === "pct" ? (sales * c.value) / 100 : c.value * (weeks / WEEKS_PER_MONTH));

/** Reports for the weeks, per store, then each store's own cost settings, summed over the stores. */
export function totals(stores: readonly Store[], from: number, to: number, settings: (s: Store) => CostSettings): Totals {
  const weeks = Math.max(0, to - from + 1);
  const raw = Object.fromEntries(CHANNELS.map((c) => [c.key, zero()])) as Record<ChannelKey, ChannelReport>;
  const food = Object.fromEntries(CHANNELS.map((c) => [c.key, 0])) as Record<ChannelKey, number>;
  const weekly = Array.from({ length: weeks }, () => 0);
  let staff = 0;
  for (const s of stores) {
    const mine = Object.fromEntries(CHANNELS.map((c) => [c.key, zero()])) as Record<ChannelKey, ChannelReport>;
    for (let i = 0; i < weeks; i++) {
      const r = reportWeek(s, WEEKS[from + i].year, WEEKS[from + i].w);
      for (const c of CHANNELS) {
        mine[c.key] = plus(mine[c.key], r[c.key]);
        weekly[i] += r[c.key].sales;
      }
    }
    const set = settings(s);
    const storeSales = CHANNELS.reduce((n, c) => n + mine[c.key].sales, 0);
    // Food is set per store, as a % of sales or a monthly amount; each channel takes its share of sales
    // of it (a monthly amount is the store's, not each channel's). No sales at all: it sits in store.
    const storeFood = cost(set.food, storeSales, weeks);
    for (const c of CHANNELS) {
      raw[c.key] = plus(raw[c.key], mine[c.key]);
      food[c.key] += storeSales ? storeFood * (mine[c.key].sales / storeSales) : c.key === "instore" ? storeFood : 0;
    }
    staff += cost(set.staff, storeSales, weeks);
  }
  const cols = Object.fromEntries(CHANNELS.map((c) => [c.key, finish(raw[c.key], food[c.key])])) as Record<ChannelKey, Col>;
  const all = finish(
    CHANNELS.reduce((n, c) => plus(n, raw[c.key]), zero()),
    CHANNELS.reduce((n, c) => n + food[c.key], 0),
  );
  return { cols, all: { ...all, staff, profit: all.contribution - staff }, weekly };
}

export type OutletCol = Totals["all"];
export type Outlet = { store: Store; t: Totals; recon: Record<AppKey, Recon> };
/** A column with staff at its share of the stores' sales (it's the store's, so a channel carries only its part). */
const withShare = (col: Col, t: Totals): OutletCol => {
  const share = pctOf(col.sales, t.all.sales);
  const staff = t.all.staff * share;
  return { ...col, staff, profit: col.contribution - staff };
};
/** One app on its own, carrying its share of staff. */
export const appCol = (t: Totals, key: AppKey): OutletCol => withShare(t.cols[key], t);
/** The delivery apps as one column: their reports and food summed, carrying their share of staff. */
export function appsOnly(t: Totals): OutletCol {
  const apps = CHANNELS.filter((c) => c.app);
  const col = finish(
    apps.reduce((n, c) => plus(n, t.cols[c.key]), zero()),
    apps.reduce((n, c) => n + t.cols[c.key].food, 0),
  );
  return withShare(col, t);
}

// ───────────────────────── Page ─────────────────────────

/** The P&L for some stores (null or all of them = all) and a range of WEEKS: totals, the same span before it,
 *  the sales line and the cost editor. Shared by this page (one store) and /mvp2's P&L Summary (any set). */
export function usePnl(selected: readonly Store[] | null, range: [number, number]) {
  const [draft, setDraft] = useState<Draft>(null);
  const stored = useCostSettings();
  // Some stores, not all: costs are edited, saved and reset per store, for each chosen one.
  const subset = selected && selected.length && selected.length < STORES.length ? selected : null;
  const stores = subset ?? STORES;
  const store = subset?.length === 1 ? subset[0] : null;
  const [a, b] = range;
  const len = b - a + 1;

  const savedOf = (s: Store) => settingsFor(stored, s).s;
  // While a cost is being edited the draft applies to the chosen stores, or under All stores to every
  // store without its own settings, so the table previews it live.
  const settingsOf = (s: Store) => (draft && (subset || !stored[s]) ? { ...savedOf(s), [draft.key]: draft.setting } : savedOf(s));
  const t = totals(stores, a, b, settingsOf);
  // Each app's delivery orders checked against Square, both ways, for the cards and the table.
  const recon = Object.fromEntries(CHANNELS.filter((c) => c.app).map((c) => [c.key, reconcile(c.key as AppKey, stores, WEEKS.slice(a, b + 1))])) as Record<AppKey, Recon>;
  // The same number of weeks just before, for "vs"; none when the range starts at the first week.
  const prev = a > 0 ? totals(stores, Math.max(0, a - len), a - 1, settingsOf) : null;
  const label = `${day(WEEKS[a].start)} – ${day(WEEKS[b].start, true)}`;
  const vsLabel = prev ? `vs ${day(WEEKS[Math.max(0, a - len)].start)} – ${day(WEEKS[a - 1].start, true)}` : "";

  // Where the estimates come from, for the labels: one shared source, or mixed across stores.
  const sources = [...new Set(stores.map((s) => settingsFor(stored, s).source))];
  const typical = sources.length === 1 && sources[0] === "typical";
  const costNote = (key: CostKey) => {
    const texts = [...new Set(stores.map((s) => settingText(savedOf(s)[key])))];
    if (texts.length > 1) return "Your settings, per store";
    return `${typical ? "Typical" : "Your setting"} · ${texts[0]}`;
  };
  // The same, split for the cost chip: the figure, and whether it is still the typical stand-in.
  // A monthly amount reads as the chosen stores' total, as the editor shows it.
  const costValue = (key: CostKey) => {
    const set = stores.map((s) => savedOf(s)[key]);
    if (set.every((c) => c.mode === "month")) return { text: `$${Math.round(set.reduce((n, c) => n + c.value, 0)).toLocaleString("en-US")} a month`, typical };
    const texts = [...new Set(set.map(settingText))];
    return { text: texts.length > 1 ? "Varies by store" : texts[0], typical };
  };
  // The editor starts from the first chosen store's setting (or the all-stores one).
  const scopeSettings = subset ? savedOf(subset[0]) : (stored.all ?? TYPICAL);
  const ownStores = subset ? [] : STORES.filter((s) => stored[s]);
  const edit: CostEdit = {
    draft,
    note: costNote,
    value: costValue,
    share: (k) => pctOf(t.all[k], t.all.sales),
    monthlySales: (t.all.sales / Math.max(1, len)) * WEEKS_PER_MONTH,
    stores: stores.length,
    scopeLabel: store ? `${short(store)} only` : subset ? subset.map(short).join(" and ") : ownStores.length ? `stores without their own (${STORES.length - ownStores.length} of ${STORES.length})` : `all ${STORES.length} stores`,
    start: (k) => setDraft({ key: k, setting: scopeSettings[k] }),
    change: (setting) => setDraft((d) => (d ? { ...d, setting } : d)),
    save: () => {
      if (draft && subset) subset.forEach((s) => saveCostSettings(s, { ...savedOf(s), [draft.key]: draft.setting }));
      else if (draft) saveCostSettings("all", { ...scopeSettings, [draft.key]: draft.setting });
      setDraft(null);
    },
    cancel: () => setDraft(null),
  };
  const hasOwn = subset ? subset.some((s) => stored[s]) : !!stored.all;
  const reset = hasOwn ? { label: subset ? "Use all-stores costs" : "Back to typical", run: () => (subset ? subset.forEach((s) => saveCostSettings(s, null)) : saveCostSettings("all", null)) } : null;

  // The sales line: the range's weeks, or the 8 weeks to its end when the range is too short for a line.
  const lineFrom = len >= 4 ? a : Math.max(0, b - 7);
  const lineWeekly = len >= 4 ? t.weekly : totals(stores, lineFrom, b, settingsOf).weekly;
  // The same number of weeks just before the line's, week for week, for the Sales card's comparison; none at the start.
  const lineLen = b - lineFrom + 1;
  const linePrev = lineFrom - lineLen >= 0 ? totals(stores, lineFrom - lineLen, lineFrom - 1, settingsOf).weekly : null;
  const line = lineWeekly.map((value, i) => ({ label: WEEKS[lineFrom + i].label, value, prev: linePrev ? linePrev[i] : null, prevLabel: linePrev ? WEEKS[lineFrom - lineLen + i].label : "" }));
  // The Net profit card's bars: each week's estimated profit, 8 to 13 weeks to the range's end.
  const barFrom = Math.max(0, b - Math.min(12, Math.max(7, len - 1)));
  const bars = Array.from({ length: b - barFrom + 1 }, (_, i) => {
    const w = totals(stores, barFrom + i, barFrom + i, settingsOf).all;
    return { label: WEEKS[barFrom + i].label, value: w.profit, sales: w.sales };
  });

  // Each store's delivery apps on their own, for the outlet comparison; worked out only when it's shown.
  const byOutlet = (): Outlet[] =>
    stores.map((s) => ({
      store: s,
      t: totals([s], a, b, settingsOf),
      recon: Object.fromEntries(CHANNELS.filter((c) => c.app).map((c) => [c.key, reconcile(c.key as AppKey, [s], WEEKS.slice(a, b + 1))])) as Record<AppKey, Recon>,
    }));

  // Each store's estimated profit and sales over the range, for the Net profit card's weakest-outlets list.
  const outletMargins = stores.map((s) => {
    const o = totals([s], a, b, settingsOf).all;
    return { store: s, profit: o.profit, sales: o.sales };
  });

  return { t, recon, prev, label, vsLabel, typical, edit, reset, line, bars, byOutlet, outletMargins };
}
export type Pnl = ReturnType<typeof usePnl>;

export function PnlStory() {
  const [store, setStore] = useState<Store | null>(null);
  const [range, setRange] = useState<[number, number]>([LAST - DEFAULT_WEEKS + 1, LAST]);
  const [mobileChannel, setMobileChannel] = useState<ChannelKey | "all">("all");
  const pnl = usePnl(store ? [store] : null, range);
  const { t, recon, label, typical, edit, reset } = pnl;
  const [a, b] = range;
  const all = t.all;

  const exportCsv = () => {
    const cols = [...CHANNELS.map((c) => t.cols[c.key]), all];
    const row = (name: string, get: (v: Col) => number) => [name, ...cols.map((v) => Math.round(get(v)))];
    const totalOnly = (name: string, n: number) => [name, ...CHANNELS.map(() => ""), Math.round(n)];
    downloadCsv(`pnl-${WEEKS[a].year}-w${WEEKS[a].w + 1}-to-${WEEKS[b].year}-w${WEEKS[b].w + 1}.csv`, [
      ["Line", ...CHANNELS.map((c) => c.label), "All"],
      row("Orders", (v) => v.orders),
      row("Sales", (v) => v.sales),
      row("Card fees", (v) => -v.cardFees),
      row("App commission", (v) => -v.commission),
      row("Your app promos", (v) => -v.promos),
      row("Chargebacks, after money back", (v) => -v.chargebacksNet),
      row("Net after fees", (v) => v.moneyIn),
      row("Food & drink (estimate)", (v) => -v.food),
      totalOnly("Staff (estimate)", -all.staff),
      totalOnly("Profit after prime cost (estimate)", all.profit),
    ]);
  };

  const pill = (on: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center gap-1.5 rounded-circle px-3 text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
      on ? "bg-(--color-background-secondary) font-medium text-(--color-text-primary) shadow-[0_1px_3px_rgb(0_0_0/0.10)]" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
    );
  return (
    <div className="space-y-4">
      {/* Title, stores, download */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-subtitle-lg text-(--color-text-primary)">Profit and loss</h2>
          <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">
            {label} · {store ? short(store) : `all ${STORES.length} stores`} · in store, DoorDash, Uber Eats and Grubhub
          </p>
        </div>
        <div className="flex max-w-full items-center gap-2">
          <div role="radiogroup" aria-label="Store" className="flex min-w-0 gap-0.5 overflow-x-auto rounded-circle bg-(--gray-300) p-0.5 [scrollbar-width:none]">
            <button type="button" role="radio" aria-checked={!store} onClick={() => setStore(null)} className={pill(!store)}>
              All stores
            </button>
            {STORES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={store === s} onClick={() => setStore(s)} className={pill(store === s)}>
                <span aria-hidden className="size-3 rounded-[3px] bg-(--brand-700)" />
                {short(s)}
              </button>
            ))}
          </div>
          <button type="button" onClick={exportCsv} className="hidden h-8 shrink-0 items-center gap-1.5 rounded-circle border border-(--color-border-default) px-3 text-body-sm text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) md:flex">
            <Download aria-hidden className="size-3.5" />
            Download
          </button>
        </div>
      </div>

      <TimelineRange weeks={WEEKS} value={range} onChange={setRange} presets={PRESETS} label={label} />

      <PnlCards pnl={pnl} />

      <section aria-label="Profit and loss by channel" className="-mx-4 hidden overflow-x-auto border-y border-(--color-border-default) bg-(--color-background-secondary) md:block">
        <PnlTable t={t} recon={recon} edit={edit} />
      </section>
      <MobileChannel t={t} value={mobileChannel} onChange={setMobileChannel} edit={edit} typical={typical} reset={reset} />

      <p className="hidden items-start gap-2 px-1 text-body-sm text-(--color-text-tertiary) md:flex">
        <FileCheck2 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Sales down to Net after fees: from reports uploaded by KoreFi, last on {REPORTS_UPLOADED} ({REPORT_SOURCES.map((r) => `${r.provider} ${r.report}`).join(", ")}). Food and staff: estimates from {typical ? "typical restaurant costs" : "your cost settings"}.
        </span>
      </p>

    </div>
  );
}

// ───────────────────────── Cards ─────────────────────────

/** Three cards on a tray, each one question: a title, what it covers, one headline figure (with its change on the span
 *  before where it's a score: profit, sales), then one visual. Net profit (tagged Estimate: food and staff are the
 *  owner's settings) splits every $100 of sales into fees & promos, food, staff and profit. "Paid to you" is sales
 *  after the reports' fees, with the fees each channel takes from every $1. Sales has a weekly line against the weeks
 *  before. Per-outlet detail lives in the table and outlet filters, not here. Phones stack the cards. */
export function PnlCards({ pnl }: { pnl: Pnl }) {
  const { t, outletMargins, line, prev, vsLabel, label } = pnl;
  const all = t.all;
  const margin = pctOf(all.profit, all.sales);
  const loss = all.profit < 0;
  const paid = pctOf(all.moneyIn, all.sales);
  const change = prev && prev.all.sales ? all.sales / prev.all.sales - 1 : null;
  // Shares of sales against the span before, in points to a decimal.
  const pts = (now: number, before: (p: Totals) => number) => (prev && prev.all.sales ? Math.round((now - before(prev)) * 1000) / 10 : null);
  const marginPts = pts(margin, (p) => pctOf(p.all.profit, p.all.sales));
  const pct1 = (n: number) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;

  const channels = CHANNELS.map((c) => {
    const v = t.cols[c.key];
    return { ...c, name: c.app ? c.label : "In store & website", fee: pctOf(v.sales - v.moneyIn, v.sales), sold: v.sales };
  });
  const dearest = Math.max(...channels.map((c) => c.fee));
  const cents = (n: number) => `${Math.round(n * 100)}¢`;
  const outlets = outletMargins.length;

  const card = "flex min-w-0 flex-col gap-4 rounded-medium bg-(--color-background-secondary) p-5 @4xl/cards:flex-1 @4xl/cards:basis-0";
  const title = "text-body-md font-medium text-(--color-text-primary)";
  const sub = "text-body-sm text-(--color-text-secondary)";
  const big = "text-[28px] leading-9 font-medium tabular-nums";

  return (
    <section aria-label="Profit, what reached you and sales" className="@container/cards">
      {/* Laid out by its own width, not the window's, so it holds up beside a docked drawer */}
      <div className="flex flex-col gap-1.5 rounded-large bg-(--gray-300) p-1.5 @4xl/cards:flex-row">
      {/* Net profit */}
      <div className={card}>
        <div className="space-y-1">
          <p className={cn(title, "flex items-center gap-1.5")}>
            Profit after prime cost <EstTag />
          </p>
          <p className={sub}>After food and staff{typical(pnl) ? ", using typical costs" : ", using your costs"}</p>
        </div>
        <div className="space-y-1">
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span className={cn(big, loss ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>≈ {pct0(margin)}</span>
            <span className={sub}>≈ {usd(all.profit)} of {usd(all.sales)} sold</span>
          </p>
          {marginPts !== null && (
            <p className="text-body-sm">
              <VsPrior value={marginPts} unit={Math.abs(marginPts) === 1 ? " pt" : " pts"} label={vsLabel} first />
            </p>
          )}
        </div>
        {outlets > 1 ? <WorstOutlets outlets={outletMargins} average={margin} /> : <SpendBar all={all} />}
      </div>

      {/* Paid to you: net revenue, then what each channel's fees take from a $1 */}
      <div className={card}>
        <div className="space-y-1">
          <p className={title}>Paid to you</p>
          <p className={sub}>After card fees, commission and promos</p>
        </div>
        <div className="space-y-1">
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span className={cn(big, "text-(--color-text-primary)")}>{pct1(paid)}</span>
            <span className={sub}>{usd(all.moneyIn)} of {usd(all.sales)} sold</span>
          </p>
        </div>
        <div className="mt-auto space-y-2.5">
          <p className={sub}>Fees taken from each $1 sold</p>
          <ul role="list" aria-label="Fees taken from each $1 sold, by channel" className="space-y-2">
            {channels.map((c) => (
              <li key={c.key} className="grid grid-cols-[minmax(0,110px)_1fr_32px] items-center gap-x-3 text-body-sm" title={`${c.name}: you get ${cents(1 - c.fee)} of every $1, fees take ${cents(c.fee)}`}>
                <span className="flex min-w-0 text-(--color-text-primary)">
                  <AppName source={c.source} name={c.name} />
                </span>
                <span className="h-1.5 rounded-circle bg-(--gray-300)">
                  <span className={cn("block h-full rounded-circle", c.fee === dearest && c.fee > 0.1 ? "bg-(--red-600)" : "bg-(--gray-600)")} style={{ width: `${Math.max(0, Math.min(1, c.fee)) * 100}%`, minWidth: c.fee > 0 ? 4 : 0 }} />
                </span>
                <span className="text-right text-(--color-text-primary) tabular-nums">{cents(c.fee)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sales: what you sold, against the span before, with each week as a line */}
      <div className={cn(card, "justify-between")}>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className={title}>Sales</p>
            <p className={sub}>Before any fees</p>
          </div>
          <div className="space-y-1">
            <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className={cn(big, "text-(--color-text-primary)")}>{usd(all.sales)}</span>
              {change !== null && <VsPrior value={Math.round(change * 100)} unit="%" label={vsLabel} first />}
            </p>
            <p className={cn(sub, "tabular-nums")}>
              {all.orders.toLocaleString("en-US")} orders · {outlets} outlet{outlets === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <SalesLine weeks={line} />
      </div>
      </div>
    </section>
  );
}

const typical = (pnl: Pnl) => pnl.typical;

/** The outlets keeping the least of every sale, lowest first, as bars on one scale (profit as a share of sales). Red for
 *  those under the whole business's margin, grey otherwise, the same bar rows as the fees card. */
function WorstOutlets({ outlets, average }: { outlets: Pnl["outletMargins"]; average: number }) {
  const ranked = outlets.map((o) => ({ store: o.store, margin: pctOf(o.profit, o.sales) })).sort((x, y) => x.margin - y.margin);
  const worst = ranked.slice(0, 4);
  const top = Math.max(0.01, ...ranked.map((o) => o.margin));
  return (
    <div className="mt-auto space-y-2.5">
      <p className="text-body-sm text-(--color-text-secondary)">Lowest profit, share of sales</p>
      <ul role="list" aria-label="Outlets with the lowest profit as a share of sales" className="space-y-2">
        {worst.map((o) => (
          <li key={o.store} className="grid grid-cols-[minmax(0,110px)_1fr_44px] items-center gap-x-3 text-body-sm">
            <span className="truncate text-(--color-text-primary)">{short(o.store)}</span>
            <span className="h-1.5 rounded-circle bg-(--gray-300)">
              <span className={cn("block h-full rounded-circle", o.margin < average ? "bg-(--red-600)" : "bg-(--gray-600)")} style={{ width: `${Math.max(0, Math.min(1, o.margin / top)) * 100}%`, minWidth: o.margin > 0 ? 4 : 0 }} />
            </span>
            <span className="text-right text-(--color-text-primary) tabular-nums">{(Math.round(o.margin * 1000) / 10).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every $100 of sales as one stacked bar: what fees and promos took, then food, staff and what's left as profit,
 *  each in dollars in the legend. Costs past the sales (a loss) shrink the bar's scale so it still fits; the loss shows
 *  in the legend as a negative profit. */
function SpendBar({ all }: { all: Totals["all"] }) {
  const per = (n: number) => (all.sales ? (n / all.sales) * 100 : 0);
  const parts = [
    { key: "fees", label: "Fees & promos", value: per(all.sales - all.moneyIn), color: "var(--red-600)" },
    { key: "food", label: "Food", value: per(all.food), color: "var(--amber-700)" },
    { key: "staff", label: "Staff", value: per(all.staff), color: "var(--blue-600)" },
    { key: "profit", label: "Profit after prime cost", value: per(all.profit), color: "var(--green-700)" },
  ];
  const scale = Math.max(100, parts.reduce((n, p) => n + Math.max(0, p.value), 0));
  return (
    <div className="mt-auto space-y-2">
      <div role="img" aria-label={`Of every $100 of sales: ${parts.map((p) => `${p.label} $${Math.round(p.value)}`).join(", ")}`} className="flex h-3 gap-0.5 overflow-hidden rounded-circle">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ width: `${(p.value / scale) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul role="list" className="flex flex-wrap gap-x-3 gap-y-1 text-body-sm text-(--color-text-primary) tabular-nums">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: p.color }} />
            {p.label} <span className={p.value < 0 ? "text-(--color-text-danger)" : "font-medium"}>{p.value < 0 ? "−" : ""}${Math.abs(Math.round(p.value))}</span>
          </li>
        ))}
      </ul>
      <p className="text-body-sm text-(--color-text-secondary)">Where every $100 of sales went</p>
    </div>
  );
}

/** Mercury-style trend: this period as a line over a soft fill, running edge to edge of the card, the period before as a
 *  faint dashed line, a date axis along the bottom. Pointing at (or tabbing to) a week drops a guide and a tooltip with
 *  its sales and what the same week was before. Bleeds out of the card's padding (-mx-5 -mb-5), so the card clips it. */
function SalesLine({ weeks }: { weeks: { label: string; value: number; prev: number | null; prevLabel: string }[] }) {
  const [at, setAt] = useState<number | null>(null);
  const n = weeks.length;
  const hasPrev = weeks.every((w) => w.prev !== null);
  const top = Math.max(1, ...weeks.flatMap((w) => [w.value, w.prev ?? 0])) * 1.08;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const y = (v: number) => 100 - (v / top) * 100;
  const path = (get: (w: (typeof weeks)[number]) => number) => weeks.map((w, i) => `${i ? "L" : "M"}${x(i)},${y(get(w))}`).join(" ");
  const line = path((w) => w.value);
  const ticks = [...new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round(((n - 1) * 3) / 4), n - 1])];
  const w = at === null ? null : weeks[at];
  return (
    <div className="-mx-5 -mb-5 overflow-hidden rounded-b-medium" onMouseLeave={() => setAt(null)}>
      <div className="relative h-[96px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full">
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--brand-900)" stopOpacity="0.18" />
              <stop offset="1" stopColor="var(--brand-900)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,100 L0,100 Z`} fill="url(#sales-fill)" />
          {hasPrev && <path d={path((w) => w.prev ?? 0)} fill="none" stroke="var(--gray-500)" strokeWidth={1.25} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          <path d={line} fill="none" stroke="var(--brand-900)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {at !== null && <line x1={x(at)} x2={x(at)} y1={0} y2={100} stroke="var(--gray-500)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {w && at !== null && (
          <>
            <span aria-hidden className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-circle bg-(--brand-900) ring-2 ring-(--color-background-secondary)" style={{ left: `${x(at)}%`, top: `${y(w.value)}%` }} />
            <div className="pointer-events-none absolute top-1 z-10 rounded-medium bg-(--gray-900) px-2 py-1 text-body-sm whitespace-nowrap text-white tabular-nums shadow-md" style={{ left: `${x(at)}%`, transform: `translateX(${at < n / 3 ? "8px" : at > (n * 2) / 3 ? "calc(-100% - 8px)" : "-50%"})` }}>
              <p className="text-white/70">{w.label}</p>
              <p>{usd(w.value)}</p>
              {w.prev !== null && <p className="text-white/70">was {usd(w.prev)}</p>}
            </div>
          </>
        )}
        <div role="group" aria-label={`Sales by week, ${weeks[0].label} to ${weeks[n - 1].label}`} className="absolute inset-0 flex">
          {weeks.map((b, i) => (
            <button key={b.label} type="button" aria-label={`${b.label}: ${usd(b.value)} sales${b.prev !== null ? `, ${usd(b.prev)} the week ${b.prevLabel}` : ""}`} onMouseEnter={() => setAt(i)} onFocus={() => setAt(i)} onBlur={() => setAt(null)} className="h-full flex-1 cursor-default outline-none" />
          ))}
        </div>
      </div>
      <div className="relative mx-5 mt-1 mb-1.5 h-4 text-body-sm text-(--color-text-tertiary)" aria-hidden>
        {ticks.map((i) => (
          <span key={i} className="absolute whitespace-nowrap" style={{ left: `${x(i)}%`, transform: `translateX(${i === 0 ? "0" : i === n - 1 ? "-100%" : "-50%"})` }}>
            {weeks[i].label}
          </span>
        ))}
      </div>
      {hasPrev && (
        <p className="mx-5 mt-1 mb-5 flex items-center gap-3 text-body-sm text-(--color-text-secondary)">
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-3 bg-(--brand-900)" />This period</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="w-3 border-t-2 border-dashed border-(--gray-500)" />Period before</span>
        </p>
      )}
    </div>
  );
}

/** "▲ 38% vs Aug 3 – 16" in green or red (grey at no change): the change on the span before, beside a headline. `unit`
 *  follows the figure: "%" for a change in dollars, " pt"/" pts" for a change in a share of sales. */
function VsPrior({ value, unit, label, first = false }: { value: number; unit: string; label: string; first?: boolean }) {
  return (
    <span className="text-body-sm text-(--color-text-secondary)">
      {!first && " · "}
      <span className={value < 0 ? "text-(--color-text-danger)" : value > 0 ? "text-(--color-text-success)" : ""}>
        {value < 0 ? "▼" : value > 0 ? "▲" : "•"} {Math.abs(value)}
        {unit}
      </span>{" "}
      {label || "vs prior period"}
    </span>
  );
}

/** Marks a figure KoreFi doesn't receive and has to estimate: amber, so it reads as "not a fact" anywhere. */
export const EstTag = () => <span className="rounded-small border border-dashed border-(--amber-700) bg-(--color-warning-lightest) px-1 text-[11px] font-normal text-(--color-text-warning)">Estimate</span>;

// ───────────────────────── P&L by channel ─────────────────────────

type Line = { key: string; label: string; hint?: string; get: (v: Col) => number; cost?: boolean; only?: "apps" | "instore"; strong?: boolean };
// From the uploaded reports.
const REPORTED: Line[] = [
  { key: "sales", label: "Sales", get: (v) => v.sales, strong: true },
  { key: "cardFees", label: "Card fees", hint: "Square", get: (v) => v.cardFees, cost: true, only: "instore" },
  { key: "commission", label: "App commission", get: (v) => v.commission, cost: true, only: "apps" },
  { key: "promos", label: "Your app promos", hint: "Discounts you funded", get: (v) => v.promos, cost: true, only: "apps" },
  { key: "chargebacks", label: "Chargebacks, after money back", hint: "Refunded orders, less what KoreFi won back", get: (v) => v.chargebacksNet, cost: true, only: "apps" },
  { key: "moneyIn", label: "Net after fees", hint: "What reached you", get: (v) => v.moneyIn, strong: true },
];

export type Reset = { label: string; run: () => void } | null;

type TableProps = { t: Totals; edit: CostEdit; typical: boolean; reset: Reset };

export function MobileChannel({ t, value, onChange, edit, typical, reset }: TableProps & { value: ChannelKey | "all"; onChange: (k: ChannelKey | "all") => void }) {
  const chosen = value === "all" ? null : CHANNELS.find((c) => c.key === value)!;
  const v: Col = chosen ? t.cols[chosen.key] : t.all;
  const tabs = [{ key: "all" as const, label: "All" }, ...CHANNELS.map((c) => ({ key: c.key, label: c.app ? c.label : "In store" }))];
  const row = (key: string, label: string, n: number, opts: { cost?: boolean; strong?: boolean; est?: boolean; share?: boolean; editor?: CostKey } = {}) => (
    <li key={key} className={cn("flex justify-between gap-2 py-1", opts.editor ? "flex-wrap items-start" : "items-baseline", opts.strong ? "font-medium text-(--color-text-primary)" : "pl-3 text-(--color-text-secondary)", opts.est && !opts.strong && "italic")}>
      <span className="min-w-0">
        {label}
        {opts.editor && edit.draft?.key !== opts.editor && (
          <span className="block">
            <CostEditor costKey={opts.editor} edit={edit} compact />
          </span>
        )}
      </span>
      <span className="whitespace-nowrap not-italic tabular-nums">
        <span className={opts.est ? "text-(--color-text-secondary)" : "text-(--color-text-primary)"}>
          {opts.est && "≈ "}
          {opts.cost ? `−${usd(n)}` : usd(n)}
        </span>
        <span className="ml-2 inline-block w-9 text-right text-(--color-text-tertiary)">{opts.share === false ? "" : pct0(pctOf(n, v.sales))}</span>
      </span>
      {opts.editor && edit.draft?.key === opts.editor && (
        <span className="basis-full">
          <CostEditor costKey={opts.editor} edit={edit} compact />
        </span>
      )}
    </li>
  );
  const total = (label: string, n: number) => {
    const m = pctOf(n, v.sales);
    return (
      <li className="flex items-baseline justify-between border-t border-(--color-border-default) py-1.5 font-medium text-(--color-text-primary)">
        <span>{label}</span>
        <span className="tabular-nums">
          <span className={m < 0 ? "text-(--color-text-danger)" : "text-(--color-text-success)"}>≈{pct0(m)}</span>
          <span className="ml-2 text-(--color-text-secondary)">{usd(n)}</span>
        </span>
      </li>
    );
  };
  const shows = (l: Line) => !chosen || !l.only || (l.only === "apps" ? chosen.app : !chosen.app);
  return (
    <section aria-label="Profit and loss by channel" className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) md:hidden">
      <div role="tablist" aria-label="Channel" className="flex gap-1 overflow-x-auto border-b border-(--color-border-default) p-1.5 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={value === tab.key} onClick={() => onChange(tab.key)} className={cn("h-7 shrink-0 rounded-circle px-2.5 text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", value === tab.key ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
            {tab.label}
          </button>
        ))}
      </div>
      <ul className="px-3 text-body-sm">
        {REPORTED.filter(shows).map((l) => row(l.key, l.label, l.get(v), { cost: l.cost, strong: l.strong, share: l.key !== "sales" }))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-y border-dashed border-(--color-border-darker) bg-(--gray-200) px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
          <EstTag /> {typical ? "Typical costs · tap one to use yours" : "Your costs · tap one to change"}
        </span>
        {reset && (
          <button type="button" onClick={reset.run} className="text-body-sm text-(--color-text-clickable)">
            Reset
          </button>
        )}
      </div>
      <ul className="px-3 pb-1 text-body-sm">
        {row("food", "Food & drink", v.food, { cost: true, est: true, editor: "food" })}
        {!chosen && (
          <>
            {row("staff", "Staff", t.all.staff, { cost: true, est: true, editor: "staff" })}
            {total("Profit after prime cost", t.all.profit)}
          </>
        )}
      </ul>
    </section>
  );
}

// ───────────────────────── Inline cost editor ─────────────────────────

type Draft = { key: CostKey; setting: CostSetting } | null;
export type CostEdit = {
  draft: Draft;
  note: (k: CostKey) => string;
  /** The setting for the chip: its figure, and whether typical figures still stand in. */
  value: (k: CostKey) => { text: string; typical: boolean };
  /** The draft's total for the range as a share of sales, for the sanity check. */
  share: (k: CostKey) => number;
  /** The chosen stores' sales in an average month of the range, so a % and a $ a month can stand for each other. */
  monthlySales: number;
  /** How many stores the edit applies to; a $ a month is split evenly between them. */
  stores: number;
  scopeLabel: string;
  start: (k: CostKey) => void;
  change: (s: CostSetting) => void;
  save: () => void;
  cancel: () => void;
};

/** The cost's setting under its label. Click to edit in place; the row's figures follow as you type.
 *  (/mvp2 edits in a popover instead: CostPopover.tsx.) */
export function CostEditor({ costKey, edit, compact = false }: { costKey: CostKey; edit: CostEdit; compact?: boolean }) {
  const meta = COSTS.find((c) => c.key === costKey)!;
  const d = edit.draft?.key === costKey ? edit.draft.setting : null;
  if (!d) {
    return (
      <button
        type="button"
        onClick={() => edit.start(costKey)}
        className="group/edit mt-0.5 inline-flex items-center gap-1 rounded-small border border-dashed border-(--color-border-darker) px-1.5 text-body-sm font-normal not-italic text-(--color-text-secondary) outline-none hover:border-(--color-text-secondary) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
      >
        {edit.note(costKey)}
        <Pencil aria-hidden className="size-3 opacity-60 group-hover/edit:opacity-100" />
      </button>
    );
  }
  const share = edit.share(costKey);
  // Over half of sales is almost always a slip: a group figure typed as per store, or a year as a month.
  const odd = share > 0.5;
  return (
    <div className={cn("mt-1 space-y-1.5 font-normal not-italic", compact ? "pb-1" : "")} onKeyDown={(e) => (e.key === "Escape" ? edit.cancel() : e.key === "Enter" ? edit.save() : undefined)}>
      <div className="flex items-center gap-1.5">
        <label className="relative">
          <span className="sr-only">{meta.label}</span>
          {d.mode === "month" && <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-body-sm text-(--color-text-secondary)">$</span>}
          <input
            autoFocus
            // Selected on open, so typing replaces the figure instead of appending to it.
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            value={String(d.value)}
            onChange={(e) => edit.change({ ...d, value: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
            className={cn("h-8 rounded-medium border border-(--color-focus-primary) bg-(--color-background-secondary) text-body-md text-(--color-text-primary) tabular-nums outline-none", d.mode === "month" ? "w-24 pr-2 pl-5" : "w-14 px-2")}
          />
        </label>
        {meta.modes.length > 1 ? (
          <Segmented<CostMode>
            label={`${meta.label} as`}
            options={[
              { key: "pct", label: "%" },
              { key: "month", label: "$ a mo" },
            ]}
            value={d.mode}
            onChange={(mode) => edit.change({ mode, value: mode === "pct" ? TYPICAL[costKey].value : 0 })}
          />
        ) : (
          <span className="text-body-sm text-(--color-text-secondary)">%</span>
        )}
        <button type="button" aria-label="Save" onClick={edit.save} className="grid size-8 place-items-center rounded-medium bg-(--color-text-primary) text-(--color-background-secondary) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          <Check aria-hidden className="size-4" />
        </button>
        <button type="button" aria-label="Cancel" onClick={edit.cancel} className="grid size-8 place-items-center rounded-medium border border-(--color-border-default) text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <p className={cn("text-body-sm", odd ? "text-(--color-text-danger)" : "text-(--color-text-tertiary)")}>
        {odd ? (
          <>That&apos;s {pct0(share)} of sales. {d.mode === "month" ? "Amounts are per store, per month." : "Check the percentage."}</>
        ) : (
          <>
            {d.mode === "pct" ? "% of sales" : "Per store, per month"} · typical {meta.typical} · {edit.scopeLabel}
          </>
        )}
      </p>
    </div>
  );
}
