"use client";
import { Fragment, useState } from "react";
import Image from "next/image";
import { ChevronRight, Store as StoreIcon } from "lucide-react";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";
import type { AppKey } from "@/lib/finance/chargebacks";
import type { Recon } from "@/lib/finance/reconcile";
import { CHANNELS, appCol, appsOnly, short, type Col, type CostEdit, type Outlet, type OutletCol, type Totals } from "./PnlStory";
import { Amount, SALES, SELLING, ViewContext, type Only, type PnlView } from "./PnlTable";
import { InStoreMark } from "@/components/ui/InStoreMark";
import { CostPopover } from "./CostPopover";

// The P&L Summary table, laid out for a phone (built for 390pt wide, an iPhone 13). The same lines and figures as
// PnlTable, read down instead of across:
//   one channel at a time   tabs for All / In store / each app, then the lines as one statement. Sales, the app
//                           fees and Prime cost open into their parts (as the table's chevrons do); Net revenue and
//                           Profit sit on tinted rows.
//   Compare outlets         one card per outlet, All outlets first. Closed, a card shows the outlet's total: Sales, Net
//                           revenue, Prime cost and Profit. "Platform breakdown" (per card, or all at once from the page's
//                           bar) adds a column per app and the fee lines, scrolling sideways with the line names pinned.

type Props = {
  t: Totals;
  recon: Record<AppKey, Recon>;
  edit: CostEdit;
  outlets?: Outlet[];
  view?: PnlView;
  /** The outlet groups (an outlet's store, or "all") showing their platforms, and the flip for one. */
  broken?: Set<string>;
  onBreak?: (group: string) => void;
  /** Every group open, and a flip for all at once: the cards' "Show all platforms". */
  allBroken?: boolean;
  onBreakAll?: (on: boolean) => void;
};

export function PnlMobile({ view = "amount", outlets, ...rest }: Props) {
  return (
    <ViewContext.Provider value={view}>
      {outlets ? <OutletCards t={rest.t} outlets={outlets} broken={rest.broken} onBreak={rest.onBreak} allBroken={rest.allBroken} onBreakAll={rest.onBreakAll} /> : <ChannelTable t={rest.t} edit={rest.edit} />}
    </ViewContext.Provider>
  );
}

const card = "overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)";
const tint = { good: "bg-(--green-200)", bad: "bg-(--red-200)", grey: "bg-(--gray-200)" };

// ───────────────────────── By channel: the table, columns scrolling ─────────────────────────

type MCol = { key: string; label: string; source: string; app: boolean; all?: boolean; v: Col & Partial<Pick<OutletCol, "staff" | "profit">> };

/** The channel table as Asana's iOS list is: the line names pinned on the left, All first (so the summary shows with no
 *  scrolling), then each channel, the next one peeking in at the edge to say it scrolls. */
function ChannelTable({ t, edit }: { t: Totals; edit: CostEdit }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(k)) n.add(k);
      return n;
    });
  const cols: MCol[] = [{ key: "all", label: "All", source: "", app: true, all: true, v: t.all }, ...CHANNELS.map((c) => ({ key: c.key, label: c.app ? c.label : "In store", source: c.source, app: c.app, v: t.cols[c.key] }))];
  const fits = (only: Only | undefined, c: MCol) => c.all || !only || (only === "apps") === c.app;
  const lines = [SALES, ...SELLING];
  const costOpen = open.has("costs");

  const cell = "flex items-center justify-end border-b border-(--color-border-default) px-2.5 text-body-sm";
  /** One row: the pinned name cell, then a cell per column from `fig` (null leaves it empty). */
  const row = (key: string, name: React.ReactNode, fig: (c: MCol) => React.ReactNode, o: { part?: boolean; last?: boolean; strong?: boolean; bg?: string; allBg?: string; toggleKey?: string; label?: string } = {}) => {
    const h = o.part ? "h-9 text-body-sm" : "h-11";
    const bg = o.bg ?? "bg-(--color-background-secondary)";
    return (
      <Fragment key={key}>
        <div className={cn(cell, h, "sticky left-0 z-[1] justify-start gap-0 overflow-hidden pr-1 text-body-md whitespace-nowrap", bg, o.part ? "pl-[44px]" : "pl-3")}>
          {o.part && (
            <>
              {/* the table's tree guide */}
              <span aria-hidden className={cn("absolute -top-px left-[17px] w-px bg-(--gray-600)", o.last ? "h-[calc(50%+1px)]" : "-bottom-px")} />
              <span aria-hidden className="absolute top-1/2 left-[17px] h-px w-4 bg-(--gray-600)" />
            </>
          )}
          {o.toggleKey ? (
            <button
              type="button"
              aria-expanded={open.has(o.toggleKey)}
              aria-label={`${open.has(o.toggleKey) ? "Hide" : "Show"} detail for ${o.label}`}
              onClick={() => toggle(o.toggleKey!)}
              className="-ml-2 grid size-8 shrink-0 place-items-center rounded-small text-(--color-text-tertiary) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
            >
              <ChevronRight aria-hidden className={cn("size-4 transition-transform duration-150", open.has(o.toggleKey) && "rotate-90")} />
            </button>
          ) : (
            !o.part && <span aria-hidden className="-ml-2 w-8 shrink-0" />
          )}
          <span className={cn("flex min-w-0 items-center gap-1 truncate", o.strong && "font-medium text-(--color-text-primary)", o.part && "text-(--color-text-secondary)")}>{name}</span>
        </div>
        {cols.map((c) => (
          <div key={c.key} className={cn(cell, h, c.all ? (o.allBg ?? bg) : bg)}>
            {fig(c)}
          </div>
        ))}
      </Fragment>
    );
  };

  return (
    <section aria-label="Profit and loss by channel" className={card}>
      <div className="overflow-x-auto">
        <div className="grid w-max min-w-full" style={{ gridTemplateColumns: `132px repeat(${cols.length}, 100px)` }}>
          <div className={cn(cell, "sticky left-0 z-[1] h-10 justify-start bg-(--gray-200) text-body-sm text-(--color-text-secondary)")}>Line</div>
          {cols.map((c) => (
            <div key={c.key} className={cn(cell, "h-10 gap-1.5 bg-(--gray-200) text-body-sm whitespace-nowrap", c.all ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
              {c.source === "instore" ? <InStoreMark size={16} /> : c.source ? <Image src={asset(`/dashboard/${c.source}.png`)} alt="" width={16} height={16} unoptimized className="size-4 shrink-0 rounded-[2px] object-cover" /> : null}
              {c.label}
            </div>
          ))}

          {row("orders", "Orders", (c) => <span className="tabular-nums text-(--color-text-secondary)">{c.v.orders.toLocaleString("en-US")}</span>)}
          {lines.map((l) => {
            const isSales = l.key === "sales";
            const opened = open.has(l.key);
            const out: React.ReactNode[] = [
              row(l.key, SHORT[l.key] ?? l.label, (c) => (fits(l.only, c) ? isSales ? <Amount n={c.v.sales} sales={c.v.sales} strong /> : <Amount n={l.get(c.v)} sales={c.v.sales} cost={l.cost} /> : <Dash />), {
                strong: isSales,
                bg: isSales ? tint.grey : undefined,
                toggleKey: l.parts ? l.key : undefined,
                label: l.label,
              }),
            ];
            if (opened && l.parts) {
              l.parts.forEach((p, i) =>
                out.push(
                  row(`${l.key}:${p.label}`, p.label, (c) => (fits(l.only, c) && fits(p.only, c) ? <Amount n={p.get(c.v)} sales={c.v.sales} cost={p.cost} back={p.back} muted /> : null), { part: true, last: i === l.parts!.length - 1 }),
                ),
              );
            }
            return out;
          })}
          {row("moneyIn", "Net revenue", (c) => <Amount n={c.v.moneyIn} sales={c.v.sales} strong tone={c.all ? "text-(--color-text-success)" : undefined} />, { strong: true, bg: tint.grey, allBg: tint.good })}

          {costOpen ? (
            <>
              {row("costs", "Prime cost", () => null, { strong: true, toggleKey: "costs", label: "Prime cost" })}
              {row("food", <>Food & drink <CostPopover costKey="food" edit={edit} amount={t.all.food} /></>, (c) => <Amount n={c.v.food} sales={c.v.sales} cost muted />, { part: true })}
              {row("staff", <>Staff <CostPopover costKey="staff" edit={edit} amount={t.all.staff} /></>, (c) => (c.all ? <Amount n={t.all.staff} sales={c.v.sales} cost muted /> : null), { part: true, last: true })}
            </>
          ) : (
            row("costs", "Prime cost", (c) => <Amount n={c.v.food + (c.v.staff ?? 0)} sales={c.v.sales} cost />, { strong: true, toggleKey: "costs", label: "Prime cost" })
          )}
          {row("profit", "Profit", (c) => (c.all ? <Amount n={t.all.profit} sales={c.v.sales} strong tone={Math.round(t.all.profit) < 0 ? "text-(--color-text-danger)" : "text-(--color-text-success)"} /> : null), {
            strong: true,
            bg: tint.grey,
            allBg: t.all.profit < 0 ? tint.bad : tint.good,
          })}
        </div>
      </div>
    </section>
  );
}

/** Names for the pinned column, which is narrow. */
const SHORT: Record<string, string> = { commission: "Commission", promos: "Promos", chargebacks: "Chargebacks" };

const Dash = () => <span className="text-(--gray-600)">—</span>;

// ───────────────────────── Compare outlets ─────────────────────────

type Group = { key: string; label: string; t: Totals };

function OutletCards({ t, outlets, broken, onBreak, allBroken, onBreakAll }: { t: Totals; outlets: Outlet[]; broken?: Set<string>; onBreak?: (g: string) => void; allBroken?: boolean; onBreakAll?: (on: boolean) => void }) {
  const groups: Group[] = [{ key: "all", label: "All outlets", t }, ...outlets.map((o) => ({ key: o.store, label: short(o.store), t: o.t }))];
  return (
    <section aria-label="Profit and loss by outlet" className="space-y-3">
      {onBreakAll && (
        <div className="flex items-center justify-between px-1 text-body-sm text-(--color-text-secondary)">
          <span>{outlets.length} outlets</span>
          <button type="button" onClick={() => onBreakAll(!allBroken)} className="h-8 rounded-small px-1.5 text-(--color-text-clickable) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            {allBroken ? "Hide all platforms" : "Show all platforms"}
          </button>
        </div>
      )}
      {groups.map((g) => (
        <OutletCard key={g.key} g={g} split={!broken || broken.has(g.key)} onBreak={onBreak && (() => onBreak(g.key))} />
      ))}
    </section>
  );
}

/** What an outlet card's rows read from a column: the apps' own lines are only there once its platforms open. */
const OUTLET_LINES: { key: string; label: string; get: (c: OutletCol) => number; cost?: boolean; strong?: boolean; detail?: boolean; tone?: (c: OutletCol) => string | undefined }[] = [
  { key: "sales", label: "Sales", get: (c) => c.sales, strong: true },
  { key: "commission", label: "Commission", get: (c) => c.commission, cost: true, detail: true },
  { key: "promos", label: "Promos", get: (c) => c.promos, cost: true, detail: true },
  { key: "chargebacks", label: "Chargebacks", get: (c) => c.chargebacksNet, cost: true, detail: true },
  { key: "moneyIn", label: "Net revenue", get: (c) => c.moneyIn, strong: true },
  { key: "prime", label: "Prime cost", get: (c) => c.food + c.staff, cost: true },
  { key: "profit", label: "Profit", get: (c) => c.profit, strong: true, tone: (c) => (Math.round(c.profit) < 0 ? "text-(--color-text-danger)" : "text-(--color-text-success)") },
];

function OutletCard({ g, split, onBreak }: { g: Group; split: boolean; onBreak?: () => void }) {
  const apps = CHANNELS.filter((c) => c.app);
  const cols = [{ key: "total", label: "Total", source: "", v: appsOnly(g.t) }, ...(split ? apps.map((c) => ({ key: c.key, label: c.label, source: c.source, v: appCol(g.t, c.key as AppKey) })) : [])];
  const rows = OUTLET_LINES.filter((l) => split || !l.detail);
  const template = `minmax(88px,1fr) repeat(${cols.length}, minmax(${split ? 64 : 96}px, auto))`;
  const cell = "flex h-10 items-center justify-end border-b border-(--color-border-default) px-2.5 text-body-sm";
  return (
    <div className={card}>
      {/* A section header, as Asana's: the whole row opens or closes the outlet's platforms */}
      <button type="button" aria-expanded={split} disabled={!onBreak} onClick={onBreak} className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left outline-none focus-visible:bg-(--color-neutral-lightest)">
        {onBreak && <ChevronRight aria-hidden className={cn("size-4 shrink-0 text-(--color-text-tertiary) transition-transform duration-150", split && "rotate-90")} />}
        <StoreIcon aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
        <span className="min-w-0 flex-1 truncate font-medium text-(--color-text-primary)">{g.label}</span>
        {onBreak && <span className="shrink-0 text-body-sm text-(--color-text-tertiary)">{split ? "Hide platforms" : "Platforms"}</span>}
      </button>
      <div className="overflow-x-auto border-t border-(--color-border-default)">
        <div className="grid min-w-full" style={{ gridTemplateColumns: template, minWidth: split && g.key === "all" ? 88 + cols.length * 112 : undefined }}>
          {/* header: the platforms by logo, so four columns fit */}
          {split && (
            <>
              <div className={cn(cell, "sticky left-0 z-[1] justify-start bg-(--gray-200) text-(--color-text-secondary)")}>Line</div>
              {cols.map((c) => (
                <div key={c.key} className={cn(cell, "gap-1.5 bg-(--gray-200) whitespace-nowrap", c.source ? "text-(--color-text-secondary)" : "font-medium text-(--color-text-primary)")}>
                  {c.source && <Image src={asset(`/dashboard/${c.source}.png`)} alt="" width={16} height={16} unoptimized className="size-4 shrink-0 rounded-[2px] object-cover" />}
                  {c.source ? <span className="sr-only">{c.label}</span> : c.label}
                </div>
              ))}
            </>
          )}
          {rows.map((l) => (
            <Fragment key={l.key}>
              <div className={cn(cell, "sticky left-0 z-[1] justify-start whitespace-nowrap", l.strong ? "bg-(--gray-200) font-medium text-(--color-text-primary)" : "bg-(--color-background-secondary) text-(--color-text-secondary)")}>{l.label}</div>
              {cols.map((c) => (
                <div key={c.key} className={cn(cell, l.strong && "bg-(--gray-200)")}>
                  <Amount n={l.get(c.v)} sales={c.v.sales} cost={l.cost} strong={l.strong} tone={l.tone?.(c.v)} />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
