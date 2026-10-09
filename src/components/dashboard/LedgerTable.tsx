"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/Money";
import { CountTabs } from "@/components/ui/CountTabs";
import { FilterChip } from "@/components/ui/FilterChip";
import { DetailDrawer, DetailList, DrawerSection, Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { StatusBadge } from "./primitives";

// Mercury-style ledger: tabs with counts → filter chips → dense table → row opens a detail
// drawer. Used for Overview "Activity" and the Chargebacks list. Read-only by design: the drawer
// shows what happened and where it stands, never an action for the owner to take.

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export type LedgerRow = {
  id: string;
  date: string; // ISO date
  title: string;
  subtitle: string;
  logo: string;
  store: string;
  app: string;
  reason?: string;
  amount: number;
  /** Show +/− and green money in. Off for amounts that are only "at stake". */
  signed: boolean;
  status: { label: string; tone: Tone };
  /** Tab keys this row belongs to ("all" is implied). */
  tabs: string[];
  detail: {
    eyebrow: string;
    heading: string;
    timeline: TimelineStep[];
    facts: { label: string; value: string }[];
    note?: string;
    link?: { label: string; href: string };
  };
};

type FilterKey = "store" | "app" | "reason";
const FILTER_LABEL: Record<FilterKey, string> = { store: "Store", app: "App", reason: "Reason" };

const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function LedgerTable({
  rows,
  tabs,
  filters = [],
  pageSize = 8,
  label,
}: {
  rows: LedgerRow[];
  tabs: { key: string; label: string }[];
  filters?: FilterKey[];
  pageSize?: number;
  label: string;
}) {
  const [tab, setTab] = useState("all");
  const [picked, setPicked] = useState<Partial<Record<FilterKey, string | null>>>({});
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const inTab = (r: LedgerRow, k: string) => k === "all" || r.tabs.includes(k);
  const passes = (r: LedgerRow) => filters.every((f) => !picked[f] || r[f] === picked[f]);
  const filtered = useMemo(() => rows.filter((r) => inTab(r, tab) && passes(r)), [rows, tab, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = expanded ? filtered : filtered.slice(0, pageSize);
  const options = (f: FilterKey) => [...new Set(rows.map((r) => r[f]).filter(Boolean) as string[])].sort();
  const anyFilter = filters.some((f) => picked[f]);
  const open = rows.find((r) => r.id === openId) ?? null;
  // Previous / next within what the owner is currently looking at (tab + filters applied).
  const at = filtered.findIndex((r) => r.id === openId);
  const prev = at > 0 ? filtered[at - 1] : undefined;
  const next = at >= 0 && at < filtered.length - 1 ? filtered[at + 1] : undefined;

  return (
    <div>
      <CountTabs
        label={label}
        tabs={tabs.map((t) => ({ ...t, count: rows.filter((r) => inTab(r, t.key) && passes(r)).length }))}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setExpanded(false);
        }}
      />

      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {filters.map((f) => (
            <FilterChip key={f} label={FILTER_LABEL[f]} options={options(f)} value={picked[f] ?? null} onChange={(v) => setPicked((p) => ({ ...p, [f]: v }))} />
          ))}
          {anyFilter && (
            <button type="button" onClick={() => setPicked({})} className="h-8 px-2 text-menu-sm text-(--color-text-secondary) hover:text-(--color-text-primary)">
              Reset
            </button>
          )}
        </div>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-left text-body-sm text-(--color-text-secondary)">
              <th className="w-20 py-2.5 pr-3 font-normal">Date</th>
              <th className="py-2.5 pr-3 font-normal">Description</th>
              <th className="py-2.5 pr-3 font-normal">Store</th>
              <th className="py-2.5 pr-3 text-right font-normal">Amount</th>
              <th className="py-2.5 pr-3 font-normal">Status</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody className="text-body-md text-(--color-text-primary)">
            {shown.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className={cn("group h-14 cursor-pointer border-t border-(--color-border-default) transition-colors hover:bg-(--color-background-primary)", openId === r.id && "bg-(--color-background-primary)")}
              >
                <td className="pr-3 whitespace-nowrap text-(--color-text-secondary)">{day(r.date)}</td>
                <td className="pr-3">
                  {/* The real control: keyboard users tab to it and press Enter to open the row. */}
                  <button type="button" onClick={() => setOpenId(r.id)} className="flex min-w-0 items-center gap-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.logo} alt="" className="size-7 shrink-0 rounded-medium border border-(--color-border-default)" />
                    <span className="min-w-0">
                      <span className="block truncate">{r.title}</span>
                      <span className="block truncate text-body-sm text-(--color-text-secondary)">{r.subtitle}</span>
                    </span>
                  </button>
                </td>
                <td className="pr-3 whitespace-nowrap text-(--color-text-secondary)">{r.store}</td>
                <td className="pr-3 text-right">
                  <Money value={r.amount} signed={r.signed} tone={r.signed ? "auto" : "muted"} />
                </td>
                <td className="pr-3">
                  <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                </td>
                <td>
                  <ChevronRight aria-hidden className="size-4 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="border-t border-(--color-border-default) py-10 text-center text-body-md text-(--color-text-secondary)">Nothing matches these filters.</p>}
      </div>

      <div className="flex items-center justify-between border-t border-(--color-border-default) pt-3 text-body-sm text-(--color-text-secondary)">
        <span>
          {shown.length} of {filtered.length}
        </span>
        {filtered.length > pageSize && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-menu-sm text-(--color-text-primary) hover:underline">
            {expanded ? "Show fewer" : `Show all ${filtered.length}`}
          </button>
        )}
      </div>

      <DetailDrawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        eyebrow={open?.detail.eyebrow}
        title={open?.detail.heading}
        meta={open ? `${longDay(open.date)} · ${open.store}` : undefined}
        onPrev={prev ? () => setOpenId(prev.id) : undefined}
        onNext={next ? () => setOpenId(next.id) : undefined}
        footer={
          open?.detail.link && (
            <Link href={open.detail.link.href} className="group flex items-center gap-1 text-body-md text-(--color-text-clickable) hover:underline">
              {open.detail.link.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        }
      >
        {open && (
          <>
            <div>
              <div className="flex items-center gap-2.5">
                <Money value={open.amount} signed={open.signed} tone={open.signed ? "auto" : "default"} className="text-jumbo-sm" />
                <StatusBadge tone={open.status.tone}>{open.status.label}</StatusBadge>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={open.logo} alt="" className="size-4 rounded-small" />
                {open.subtitle}
              </p>
            </div>
            <DrawerSection>
              <Timeline steps={open.detail.timeline} />
            </DrawerSection>
            <DetailList title="Details" rows={[{ label: "Date", value: longDay(open.date) }, ...open.detail.facts]} />
            {open.detail.note && (
              <DrawerSection title="Notes">
                <p className="px-4 text-body-md text-(--color-text-primary)">{open.detail.note}</p>
              </DrawerSection>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
