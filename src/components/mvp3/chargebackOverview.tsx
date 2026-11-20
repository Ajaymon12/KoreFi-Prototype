"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tray } from "@/components/mvp2/parts";
import * as FX from "@/lib/mvp3/masaFixture";
import { versusUsual } from "@/lib/mvp3/outletDive";
import { focusRing, pill } from "@/components/mvp3/styles";

// Masa Kitchen's Chargebacks Overview, laid out like the Eggholic chargeback review: what the week cost, where and what
// came back → biggest problems → outlets ranked by $ → what went wrong (reason × outlet) → one outlet at a time.
// One week, so timing is by day (Sun–Sat); the sample has no order times for shifts or hours. Every figure is counted
// from masaFixture (FX_OUTLETS and CHARGES), so it follows the outlet filter and matches the weekly email.

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const and = (xs: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(xs);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const over = (x: FX.FxOutlet) => FX.rate(x) > FX.LIMIT;

/** Neutral on purpose: one grey per place in the $ ranking, darkest first. Colour is kept for meaning only
 *  (red = over the limit, green = won back). */
const COLORS = ["var(--gray-1200)", "var(--gray-1000)", "var(--gray-800)"];
export const colorFor = (ranked: FX.FxOutlet[], x: FX.FxOutlet) => COLORS[Math.min(Math.max(0, ranked.indexOf(x)), COLORS.length - 1)];
/** The one bar colour for outlets, days and the ranking. */
const BAR = "var(--gray-1100)";

const card = "rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-4";
const label = "text-body-sm text-(--color-text-secondary)";
const big = "text-jumbo-sm tabular-nums text-(--color-text-primary)";

// ───────── 1. Headline cards ─────────

export function HeadlineCards({ rows, ranked, all }: { rows: FX.FxOutlet[]; ranked: FX.FxOutlet[]; all: boolean }) {
  const charged = rows.reduce((n, x) => n + x.charged, 0);
  const errors = rows.reduce((n, x) => n + x.errors, 0);
  const usual = rows.reduce((n, x) => n + x.usual, 0);
  const sales = rows.reduce((n, x) => n + x.sales, 0);
  const st = FX.statusFor(rows.map((x) => x.name));
  const focus = FX.focusOutlets(rows);
  const others = ranked.filter((x) => !focus.includes(x));
  const focusPct = focus.reduce((n, x) => n + pct(x.charged, charged), 0);
  const winPct = pct(st.won, st.disputed);
  const pace = all
    ? charged > FX.USUAL
      ? `Up from your usual ${usd(FX.USUAL)} a week.`
      : `Down from your usual ${usd(FX.USUAL)} a week.`
    : `${errors > usual ? "Up from" : errors < usual ? "Down from" : "Same as"} the usual ${plural(usual, "order")} a week.`;

  return (
    <section aria-label="This week" className="grid gap-3 @2xl:grid-cols-3">
      <div className={cn(card, "flex flex-col gap-1")}>
        <p className="text-body-md font-medium text-(--color-text-primary)">Chargebacks cost you</p>
        <p className={big}>{usd(charged)}</p>
        <p className={label}>
          {plural(errors, "order")} with errors · {((charged / sales) * 100).toFixed(1)}% of app sales
        </p>
        <p className={cn(label, "mt-auto border-t border-(--color-border-default) pt-2")}>{pace}</p>
      </div>

      <div className={cn(card, "flex flex-col gap-1")}>
        <p className="text-body-md font-medium text-(--color-text-primary)">Where it happens</p>
        <p className={big}>{focusPct}%</p>
        <p className={label}>from {and(focus.map((x) => x.name))}</p>
        <div role="img" aria-label="Share of chargebacks by outlet" className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-circle">
          {focus.map((x) => (
            <i key={x.name} className="block h-full" style={{ width: `${pct(x.charged, charged)}%`, background: colorFor(ranked, x) }} />
          ))}
          {others.length > 0 && <i className="block h-full flex-1 bg-(--gray-400)" />}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-body-sm text-(--color-text-secondary)">
          {focus.map((x) => (
            <span key={x.name} className="inline-flex items-center gap-1.5">
              <i aria-hidden className="size-2 rounded-[2px]" style={{ background: colorFor(ranked, x) }} />
              {x.name} {pct(x.charged, charged)}%
            </span>
          ))}
          {others.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="size-2 rounded-[2px] bg-(--gray-400)" />
              {others.length} {others.length === 1 ? "other" : "others"} {100 - focusPct}%
            </span>
          )}
        </div>
      </div>

      <div className={cn(card, "flex flex-col gap-1")}>
        <p className="text-body-md font-medium text-(--color-text-primary)">Won back</p>
        <p className={cn(big, "text-(--color-text-success)")}>{usd(st.won)}</p>
        <p className={label}>{st.disputed ? `${winPct}% of the ${usd(st.disputed)} we disputed` : "Nothing disputed yet"}</p>
        <div role="img" aria-label={`${winPct}% of disputed money won back`} className="mt-1 h-2 overflow-hidden rounded-circle bg-(--gray-400)">
          <i className="block h-full rounded-circle bg-(--gray-1100)" style={{ width: `${winPct}%` }} />
        </div>
        {st.todo > 0 && <p className={label}>{usd(st.todo)} still to dispute</p>}
      </div>
    </section>
  );
}

// ───────── 2. Biggest problems ─────────

type Problem = { title: string; text: string; value: string; unit: string; outlet?: string; ask?: string };

export function biggestProblems(rows: FX.FxOutlet[]): Problem[] {
  const names = rows.map((x) => x.name);
  const out: Problem[] = rows.filter(over).map((x) => ({
    title: `${x.name}: ${FX.rateLabel(x)} of app sales, over your ${FX.LIMIT}% limit`,
    text: x.name === "Damen" ? FX.DAMEN_WHY.text : `${plural(x.errors, "order")} with errors, usually ${x.usual}.`,
    value: usd(x.charged),
    unit: "charged back",
    outlet: x.name,
    ask: `Why is ${x.name} high?`,
  }));
  const rep = FX.repeatItem(names);
  if (rep)
    out.push({
      title: `${rep.item}: ${rep.n} orders at ${rep.at.length} outlets`,
      text: `${rep.at.map((a) => `${a.outlet} ${a.n}`).join(" · ")}. ${rep.why.map((w, i) => (i ? `${w.r.toLowerCase()} ${w.n}` : `${w.r} ${w.n}`)).join(", ")}.`,
      value: String(rep.n),
      unit: "orders",
    });
  const st = FX.statusFor(names);
  if (st.todo > 0)
    out.push({
      title: `${usd(st.todo)} is not filed yet`,
      text: "The KoreFi team reviews each dispute before filing. All of these are inside the apps' deadlines.",
      value: usd(st.todo),
      unit: "to dispute",
    });
  return out.slice(0, 3);
}

export function Problems({ items, onOpen, onAsk }: { items: Problem[]; onOpen: (outlet: string) => void; onAsk: (q: string) => void }) {
  if (!items.length) return null;
  return (
    <Tray title="Biggest problems">
      <ol className="-mx-2 divide-y divide-(--color-border-default)">
        {items.map((p, i) => (
          <li key={p.title} className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-2 py-3 @xl:grid-cols-[24px_minmax(0,1fr)_auto]">
            <span className="grid size-6 place-items-center rounded-circle bg-(--color-neutral-lightest) text-body-sm font-medium text-(--color-text-secondary)">{i + 1}</span>
            <div className="min-w-0">
              {p.outlet ? (
                <button type="button" onClick={() => onOpen(p.outlet!)} className={cn("text-left text-body-md font-medium text-(--color-text-primary) hover:underline", focusRing)}>
                  {p.title}
                </button>
              ) : (
                <p className="text-body-md font-medium text-(--color-text-primary)">{p.title}</p>
              )}
              <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{p.text}</p>
              {p.ask && (
                <button type="button" className={cn(pill, "mt-2 h-7 px-3")} onClick={() => onAsk(p.ask!)}>
                  Ask why
                </button>
              )}
            </div>
            <div className="col-start-2 flex items-baseline gap-1.5 @xl:col-start-3 @xl:block @xl:text-right">
              <b className="block text-subtitle-md font-medium tabular-nums text-(--color-text-primary)">{p.value}</b>
              <span className="text-body-sm text-(--color-text-secondary)">{p.unit}</span>
            </div>
          </li>
        ))}
      </ol>
    </Tray>
  );
}

// ───────── 3. Chargebacks by outlet ─────────

const RANK_COLS = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 @xl:grid-cols-[7.5rem_minmax(0,1fr)_5.5rem_4.5rem_4.5rem_5rem]";

export function OutletRanks({ rows, ranked, all, sel, onOpen }: { rows: FX.FxOutlet[]; ranked: FX.FxOutlet[]; all: boolean; sel: string; onOpen: (outlet: string) => void }) {
  const focus = FX.focusOutlets(rows);
  const others = ranked.filter((x) => !focus.includes(x));
  const max = ranked[0]?.charged ?? 1;
  const charged = rows.reduce((n, x) => n + x.charged, 0);
  const errors = rows.reduce((n, x) => n + x.errors, 0);
  const sales = rows.reduce((n, x) => n + x.sales, 0);
  const won = rows.reduce((n, x) => n + x.won, 0);
  const zero = rows.filter((x) => !x.charged);

  const row = (x: FX.FxOutlet, quiet: boolean) => (
    <button
      key={x.name}
      type="button"
      onClick={() => onOpen(x.name)}
      aria-pressed={sel === x.name}
      className={cn(RANK_COLS, "w-full rounded-medium px-2 py-2.5 text-left text-body-md tabular-nums hover:bg-(--color-neutral-lightest)", sel === x.name && "bg-(--color-neutral-lightest)", focusRing)}
    >
      <span className={cn("inline-flex min-w-0 items-center gap-2 truncate", quiet ? "text-(--color-text-secondary)" : "font-medium text-(--color-text-primary)")}>
        {x.name}
      </span>
      <span className="order-1 col-span-2 h-2.5 overflow-hidden rounded-circle bg-(--gray-300) @xl:order-none @xl:col-span-1">
        <span className="block h-full rounded-circle" style={{ width: `${Math.max((x.charged / max) * 100, 2)}%`, background: BAR, opacity: quiet ? 0.4 : 1 }} />
      </span>
      <span className={cn("text-right", quiet ? "text-(--color-text-secondary)" : "font-medium text-(--color-text-primary)")}>{usd(x.charged)}</span>
      <span className="hidden text-right text-(--color-text-secondary) @xl:block">{x.errors}</span>
      <span className={cn("hidden text-right @xl:block", over(x) ? "font-medium text-(--color-text-danger)" : "text-(--color-text-secondary)")}>{FX.rateLabel(x)}</span>
      <span className="hidden text-right text-(--color-text-secondary) @xl:block">{usd(x.won)}</span>
      <span className="order-2 col-span-2 text-body-sm text-(--color-text-secondary) @xl:hidden">
        {plural(x.errors, "order")} · <span className={over(x) ? "font-medium text-(--color-text-danger)" : undefined}>{FX.rateLabel(x)}</span> of app sales · won back {usd(x.won)}
      </span>
    </button>
  );

  return (
    <Tray title="Chargebacks by outlet" sub={`Red = over your ${FX.LIMIT}% limit`}>
      <p className="-mt-2 mb-2 text-body-sm text-(--color-text-secondary)">Biggest first. Pick an outlet to see its items and days.</p>
      <div className={cn(RANK_COLS, "hidden px-2 pb-1 text-body-sm text-(--color-text-secondary) @xl:grid")}>
        <span>Outlet</span>
        <span />
        <span className="text-right">Charged back</span>
        <span className="text-right">Orders</span>
        <span className="text-right">% of sales</span>
        <span className="text-right">Won back</span>
      </div>
      <div className="-mx-2 divide-y divide-(--color-border-default)">
        {focus.map((x) => row(x, false))}
      </div>
      {others.length > 0 && (
        <>
          <p className="border-t border-(--color-border-default) px-0 pt-3 pb-1 text-body-sm text-(--color-text-tertiary)">Other outlets</p>
          <div className="-mx-2 divide-y divide-(--color-border-default)">{others.map((x) => row(x, true))}</div>
        </>
      )}
      <div className={cn(RANK_COLS, "-mx-2 mt-2 rounded-medium bg-(--color-neutral-lightest) px-2 py-2.5 text-body-md font-medium tabular-nums text-(--color-text-primary)")}>
        <span>{all ? "All outlets" : plural(rows.length, "outlet")}</span>
        <span className="hidden @xl:block" />
        <span className="text-right">{usd(charged)}</span>
        <span className="hidden text-right @xl:block">{errors}</span>
        <span className="hidden text-right @xl:block">{((charged / sales) * 100).toFixed(1)}%</span>
        <span className="hidden text-right @xl:block">{usd(won)}</span>
      </div>
      {zero.length > 0 && <p className="mt-3 text-body-sm text-(--color-text-secondary)">No chargebacks this week: {zero.map((x) => x.name).join(", ")}.</p>}
    </Tray>
  );
}

// ───────── 4. What went wrong ─────────

/** Darker = a bigger share of that outlet's orders. */
const HEAT = [
  { min: 50, cls: "bg-(--gray-1200) text-(--gray-100)", key: "50%+" },
  { min: 25, cls: "bg-(--gray-900) text-(--color-text-primary)", key: "25–49%" },
  { min: 10, cls: "bg-(--gray-500) text-(--color-text-primary)", key: "10–24%" },
  { min: 0.01, cls: "bg-(--gray-300) text-(--color-text-primary)", key: "under 10%" },
];
const heat = (share: number) => HEAT.find((h) => share >= h.min)?.cls ?? "border border-dashed border-(--color-border-default) text-(--color-text-tertiary)";

export function ReasonGrid({ ranked, onOpen }: { ranked: FX.FxOutlet[]; onOpen: (outlet: string) => void }) {
  const cols = ranked.map((x) => ({ x, r: FX.reasonsFor(x.name) }));
  const tops = cols.map((c) => FX.REASONS[c.r.indexOf(Math.max(...c.r))]);
  const top = FX.REASONS.map((r) => [r, tops.filter((t) => t === r).length] as const).sort((a, b) => b[1] - a[1])[0];
  const note = cols.length > 1 ? (top[1] === cols.length ? `${top[0]} is the top issue at every outlet.` : `${top[0]} is the top issue at ${top[1]} of ${cols.length} outlets.`) : `${top[0]} is the top issue.`;

  return (
    <Tray title="What went wrong" sub={FX.WEEK}>
      <p className="-mt-2 text-body-sm text-(--color-text-secondary)">{note} Orders with each reason, by outlet.</p>
      <div className="-mx-1 mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed border-separate border-spacing-1 tabular-nums">
          <colgroup>
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr>
              <th />
              {cols.map(({ x }) => (
                <th key={x.name} className="align-bottom font-normal">
                  <button type="button" onClick={() => onOpen(x.name)} className={cn("grid w-full gap-0.5 rounded-medium px-1 py-1.5 text-center text-body-sm font-medium text-(--color-text-primary) hover:bg-(--color-neutral-lightest)", focusRing)}>
                    <span className="truncate">{x.name}</span>
                    <small className="text-[11px] font-normal text-(--color-text-secondary)">{plural(x.errors, "order")}</small>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FX.REASONS.map((reason, i) => (
              <tr key={reason}>
                <th scope="row" className="pr-2 text-left text-body-sm font-normal text-(--color-text-primary)">
                  {reason}
                </th>
                {cols.map(({ x, r }) => (
                  <td key={x.name} className="p-0">
                    <span className={cn("grid h-10 place-items-center rounded-medium text-body-md font-medium", heat(pct(r[i], x.errors)))}>{r[i] || "–"}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-(--color-text-secondary)">
        <span>Share of the outlet&apos;s orders</span>
        {[...HEAT].reverse().map((h) => (
          <span key={h.key} className="inline-flex items-center gap-1.5">
            <i aria-hidden className={cn("size-3 rounded-[3px]", h.cls)} />
            {h.key}
          </span>
        ))}
      </div>
    </Tray>
  );
}

// ───────── 5. One outlet at a time ─────────

export function OutletTabs({ ranked, rows, sel, onSelect, sectionRef }: { ranked: FX.FxOutlet[]; rows: FX.FxOutlet[]; sel: string; onSelect: (outlet: string, dir?: number) => void; sectionRef: React.Ref<HTMLElement> }) {
  const tabs = useRef<HTMLDivElement>(null);
  const x = ranked.find((r) => r.name === sel) ?? ranked[0];
  if (!x) return null;
  const i = ranked.indexOf(x);
  const prev = ranked[(i + ranked.length - 1) % ranked.length];
  const next = ranked[(i + 1) % ranked.length];
  const total = rows.reduce((n, r) => n + r.charged, 0);
  const st = FX.statusFor([x.name]);
  const color = BAR;
  const reasons = FX.reasonsFor(x.name);
  const topR = reasons.indexOf(Math.max(...reasons));
  const items = FX.itemsFor(x.name);
  const repeat = items.filter((it) => it.n >= 2);
  const tied = repeat.filter((it) => it.n === repeat[0]?.n);
  const once = items.filter((it) => it.n < 2);
  const days = FX.daysFor(x.name);
  const dmax = Math.max(...days);
  const peaks = FX.WEEK_DAYS.filter((_, j) => days[j] === dmax);
  const spread = dmax <= 1 || peaks.length > 2;

  const move = (to: FX.FxOutlet, dir: number) => {
    onSelect(to.name, dir);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(to.name)}"]`)?.focus());
  };
  const onKey = (e: React.KeyboardEvent) => {
    const n = ranked.length;
    const to = e.key === "ArrowRight" ? ranked[(i + 1) % n] : e.key === "ArrowLeft" ? ranked[(i + n - 1) % n] : e.key === "Home" ? ranked[0] : e.key === "End" ? ranked[n - 1] : null;
    if (!to) return;
    e.preventDefault();
    move(to, ranked.indexOf(to) > i ? 1 : -1);
  };

  return (
    <section ref={sectionRef} aria-labelledby="cb-by-outlet" className="scroll-mt-4 rounded-large bg-(--gray-300) p-1.5">
      <div className="rounded-medium bg-(--color-background-secondary) px-5 py-4">
        <p id="cb-by-outlet" className="text-body-md font-medium text-(--color-text-primary)">
          By outlet
        </p>
        <p className="text-body-sm text-(--color-text-secondary)">One outlet at a time</p>

        <div ref={tabs} role="tablist" aria-label="Outlet" onKeyDown={onKey} className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
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
                onClick={() => onSelect(r.name)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-circle border px-3 text-body-sm",
                  on ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-background-secondary)" : "border-(--color-border-default) text-(--color-text-secondary) hover:border-(--color-border-strong,var(--gray-700))",
                  focusRing,
                )}
              >
                {r.name}
                <span className={cn("tabular-nums", on ? "opacity-70" : "text-(--color-text-tertiary)")}>{usd(r.charged)}</span>
              </button>
            );
          })}
        </div>

        <div id="cb-outlet-panel" role="tabpanel" aria-labelledby={`cb-tab-${x.name}`} className="mt-3 space-y-5">
          <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
            <Mini label="Charged back" value={usd(x.charged)} sub={`${pct(x.charged, total)}% of all chargebacks`} />
            <Mini label="Orders with errors" value={String(x.errors)} sub={versusUsual(x.errors, x.usual)} />
            <Mini label="% of app sales" value={FX.rateLabel(x)} tone={over(x) ? "danger" : undefined} sub={`Your limit is ${FX.LIMIT}%`} />
            <Mini label="Won back" value={usd(x.won)} tone="success" sub={st.disputed ? `${pct(st.won, st.disputed)}% of ${usd(st.disputed)} disputed` : "Nothing disputed yet"} />
          </div>

          <div className="grid rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest) @xl:grid-cols-3">
            <Glance label="Top issue" value={FX.REASONS[topR]} sub={`${reasons[topR]} of ${plural(x.errors, "order")}`} />
            <Glance
              label={tied.length > 1 ? "Most repeated items" : "Most repeated item"}
              value={tied.length ? and(tied.slice(0, 2).map((it) => it.item)) : "No repeat item"}
              sub={tied.length ? `${plural(tied[0].n, "order")}${tied.length > 1 ? " each" : `, ${tied[0].reason.toLowerCase()}`}` : "No item came up twice"}
            />
            <Glance label="Worst day" value={spread ? "Spread out" : and([...peaks])} sub={spread ? `No more than ${plural(dmax, "order")} a day` : `${plural(dmax, "order")} ${peaks.length > 1 ? "each" : ""}`.trim()} />
          </div>

          <div className="space-y-2">
            <p className="text-body-md font-medium text-(--color-text-primary)">Items charged back</p>
            {repeat.length > 0 ? <Items items={repeat} start={0} /> : <p className="rounded-medium border border-dashed border-(--color-border-default) px-3 py-2.5 text-body-sm text-(--color-text-secondary)">No item came up more than once this week.</p>}
            {once.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-body-sm text-(--color-text-secondary)">
                  {repeat.length ? "Show" : "See"} {plural(once.length, "item")} charged back once
                </summary>
                <div className="mt-2">
                  <Items items={once} start={repeat.length} />
                </div>
              </details>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-body-md font-medium text-(--color-text-primary)">By day of week</p>
            <div role="img" aria-label={`Orders with errors by day: ${FX.WEEK_DAYS.map((d, j) => `${d} ${days[j]}`).join(", ")}`} className="grid h-32 grid-cols-7 items-end gap-1.5">
              {days.map((v, j) => {
                const pk = !spread && v === dmax;
                return (
                  <div key={j} className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] justify-items-center gap-1 text-body-sm">
                    <b className={cn("tabular-nums", pk ? "font-medium text-(--color-text-primary)" : "font-normal text-(--color-text-secondary)")}>{v}</b>
                    <span className="w-full max-w-8 self-end rounded-t-[6px] rounded-b-[2px]" style={{ height: `${Math.max((v / Math.max(dmax, 1)) * 100, 3)}%`, background: color, opacity: pk ? 1 : 0.35 }} />
                    <span className={pk ? "font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)"}>{FX.WEEK_DAYS[j]}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-body-sm text-(--color-text-tertiary)">Sun, Nov 1 to Sat, Nov 7</p>
          </div>

          <nav aria-label="Other outlets" className="grid grid-cols-2 gap-2 border-t border-(--color-border-default) pt-4">
            <button type="button" onClick={() => move(prev, -1)} className={cn("flex min-w-0 items-center gap-2 rounded-medium border border-(--color-border-default) px-3 py-2 text-left hover:bg-(--color-neutral-lightest)", focusRing)}>
              <ChevronLeft className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
              <span className="grid min-w-0">
                <small className="text-body-sm text-(--color-text-secondary)">Previous</small>
                <span className="truncate text-body-md font-medium text-(--color-text-primary)">{prev.name}</span>
              </span>
            </button>
            <button type="button" onClick={() => move(next, 1)} className={cn("flex min-w-0 items-center justify-end gap-2 rounded-medium border border-(--color-border-default) px-3 py-2 text-right hover:bg-(--color-neutral-lightest)", focusRing)}>
              <span className="grid min-w-0">
                <small className="text-body-sm text-(--color-text-secondary)">Next</small>
                <span className="truncate text-body-md font-medium text-(--color-text-primary)">{next.name}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}

function Mini({ label: l, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "danger" }) {
  return (
    <div className="grid content-start gap-0.5 rounded-medium border border-(--color-border-default) px-3 py-2.5">
      <span className={label}>{l}</span>
      <b className={cn("text-subtitle-md font-normal tabular-nums", tone === "success" ? "text-(--color-text-success)" : tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{value}</b>
      {sub && <small className="text-body-sm text-(--color-text-secondary)">{sub}</small>}
    </div>
  );
}

function Glance({ label: l, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5 border-t border-(--color-border-default) px-3.5 py-3 first:border-t-0 @xl:border-t-0 @xl:border-l @xl:first:border-l-0">
      <span className={label}>{l}</span>
      <b className="text-body-md font-medium text-(--color-text-primary)">{value}</b>
      <small className="text-body-sm text-(--color-text-secondary)">{sub}</small>
    </div>
  );
}

function Items({ items, start }: { items: ReturnType<typeof FX.itemsFor>; start: number }) {
  return (
    <ol className="divide-y divide-(--color-border-default) overflow-hidden rounded-large border border-(--color-border-default)">
      {items.map((it, k) => (
        <li key={it.item} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5">
          <span className="grid size-6 place-items-center rounded-circle bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary)">{start + k + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-body-md text-(--color-text-primary)">{it.item}</p>
            <p className="text-body-sm text-(--color-text-secondary)">{it.reason}</p>
          </div>
          <p className="text-right tabular-nums">
            <b className="text-subtitle-md font-normal text-(--color-text-primary)">{it.n}</b>
            <span className="ml-1 text-body-sm text-(--color-text-secondary)">{it.n === 1 ? "order" : "orders"}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
