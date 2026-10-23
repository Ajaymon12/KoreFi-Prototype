"use client";
import { Fragment, useState } from "react";
import { CircleCheck, ChevronDown, Info, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { NoOutlets, OutletCount, OutletFilters, useOutletFilter } from "./OutletFilters";
import { AppName } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import type { AppKey } from "@/lib/finance/chargebacks";
import { REPORT_THROUGH } from "@/lib/finance/reports";
import { TAX_RATE, addPayout, commissionOf, depositOf, marketingOf, moneyInOf, otherOf, payout, refundsOf, zeroPayout, type Payout } from "@/lib/finance/payouts";
import { CHANNELS, PRESETS, WEEKS, pct0, pctOf } from "@/components/finance/PnlStory";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import { usd } from "@/components/finance/parts";

// MVP 2 / 3PD Payouts: each delivery app's payout report, line by line, redrawn from the ops dev dashboard's
// "Component" table. What changed from it, and why:
//   math you can read   a gutter of − + = down the left, so the table is the sum from Sales to the deposit
//   groups, not walls   Commission, Marketing you paid, Refunds after disputes and Other are one line each,
//                       opening into their parts (Expand all for the lot), instead of every part at once
//   $0 lines hidden     lines that are zero for every app are left out and listed under the table; one
//                       click shows them. "Unaccounted" becomes a check: every dollar traced, or not
//   colour means money  amounts are plain; green only for money back to you; red only for something wrong.
//                       % of that app's sales sits beside each figure, not in a pill on every cell
//   yours vs the state's  Net revenue (the P&L's figure) is what's yours; sales tax that passes through the
//                       payout sits below it, so the deposit is explained without inflating "your" money
//   no fake profit      no COGS/Net margin at $0: food and profit live on the P&L Summary, with estimates
// Above the table, "where each $1 went" per app: one bar each, to compare apps before reading lines.

const APPS = CHANNELS.filter((c) => c.app);
type Sign = "−" | "+";
type Part = { key: string; label: string; info?: string; get: (p: Payout) => number; sign: Sign; ref?: boolean };
type Group = { key: string; label: string; info: string; get: (p: Payout) => number; sign: Sign; parts: Part[] };

const GROUPS: Group[] = [
  {
    key: "commission",
    label: "Commission",
    info: "What the app charges per order, plus its payment processing fee.",
    get: commissionOf,
    sign: "−",
    parts: [
      { key: "commission", label: "Commission", get: (p) => p.commission, sign: "−" },
      { key: "processing", label: "Payment processing", get: (p) => p.processingFee, sign: "−" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing you paid",
    info: "Promotions you funded, ads and marketing fees, less credits the app gave back. Promotions the app paid for are shown for reference; they don't cost you.",
    get: marketingOf,
    sign: "−",
    parts: [
      { key: "promo", label: "Promotions you funded", get: (p) => p.promoSpend, sign: "−" },
      { key: "ads", label: "Ad spend", get: (p) => p.adSpend, sign: "−" },
      { key: "fees", label: "Marketing fees", get: (p) => p.marketingFees, sign: "−" },
      { key: "loyalty", label: "Loyalty rewards", get: (p) => p.loyalty, sign: "−" },
      { key: "credits", label: "Credits back from the app", get: (p) => p.credits, sign: "+" },
      { key: "appFunded", label: "Promotions the app paid for", info: "Discounts the app funded itself. Not taken from your payout; shown so you can see the full promotion.", get: (p) => p.appFunded, sign: "−", ref: true },
    ],
  },
  {
    key: "refunds",
    label: "Refunds, after disputes",
    info: "Order errors the app refunded to customers and charged to you, less what KoreFi won back in disputes.",
    get: refundsOf,
    sign: "−",
    parts: [
      { key: "refunds", label: "Refunds charged to you", get: (p) => p.refunds, sign: "−" },
      { key: "won", label: "Won back in disputes", get: (p) => p.wonBack, sign: "+" },
    ],
  },
  {
    key: "other",
    label: "Other",
    info: "Tips passed to you, and adjustments the report lists without a reason.",
    get: otherOf,
    sign: "+",
    parts: [
      { key: "tips", label: "Customer tips", get: (p) => p.tips, sign: "+" },
      { key: "misc", label: "Miscellaneous adjustments", get: (p) => p.misc, sign: "+" },
      { key: "unaccounted", label: "Unaccounted", get: (p) => p.unaccounted, sign: "+" },
    ],
  },
];

const zero = (n: number) => Math.abs(n) < 0.005;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What each $1 of an app's sales became, for the bars. */
const SLICES: { key: string; label: string; color: string; get: (p: Payout) => number }[] = [
  { key: "commission", label: "Commission", color: "var(--gray-900)", get: commissionOf },
  { key: "marketing", label: "Marketing", color: "var(--brand-700)", get: marketingOf },
  { key: "refunds", label: "Refunds", color: "var(--gray-600)", get: refundsOf },
];

function InfoTip({ name, text }: { name: string; text: string }) {
  return (
    <span className="group/tip relative ml-1 inline-flex align-[-2px]">
      <button type="button" aria-label={`About ${name}`} className="grid size-4 place-items-center rounded-circle text-(--color-text-tertiary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
        <Info aria-hidden className="size-3.5" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute top-5 left-0 z-20 hidden w-64 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-3 text-body-sm font-normal whitespace-normal text-(--color-text-secondary) shadow-md group-focus-within/tip:block group-hover/tip:block">
        {text}
      </span>
    </span>
  );
}

/** A figure and its share of that column's sales, side by side. Costs read −, money back + in green. */
function Amount({ n, sales, sign, strong, muted, share = true }: { n: number; sales: number; sign?: Sign; strong?: boolean; muted?: boolean; share?: boolean }) {
  // A negative cost (more back than charged) reads as money in, and the other way round.
  const s = sign && n < 0 ? (sign === "−" ? "+" : "−") : sign;
  const back = s === "+" && sign !== undefined && !zero(n);
  return (
    <span className="flex items-baseline justify-end gap-2 tabular-nums">
      <span className={cn("whitespace-nowrap", strong && "font-medium", muted ? "text-(--color-text-tertiary)" : back ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>
        {zero(n) ? "$0" : `${s ?? ""}${usd(Math.abs(n))}`}
      </span>
      <span className="w-9 text-right text-body-sm text-(--color-text-tertiary)">{zero(n) || !share ? "" : pct0(pctOf(Math.abs(n), sales))}</span>
    </span>
  );
}

export function PayoutReport() {
  const [range, setRange] = useState<[number, number]>(PRESETS[0].range);
  const outlets = useOutletFilter(range);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showZero, setShowZero] = useState(false);

  const stores = outlets.stores;
  const weeks = WEEKS.slice(range[0], range[1] + 1);
  const cols = APPS.map((c) => ({ ...c, p: payout(c.key as AppKey, stores, weeks) }));
  const all = cols.reduce((n, c) => addPayout(n, c.p), zeroPayout());
  const columns = [...cols.map((c) => c.p), all];
  const label = `${day(weeks[0].start)} – ${day(new Date(weeks[weeks.length - 1].start.getTime() + 6 * 86_400_000))}`;

  // Lines that are zero for every app hide until asked for; a group hides when all its parts do.
  const isZero = (get: (p: Payout) => number) => cols.every((c) => zero(get(c.p)));
  const hiddenParts = GROUPS.flatMap((g) => g.parts.filter((p) => isZero(p.get)).map((p) => p.label));
  const groups = GROUPS.filter((g) => showZero || !g.parts.every((p) => isZero(p.get)));
  const allOpen = groups.every((g) => open.has(g.key));
  const toggle = (k: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(k)) n.add(k);
      return n;
    });
  const unaccounted = all.unaccounted;

  const row = "border-b border-(--gray-300)";
  const num = "w-[168px] px-3 py-3 text-right align-top";
  const allCell = "border-l border-(--gray-300) bg-(--color-text-primary)/[0.03]";
  const labelCell = "px-3 py-3 text-left align-top font-normal text-(--color-text-primary)";
  const op = (s: string) => <td className="w-[36px] py-3 pl-4 text-center align-top text-body-md text-(--color-text-tertiary) tabular-nums">{s}</td>;
  const cells = (render: (p: Payout) => React.ReactNode) => columns.map((p, i) => <td key={i} className={cn(num, i === cols.length && allCell)}>{render(p)}</td>);

  return (
    <>
      <PageHeader title="3PD Payouts" />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <OutletFilters scope={outlets} />
          <DateRangeFilter weeks={WEEKS} presets={PRESETS} value={range} onChange={setRange} />
          <span className="ml-auto flex items-center gap-2 text-body-sm text-(--color-text-tertiary) tabular-nums">
            <OutletCount scope={outlets} />
            {label}
          </span>
        </div>

        {stores.length === 0 ? (
          <NoOutlets scope={outlets} />
        ) : (
          <>
            {/* Where each $1 went, per app: compare before reading lines */}
            <section aria-label="Where each dollar of app sales went" className="mx-4 mt-3 rounded-large bg-(--gray-300) p-1.5">
              <div className="rounded-medium bg-(--color-background-secondary) px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-body-sm text-(--color-text-secondary)">Where each $1 of app sales went</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-(--color-text-secondary)">
                    {[...SLICES, { key: "keep", label: "You keep", color: "var(--green-700)" }].map((s) => (
                      <li key={s.key} className="flex items-center gap-1.5">
                        <span aria-hidden className="size-2 rounded-[2px]" style={{ background: s.color }} />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="mt-3 space-y-2">
                  {[...cols.map((c) => ({ key: c.key, name: <AppName source={c.source} name={c.label} />, p: c.p })), { key: "all", name: <span className="font-medium">All apps</span>, p: all }].map(({ key, name, p }) => {
                    const keep = pctOf(moneyInOf(p), p.sales);
                    return (
                      <li key={key} className="grid grid-cols-[120px_1fr_92px] items-center gap-4 text-body-sm">
                        <span className="min-w-0 truncate text-(--color-text-primary)">{name}</span>
                        <span className="flex h-2.5 gap-px overflow-hidden rounded-circle bg-(--gray-300)">
                          {SLICES.map((s) => (
                            <span key={s.key} title={`${s.label}: ${Math.round(pctOf(s.get(p), p.sales) * 100)}¢ of every $1`} style={{ width: `${(Math.max(0, pctOf(s.get(p), p.sales)) * 100).toFixed(2)}%`, background: s.color }} />
                          ))}
                          <span style={{ width: `${(keep * 100).toFixed(2)}%`, background: "var(--green-700)" }} />
                        </span>
                        <span className="text-right text-(--color-text-secondary) tabular-nums">
                          keep <b className="font-medium text-(--color-text-primary)">{Math.round(keep * 100)}¢</b>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {/* Table tools */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
              <p className="text-body-sm text-(--color-text-secondary)">
                Reports to {day(REPORT_THROUGH.doordash)} · % = share of that app&apos;s sales
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.key)))} className="h-7 rounded-medium px-2 text-body-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              </div>
            </div>

            <section aria-label="Payout by app" className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-body-md">
                <thead>
                  <tr className="h-[46px] text-body-sm text-(--color-text-secondary) [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-(--gray-200) [&>th]:shadow-[inset_0_-1px_0_var(--gray-300)]">
                    <th scope="col" className="w-[36px]" />
                    <th scope="col" className="w-[42px]" />
                    <th scope="col" className="px-3 text-left font-normal">
                      From each app&apos;s payout report
                    </th>
                    {cols.map((c) => (
                      <th key={c.key} scope="col" className="w-[168px] px-3 py-1.5 text-right font-normal">
                        <span className="inline-flex justify-end text-(--color-text-primary)">
                          <AppName source={c.source} name={c.label} />
                        </span>
                        <span className="block text-label-sm text-(--color-text-tertiary) tabular-nums">
                          {c.p.orders.toLocaleString("en-US")} orders · {usd(c.p.sales / Math.max(1, c.p.orders))} avg
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="w-[168px] px-3 py-1.5 text-right font-normal">
                      <span className="text-(--color-text-primary)">All apps</span>
                      <span className="block text-label-sm text-(--color-text-tertiary) tabular-nums">{all.orders.toLocaleString("en-US")} orders</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={row}>
                    {op("")}
                    <td />
                    <th scope="row" className={labelCell}>
                      <span className="block font-medium">Sales</span>
                      <span className="mt-0.5 block text-body-sm text-(--color-text-secondary)">Before tax, what customers paid for food and drink</span>
                    </th>
                    {cells((p) => (
                      <span className="font-medium tabular-nums">{usd(p.sales)}</span>
                    ))}
                  </tr>

                  {groups.map((g) => {
                    const opened = open.has(g.key);
                    const parts = g.parts.filter((p) => showZero || !isZero(p.get));
                    return (
                      <Fragment key={g.key}>
                        <tr className={row}>
                          {op(g.sign)}
                          <td className="w-[42px] pt-3 align-top">
                            <button
                              type="button"
                              aria-expanded={opened}
                              aria-label={`${opened ? "Hide" : "Show"} the parts of ${g.label}`}
                              onClick={() => toggle(g.key)}
                              className="grid size-6 place-items-center rounded-small text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                            >
                              <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-150", !opened && "-rotate-90")} />
                            </button>
                          </td>
                          <th scope="row" className={labelCell}>
                            <button type="button" onClick={() => toggle(g.key)} className="text-left outline-none">
                              {g.label}
                            </button>
                            <InfoTip name={g.label} text={g.info} />
                          </th>
                          {cells((p) => (
                            <Amount n={g.get(p)} sales={p.sales} sign={g.sign} />
                          ))}
                        </tr>
                        {opened &&
                          parts.map((part, k) => (
                            <tr key={part.key} className={cn("bg-(--gray-200) text-body-sm", k < parts.length - 1 ? "border-b border-dashed border-(--gray-400)" : row)}>
                              {op("")}
                              <td />
                              <th scope="row" className={cn(labelCell, "py-2 pl-6 text-(--color-text-secondary)")}>
                                {part.label}
                                {part.ref && <span className="ml-1.5 rounded-small bg-(--gray-300) px-1 text-label-sm text-(--color-text-tertiary)">not from you</span>}
                                {part.info && <InfoTip name={part.label} text={part.info} />}
                              </th>
                              {columns.map((p, i) => (
                                <td key={i} className={cn(num, "py-2", i === cols.length && allCell)}>
                                  <Amount n={part.get(p)} sales={p.sales} sign={part.ref ? undefined : part.sign} muted={part.ref || zero(part.get(p))} />
                                </td>
                              ))}
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}

                  {/* Yours: the P&L's Net revenue */}
                  <tr className={cn(row, "border-t border-t-(--gray-500) bg-(--gray-300)")}>
                    {op("=")}
                    <td />
                    <th scope="row" className={labelCell}>
                      <span className="block font-medium">
                        Net revenue
                        <InfoTip name="Net revenue" text="What the app paid you for your food, after its fees, your marketing and refunds. The same figure as Net revenue on the P&L Summary." />
                      </span>
                      <span className="mt-0.5 block text-body-sm text-(--color-text-secondary)">Yours, after the app&apos;s cut</span>
                    </th>
                    {cells((p) => (
                      <Amount n={moneyInOf(p)} sales={p.sales} strong />
                    ))}
                  </tr>

                  {/* Sales tax: through the payout, owed to the state */}
                  <tr className={cn(row, "bg-(--blue-200)")}>
                    <td colSpan={3 + columns.length} className="px-4 py-2 text-body-sm text-(--color-text-secondary)">
                      <b className="font-medium text-(--color-text-primary)">Sales tax passes through the payout.</b> It isn&apos;t yours: the app remits it, or you do from the deposit.
                    </td>
                  </tr>
                  <tr className={cn(row, "bg-(--blue-200)")}>
                    {op("+")}
                    <td />
                    <th scope="row" className={labelCell}>
                      Sales tax collected
                      <span className="mt-0.5 block text-body-sm text-(--color-text-secondary) tabular-nums">{(TAX_RATE * 100).toFixed(2)}% on sales</span>
                    </th>
                    {cells((p) => (
                      <Amount n={p.taxCollected} sales={p.sales} share={false} />
                    ))}
                  </tr>
                  <tr className={cn(row, "bg-(--blue-200)")}>
                    {op("−")}
                    <td />
                    <th scope="row" className={labelCell}>
                      Remitted by the app
                      <span className="mt-0.5 block text-body-sm text-(--color-text-secondary)">Kept back and paid to the state for you</span>
                    </th>
                    {columns.map((p, i) => (
                      <td key={i} className={cn(num, i === cols.length && allCell)}>
                        {zero(p.taxWithheld) ? <span className="text-body-sm text-(--color-text-tertiary)">You remit it</span> : <Amount n={p.taxWithheld} sales={p.sales} sign="−" share={false} />}
                      </td>
                    ))}
                  </tr>

                  {/* The bank line */}
                  <tr className={cn(row, "border-t border-t-(--gray-600) bg-(--gray-400)")}>
                    {op("=")}
                    <td />
                    <th scope="row" className={labelCell}>
                      <span className="block text-subtitle-sm font-medium">Deposited by the app</span>
                      <span className="mt-0.5 block text-body-sm text-(--color-text-secondary)">What lands in your bank</span>
                    </th>
                    {cells((p) => (
                      <span className="text-subtitle-sm font-medium whitespace-nowrap tabular-nums">{usd(depositOf(p))}</span>
                    ))}
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Every dollar traced, and what's hidden at $0 */}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 py-3 text-body-sm">
              {zero(unaccounted) ? (
                <p className="flex items-center gap-1.5 text-(--color-text-secondary)">
                  <CircleCheck aria-hidden className="size-3.5 text-(--color-text-success)" />
                  Every dollar of the payouts is traced to a report line.
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-(--color-text-danger)">
                  <TriangleAlert aria-hidden className="size-3.5" />
                  {usd(Math.abs(unaccounted))} of the payouts isn&apos;t explained by any report line. KoreFi is looking into it.
                </p>
              )}
              {hiddenParts.length > 0 && (
                <p className="text-(--color-text-tertiary)">
                  {showZero ? "Showing lines at $0. " : `Hidden at $0 for every app: ${hiddenParts.join(", ")}. `}
                  <button type="button" onClick={() => setShowZero((v) => !v)} className="rounded-small text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                    {showZero ? "Hide them" : "Show them"}
                  </button>
                </p>
              )}
            </div>
            <p className="px-4 pb-6 text-body-sm text-(--color-text-tertiary)">Food costs and profit are on the P&amp;L Summary.</p>
          </>
        )}
      </div>
    </>
  );
}
