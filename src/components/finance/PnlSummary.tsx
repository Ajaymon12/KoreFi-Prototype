"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { asset } from "@/lib/asset";
import { DollarSign, ListFilter, Percent, Search, SlidersHorizontal, Store as StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { NoOutlets, OutletCount, OutletFilterSheet, OutletFilters, useOutletFilter } from "@/components/mvp2/OutletFilters";
import { activeCount } from "@/lib/finance/outletFilter";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PRESETS, WEEKS, PnlCards, usePnl } from "./PnlStory";
import { PnlTable, type PnlView } from "./PnlTable";
import { PnlMobile } from "./PnlMobile";
import { DateRangeFilter } from "./DateRangeFilter";
import { cn } from "@/lib/utils";

// MVP 2 / P&L Summary (Figma 1514:18163). The same figures as /mvp/profit's P&L tab (usePnl), laid out
// as one report: an outlets + date bar (it drives everything below), the three cards, then the P&L by
// channel (PnlTable, shared with /mvp/profit) with its header pinned to this page's scroll box.
// One bar on top: Search narrows the table's lines (and opens the ones whose parts match); the outlet filters
// (State / City / Outlet and the Filters panel, components/mvp2/OutletFilters; all outlets by default) and Date (last 4 weeks by default, a preset or a custom range: DateRangeFilter)
// scope the cards, table and cost edits. Phones get /mvp's one-channel-at-a-time list.
// Compare outlets (a switch at the bar's end) swaps the cards and the channel table for the same lines with one
// column per outlet, its delivery apps only (PnlTable's `outlets`).

export function PnlSummary() {
  const [query, setQuery] = useState("");
  // Last 4 weeks by default; a preset or any custom run of weeks.
  const [range, setRange] = useState<[number, number]>(PRESETS[0].range);
  const outlets = useOutletFilter(range);
  const [compare, setCompare] = useState(false);
  const [view, setView] = useState<PnlView>("amount");
  // Compare outlets shows each outlet's total alone; its platforms (DoorDash, Uber Eats, Grubhub) open per outlet or all at once.
  // Phones: the filters and the view options are two bottom sheets, opened from the round buttons at the bottom left.
  const [sheet, setSheet] = useState<"filter" | "view" | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  // Which way the box has scrolled, for the table's shadows: sideways at all, or down past the table's top.
  const [scrolled, setScrolled] = useState({ x: false, y: false });
  const table = useRef<HTMLElement>(null);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const x = e.currentTarget.scrollLeft > 0;
    const y = e.currentTarget.scrollTop > (table.current?.offsetTop ?? 0);
    if (x !== scrolled.x || y !== scrolled.y) setScrolled({ x, y });
  };
  const pnl = usePnl(outlets.filtered ? outlets.stores : null, range);
  const { t, recon, edit } = pnl;
  const none = outlets.stores.length === 0;
  const groups = ["all", ...outlets.stores];
  const allBroken = groups.every((g) => broken.has(g));
  const flip = (g: string) => setBroken((b) => { const n = new Set(b); if (!n.delete(g)) n.add(g); return n; });

  return (
    <>
      <PageHeader title="P&L Summary" />
      {/* One scroll box for both axes, so the table's header rows can stick to its top. contain-paint keeps a
          wide table's overflow inside it; without it the page took the width too and scrolled away sideways. */}
      <div onScroll={onScroll} className="min-h-0 flex-1 overflow-auto contain-paint">
        {/* Search (the table's lines) and the filters (everything below); pinned left, like everything above the table, so a wide table scrolls under them */}
        {/* z-[4]: sticky makes the bar its own layer, so without it the table's pinned header (z-[3]) covers its menus */}
        <div className="sticky left-0 z-[4] flex flex-wrap items-center gap-2 px-4 pt-3 max-md:hidden">
          <label className="hidden h-8 w-[260px] max-w-full items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 focus-within:border-(--color-focus-primary) md:flex">
            <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." aria-label="Search lines" className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)" />
          </label>
          <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-(--color-border-default) md:block" />
          <OutletFilters scope={outlets} compact />
          <DateRangeFilter weeks={WEEKS} presets={PRESETS} value={range} onChange={setRange} />
          {/* How the table reads, pinned to the bar's end so the bar stays one line: icons alone until the window
              is wide enough for the labels and the outlet count */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="mr-2 hidden 2xl:block">
              <OutletCount scope={outlets} />
            </span>
            <CompareSwitch on={compare} onChange={setCompare} />
            {compare && <BreakdownSwitch on={allBroken} onChange={(on) => setBroken(on ? new Set(groups) : new Set())} />}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
        {/* Phones: what the report covers, one line that opens the filters */}
        <button type="button" onClick={() => setSheet("filter")} className="sticky left-0 flex h-11 w-full items-center gap-1.5 px-4 text-left text-body-md text-(--color-text-secondary) outline-none focus-visible:bg-(--color-neutral-lightest) md:hidden">
          <span className="truncate">{outlets.filtered ? `${outlets.stores.length} outlets` : "All outlets"} · {(PRESETS.find((p) => p.range[0] === range[0] && p.range[1] === range[1]) ?? { label: "Custom range" }).label}</span>
          <span className="ml-auto shrink-0 text-(--color-text-clickable)">Change</span>
        </button>
        {none ? (
          <div className="sticky left-0 pb-4">
            <NoOutlets scope={outlets} />
          </div>
        ) : compare ? (
          <div aria-hidden className="h-3" />
        ) : (
          <div className="sticky left-0 border-b border-(--color-border-default) px-4 pt-3 pb-3">
            <PnlCards pnl={pnl} />
          </div>
        )}

        {!none && (
          <>
            <section ref={table} aria-label={compare ? "Profit and loss by outlet" : "Profit and loss by channel"} className="hidden md:block">
              <PnlTable t={t} recon={recon} edit={edit} query={query} sticky outlets={compare ? pnl.byOutlet() : undefined} scrolled={scrolled} view={view} broken={broken} onBreak={flip} />
            </section>

            <div className="px-4 pt-1 pb-24 md:hidden">
              <PnlMobile t={t} recon={recon} edit={edit} outlets={compare ? pnl.byOutlet() : undefined} view={view} broken={broken} onBreak={flip} allBroken={allBroken} onBreakAll={(on) => setBroken(on ? new Set(groups) : new Set())} />
            </div>
          </>
        )}
      </div>

      {/* Phones, after Asana iOS: filter and view as round buttons at the bottom (right, so the dev indicator keeps the left), each opening a bottom sheet */}
      <div className="fixed right-4 bottom-4 z-30 flex gap-2 md:hidden">
        <RoundButton label="Filters" count={activeCount(outlets.filter)} onClick={() => setSheet("filter")}>
          <ListFilter aria-hidden className="size-5" />
        </RoundButton>
        <RoundButton label="View options" onClick={() => setSheet("view")}>
          <SlidersHorizontal aria-hidden className="size-5" />
        </RoundButton>
      </div>
      <OutletFilterSheet scope={outlets} open={sheet === "filter"} onClose={() => setSheet(null)} presets={PRESETS} range={range} onRange={setRange} />
      <BottomSheet open={sheet === "view"} onClose={() => setSheet(null)} title="View">
        <div className="divide-y divide-(--color-border-default) px-4">
          <div className="py-3">
            <p className="mb-2 text-body-sm text-(--color-text-secondary)">Break down by</p>
            <ByToggle by={compare ? "outlet" : "channel"} onChange={(b) => setCompare(b === "outlet")} />
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-body-md text-(--color-text-primary)">Show figures as</span>
            <ViewToggle value={view} onChange={setView} />
          </div>
          {compare && (
            <button type="button" role="switch" aria-checked={allBroken} onClick={() => setBroken(allBroken ? new Set() : new Set(groups))} className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left outline-none focus-visible:bg-(--color-neutral-lightest)">
              <span>
                <span className="block text-body-md text-(--color-text-primary)">Platform breakdown</span>
                <span className="block text-body-sm text-(--color-text-tertiary)">DoorDash, Uber Eats and Grubhub for every outlet</span>
              </span>
              <span aria-hidden className={cn("relative h-6 w-10 shrink-0 rounded-circle transition-colors motion-reduce:transition-none", allBroken ? "bg-(--color-primary-solid)" : "bg-(--gray-600)")}>
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-circle bg-white shadow-sm transition-transform motion-reduce:transition-none", allBroken && "translate-x-4")} />
              </span>
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

/** A round icon button over the page, with a count badge when something's applied. */
function RoundButton({ label, count = 0, onClick, children }: { label: string; count?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={count ? `${label}: ${count} applied` : label}
      onClick={onClick}
      className={cn(
        "relative grid size-12 place-items-center rounded-circle border shadow-[0_4px_12px_rgb(0_0_0/0.14)] outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
        count ? "border-(--brand-700) bg-(--brand-300) text-(--color-text-clickable)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary)",
      )}
    >
      {children}
      {count > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-circle bg-(--color-primary-solid) px-1 text-[11px] font-medium text-white">{count}</span>}
    </button>
  );
}

/** The table's figures as dollars or as a share of sales: an icon-only segmented control at the bar's end. Desktop only, like the table. */
function ViewToggle({ value, onChange }: { value: PnlView; onChange: (v: PnlView) => void }) {
  return (
    <div role="group" aria-label="Show figures as" className="flex h-8 items-center gap-0.5 rounded-medium bg-(--color-neutral-light) p-0.5">
      {([["amount", DollarSign, "Show amounts ($)"], ["percent", Percent, "Show share of sales (%)"]] as const).map(([v, Icon, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={cn(
            "grid size-7 place-items-center rounded-small outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
            value === v ? "bg-(--color-background-secondary) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** Phones: By channel / By outlet, a segmented control in place of the Compare outlets chip. */
function ByToggle({ by, onChange }: { by: "channel" | "outlet"; onChange: (b: "channel" | "outlet") => void }) {
  return (
    <div role="group" aria-label="Break down by" className="flex h-8 min-w-0 flex-1 items-center gap-0.5 rounded-medium bg-(--color-neutral-light) p-0.5">
      {([["channel", "By channel"], ["outlet", "By outlet"]] as const).map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={by === v}
          onClick={() => onChange(v)}
          className={cn(
            "h-7 flex-1 rounded-small text-menu-sm outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
            by === v ? "bg-(--color-background-secondary) font-medium text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary)",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Platform breakdown (Figma 287:11686): the three apps' logos, the label and a switch, on a grey chip. Opens every
 *  outlet's DoorDash / Uber Eats / Grubhub columns at once; each outlet's own chevron opens just its. */
function BreakdownSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-8 items-center gap-2.5 rounded-large bg-(--color-neutral-lightest) px-3 text-body-md whitespace-nowrap text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
    >
      <span aria-hidden className="flex items-center gap-0.5">
        {["ubereats", "grubhub", "doordash"].map((s) => (
          <Image key={s} src={asset(`/dashboard/${s}.png`)} alt="" width={18} height={18} unoptimized className="size-[18px] rounded-[2px] object-cover" />
        ))}
      </span>
      Platform breakdown
      <span aria-hidden className={cn("relative h-4 w-7 rounded-circle transition-colors motion-reduce:transition-none", on ? "bg-(--color-primary-solid)" : "bg-(--gray-600)")}>
        <span className={cn("absolute top-0.5 left-0.5 size-3 rounded-circle bg-white shadow-sm transition-transform motion-reduce:transition-none", on && "translate-x-3")} />
      </span>
    </button>
  );
}

/** Compare outlets: the filters' chip shape with a switch inside it, so it sits with the bar's other controls and
 *  still flips. The wording stays at every width. Desktop only, like the table. */
function CompareSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-8 items-center gap-2 rounded-medium border pr-2 pl-2.5 text-menu-sm whitespace-nowrap outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
        on ? "border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-primary)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)",
      )}
    >
      <StoreIcon aria-hidden className="size-3.5" />
      Compare outlets
      <span aria-hidden className={cn("relative h-4 w-7 rounded-circle transition-colors motion-reduce:transition-none", on ? "bg-(--color-primary-solid)" : "bg-(--gray-600)")}>
        <span className={cn("absolute top-0.5 left-0.5 size-3 rounded-circle bg-white shadow-sm transition-transform motion-reduce:transition-none", on && "translate-x-3")} />
      </span>
    </button>
  );
}
