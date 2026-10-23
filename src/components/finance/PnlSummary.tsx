"use client";
import { useRef, useState } from "react";
import { DollarSign, Percent, Search, Store as StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { NoOutlets, OutletCount, OutletFilters, useOutletFilter } from "@/components/mvp2/OutletFilters";
import type { ChannelKey } from "@/lib/finance/reports";
import { MobileChannel, PRESETS, WEEKS, PnlCards, usePnl } from "./PnlStory";
import { PnlTable, type PnlView } from "./PnlTable";
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
  const [mobileChannel, setMobileChannel] = useState<ChannelKey | "all">("all");
  const [compare, setCompare] = useState(false);
  const [view, setView] = useState<PnlView>("amount");
  // Which way the box has scrolled, for the table's shadows: sideways at all, or down past the table's top.
  const [scrolled, setScrolled] = useState({ x: false, y: false });
  const table = useRef<HTMLElement>(null);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const x = e.currentTarget.scrollLeft > 0;
    const y = e.currentTarget.scrollTop > (table.current?.offsetTop ?? 0);
    if (x !== scrolled.x || y !== scrolled.y) setScrolled({ x, y });
  };
  const pnl = usePnl(outlets.filtered ? outlets.stores : null, range);
  const { t, recon, edit, typical, reset } = pnl;
  const none = outlets.stores.length === 0;

  return (
    <>
      <PageHeader title="P&L Summary" />
      {/* One scroll box for both axes, so the table's header rows can stick to its top. contain-paint keeps a
          wide table's overflow inside it; without it the page took the width too and scrolled away sideways. */}
      <div onScroll={onScroll} className="min-h-0 flex-1 overflow-auto contain-paint">
        {/* Search (the table's lines) and the filters (everything below); pinned left, like everything above the table, so a wide table scrolls under them */}
        {/* z-[4]: sticky makes the bar its own layer, so without it the table's pinned header (z-[3]) covers its menus */}
        <div className="sticky left-0 z-[4] flex flex-wrap items-center gap-2 px-4 pt-3">
          <label className="hidden h-8 w-[260px] max-w-full items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 focus-within:border-(--color-focus-primary) md:flex">
            <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." aria-label="Search lines" className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)" />
          </label>
          <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-(--color-border-default) md:block" />
          <OutletFilters scope={outlets} />
          <DateRangeFilter weeks={WEEKS} presets={PRESETS} value={range} onChange={setRange} />
          {/* How the table reads, pinned to the bar's end so the bar stays one line: icons alone until the window
              is wide enough for the labels and the outlet count */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="mr-2 hidden 2xl:block">
              <OutletCount scope={outlets} />
            </span>
            <CompareSwitch on={compare} onChange={setCompare} />
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
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
              <PnlTable t={t} recon={recon} edit={edit} query={query} sticky outlets={compare ? pnl.byOutlet() : undefined} scrolled={scrolled} view={view} />
            </section>

            <div className="p-4 md:hidden">
              <MobileChannel t={t} value={mobileChannel} onChange={setMobileChannel} edit={edit} typical={typical} reset={reset} />
            </div>
          </>
        )}
      </div>
    </>
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
