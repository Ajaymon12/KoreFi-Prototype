"use client";
import { NoOutlets, OutletCount, OutletFilters, type OutletScope } from "@/components/mvp2/OutletFilters";
import { Tray } from "@/components/mvp2/parts";

// What Masa Kitchen's two pinned dashboards share, built from the /mvp2 report parts: the outlet filter bar (Filter,
// Outlet), the no-outlets message and the table card.
//
// One scale for the chat and its dashboards: the answer's headline is text-subtitle-md medium (16px) in both; a block
// title is text-body-md medium (14px); body text is text-body-md; labels and lines under figures are text-body-sm.
// Every block is the same grey-tray card, tables included, and panels pad their content px-6 py-6.

/** The /mvp2 outlet filters, with the "N of M outlets" count on the right while filtered. */
export function FilterBar({ scope, children }: { scope: OutletScope; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <OutletFilters scope={scope} pills={["outlet"]} />
      {children}
      <span className="ml-auto flex items-center gap-2 text-body-sm text-(--color-text-tertiary) tabular-nums">
        <OutletCount scope={scope} />
      </span>
    </div>
  );
}
export { NoOutlets };

/** A table as a block: the tray card's title row, the table flush to the card's inner edges. */
export function TableCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Tray title={title} sub={sub}>
      <div className="-mx-5 -mb-4 [&>section]:mx-0 [&>section]:border-y-0">{children}</div>
    </Tray>
  );
}
