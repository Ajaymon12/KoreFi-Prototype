"use client";
import { useState } from "react";
import { Segmented, usd } from "@/components/finance/parts";
import { CHANNELS, WEEKS, pct0, pctOf, short } from "@/components/finance/PnlStory";
import { reportWeek, type ChannelKey } from "@/lib/finance/reports";
import { outletOf, type Store } from "@/lib/finance/outlets";
import { cn } from "@/lib/utils";
import { Delta, Key, Section } from "./parts";

// MVP 2 / Overview / Revenue by outlet. Two views of one question, side by side:
//   mosaic   each outlet is a column as wide as its share of revenue, split top to bottom by channel
//            (the 3PD apps above, Non-3PD below), so size and mix read in one shape
//   ranking  the outlets in order for the chosen view, with change vs the period before and a weekly line
// Revenue | 3PD | Non-3PD picks the part: the mosaic keeps its shape and fades the rest, so the part is
// always seen against the whole; the ranking re-sorts and its figures follow.
// Many outlets (Taco Pros has 34): the mosaic groups them by city or state (Group by, City by default past 8
// outlets) and draws the largest 7 columns plus "n more"; the ranking shows the top 8 until "Show all".

type View = "sales" | "apps" | "instore";
// Apps on top, in store at the base.
const ORDER: ChannelKey[] = ["doordash", "uber", "grubhub", "instore"];
const CH = Object.fromEntries(CHANNELS.map((c) => [c.key, c])) as Record<ChannelKey, (typeof CHANNELS)[number]>;
const inView = (v: View, k: ChannelKey) => v === "sales" || (v === "apps" ? k !== "instore" : k === "instore");
const NAME: Record<View, string> = { sales: "Revenue", apps: "3PD revenue", instore: "Non-3PD revenue" };

type Group = "outlet" | "city" | "state";
/** A mosaic column: one outlet, a city's or state's outlets, or the rest together. */
type Column = { key: string; name: string; title: string; by: Record<ChannelKey, number>; total: number };
const MOSAIC = 8;
const RANKED = 8;
const sumBy = (list: Record<ChannelKey, number>[]) => Object.fromEntries(ORDER.map((k) => [k, list.reduce((n, b) => n + b[k], 0)])) as Record<ChannelKey, number>;

type Outlet = { store: Store; by: Record<ChannelKey, number>; total: number; prev: Record<ChannelKey, number> | null; weekly: Record<ChannelKey, number>[] };

function channelSums(store: Store, from: number, to: number) {
  const by = { instore: 0, doordash: 0, uber: 0, grubhub: 0 } as Record<ChannelKey, number>;
  const weekly: Record<ChannelKey, number>[] = [];
  for (let i = from; i <= to; i++) {
    const r = reportWeek(store, WEEKS[i].year, WEEKS[i].w);
    const w = {} as Record<ChannelKey, number>;
    for (const k of ORDER) {
      w[k] = r[k].sales;
      by[k] += r[k].sales;
    }
    weekly.push(w);
  }
  return { by, weekly };
}

/** A weekly line, scaled to its own range; the last point marked. */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span className="w-20" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 76 + 2, 20 - ((v - lo) / (hi - lo || 1)) * 16]);
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20 shrink-0" aria-hidden>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.2} fill={color} />
    </svg>
  );
}

export function OutletMix({ stores, range, prev }: { stores: readonly Store[]; range: [number, number]; prev: [number, number] | null }) {
  const [view, setView] = useState<View>("sales");
  const [hover, setHover] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [showAll, setShowAll] = useState(false);
  const outlets: Outlet[] = stores.map((s) => {
    const { by, weekly } = channelSums(s, range[0], range[1]);
    return { store: s, by, weekly, total: ORDER.reduce((n, k) => n + by[k], 0), prev: prev ? channelSums(s, prev[0], prev[1]).by : null };
  });
  const part = (by: Record<ChannelKey, number>) => ORDER.filter((k) => inView(view, k)).reduce((n, k) => n + by[k], 0);
  const grand = outlets.reduce((n, o) => n + o.total, 0);
  const grandPart = outlets.reduce((n, o) => n + part(o.by), 0);
  // The mosaic keeps revenue order; the ranking sorts by the view.
  // Grouped by city past MOSAIC outlets (when they're in more than one) unless picked; the largest columns, then the rest as one.
  const cities = new Set(outlets.map((o) => outletOf(o.store).city)).size;
  const by = group ?? (outlets.length > MOSAIC && cities > 1 ? "city" : "outlet");
  const keyOf = (o: Outlet) => (by === "outlet" ? o.store : by === "city" ? `${outletOf(o.store).city}, ${outletOf(o.store).state}` : outletOf(o.store).state);
  const groups = new Map<string, Outlet[]>();
  for (const o of outlets) groups.set(keyOf(o), [...(groups.get(keyOf(o)) ?? []), o]);
  const columns: Column[] = [...groups].map(([key, list]) => {
    const sums = sumBy(list.map((o) => o.by));
    const name = by === "outlet" ? short(list[0].store) : by === "city" ? outletOf(list[0].store).city : key;
    return { key, name, title: by === "outlet" ? key : `${key} · ${list.length} ${list.length === 1 ? "outlet" : "outlets"}`, by: sums, total: ORDER.reduce((n, k) => n + sums[k], 0) };
  });
  columns.sort((a, b) => b.total - a.total);
  const unit = by === "outlet" ? "outlets" : by === "city" ? "cities" : "states";
  const bySize =
    columns.length > MOSAIC
      ? [
          ...columns.slice(0, MOSAIC - 1),
          (() => {
            const rest = columns.slice(MOSAIC - 1);
            const sums = sumBy(rest.map((c) => c.by));
            return { key: "rest", name: `${rest.length} more ${unit}`, title: rest.map((c) => c.name).join(", "), by: sums, total: ORDER.reduce((n, k) => n + sums[k], 0) };
          })(),
        ]
      : columns;
  const ranked = [...outlets].sort((a, b) => part(b.by) - part(a.by));
  const viewColor = view === "instore" ? CH.instore.color : view === "apps" ? "var(--chart-series)" : "var(--color-text-primary)";
  const legend = ORDER.map((k) => ({ k, v: outlets.reduce((n, o) => n + o.by[k], 0) }));

  return (
    <Section
      title="Revenue by outlet"
      sub={view === "sales" ? `Each outlet's size and channel mix · ${usd(grand)} in all` : `${NAME[view]} · ${usd(grandPart)}, ${pct0(pctOf(grandPart, grand))} of all revenue`}
      actions={
        <>
        {outlets.length > 1 && (
          <Segmented<Group>
            label="Group by"
            value={by}
            onChange={setGroup}
            options={[
              { key: "outlet", label: "Outlet" },
              { key: "city", label: "City" },
              { key: "state", label: "State" },
            ]}
          />
        )}
        <Segmented<View>
          label="Show revenue"
          value={view}
          onChange={setView}
          options={[
            { key: "sales", label: "Revenue" },
            { key: "apps", label: "3PD" },
            { key: "instore", label: "Non-3PD" },
          ]}
        />
        </>
      }
    >
      <div className="grid border-t border-(--color-border-default) xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Mosaic */}
        <div className="min-w-0 px-5 py-4">
          <div className="flex gap-1.5">
            {bySize.map((o) => {
              const p = part(o.by);
              return (
                <div key={o.key} className="flex min-w-0 flex-col" style={{ width: `${Math.max(100 / (bySize.length * 1.6), pctOf(o.total, grand) * 100)}%` }}>
                  <div className="mb-2 min-w-0">
                    <p className="truncate text-body-sm text-(--color-text-secondary)" title={o.title}>
                      {o.name}
                    </p>
                    <p className="truncate text-body-md font-medium text-(--color-text-primary) tabular-nums">
                      {usd(p)}
                      <span className="ml-1.5 text-body-sm font-normal text-(--color-text-tertiary)">{view === "sales" ? pct0(pctOf(o.total, grand)) : `${pct0(pctOf(p, o.total))} of outlet`}</span>
                    </p>
                  </div>
                  <div className="flex h-64 flex-col gap-px overflow-hidden rounded-medium" role="img" aria-label={`${o.title}: ${ORDER.map((k) => `${CH[k].label} ${usd(o.by[k])}`).join(", ")}`}>
                    {ORDER.map((k) => {
                      const share = pctOf(o.by[k], o.total);
                      const on = inView(view, k);
                      const id = `${o.key}|${k}`;
                      return (
                        <div
                          key={k}
                          onMouseEnter={() => setHover(id)}
                          onMouseLeave={() => setHover(null)}
                          title={`${o.name} · ${CH[k].label}: ${usd(o.by[k])} (${pct0(share)} of the outlet)`}
                          className={cn("relative min-h-0 transition-opacity duration-200", !on && "opacity-15", hover && hover !== id && on && "opacity-70")}
                          style={{ flexGrow: o.by[k], flexBasis: 0, background: CH[k].color }}
                        >
                          {/* The share inside the block when it's tall enough to hold it */}
                          {share >= 0.08 && on && (
                            <span className="absolute top-1.5 left-2 text-[11px] font-medium text-white/90 tabular-nums">
                              {pct0(share)}
                              {share >= 0.14 && <span className="block font-normal text-white/75">{k === "instore" ? "Non-3PD" : CH[k].label}</span>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {legend.map(({ k, v }) => (
              <span key={k} className={cn("transition-opacity", !inView(view, k) && "opacity-40")}>
                <Key color={CH[k].color}>
                  {k === "instore" ? "Non-3PD · in store & web" : CH[k].label} <span className="text-(--color-text-tertiary) tabular-nums">{pct0(pctOf(v, grand))}</span>
                </Key>
              </span>
            ))}
            <span className="ml-auto text-body-sm text-(--color-text-tertiary)">Width = share of revenue · height = channel mix</span>
          </div>
        </div>

        {/* Ranking */}
        <div className="min-w-0 border-t border-(--color-border-default) xl:border-t-0 xl:border-l">
          <p className="flex items-center justify-between px-5 pt-4 pb-2 text-body-sm text-(--color-text-secondary)">
            <span>
              {outlets.length} {outlets.length === 1 ? "outlet" : "outlets"} ranked by {view === "sales" ? "revenue" : NAME[view]}
            </span>
            <span>{range[1] - range[0] + 1} weeks</span>
          </p>
          <ol>
            {(showAll ? ranked : ranked.slice(0, RANKED)).map((o, i) => {
              const p = part(o.by);
              const before = o.prev ? part(o.prev) : undefined;
              return (
                <li key={o.store} className="flex items-center gap-3 border-t border-(--gray-300) px-5 py-3 first:border-t-0">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-circle text-body-sm tabular-nums", i === 0 ? "bg-(--color-text-primary) text-(--color-background-secondary)" : "bg-(--gray-200) text-(--color-text-secondary)")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md text-(--color-text-primary)" title={o.store}>
                      {short(o.store)}
                    </p>
                    <p className="truncate text-body-sm text-(--color-text-tertiary) tabular-nums">
                      {outletOf(o.store).city}, {outletOf(o.store).state} · {pct0(pctOf(o.total - o.by.instore, o.total))} 3PD
                    </p>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-circle bg-(--gray-200)">
                      <span className="block h-full rounded-circle transition-[width] duration-300" style={{ width: `${pctOf(p, Math.max(...ranked.map((r) => part(r.by))))* 100}%`, background: viewColor }} />
                    </span>
                  </div>
                  <Spark values={o.weekly.map((w) => part(w))} color={viewColor} />
                  <div className="w-24 shrink-0 text-right">
                    <p className="text-body-md font-medium text-(--color-text-primary) tabular-nums">{usd(p)}</p>
                    <Delta now={p} before={before} />
                  </div>
                </li>
              );
            })}
          </ol>
          {ranked.length > RANKED && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full border-t border-(--gray-300) px-5 py-3 text-left text-body-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus-primary)">
              {showAll ? "Show top 8" : `Show all ${ranked.length} outlets`}
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}
