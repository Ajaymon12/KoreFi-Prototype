"use client";
import { createContext, Fragment, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Info, ListTree, Store as StoreIcon } from "lucide-react";
import { AppName } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import { REPORT_FIELDS } from "@/lib/finance/reports";
import type { Recon } from "@/lib/finance/reconcile";
import type { AppKey } from "@/lib/finance/chargebacks";
import type { CostKey } from "@/lib/finance/costSettings";
import { CHANNELS, appCol, appsOnly, pct0, pctOf, short, type Col, type CostEdit, type Outlet, type OutletCol, type Totals } from "./PnlStory";
import { CostPopover } from "./CostPopover";
import { ReconHover, summarize, type ReconSummary } from "./ReconHover";
import { usd } from "./parts";

// The P&L by channel, shared by /mvp2's P&L Summary and /mvp/profit's P&L tab, one line per row:
//   reported     Orders, Sales, Card fees, App commission, Your app promos, Chargebacks after money
//                back, Net after fees. Sales and the three app lines open into their parts (Sales: gross,
//                discounts and comps, refunds, service charges; commission: commission, processing fee;
//                promos: discounts you funded, ads; chargebacks: charged, won back).
//   estimates    below the striped band: food per channel, then staff once, in
//                All, and the estimated profit. Each cost's chip opens its editor (CostPopover).
// Each column header names its source on hover, POS (In store & website) or 3PD (the apps). Sales, Net after fees,
// and Profit sit on faint grey rows. Each app's Sales figure (and All's) carries the POS ⇄ 3PD check
// on hover: its delivery orders against Square, both ways (ReconHover). Hover a line's name for the report
// columns behind it (REPORT_FIELDS).
// Laid out like a CRM records table (Attio): a dense grid with a line between every row and column, one-line
// rows, a grey header with each column's icon, and the line names pinned on the left while the figures scroll.
// What a line means sits behind an ⓘ, not under its name. Two thin section rows split it: Reported (from the
// uploaded reports) and Cost. Below Net after fees it stays bare, since owners know food and staff are their own
// estimates: no ≈, no "typical" tags, no notes in the empty channel cells; just each cost's pencil, which opens
// its editor and Profit (each with an ⓘ). Lines with parts open into indented child
// rows on a tree guide; Expand all opens them all. Each figure has its % of that column's sales beside it, small
// and grey. Each app's Sales carries an alert icon when its POS ⇄ 3PD check finds orders that differ. Net after fees and profit are bold, and
// in All they sit in a green-tinted cell (red at a loss). A line that doesn't apply leaves its cell empty.
// `query` narrows the lines (and opens the ones whose parts match); `sticky` pins the header rows to the
// nearest scroll box; `scrolled` says which way that box has scrolled, for a soft shadow off the pinned
// names (sideways) and under the header (down). `outlets` turns it into the outlet comparison: each outlet a group of DoorDash, Uber Eats,
// Grubhub and their total under its name, then All outlets the same way (no in store, so its own lines drop
// out). Staff and profit show in every column, each app carrying its share of its outlet's sales.

export type Only = "apps" | "instore";
export type Part = { label: string; get: (v: Col) => number; cost?: boolean; back?: boolean; only?: Only };
export type Line = { key: keyof typeof REPORT_FIELDS; label: string; sub?: string; get: (v: Col) => number; cost?: boolean; only?: Only; parts?: Part[] };

export const SALES: Line = {
  key: "sales",
  label: "Sales",
  sub: "In store: from your POS. Apps: from each app’s report, checked against your POS.",
  get: (v) => v.sales,
  parts: [
    { label: "Gross sales", get: (v) => v.grossSales },
    { label: "Discounts and comps", get: (v) => v.discounts, cost: true, only: "instore" },
    { label: "Refunds", get: (v) => v.refunds, cost: true, only: "instore" },
    { label: "Service charges", get: (v) => v.serviceCharges, only: "instore" },
  ],
};
// What it cost to get paid, between Sales and Net after fees.
export const SELLING: Line[] = [
  { key: "cardFees", label: "Card fees", get: (v) => v.cardFees, cost: true, only: "instore" },
  {
    key: "commission",
    label: "App commission",
    sub: "What each app keeps for taking the order",
    get: (v) => v.commission,
    cost: true,
    only: "apps",
    parts: [
      { label: "Commission", get: (v) => v.commission - v.processingFee, cost: true },
      { label: "Processing fee", get: (v) => v.processingFee, cost: true },
    ],
  },
  {
    key: "promos",
    label: "Your app promos",
    sub: "Discounts and ads you paid for",
    get: (v) => v.promos,
    cost: true,
    only: "apps",
    parts: [
      { label: "Discounts you funded", get: (v) => v.promos - v.ads, cost: true },
      { label: "Ads and marketing fees", get: (v) => v.ads, cost: true },
    ],
  },
  {
    key: "chargebacks",
    label: "Chargebacks, after money back",
    sub: "Order errors charged, less what was won back",
    get: (v) => v.chargebacksNet,
    cost: true,
    only: "apps",
    parts: [
      { label: "Charged for errors", get: (v) => v.chargebacks, cost: true },
      { label: "Won back", get: (v) => v.moneyBack, back: true },
    ],
  },
];
/** A line as the sum of its parts, for its ⓘ: "Sales = Gross sales − Refunds + Service charges". */
const formulaOf = (l: Line) =>
  l.parts && `${l.label} = ${l.parts.map((p, i) => (i ? `${(l.cost ? p.back : p.cost) ? "−" : "+"} ${p.label}` : p.label)).join(" ")}`;

const SHARED: { key: Extract<CostKey, "staff">; label: string }[] = [{ key: "staff", label: "Staff" }];

/** Each column's source, on hover over its header. */
const SOURCE = { pos: "Point of sale: in-store and website sales from Square", app: "Third-party delivery: this app's payout report" };

/** The report columns behind a line, per channel: Square for the POS, each app's report for 3PD. */
const sources = (key: keyof typeof REPORT_FIELDS) =>
  CHANNELS.filter((c) => REPORT_FIELDS[key][c.key])
    .map((c) => `${c.app ? c.label : "Square"}: ${REPORT_FIELDS[key][c.key]}`)
    .join("\n");

/** What a line means, behind an ⓘ beside its name: on hover or keyboard focus. Laid out like Xero's
 *  metric tips (Mobbin): the line's name, what it means in a sentence, then, for lines worked out from
 *  others, the sum in a grey box. A small arrow points back at the icon. The tip is portalled to the
 *  body and placed under the icon (flipped above near the bottom of the screen), since the name cell
 *  truncates and the sticky columns would clip or cover it. */
export function InfoTip({ name, text, formula, from }: { name: string; text: string; formula?: string; /** Where its figures come from, one source per line. */ from?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const [at, setAt] = useState<{ left: number; arrow: number; top?: number; bottom?: number } | null>(null);
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const mid = r.left + r.width / 2;
    const left = Math.max(8, Math.min(mid - 24, window.innerWidth - TIP_W - 8));
    const below = r.bottom + 180 < window.innerHeight;
    setAt({ left, arrow: mid - left, ...(below ? { top: r.bottom + 8 } : { bottom: window.innerHeight - r.top + 8 }) });
  };
  const hide = () => setAt(null);
  // It's placed once, so it closes rather than drift when the table scrolls under it.
  useEffect(() => {
    if (!at) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [at]);
  return (
    <span className="ml-1 inline-flex align-[-2px]">
      <button
        ref={btn}
        type="button"
        aria-label={`About ${name}`}
        aria-describedby={at ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.stopPropagation()}
        className={cn("grid size-4 place-items-center rounded-circle outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", at ? "text-(--color-text-primary)" : "text-(--color-text-tertiary)")}
      >
        <Info aria-hidden className="size-3.5" />
      </button>
      {at &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            style={{ left: at.left, top: at.top, bottom: at.bottom, width: TIP_W }}
            className="pointer-events-none fixed z-50 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-3.5 text-left font-normal whitespace-normal shadow-[0_12px_32px_rgb(0_0_0/0.14)]"
          >
            {/* arrow back to the ⓘ */}
            <span
              aria-hidden
              style={{ left: at.arrow - 5 }}
              className={cn(
                "absolute size-2.5 rotate-45 border-(--color-border-default) bg-(--color-background-secondary)",
                at.top !== undefined ? "-top-[6px] border-t border-l" : "-bottom-[6px] border-r border-b",
              )}
            />
            <p className="text-subtitle-sm font-medium text-(--color-text-primary)">{name}</p>
            <p className="mt-1 text-body-sm leading-[1.45] text-(--color-text-secondary)">{text}</p>
            {from && (
              <div className="mt-2 rounded-medium bg-(--gray-300) px-2.5 py-2">
                <p className="text-label-sm text-(--color-text-tertiary)">Where it comes from</p>
                <p className="mt-1 text-body-sm leading-[1.5] whitespace-pre-line text-(--color-text-primary)">{from}</p>
              </div>
            )}
            {formula && (
              <div className="mt-3 rounded-medium bg-(--gray-300) px-2.5 py-2">
                <p className="text-label-sm text-(--color-text-tertiary)">How it&rsquo;s worked out</p>
                <p className="mt-1 flex flex-wrap gap-x-1.5 text-body-sm leading-[1.5] text-(--color-text-primary)">
                  {/* wraps between terms, never inside one */}
                  {formula.split(/ ([=−+]) /).map((part, i) => (i % 2 ? <span key={i} className="text-(--color-text-tertiary)">{part}</span> : <span key={i} className="whitespace-nowrap">{part}</span>))}
                </p>
              </div>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
const TIP_W = 288;

/** How the figures read: dollars with their share of sales beside them, or the share alone. */
export type PnlView = "amount" | "percent";
export const ViewContext = createContext<PnlView>("amount");

const Dash = () => <span className="text-(--gray-600)">—</span>;

/** A figure with its share of that column's sales before it, small and grey; estimates carry ≈. Costs read −,
 *  money back + in green, and a negative cost (more won back than charged) reads as money in. */
export function Amount({ n, sales, cost, back, est, muted, strong, tone }: { n: number; sales: number; cost?: boolean; back?: boolean; est?: boolean; muted?: boolean; strong?: boolean; tone?: string }) {
  n = Math.round(n) || 0; // whole dollars, so a few cents either side of zero read $0, not −$0
  const text = cost ? (n < 0 ? `+${usd(-n)}` : `−${usd(n)}`) : back ? `+${usd(n)}` : usd(n);
  const green = back || (cost && n < 0);
  const view = useContext(ViewContext);
  const share = pctOf(n, sales);
  const tones = cn(strong && "font-medium", tone ?? (green ? "text-(--color-text-success)" : muted ? "text-(--color-text-secondary)" : "text-(--color-text-primary)"));
  if (view === "percent") {
    const sign = cost ? (n < 0 ? "+" : "−") : back ? "+" : "";
    return (
      <span className={cn("whitespace-nowrap tabular-nums", tones)}>
        {est && "≈ "}
        {sign}
        {pct0(Math.abs(share))}
      </span>
    );
  }
  return (
    <span className={cn("whitespace-nowrap tabular-nums", tones)}>
      {est && "≈ "}
      {text}
    </span>
  );
}

/** `broken` names the outlet groups (an outlet's store, or "all") showing their DoorDash / Uber Eats / Grubhub columns;
 *  the rest show their total alone. `onBreak` flips one group. Left out, every group shows its platforms. */
type Props = { t: Totals; recon: Record<AppKey, Recon>; edit: CostEdit; query?: string; sticky?: boolean; outlets?: Outlet[]; scrolled?: { x: boolean; y: boolean }; view?: PnlView; broken?: Set<string>; onBreak?: (group: string) => void };
/** A figure column: a channel, or one of an outlet's apps or their total. `app` columns leave in-store-only lines
 *  empty; `total` closes an outlet's group with a heavier line. */
type Column = { key: string; head: React.ReactNode; title?: string; name: string; v: Col & Partial<Pick<OutletCol, "staff" | "profit">>; app: boolean; check: ReconSummary | null; total?: boolean };

export function PnlTable({ view = "amount", ...props }: Props) {
  return (
    <ViewContext.Provider value={view}>
      <PnlGrid {...props} />
    </ViewContext.Provider>
  );
}

function PnlGrid({ t, recon, edit, query = "", sticky = false, outlets, scrolled, broken, onBreak }: Omit<Props, "view">) {
  const view = useContext(ViewContext);
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Read here, not at the top: PnlStory and this file import each other, so CHANNELS isn't ready at load.
  const APPS = CHANNELS.filter((c) => c.app);
  const all = outlets ? appsOnly(t) : t.all;
  // Each app's (or outlet's) check for its Sales figure, and all of them for All's.
  /** An outlet's (or all outlets') apps, one column each. */
  const appCols = (key: string, label: string, tt: Totals, rc: Record<AppKey, Recon>): Column[] =>
    APPS.map((c) => ({ key: `${key}:${c.key}`, head: <AppName source={c.source} name={c.label} />, title: SOURCE.app, name: `${label} · ${c.label}`, v: appCol(tt, c.key as AppKey), app: true, check: summarize([rc[c.key as AppKey]]) }));
  const split = (group: string) => !broken || broken.has(group);
  const columns: Column[] = outlets
    ? [
        ...outlets.flatMap((o) => [
          ...(split(o.store) ? appCols(o.store, short(o.store), o.t, o.recon) : []),
          { key: o.store, head: "Total", title: `${o.store}: DoorDash, Uber Eats and Grubhub`, name: short(o.store), v: appsOnly(o.t), app: true, check: summarize(Object.values(o.recon)), total: true },
        ]),
        ...(split("all") ? appCols("all", "All outlets", t, recon) : []),
      ]
    : CHANNELS.map((c) => ({
        key: c.key,
        head: <AppName source={c.source} name={c.label} />,
        title: c.app ? SOURCE.app : SOURCE.pos,
        name: c.label,
        v: t.cols[c.key],
        app: c.app,
        check: c.app ? summarize([recon[c.key as AppKey]]) : null,
      }));
  const cols: Col[] = [...columns.map((c) => c.v), all];
  const allCheck = summarize(Object.values(recon));
  // Outlets show only the apps: in-store-only lines and parts drop out, and a line left with one part doesn't open.
  const fits = (only?: Only) => !outlets || only !== "instore";
  const shape = (l: Line): Line => { const parts = l.parts?.filter((p) => fits(p.only)); return { ...l, parts: parts && parts.length > 1 ? parts : undefined } };
  const lines = [SALES, ...SELLING].filter((l) => fits(l.only)).map(shape);
  const [sales, ...selling] = lines;

  const q = query.trim().toLowerCase();
  const shows = (text: string) => !q || text.toLowerCase().includes(q);
  // A line shows when it or one of its parts matches; a search opens the lines whose parts match.
  const visible = (l: Line) => shows(l.label) || !!l.parts?.some((p) => shows(p.label));
  const isOpen = (l: Line) => open.has(l.key) || (!!q && !!l.parts?.some((p) => shows(p.label)));
  const toggle = (k: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(k)) n.add(k);
      return n;
    });
  const shared = SHARED.filter((l) => shows(l.label));
  const estimates = shows("Food & drink") || shared.length > 0 || (shows("Profit") || shows("Prime cost"));
  const nothing = !shows("Orders") && !shows("Net after fees") && !lines.some(visible) && !estimates;
  const applies = (only: Only | undefined, app: boolean) => !only || (only === "apps") === app;
  const expandable = lines.filter((l) => l.parts && visible(l));
  // Cost opens like a line: closed, one row of each column's total cost; open, its lines and no total.
  // A search for one of its lines opens it.
  const costOpen = open.has("costs") || (!!q && (shows("Food & drink") || shared.length > 0));
  const openable = [...expandable.map((l) => l.key), ...(estimates ? ["costs"] : [])];
  const allOpen = openable.every((k) => open.has(k));

  // The grid: a line on every cell's right and bottom; the table draws the top and left.
  const grid = "border-r border-b border-(--gray-400)";
  // The names stay put while the figures scroll sideways.
  // Once the figures scroll under the names, a soft shadow off the names' right edge.
  const edge = scrolled?.x && "after:pointer-events-none after:absolute after:inset-y-0 after:-right-2 after:w-2 after:bg-linear-to-r after:from-black/[0.07] after:to-transparent";
  const pin = cn("sticky left-0 z-[1] bg-(--color-background-secondary) group-hover/row:bg-(--gray-200)", edge);
  const nameCell = cn(grid, pin, "h-11 px-3 text-left align-middle font-normal text-(--color-text-primary)");
  const colW = outlets ? "w-[140px]" : "w-[170px]";
  const num = cn(grid, colW, "h-11 px-3 text-right align-middle");
  // The line that closes an outlet's group.
  const groupEnd = "border-r-(--gray-700)";
  const cellOf = (c: Column, extra?: string) => cn(num, c.total && groupEnd, extra);
  const rowCls = "group/row transition-colors hover:bg-(--gray-200)";
  // Sales and the subtotals (Net after fees, Profit) sit on a faint grey row.
  const strongRow = "bg-(--gray-200) [&>th]:bg-(--gray-200) hover:bg-(--gray-300) [&>th]:group-hover/row:bg-(--gray-300)";
  // Net after fees and profit, in All: a tinted cell, green (red at a loss).
  const good = "bg-(--green-200) group-hover/row:bg-(--green-300)";
  const bad = "bg-(--red-200) group-hover/row:bg-(--red-300)";

  /** A line's name: the expand chevron (or its space), the name and its ⓘ, then anything at the end (a cost's chip). */
  const name = (label: string, opts: { info?: string; formula?: string; from?: string; strong?: boolean; child?: boolean; toggle?: { open: boolean; key: string }; end?: React.ReactNode } = {}) => (
    <div className="flex items-center gap-1">
      {opts.child ? null : opts.toggle ? (
        <button
          type="button"
          aria-expanded={opts.toggle.open}
          aria-label={`${opts.toggle.open ? "Hide" : "Show"} detail for ${label}`}
          onClick={() => toggle(opts.toggle!.key)}
          className="-ml-1 grid size-5 shrink-0 place-items-center rounded-small text-(--color-text-tertiary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
        >
          <ChevronRight aria-hidden className={cn("size-3.5 transition-transform duration-150", opts.toggle.open && "rotate-90")} />
        </button>
      ) : (
        <span aria-hidden className="-ml-1 w-5 shrink-0" />
      )}
      <span className={cn("min-w-0 flex-1 truncate", opts.strong && "font-medium", opts.child && "text-(--color-text-secondary)")}>
        {label}
        {opts.info && <InfoTip name={label} text={opts.info} formula={opts.formula} from={opts.from} />}
      </span>
      {opts.end}
    </div>
  );

  /** A thin section row: what the lines below are, and where they come from. */
  const section = (key: string, title: React.ReactNode, end?: React.ReactNode) => (
    <tr key={key}>
      <td colSpan={columns.length + 2} className={cn(grid, "h-11 bg-(--color-background-secondary) px-3")}>
        <div className="sticky left-3 flex w-fit max-w-[calc(100vw-48px)] items-center gap-3 text-body-sm text-(--color-text-secondary)">
          {title}
          {end}
        </div>
      </td>
    </tr>
  );

  /** A reported line, then its parts as indented child rows when opened. */
  const lineRows = (l: Line) => {
    const opened = isOpen(l);
    const isSales = l.key === "sales";
    return (
      <Fragment key={l.key}>
        <tr className={cn(rowCls, isSales && strongRow)}>
          <th scope="row" className={nameCell} title={l.sub ? undefined : sources(l.key)}>
            {name(l.label, { info: l.sub, from: isSales ? undefined : sources(l.key), formula: isSales ? undefined : l.sub && formulaOf(l), strong: isSales, toggle: l.parts ? { open: opened, key: l.key } : undefined })}
          </th>
          {columns.map((c) => (
            <td key={c.key} className={cellOf(c)}>
              {!applies(l.only, c.app) ? <Dash /> : isSales ? <SalesFigure n={c.v.sales} check={c.check} name={c.name} /> : <Amount n={l.get(c.v)} sales={c.v.sales} cost={l.cost} />}
            </td>
          ))}
          <td className={num}>{isSales ? <SalesFigure n={all.sales} check={allCheck} name={outlets ? "All outlets" : "All apps"} /> : <Amount n={l.get(all)} sales={all.sales} cost={l.cost} />}</td>
        </tr>
        {opened &&
          l.parts!.map((p, k) => (
            <tr key={p.label} className={cn(rowCls, "text-body-sm")}>
              <th scope="row" className={cn(nameCell, "h-8 pl-[48px]")}>
                {/* A tree guide down from the parent's chevron: the cell's full height and across the row line, so it
                    runs unbroken; the last part's stops at its middle, with a tick into it */}
                <span aria-hidden className={cn("absolute -top-px left-[17px] w-px bg-(--gray-600)", k === l.parts!.length - 1 ? "h-[calc(50%+1px)]" : "-bottom-px")} />
                <span aria-hidden className="absolute top-1/2 left-[17px] h-px w-4 bg-(--gray-600)" />
                <span className="text-(--color-text-secondary)">{p.label}</span>
              </th>
              {columns.map((c) => (
                <td key={c.key} className={cellOf(c, "h-8")}>
                  {applies(l.only, c.app) && applies(p.only, c.app) ? <Amount n={p.get(c.v)} sales={c.v.sales} cost={p.cost} back={p.back} muted /> : null}
                </td>
              ))}
              <td className={cn(num, "h-8")}>
                <Amount n={p.get(all)} sales={all.sales} cost={p.cost} back={p.back} muted />
              </td>
            </tr>
          ))}
      </Fragment>
    );
  };

  /** A line of single figures. `once` gives the channels one empty cell, for a figure that's only in All; `tint` colours All's cell. */
  const figureRow = (key: string, label: React.ReactNode, title: string | undefined, figure: (v: Column["v"]) => React.ReactNode, opts: { once?: boolean; tint?: string; editing?: boolean; strong?: boolean; child?: "mid" | "last" } = {}) => (
    <tr key={key} className={cn(rowCls, opts.strong && strongRow, opts.child && "text-body-sm")}>
      <th scope="row" className={cn(nameCell, opts.child && "h-8 pl-[48px]", opts.editing && "shadow-[inset_2px_0_0_var(--amber-700)]")} title={title}>
        {opts.child && (
          <>
            {/* the same tree guide as a reported line's parts */}
            <span aria-hidden className={cn("absolute -top-px left-[17px] w-px bg-(--gray-600)", opts.child === "last" ? "h-[calc(50%+1px)]" : "-bottom-px")} />
            <span aria-hidden className="absolute top-1/2 left-[17px] h-px w-4 bg-(--gray-600)" />
          </>
        )}
        {label}
      </th>
      {opts.once ? (
        <td colSpan={columns.length} className={cn(grid, opts.child ? "h-8" : "h-11")} />
      ) : (
        columns.map((c) => (
          <td key={c.key} className={cellOf(c, opts.child && "h-8")}>
            {figure(c.v)}
          </td>
        ))
      )}
      <td className={cn(num, opts.child && "h-8", opts.tint)}>{figure(all)}</td>
    </tr>
  );
  const profitTone = (n: number) => (Math.round(n) < 0 ? "text-(--color-text-danger)" : "text-(--color-text-success)");

  return (
    <table className="w-full min-w-[920px] border-separate border-spacing-0 border-t border-l border-(--gray-400) text-body-md">
      <thead>
        {outlets && (
          // The outlets over their apps.
          <tr className={cn("text-body-sm [&>th]:h-[34px] [&>th]:bg-(--gray-200)", sticky && "[&>th]:sticky [&>th]:top-0 [&>th]:z-[2]")}>
            <th aria-hidden className={cn(grid, "left-0 z-[3]!", !sticky && "sticky", edge)} />
            {[...outlets.map((o) => ({ key: o.store, label: short(o.store), title: o.store })), { key: "all", label: "All outlets", title: undefined }].map((g) => (
              <th key={g.key} scope="colgroup" colSpan={split(g.key) ? APPS.length + 1 : 1} title={g.title} className={cn(grid, groupEnd, "px-3 text-left font-medium text-(--color-text-primary)")}>
                {/* Stays beside the pinned Line column (280px) while any of its group is in view */}
                <span className="sticky left-[292px] flex w-fit max-w-full items-center gap-1.5 whitespace-nowrap">
                  <StoreIcon aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
                  <span className="min-w-0 truncate">{g.label}</span>
                  {onBreak && (
                    <button
                      type="button"
                      aria-expanded={split(g.key)}
                      aria-label={`${split(g.key) ? "Hide" : "Show"} platform breakdown for ${g.label}`}
                      title={split(g.key) ? "Hide platform breakdown" : "Platform breakdown"}
                      onClick={() => onBreak(g.key)}
                      className="grid size-5 shrink-0 place-items-center rounded-small text-(--color-text-tertiary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                    >
                      <ChevronRight aria-hidden className={cn("size-3.5 transition-transform duration-150", split(g.key) && "rotate-90")} />
                    </button>
                  )}
                </span>
              </th>
            ))}
          </tr>
        )}
        <tr
          className={cn(
            "text-body-sm text-(--color-text-secondary) [&>th]:h-[42px] [&>th]:bg-(--gray-200)",
            sticky && (outlets ? "[&>th]:sticky [&>th]:top-[34px] [&>th]:z-[2]" : "[&>th]:sticky [&>th]:top-0 [&>th]:z-[2]"),
            // Once the lines scroll under the pinned header, a soft shadow below it.
            scrolled?.y && "[&>th]:before:pointer-events-none [&>th]:before:absolute [&>th]:before:inset-x-0 [&>th]:before:-bottom-2 [&>th]:before:h-2 [&>th]:before:bg-linear-to-b [&>th]:before:from-black/[0.07] [&>th]:before:to-transparent",
          )}
        >
          {/* z-[3]! because the row's [&>th]:z-[2] would otherwise win and let the scrolled headers paint over it */}
          <th scope="col" className={cn(grid, "left-0 z-[3]! px-3 text-left font-normal", !sticky && "sticky", outlets && "w-[280px] min-w-[280px]", edge)}>
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <ListTree aria-hidden className="size-3.5" />
                Line
              </span>
              {openable.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpen(allOpen ? new Set() : new Set(openable))}
                  className="h-6 shrink-0 rounded-small px-1.5 text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                >
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              )}
            </span>
          </th>
          {columns.map((c) => (
            <th key={c.key} scope="col" title={c.title} className={cn(grid, colW, c.total && groupEnd, "px-3 text-right font-normal text-(--color-text-primary)", c.total && "font-medium")}>
              <span className="flex items-center justify-end whitespace-nowrap">{c.head}</span>
            </th>
          ))}
          <th scope="col" className={cn(grid, colW, "px-3 text-right font-medium text-(--color-text-primary)")}>
            {outlets ? "Total" : "All"}
          </th>
        </tr>
      </thead>
      <tbody>
        {!nothing && section("reported", <span className="text-body-md font-medium text-(--color-text-primary)">Reported</span>, <span className="text-(--color-text-tertiary)">From the uploaded reports{view === "percent" && " · % of each column\u2019s sales"}</span>)}
        {shows("Orders") && (
          <tr className={rowCls}>
            <th scope="row" className={nameCell} title={sources("orders")}>
              {name("Orders")}
            </th>
            {cols.map((v, i) => (
              <td key={i} className={cn(num, columns[i]?.total && groupEnd, "text-(--color-text-secondary) tabular-nums")}>
                {v.orders.toLocaleString("en-US")}
              </td>
            ))}
          </tr>
        )}
        {visible(sales) && lineRows(sales)}
        {selling.filter(visible).map(lineRows)}
        {shows("Net after fees") &&
          figureRow("moneyIn", name("Net after fees", { strong: true }), sources("moneyIn"), (v) => <Amount n={v.moneyIn} sales={v.sales} strong tone={v === all ? "text-(--color-text-success)" : undefined} />, { tint: good, strong: true })}

        {estimates &&
          (costOpen
            ? section(
                "costs",
                <div className="text-body-md text-(--color-text-primary)">
                  {name("Prime cost", { strong: true, toggle: { open: true, key: "costs" } })}
                </div>,
              )
            : figureRow(
                "costs",
                name("Prime cost", {
                  strong: true,
                  toggle: { open: false, key: "costs" },
                  info: outlets ? "Food & drink and staff." : "Food & drink and staff. Staff is shared, so the channels show food only and All shows both.",
                  formula: "Prime cost = Food & drink + Staff",
                }),
                undefined,
                (v) => <Amount n={v.food + (v.staff ?? 0)} sales={v.sales} cost />,
              ))}
        {costOpen &&
          shows("Food & drink") &&
          figureRow(
            "food",
            name("Food & drink", { child: true, end: <CostPopover costKey="food" edit={edit} amount={all.food} /> }),
            undefined,
            (v) => <Amount n={v.food} sales={v.sales} cost muted />,
            { editing: edit.draft?.key === "food", child: shared.length ? "mid" : "last" },
          )}
        {costOpen &&
          shared.map((l) =>
            figureRow(l.key, name(l.label, { child: true, end: <CostPopover costKey={l.key} edit={edit} amount={all[l.key]} /> }), undefined, (v) => <Amount n={v[l.key] ?? 0} sales={v.sales} cost muted />, { once: !outlets, editing: edit.draft?.key === l.key, child: "last" }),
          )}
        {(shows("Profit") || shows("Prime cost")) &&
          figureRow(
            "profit",
            name("Profit after prime cost", {
              info: outlets ? "Before loans and tax. Each outlet's staff is split by sales, and its delivery apps carry their share." : "Before loans and tax. Staff is shared, so profit is counted once, for all channels.",
              formula: "Profit after prime cost = Net after fees − Food & drink − Staff",
              strong: true,
            }),
            undefined,
            (v) => <Amount n={v.profit ?? 0} sales={v.sales} strong tone={profitTone(v.profit ?? 0)} />,
            { once: !outlets, tint: all.profit < 0 ? bad : good, strong: true },
          )}
        {nothing && (
          <tr>
            <td colSpan={columns.length + 2} className={cn(grid, "px-4 py-10 text-center text-body-md text-(--color-text-secondary)")}>
              No lines match &ldquo;{query}&rdquo;.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Sales, bold, with the app's (or All's) POS ⇄ 3PD check as an alert icon before it when orders differ. */
function SalesFigure({ n, check, name }: { n: number; check: ReconSummary | null; name: string }) {
  const view = useContext(ViewContext);
  const figure = <span className="font-medium whitespace-nowrap tabular-nums">{view === "percent" ? "100%" : usd(n)}</span>;
  return check ? (
    <ReconHover check={check} name={name}>
      {figure}
    </ReconHover>
  ) : (
    figure
  );
}
