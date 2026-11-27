"use client";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/finance/parts";
import { AppName } from "@/components/ui/ReportTable";
import { usd } from "@/lib/mvp3/runs";
import { APP_KEYS, before, net, totalOf, type AppFig, type HomeApp, type OutletFig } from "@/lib/mvp3/home";

// The page structure Home set (Figma "Korefi – Agents" › Home · scenarios), shared by Home and the dashboards a chat
// opens (Payouts, Chargebacks), so they read as one product:
//  - a tab row with the page's controls at its right end (period, $ / %, filters), one hairline under it;
//  - figures as a row of tiles in one bordered card, split by hairlines;
//  - sections: a 14px title row inset 12px, then a bordered white card (tables flush to its edges);
//  - 40px between sections.

export const inset = "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus-primary)";
export const card = "rounded-large border border-(--color-border-default) bg-(--color-background-secondary)";

/** The page's tabs, with its controls at the right end of the same row. Panels use id `${id}-${value}`. */
export function PageTabs<T extends string>({ id, tabs, value, onChange, trailing }: { id: string; tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void; trailing?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--color-border-default)">
      {/* The selected tab's underline in the brand orange (Figma). */}
      <div className="min-w-0 flex-1 [--color-accent:var(--color-primary)]">
        <TabList role="tablist" value={value} onChange={(v) => onChange(v as T)}>
          {tabs.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} panelId={`${id}-${t.value}`} />
          ))}
        </TabList>
      </div>
      {trailing && <div className="flex flex-wrap items-center gap-2 pb-1">{trailing}</div>}
    </div>
  );
}

export type Unit = "usd" | "pct";
/** $ or %: a table's figures as money, or as a share of each column's sales. */
export function ShowAs({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <Segmented<Unit>
      label="Show as"
      value={value}
      onChange={onChange}
      options={[
        { key: "usd", label: "$" },
        { key: "pct", label: "%" },
      ]}
    />
  );
}

/** One home section: a title row (inset to line up with the content), then the content. */
export function Section({ id, title, aside, children, className, sectionRef }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string; sectionRef?: React.Ref<HTMLElement> }) {
  return (
    <section ref={sectionRef} aria-labelledby={`${id}-h`} className={cn("scroll-mt-4 space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-0.5">
        <h2 id={`${id}-h`} className="text-body-md font-medium text-(--color-text-primary)">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** An empty panel: what's missing and when it will show. */
export function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className={cn(card, "px-5 py-6")}>
      <p className="text-body-md font-medium text-(--color-text-primary)">{title}</p>
      <p className="mt-0.5 text-body-md text-(--color-text-secondary)">{text}</p>
    </div>
  );
}

/** A tile: label, the figure, one line under it. `onOpen` makes it a button whose hint (`hint`) shows on hover. */
export type Stat = { label: string; value: string; sub: React.ReactNode; tone?: "success" | "danger"; onOpen?: () => void; hint?: string };

/** Figures in one bordered card, split by hairlines. `caption`: a line above them (what they're totals of). */
export function StatTiles({ stats, caption }: { stats: Stat[]; caption?: React.ReactNode }) {
  const cols = stats.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={cn(card, "overflow-hidden")}>
      {caption && <p className="border-b border-(--color-border-default) px-5 py-2.5 text-body-sm text-(--color-text-secondary)">{caption}</p>}
      <div className={cn("grid gap-px bg-(--color-border-default)", cols)}>
        {stats.map((s) =>
          s.onOpen ? (
            <button key={s.label} type="button" onClick={s.onOpen} className={cn("group relative flex flex-col gap-1.5 bg-(--color-background-secondary) p-5 text-left transition-colors hover:bg-(--color-neutral-lightest)", inset)}>
              <StatBody s={s} />
              {/* Out of the flow, so the label keeps its full width until hover; it covers the label's end when they meet. */}
              <span className="absolute top-5 right-5 inline-flex items-center gap-0.5 bg-(--color-neutral-lightest) pl-2 text-body-sm text-(--color-text-clickable) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {s.hint ?? "Breakdown"} <ChevronRight aria-hidden className="size-3.5" />
              </span>
            </button>
          ) : (
            <div key={s.label} className="flex flex-col gap-1.5 bg-(--color-background-secondary) p-5">
              <StatBody s={s} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function StatBody({ s }: { s: Stat }) {
  const tone = s.tone === "success" ? "text-(--color-text-success)" : s.tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)";
  return (
    <>
      <span className="truncate text-body-sm text-(--color-text-secondary)">{s.label}</span>
      <span className={cn("block text-jumbo-sm tabular-nums", tone)}>{s.value}</span>
      <span className="block text-body-sm text-(--color-text-secondary)">{s.sub}</span>
    </>
  );
}

// ───────── Revenue & payout ─────────

export const APP_SOURCE: Record<HomeApp, { source: string; name: string }> = { doordash: { source: "doordash", name: "DoorDash" }, uber: { source: "ubereats", name: "Uber Eats" }, grubhub: { source: "grubhub", name: "Grubhub" } };

/** A row of the Revenue & payout table: its figure, and whether it's taken off (−) or given back (+). */
type Line = { label: string; get: (f: AppFig) => number; sign?: -1 | 1; subtotal?: boolean; strong?: boolean; count?: boolean; success?: boolean };
const LINES: Line[] = [
  { label: "Gross sales", get: (f) => f.sales },
  { label: "Commission", get: (f) => f.commission, sign: -1 },
  { label: "Marketing (ads)", get: (f) => f.ads, sign: -1 },
  { label: "Promos", get: (f) => f.promos, sign: -1 },
  { label: "Payout before errors", get: before, subtotal: true },
  { label: "Errors (chargebacks)", get: (f) => f.errors, sign: -1 },
  { label: "Won back", get: (f) => f.won, sign: 1, success: true },
  { label: "Net payout", get: net, subtotal: true, strong: true },
  { label: "Orders", get: (f) => f.orders, count: true },
];

function cell(line: Line, f: AppFig, unit: Unit) {
  const v = line.get(f);
  if (line.count) return Math.round(v).toLocaleString("en-US");
  const sign = v && line.sign ? (line.sign < 0 ? "−" : "+") : "";
  return unit === "pct" ? `${sign}${((Math.abs(v) / (f.sales || 1)) * 100).toFixed(1)}%` : `${sign}${usd(Math.abs(v))}`;
}

/** Each app's sales down to what it paid, with a Total column. `highlight`: an app the chat asked about. */
export function PayoutTable({ figs, unit, highlight }: { figs: Record<HomeApp, AppFig>; unit: Unit; highlight?: HomeApp }) {
  const cols: { key: string; head: React.ReactNode; f: AppFig }[] = [
    ...APP_KEYS.map((k) => ({ key: k, head: <AppName {...APP_SOURCE[k]} />, f: figs[k] })),
    { key: "total", head: "Total", f: totalOf(figs) },
  ];
  return (
    <div className={cn(card, "overflow-x-auto")}>
      <table className="w-full min-w-[640px] border-collapse text-body-md tabular-nums">
        <thead>
          <tr className="border-b border-(--color-border-default)">
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Line</span>
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className={cn("w-[17%] border-l border-(--color-border-default) px-3 py-2 text-right font-medium", c.key === highlight ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
                <span className="inline-flex justify-end">{c.head}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map((l) => (
            <tr key={l.label} className={cn("border-b border-(--color-border-default) last:border-b-0", l.subtotal && "bg-(--color-neutral-lightest)")}>
              <th scope="row" className={cn("px-3 py-2 text-left text-(--color-text-primary)", l.strong ? "font-medium" : "font-normal")}>
                {l.label}
              </th>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "border-l border-(--color-border-default) px-3 py-2 text-right",
                    l.strong && "font-medium",
                    l.success ? "bg-(--color-success-lightest) text-(--color-success-darkest)" : c.key === highlight ? "bg-(--brand-200) text-(--color-text-primary)" : "text-(--color-text-primary)",
                  )}
                >
                  {cell(l, c.f, unit)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────── By outlet ─────────

export const OUTLETS_SHOWN = 7;

/** The chart's legend: 3PD in brand orange, the rest in grey. */
export function OutletKey({ total }: { total: number }) {
  return (
    <span className="flex items-center gap-4 text-body-sm text-(--color-text-secondary)">
      {total > OUTLETS_SHOWN && <span>Top {OUTLETS_SHOWN} by sales</span>}
      <Key className="bg-(--color-primary)" label="3PD" />
      <Key className="bg-(--gray-800)" label="Non-3PD" />
    </span>
  );
}
const Key = ({ className, label }: { className: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span aria-hidden className={cn("size-2.5 rounded-circle", className)} />
    {label}
  </span>
);

/** The top of the scale, rounded up to a tidy step so the axis reads $0 / half / top. */
function niceTop(max: number) {
  const half = max / 2 || 1;
  const p = 10 ** Math.floor(Math.log10(half));
  const step = [1, 1.5, 2, 2.5, 3, 5, 10].map((m) => m * p).find((s) => s >= half)!;
  return step * 2;
}
const compact = (n: number) => (n >= 1000 ? `$${+(n / 1000).toFixed(1)}K` : `$${n}`);

/** Sales per outlet as stacked bars: the apps at the bottom, in store and website on top. In % each bar is the outlet's mix. */
export function OutletBars({ rows, unit }: { rows: OutletFig[]; unit: Unit }) {
  const pct = unit === "pct";
  const top = pct ? 1 : niceTop(Math.max(...rows.map((r) => r.apps + r.instore), 0));
  const ticks = pct ? ["100%", "50%", "0%"] : [compact(top), compact(top / 2), "$0"];
  const H = 200;
  const label = rows.map((r) => `${r.name}: ${usd(r.apps)} 3PD, ${usd(r.instore)} Non-3PD`).join("; ");
  return (
    <div className={cn(card, "overflow-x-auto px-2 pt-6 pb-1")}>
      <div role="img" aria-label={`Sales by outlet. ${label}`} className="flex min-w-[520px]">
        <div aria-hidden className="relative w-12 shrink-0 text-body-sm text-(--color-text-secondary)" style={{ height: H }}>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-2 -translate-y-1/2 tabular-nums" style={{ top: (i * H) / 2 }}>
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 pr-4">
          <div className="relative" style={{ height: H }}>
            {[0, 1, 2].map((i) => (
              <span key={i} aria-hidden className="absolute inset-x-0 h-px bg-(--color-border-default)" style={{ top: (i * H) / 2 }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {rows.map((r) => {
                const total = r.apps + r.instore || 1;
                const apps = pct ? r.apps / total : r.apps / top;
                const instore = pct ? r.instore / total : r.instore / top;
                return (
                  <div key={r.name} className="flex flex-1 justify-center" title={`${r.name}: ${usd(r.apps)} 3PD (${Math.round((r.apps / total) * 100)}%), ${usd(r.instore)} Non-3PD`}>
                    <div className="flex w-8 flex-col">
                      <span className="rounded-t-[4px] bg-(--gray-800)" style={{ height: instore * H }} />
                      <span className="bg-(--color-primary)" style={{ height: apps * H }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div aria-hidden className="flex pt-2 pb-1">
            {rows.map((r) => (
              <span key={r.name} className="flex-1 truncate px-1 text-center text-body-sm text-(--color-text-secondary)">
                {r.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
