"use client";
import { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Sparkles, SquareMousePointer } from "lucide-react";
import { cn } from "@/lib/utils";
import * as FX from "@/lib/mvp3/masaFixture";
import { versusUsual } from "@/lib/mvp3/outletDive";
import type { WidgetId } from "@/lib/mvp3/dashboards";
import { focusRing } from "@/components/mvp3/styles";

// Masa Kitchen's Chargebacks Overview, laid out like Figma "Korefi – Agents" › Pinned dashboard (P1): three KPI cards
// (cost / where / won back) → biggest problems → chargebacks by outlet (table) → what went wrong (one reason at a time,
// bars per outlet) → one outlet at a time → by app. Every figure is counted from masaFixture (FX_OUTLETS and CHARGES),
// so it follows the outlet filter and matches the weekly email. Orange is kept for "the worst one"; red = over the
// limit, green = won back. Each card's "Edit in chat" points the card at the dashboard's chat.

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Cents only when there are some: $37.50, $21. */
const money = (n: number) => (Number.isInteger(n) ? usd(n) : FX.usd2(n));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const and = (xs: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(xs);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const over = (x: FX.FxOutlet) => FX.rate(x) > FX.LIMIT;
const fullName = (x: FX.FxOutlet) => x.store.split(" – ").pop() ?? x.name;
const chargesAt = (names: readonly string[]) => FX.CHARGES.filter((c) => names.includes(c.outlet));
const sum = (xs: FX.FxCharge[]) => xs.reduce((n, c) => n + c.amount, 0);

/** "Edit in chat" on a card: `on` while that card is the one pointed at. */
export type EditCard = { pointed?: string | null; onEdit?: (title: string, widget: WidgetId) => void };

// ───────── Shared parts ─────────

const sm = "text-body-sm";
const soft = "text-(--color-text-primary)/75";
const cardCls = "relative overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)";

function EditInChat({ title, widget, pointed, onEdit }: EditCard & { title: string; widget: WidgetId }) {
  if (!onEdit) return null;
  const on = pointed === title;
  return (
    <button
      type="button"
      onClick={() => onEdit(title, widget)}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from the chat` : `Edit ${title} in chat`}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-medium px-2 text-body-sm transition-colors",
        on ? "bg-(--color-primary)/10 text-(--color-text-clickable)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary)",
        focusRing,
      )}
    >
      <SquareMousePointer className="size-3.5" aria-hidden />
      {on ? "In chat" : "Edit in chat"}
    </button>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} role="img" className="inline-grid text-(--color-text-tertiary)">
      <Info className="size-[13px]" aria-hidden />
    </span>
  );
}

function CardHeader({ title, info, action, widget, edit }: { title: string; info?: string; action?: React.ReactNode; widget: WidgetId; edit: EditCard }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-(--color-border-default) px-5 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <h3 className="truncate text-body-md font-medium text-(--color-text-primary)">{title}</h3>
        {info && <InfoTip text={info} />}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {action && <span className={cn(sm, "inline-flex items-center gap-1.5 text-(--color-text-secondary)")}>{action}</span>}
        <EditInChat title={title} widget={widget} {...edit} />
      </div>
    </div>
  );
}

/** Small label → 16px answer → line under it. */
function Answer({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <p className={cn(sm, "text-(--color-text-secondary)")}>{label}</p>
      <p className="text-subtitle-md leading-normal font-medium text-(--color-text-primary)">{value}</p>
      {sub && <p className={cn(sm, "text-(--color-text-secondary)")}>{sub}</p>}
    </div>
  );
}

type SegOption = { value: string; label: string; disabled?: boolean; title?: string };
/** Grey track, the picked option on a white chip. `stretch` spreads the options across the row. */
function Segmented({ options, value, onChange, label, stretch, className }: { options: SegOption[]; value: string; onChange: (v: string) => void; label: string; stretch?: boolean; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex items-center gap-0.5 rounded-medium p-0.5", stretch ? "bg-(--gray-200)" : "border border-(--color-border-default) bg-(--gray-300)", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-small border px-2.5 text-[13px] leading-[1.3] whitespace-nowrap",
              stretch ? "h-8 min-w-0 flex-1" : "h-7 shrink-0",
              on ? "border-(--color-border-default) bg-(--color-background-secondary) font-medium text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-(--color-text-secondary)",
              focusRing,
            )}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Column bars: the biggest in orange, the rest light orange, a zero as a flat grey line. */
function Bars({ items, label }: { items: { label: string; n: number }[]; label: string }) {
  const max = Math.max(...items.map((b) => b.n), 0);
  return (
    <div role="img" aria-label={`${label}: ${items.map((b) => `${b.label} ${b.n}`).join(", ")}`} className={cn("flex items-end", items.length > 8 ? "gap-1" : "gap-2")}>
      {items.map((b) => {
        const top = max > 0 && b.n === max;
        return (
          <div key={b.label} className={cn(items.length > 8 ? "text-[11px] leading-[1.3]" : sm, "flex h-36 min-w-0 flex-1 flex-col items-center justify-end gap-1.5")}>
            <span className={top ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)"}>{b.n || ""}</span>
            <span
              aria-hidden
              className={cn("w-full max-w-10 rounded-t-[8px]", top ? "bg-(--color-primary)" : b.n ? "bg-(--brand-600)" : "bg-(--gray-300)")}
              style={{ height: b.n ? 20 + (b.n / max) * 68 : 2 }}
            />
            <span className={cn("max-w-full truncate", top ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)")}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The grey-headed table the Figma cards use: column rules, numbers right-aligned. */
type Col<T> = { key: string; header: string; cell: (r: T) => React.ReactNode; first?: boolean };
function DataTable<T>({ cols, rows, rowKey, total, onRow, label }: { cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; total?: React.ReactNode[]; onRow?: (r: T) => void; label: string }) {
  const cell = (i: number, n: number) =>
    cn("flex h-full min-w-0 items-center gap-1.5 border-b border-(--gray-400) tabular-nums", i < n - 1 && "border-r", i === 0 ? "pr-3 pl-5" : i === n - 1 ? "justify-end pr-5 pl-3" : "justify-end px-3");
  const grid = { gridTemplateColumns: `minmax(0,1.6fr) repeat(${cols.length - 1}, minmax(0,1fr))` };
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={label} className="min-w-[520px]">
        <div role="row" className="grid h-9 bg-(--gray-200)" style={grid}>
          {cols.map((c, i) => (
            <span key={c.key} role="columnheader" className={cn(cell(i, cols.length), sm, "font-medium text-(--color-text-secondary)")}>
              {c.header}
            </span>
          ))}
        </div>
        {rows.map((r) => {
          const inner = cols.map((c, i) => (
            <span key={c.key} role="cell" className={cn(cell(i, cols.length), "text-[13px] leading-[1.3] text-(--color-text-primary)")}>
              {c.cell(r)}
            </span>
          ));
          return onRow ? (
            <button key={rowKey(r)} type="button" role="row" onClick={() => onRow(r)} className={cn("grid h-10 w-full text-left hover:bg-(--gray-200)", focusRing)} style={grid}>
              {inner}
            </button>
          ) : (
            <div key={rowKey(r)} role="row" className="grid h-10" style={grid}>
              {inner}
            </div>
          );
        })}
        {total && (
          <div role="row" className="grid h-10 bg-(--gray-200)" style={grid}>
            {total.map((t, i) => (
              <span key={i} role="cell" className={cn(cell(i, total.length), "border-b-0 text-[13px] leading-[1.3] font-medium text-(--color-text-primary)")}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── 1. Headline cards ─────────

const kpiCard = cn(cardCls, "flex min-h-[265px] flex-col px-5 pt-4 pb-3.5");

function KpiHeader({ title, info }: { title: string; info?: string }) {
  return (
    <div className="flex min-h-7 items-center gap-1.5">
      <p className={cn("text-[13px] leading-[1.3] font-medium", soft)}>{title}</p>
      {info && <InfoTip text={info} />}
    </div>
  );
}
function KpiValue({ value, chip, tone }: { value: string; chip?: string; tone?: "danger" | "success" }) {
  return (
    <div className="flex items-center gap-2.5 pt-2">
      <p className={cn("text-[26px] leading-none tracking-[-0.03em] tabular-nums", tone === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{value}</p>
      {chip && (
        <span className={cn("rounded-small px-1.5 py-0.5 text-[11px] leading-[1.3] font-medium tracking-[0.02em]", tone === "success" ? "bg-(--color-success-lightest) text-(--color-text-success)" : "bg-(--color-danger-lightest) text-(--color-text-danger)")}>
          {chip}
        </span>
      )}
    </div>
  );
}
function KpiFooter({ left, right }: { left: string; right: string }) {
  return (
    <div className="pt-4">
      <div className={cn(sm, "flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-(--color-border-default) pt-3")}>
        <span className="text-(--color-text-secondary)">{left}</span>
        <span className="text-(--color-text-primary) tabular-nums">{right}</span>
      </div>
    </div>
  );
}

/** Week-by-week line with the usual week dashed and this week's point in orange. */
function Trend({ weeks, usual }: { weeks: number[]; usual: number }) {
  const W = 200, H = 56, pad = 4;
  const lo = Math.min(...weeks, usual) * 0.9, hi = Math.max(...weeks, usual);
  const x = (i: number) => pad + (i / (weeks.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (H - pad * 2);
  const last = weeks.length - 1;
  // The line stretches to the card's width; the point is HTML so it stays round.
  return (
    <div role="img" aria-label={`Chargebacks over the last ${weeks.length} weeks, this week ${usd(weeks[last])}, usually ${usd(usual)}`} className="relative h-14 w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
        <line x1={0} x2={W} y1={y(usual)} y2={y(usual)} stroke="var(--gray-800)" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polyline points={weeks.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--gray-1100)" strokeWidth={1.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <i aria-hidden className="absolute size-2 -translate-1/2 rounded-circle bg-(--color-primary) ring-2 ring-(--color-background-secondary)" style={{ left: `${(x(last) / W) * 100}%`, top: `${(y(weeks[last]) / H) * 100}%` }} />
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <i aria-hidden className="size-1.5 shrink-0 rounded-circle" style={{ background: color }} />;
}

export function HeadlineCards({ rows, ranked, all }: { rows: FX.FxOutlet[]; ranked: FX.FxOutlet[]; all: boolean }) {
  const names = rows.map((x) => x.name);
  const charged = rows.reduce((n, x) => n + x.charged, 0);
  const errors = rows.reduce((n, x) => n + x.errors, 0);
  const sales = rows.reduce((n, x) => n + x.sales, 0);
  const st = FX.statusFor(names);
  const todoOrders = chargesAt(names).filter((c) => c.status === "Still to dispute").length;
  const focus = FX.focusOutlets(rows);
  const others = ranked.filter((x) => !focus.includes(x));
  const focusPct = focus.reduce((n, x) => n + pct(x.charged, charged), 0);
  const winPct = pct(st.won, st.disputed);
  // The weekly history is for all outlets; a filtered view scales it to these outlets' share.
  const share = charged / FX.charged;
  const weeks = FX.WEEKLY.map((v, i) => (i === FX.WEEKLY.length - 1 ? charged : v * share));
  const usual = FX.USUAL * share;
  const diff = Math.round(charged - usual);

  return (
    <section aria-label="This week" className="grid gap-3 @xl:grid-cols-3">
      <div className={kpiCard}>
        <KpiHeader title="Chargebacks cost you" info={`What the apps took back for orders with errors, ${FX.WEEK}.`} />
        <KpiValue value={usd(charged)} chip={all && diff ? `${diff > 0 ? "+" : "−"}${usd(Math.abs(diff))} vs usual` : undefined} tone={diff > 0 ? "danger" : "success"} />
        <div className="flex min-h-[84px] flex-1 flex-col justify-end pt-5">
          <Trend weeks={weeks} usual={usual} />
        </div>
        <KpiFooter left={`${plural(errors, "order")} with errors`} right={`${((charged / sales) * 100).toFixed(1)}% of app sales`} />
      </div>

      <div className={kpiCard}>
        <KpiHeader title="Where it happens" />
        <KpiValue value={`${focusPct}%`} />
        <p className={cn(sm, "pt-1 text-(--color-text-secondary)")}>of chargebacks come from {focus.length === 1 ? focus[0].name : `${focus.length} outlets`}</p>
        <div className="flex min-h-[84px] flex-1 flex-col justify-end gap-2 pt-5">
          {focus.map((x, i) => (
            <div key={x.name} className={cn(sm, "flex items-center gap-3")}>
              <span className={cn("w-16 shrink-0 truncate", i === 0 ? "font-medium text-(--color-text-primary)" : soft)}>{x.name}</span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-circle bg-(--gray-300)">
                <span className={cn("block h-full rounded-circle", i === 0 ? "bg-(--color-primary)" : "bg-(--gray-900)")} style={{ width: `${pct(x.charged, charged)}%` }} />
              </span>
              <span className={cn("w-9 shrink-0 text-right tabular-nums", i === 0 ? "font-medium text-(--color-text-primary)" : soft)}>{pct(x.charged, charged)}%</span>
            </div>
          ))}
        </div>
        <KpiFooter left={others.length ? `${plural(others.length, "other outlet")}` : "No other outlets"} right={`${100 - focusPct}%`} />
      </div>

      <div className={kpiCard}>
        <KpiHeader title="Won back" />
        <KpiValue value={usd(st.won)} chip={st.disputed ? `${winPct}% won` : undefined} tone="success" />
        <p className={cn(sm, "pt-1 text-(--color-text-secondary)")}>{st.disputed ? `of the ${usd(st.disputed)} we disputed` : "Nothing disputed yet"}</p>
        <div className="flex min-h-[84px] flex-1 flex-col justify-end gap-2.5 pt-5">
          <div role="img" aria-label={`Won ${usd(st.won)}, awaiting ${usd(st.wait)}, denied ${usd(st.denied)}`} className="flex h-2 gap-0.5 overflow-hidden rounded-circle">
            {st.won > 0 && <i className="block h-full bg-(--color-success-default)" style={{ flex: st.won }} />}
            {st.wait > 0 && <i className="block h-full bg-(--gray-900)" style={{ flex: st.wait }} />}
            {st.denied > 0 && <i className="block h-full bg-(--gray-700)" style={{ flex: st.denied }} />}
            {!st.disputed && <i className="block h-full flex-1 bg-(--gray-300)" />}
          </div>
          <div className={cn(sm, "flex flex-wrap gap-x-4 gap-y-1")}>
            {[
              ["Won", st.won, "var(--color-success-default)"],
              ["Awaiting", st.wait, "var(--gray-900)"],
              ["Denied", st.denied, "var(--gray-700)"],
            ].map(([l, v, c]) => (
              <span key={l as string} className="inline-flex items-center gap-1.5">
                <Dot color={c as string} />
                <span className={soft}>{l}</span>
                <span className="text-(--color-text-primary) tabular-nums">{usd(v as number)}</span>
              </span>
            ))}
          </div>
        </div>
        <KpiFooter left={`Still to dispute · ${plural(todoOrders, "order")}`} right={usd(st.todo)} />
      </div>
    </section>
  );
}

// ───────── 2. Biggest problems ─────────

type Problem = { title: string; text: string; value: string; unit: string; outlet?: string };

export function biggestProblems(rows: FX.FxOutlet[]): Problem[] {
  const names = rows.map((x) => x.name);
  const xs = chargesAt(names);
  const total = sum(xs);
  const ofAll = (n: number) => `· ${pct(n, total)}% of chargebacks`;
  const mostAt = (cs: FX.FxCharge[]) => {
    const m = new Map<string, number>();
    cs.forEach((c) => m.set(c.outlet, (m.get(c.outlet) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const out: Problem[] = rows.filter(over).map((x) => ({
    title: `${x.name} is over your ${FX.LIMIT}% limit`,
    text: `${FX.rateLabel(x)} of app sales from ${plural(x.errors, "order")}.`,
    value: usd(x.charged),
    unit: ofAll(x.charged),
    outlet: x.name,
  }));

  // The most common reason, and how many outlets it tops.
  const byReason = FX.REASONS.map((r) => ({ r, cs: xs.filter((c) => c.reason === r) })).sort((a, b) => b.cs.length - a.cs.length)[0];
  if (byReason?.cs.length) {
    const ranked = rows.filter((x) => x.charged);
    const tops = ranked.filter((x) => {
      const r = FX.reasonsFor(x.name);
      return FX.REASONS[r.indexOf(Math.max(...r))] === byReason.r;
    }).length;
    const where = mostAt(byReason.cs);
    out.push({
      title: `${byReason.r} is your most common error`,
      text: `${plural(byReason.cs.length, "order")}${ranked.length > 1 ? `, and the top issue at ${tops} of ${ranked.length} outlets` : ""}. Most at ${where[0][0]}.`,
      value: money(sum(byReason.cs)),
      unit: ofAll(sum(byReason.cs)),
      outlet: where[0][0],
    });
  }

  const rep = FX.repeatItem(names);
  if (rep) {
    const cs = xs.filter((c) => c.item === rep.item);
    out.push({
      title: `${rep.item} keeps getting charged back`,
      text: `${plural(rep.n, "order")} at ${plural(rep.at.length, "outlet")}, mostly ${rep.why[0].r.toLowerCase()}.`,
      value: money(sum(cs)),
      unit: ofAll(sum(cs)),
      outlet: rep.at[0].outlet,
    });
  }

  const st = FX.statusFor(names);
  if (st.todo > 0)
    out.push({
      title: `${usd(st.todo)} is not filed yet`,
      text: "KoreFi reviews each dispute before filing. All of these are inside the apps' deadlines.",
      value: usd(st.todo),
      unit: "to dispute",
    });
  return out.slice(0, 3);
}

export function Problems({ items, onOpen, edit }: { items: Problem[]; onOpen: (outlet: string) => void; edit: EditCard }) {
  if (!items.length) return null;
  return (
    <section aria-label="Biggest problems" className={cardCls}>
      {/* A soft orange glow in the top-right corner. */}
      <div aria-hidden className="pointer-events-none absolute -top-28 -right-px h-64 w-[420px] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent)]" />
      <div className="relative flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-(--color-primary)" aria-hidden />
          <h3 className="text-body-md font-medium text-(--color-text-primary)">Biggest problems</h3>
        </div>
        <EditInChat title="Biggest problems" widget="kpis" {...edit} />
      </div>
      <ol className="relative grid gap-x-8 gap-y-4 px-5 pt-4 pb-5 @xl:grid-cols-3">
        {items.map((p) => (
          <li key={p.title} className="flex min-w-0 flex-col gap-1 border-l border-(--color-border-default) pl-3.5">
            <p className="text-body-md font-medium text-(--color-text-primary)">{p.title}</p>
            <p className={cn(sm, "text-(--color-text-secondary)")}>{p.text}</p>
            <div className={cn(sm, "flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5")}>
              <span className="tabular-nums">
                <span className="text-(--color-text-primary)">{p.value}</span> <span className="text-(--color-text-secondary)">{p.unit}</span>
              </span>
              {p.outlet && (
                <button type="button" onClick={() => onOpen(p.outlet!)} className={cn("inline-flex items-center gap-0.5 whitespace-nowrap text-(--color-text-clickable) hover:underline", focusRing)}>
                  See {p.outlet}
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────── 3. Chargebacks by outlet ─────────

export function OutletRanks({ rows, ranked, all, onOpen, edit }: { rows: FX.FxOutlet[]; ranked: FX.FxOutlet[]; all: boolean; onOpen: (outlet: string) => void; edit: EditCard }) {
  const charged = rows.reduce((n, x) => n + x.charged, 0);
  const errors = rows.reduce((n, x) => n + x.errors, 0);
  const sales = rows.reduce((n, x) => n + x.sales, 0);
  const won = rows.reduce((n, x) => n + x.won, 0);
  const zero = rows.filter((x) => !x.charged);
  const cols: Col<FX.FxOutlet>[] = [
    { key: "outlet", header: "Outlet", cell: (x) => <span className="truncate">{x.name}</span> },
    { key: "charged", header: "Charged back", cell: (x) => usd(x.charged) },
    { key: "orders", header: "Orders", cell: (x) => <span className={soft}>{x.errors}</span> },
    {
      key: "rate",
      header: "% of sales",
      cell: (x) =>
        over(x) ? (
          <>
            <Dot color="var(--color-text-danger)" />
            <span className="font-medium text-(--color-text-danger)">{FX.rateLabel(x)}</span>
          </>
        ) : (
          FX.rateLabel(x)
        ),
    },
    { key: "won", header: "Won back", cell: (x) => <span className="text-(--color-text-success)">{usd(x.won)}</span> },
  ];
  return (
    <section aria-label="Chargebacks by outlet" className={cardCls}>
      <CardHeader
        title="Chargebacks by outlet"
        widget="outlets"
        edit={edit}
        action={
          <>
            <Dot color="var(--color-text-danger)" />
            Over your {FX.LIMIT}% limit
          </>
        }
      />
      <DataTable
        label="Chargebacks by outlet"
        cols={cols}
        rows={ranked}
        rowKey={(x) => x.name}
        onRow={(x) => onOpen(x.name)}
        total={[all ? "All outlets" : plural(rows.length, "outlet"), usd(charged), errors, `${((charged / sales) * 100).toFixed(1)}%`, <span key="w" className="text-(--color-text-success)">{usd(won)}</span>]}
      />
      {zero.length > 0 && <p className={cn(sm, "border-t border-(--color-border-default) px-5 py-2.5 text-(--color-text-secondary)")}>No chargebacks this week: {zero.map((x) => x.name).join(", ")}.</p>}
    </section>
  );
}

// ───────── 4. What went wrong ─────────

export function ReasonGrid({ ranked, edit }: { ranked: FX.FxOutlet[]; edit: EditCard }) {
  const cols = ranked.map((x) => ({ x, r: FX.reasonsFor(x.name) }));
  const totals = FX.REASONS.map((_, i) => cols.reduce((n, c) => n + c.r[i], 0));
  const allErrors = totals.reduce((a, b) => a + b, 0);
  const shown = FX.REASONS.filter((_, i) => totals[i] > 0);
  const [pick, setPick] = useState<string>(shown[0] ?? "All");
  const reason = pick === "All" || !shown.includes(pick as (typeof FX.REASONS)[number]) ? "All" : pick;
  const ri = FX.REASONS.indexOf(reason as (typeof FX.REASONS)[number]);
  const bars = cols.map(({ x, r }) => ({ label: x.name, n: ri < 0 ? r.reduce((a, b) => a + b, 0) : r[ri] }));
  const lead = [...bars].sort((a, b) => b.n - a.n)[0];
  const of = ri < 0 ? allErrors : totals[ri];

  const tops = cols.map((c) => FX.REASONS[c.r.indexOf(Math.max(...c.r))]);
  const top = FX.REASONS.map((r) => [r, tops.filter((t) => t === r).length] as const).sort((a, b) => b[1] - a[1])[0];
  const note = cols.length > 1 ? (top[1] === cols.length ? "is the top issue at every outlet." : `is the top issue at ${top[1]} of ${cols.length} outlets.`) : "is the top issue.";

  return (
    <section aria-label="What went wrong" className={cardCls}>
      <CardHeader title="What went wrong" info={`Orders with errors by reason, ${FX.WEEK}.`} widget="reasons" edit={edit} />
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Answer
            label={ri < 0 ? "Most orders with errors" : `Most ${reason.toLowerCase()} orders`}
            value={lead?.n ? lead.label : "None this week"}
            sub={ri < 0 ? `${lead?.n ?? 0} of ${plural(of, "error")} · ${pct(lead?.n ?? 0, of)}%` : `${lead?.n ?? 0} of ${of} ${reason.toLowerCase()} orders · ${pct(of, allErrors)}% of all errors`}
          />
          <Segmented label="Reason" value={reason} onChange={setPick} options={[...shown.map((r) => ({ value: r, label: r })), { value: "All", label: "All" }]} className="max-w-full overflow-x-auto" />
        </div>
        <Bars label={ri < 0 ? "Orders with errors by outlet" : `${reason} orders by outlet`} items={bars} />
      </div>
      <p className={cn(sm, "border-t border-(--color-border-default) px-5 py-2.5 text-(--color-text-primary)")}>
        <span className="font-medium">{top[0]}</span> {note}
      </p>
    </section>
  );
}

// ───────── 5. One outlet at a time ─────────

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-large border border-(--color-border-default) px-4 py-3">
      <span className={cn(sm, "text-(--color-text-secondary)")}>{label}</span>
      <b className={cn("text-lg leading-[1.2] font-normal tracking-[-0.01em] tabular-nums", tone === "success" ? "text-(--color-text-success)" : tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{value}</b>
      {sub && <small className={cn(sm, "text-(--color-text-secondary)")}>{sub}</small>}
    </div>
  );
}

const panel = "flex min-w-0 flex-col gap-4 rounded-large border border-(--color-border-default) p-4";
const SHOWN_ITEMS = 5;
/** "7p" → "7 PM", "12p" → "12 PM". */
const hourName = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
type ErrorsBy = "day" | "shift" | "hour";
/** One outlet's orders with errors by day, shift or hour: the bars, and each bar's name for the answer above them. */
function errorsBy(outlet: string, by: ErrorsBy) {
  if (by === "shift")
    return FX.shiftsFor(outlet).map((n, j) => {
      const s = FX.SHIFTS[j];
      return { label: s.label, name: s.label, n, hint: `${hourName(s.from)}–${hourName(s.to)}` };
    });
  if (by === "hour") return FX.hoursFor(outlet).map((n, j) => ({ label: FX.hourLabel(FX.OPEN_HOURS[j]), name: hourName(FX.OPEN_HOURS[j]), n, hint: "" }));
  return FX.daysFor(outlet).map((n, j) => ({ label: FX.WEEK_DAYS[j] as string, name: FULL_DAY[FX.WEEK_DAYS[j]], n, hint: "" }));
}

export function OutletTabs({ ranked, rows, sel, onSelect, sectionRef, onSeeOrders, edit }: { ranked: FX.FxOutlet[]; rows: FX.FxOutlet[]; sel: string; onSelect: (outlet: string) => void; sectionRef: React.Ref<HTMLElement>; onSeeOrders?: (outlet: string) => void; edit: EditCard }) {
  const tabs = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [by, setBy] = useState<ErrorsBy>("day");
  const x = ranked.find((r) => r.name === sel) ?? ranked[0];
  if (!x) return null;
  const i = ranked.indexOf(x);
  const total = rows.reduce((n, r) => n + r.charged, 0);
  const st = FX.statusFor([x.name]);
  const xs = chargesAt([x.name]);
  const reasons = FX.REASONS.map((r, j) => ({ r, n: FX.reasonsFor(x.name)[j], amt: sum(xs.filter((c) => c.reason === r)) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const items = FX.itemsFor(x.name).map((it) => ({ ...it, amt: sum(xs.filter((c) => c.item === it.item)) }));
  const tied = items.filter((it) => it.n >= 2 && it.n === items[0]?.n);
  const when = errorsBy(x.name, by);
  const dmax = Math.max(...when.map((w) => w.n));
  const peaks = when.filter((w) => w.n === dmax);
  const spread = dmax <= 1 || peaks.length > 2;
  const unit = by === "day" ? "a day" : by === "shift" ? "a shift" : "an hour";

  const go = (to: FX.FxOutlet | undefined) => {
    if (!to) return;
    setMore(false);
    onSelect(to.name);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(to.name)}"]`)?.focus());
  };
  const onKey = (e: React.KeyboardEvent) => {
    const n = ranked.length;
    const to = e.key === "ArrowRight" ? ranked[(i + 1) % n] : e.key === "ArrowLeft" ? ranked[(i + n - 1) % n] : e.key === "Home" ? ranked[0] : e.key === "End" ? ranked[n - 1] : null;
    if (!to) return;
    e.preventDefault();
    go(to);
  };
  const round = cn("grid size-8 shrink-0 place-items-center rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) hover:bg-(--gray-200) disabled:opacity-40 disabled:hover:bg-(--color-background-secondary)", focusRing);

  return (
    <section ref={sectionRef} aria-label="By outlet" className={cn(cardCls, "scroll-mt-4")}>
      <CardHeader title="By outlet" info="One outlet at a time: its numbers, worst days, top issue and items." widget="outlets" edit={edit} action={`${i + 1} of ${ranked.length}`} />

      <div className="flex items-center gap-1.5 border-b border-(--color-border-default) px-2 py-2.5">
        <button type="button" aria-label="Previous outlet" disabled={i === 0} onClick={() => go(ranked[i - 1])} className={round}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div ref={tabs} role="tablist" aria-label="Outlet" onKeyDown={onKey} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-medium bg-(--gray-200) p-0.5 [scrollbar-width:none]">
          {ranked.map((r) => {
            const on = r.name === x.name;
            return (
              <button
                key={r.name}
                type="button"
                role="tab"
                id={`cb-tab-${r.name}`}
                data-tab={r.name}
                aria-selected={on}
                aria-controls="cb-outlet-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => go(r)}
                className={cn(
                  "inline-flex h-8 min-w-20 flex-1 items-center justify-center rounded-small border px-2.5 text-[13px] leading-[1.3] whitespace-nowrap",
                  on ? "border-(--color-border-default) bg-(--color-background-secondary) font-medium text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)",
                  focusRing,
                )}
              >
                {r.name}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Next outlet" disabled={i === ranked.length - 1} onClick={() => go(ranked[i + 1])} className={round}>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div id="cb-outlet-panel" role="tabpanel" aria-labelledby={`cb-tab-${x.name}`} className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-subtitle-md leading-normal font-medium text-(--color-text-primary)">{fullName(x)}</p>
            {over(x) && <span className={cn(sm, "inline-flex h-6 items-center rounded-circle bg-(--color-neutral-light) px-2.5 font-medium text-(--color-text-primary)")}>Over {FX.LIMIT}% limit</span>}
          </div>
          {onSeeOrders && (
            <button type="button" onClick={() => onSeeOrders(x.name)} className={cn(sm, "inline-flex items-center gap-0.5 text-(--color-text-clickable) hover:underline", focusRing)}>
              See {plural(x.errors, "order")}
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
          <Stat label="Charged back" value={usd(x.charged)} sub={`${pct(x.charged, total)}% of all chargebacks`} />
          <Stat label="Error orders" value={String(x.errors)} sub={versusUsual(x.errors, x.usual)} />
          <Stat label="Chargeback rate" value={FX.rateLabel(x)} tone={over(x) ? "danger" : undefined} sub={`Your limit ${FX.LIMIT}%`} />
          <Stat label="Won back" value={usd(x.won)} tone="success" sub={st.disputed ? `${pct(st.won, st.disputed)}% of ${money(st.disputed)} disputed` : "Nothing disputed yet"} />
        </div>

        <div className="grid gap-4 @xl:grid-cols-2">
          <div className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-3 [&>:first-child]:min-w-36 [&>:first-child]:flex-1">
              <Answer
                label={`Worst ${by}`}
                value={spread ? "Spread out" : and(peaks.map((p) => p.name))}
                sub={spread ? `No more than ${plural(dmax, "error")} ${unit}` : `${dmax} of ${plural(x.errors, "error")}${peaks.length > 1 ? " each" : ""}${peaks.length === 1 && peaks[0].hint ? ` · ${peaks[0].hint}` : ""}`}
              />
              <Segmented
                label="Errors by"
                value={by}
                onChange={(v) => setBy(v as ErrorsBy)}
                options={[
                  { value: "day", label: "Day" },
                  { value: "shift", label: "Shift" },
                  { value: "hour", label: "Hour" },
                ]}
              />
            </div>
            <Bars label={`Orders with errors by ${by}`} items={when} />
          </div>

          <div className={panel}>
            <Answer label="Top issue" value={reasons[0]?.r ?? "None"} sub={reasons[0] ? `${reasons[0].n} of ${plural(x.errors, "error")}` : undefined} />
            <div className="flex flex-1 flex-col justify-between gap-4">
              {reasons.map((r, k) => (
                <div key={r.r} className="flex flex-col gap-1.5">
                  <div className={cn(sm, "flex items-baseline justify-between gap-2 whitespace-nowrap")}>
                    <span className={k === 0 ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)"}>{r.r}</span>
                    <span className="text-(--color-text-secondary) tabular-nums">
                      {r.n} · {money(r.amt)} · {pct(r.n, x.errors)}%
                    </span>
                  </div>
                  <span className="h-2.5 overflow-hidden rounded-circle bg-(--gray-200)">
                    <span className={cn("block h-full rounded-circle", k === 0 ? "bg-(--color-primary)" : "bg-(--gray-700)")} style={{ width: `${pct(r.n, x.errors)}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={panel}>
          <Answer
            label="Most complaints"
            value={tied.length ? and(tied.slice(0, 2).map((it) => it.item)) : "No repeat item"}
            sub={tied.length ? `${plural(tied[0].n, "order")}${tied.length > 1 ? " each" : ""}` : "No item came up twice"}
          />
          <div>
            {(more ? items : items.slice(0, SHOWN_ITEMS)).map((it, k) => (
              <div key={it.item} className={cn("flex items-center gap-3 py-2", k > 0 && "border-t border-(--color-border-default)")}>
                <span className="min-w-0 flex-1 truncate text-body-md text-(--color-text-primary)">{it.item}</span>
                <span className={cn(sm, "min-w-0 flex-1 truncate text-(--color-text-secondary)")}>{it.reason}</span>
                <span className={cn(sm, "w-16 shrink-0 text-right text-(--color-text-primary) tabular-nums")}>{it.n}×</span>
                <span className={cn(sm, "w-20 shrink-0 text-right text-(--color-text-secondary) tabular-nums")}>{money(it.amt)}</span>
              </div>
            ))}
          </div>
          {items.length > SHOWN_ITEMS && (
            <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className={cn(sm, "inline-flex items-center gap-1 self-start text-(--color-text-clickable) hover:underline", focusRing)}>
              {more ? "Show less" : `Show ${items.length - SHOWN_ITEMS} more`}
              <ChevronDown className={cn("size-3.5 transition-transform", more && "rotate-180")} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const FULL_DAY: Record<string, string> = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };

// ───────── 6. By app ─────────

type AppRow = { app: string; name: React.ReactNode; orders: number; charged: number; won: number };
export function ByApp({ rows, edit }: { rows: AppRow[]; edit: EditCard }) {
  const cols: Col<AppRow>[] = [
    { key: "app", header: "App", cell: (a) => a.name },
    { key: "orders", header: "Orders", cell: (a) => a.orders },
    { key: "charged", header: "Charged back", cell: (a) => <span className="font-medium">{usd(a.charged)}</span> },
    { key: "won", header: "Won back", cell: (a) => <span className="text-(--color-text-success)">{usd(a.won)}</span> },
  ];
  return (
    <section aria-label="By app" className={cardCls}>
      <CardHeader title="By app" widget="apps" edit={edit} />
      <div className="-mb-px">
        <DataTable label="By app" cols={cols} rows={rows} rowKey={(a) => a.app} />
      </div>
    </section>
  );
}
