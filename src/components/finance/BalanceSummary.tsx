"use client";
import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Search, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterChip } from "@/components/ui/FilterChip";
import { DetailDrawer, DetailList, DrawerSection } from "@/components/ui/DetailDrawer";
import { cn } from "@/lib/utils";
import { ACCOUNTING_SOURCE, AS_OF_OPTIONS, BALANCE_LINES, asOfKey, asOfLabel, balance, yearAgo, type Balance, type BalanceKind, type BalanceLine } from "@/lib/finance/books";
import { pct0 } from "./PnlStory";
import { usd } from "./parts";

// MVP 2 / Balance Sheet, laid out like the P&L Summary (PnlSummary): one bar on top (search the lines,
// pick the month-end), two cards on a tray, then one table read by role.
//   cards   Net worth as the headline (own − owe); Cash in the bank, beside where the money sits:
//           each group of what you own and what you owe on one scale, and the balance check
//   table   What you own / What you owe / Owner's equity, each opening to its groups and lines, against
//           the same date a year earlier; Net worth is the total. A line opens its 12-month history.
// Plain-English labels with the bookkeeping term in a tooltip, as on /finance/balance-summary (BalanceView).

const KINDS: { kind: BalanceKind; label: string; total: "assets" | "liabilities" | "equity"; goodWhenUp: boolean }[] = [
  { kind: "asset", label: "What you own", total: "assets", goodWhenUp: true },
  { kind: "liability", label: "What you owe", total: "liabilities", goodWhenUp: false },
  { kind: "equity", label: "Owner's equity", total: "equity", goodWhenUp: true },
];
const LATEST = asOfLabel(AS_OF_OPTIONS[0]);
const sum = (ls: BalanceLine[], b: Balance) => ls.reduce((s, l) => s + b[l.id], 0);
const groupsOf = (kind: BalanceKind) => [...new Set(BALANCE_LINES.filter((l) => l.kind === kind).map((l) => l.group))];

/** Change against a year ago: the dollars, coloured by whether that's good, with the % under it. */
function Change({ now, before, goodWhenUp }: { now: number; before: number; goodWhenUp: boolean }) {
  const d = now - before;
  if (Math.abs(d) < 1) return <span className="text-(--color-text-tertiary)">No change</span>;
  return (
    <>
      <span className={cn("block whitespace-nowrap tabular-nums", d > 0 === goodWhenUp ? "text-(--color-text-success)" : "text-(--color-text-danger)")}>
        {d > 0 ? "▲" : "▼"} {usd(Math.abs(d))}
      </span>
      {before !== 0 && <span className="mt-1 block text-body-sm text-(--color-text-secondary) tabular-nums">{pct0(Math.abs(d / before))}</span>}
    </>
  );
}

/** The card's change line, like the P&L's: arrow and % in colour, the comparison date muted. */
function Delta({ now, before, vs, goodWhenUp = true }: { now: number; before: number; vs: string; goodWhenUp?: boolean }) {
  const d = before ? (now - before) / Math.abs(before) : 0;
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-body-sm">
      {Math.abs(d) < 0.0005 ? (
        <span className="text-(--color-text-secondary)">No change</span>
      ) : (
        <span className={cn("tabular-nums", d > 0 === goodWhenUp ? "text-(--color-text-success)" : "text-(--color-text-danger)")}>
          {d > 0 ? "▲" : "▼"} {pct0(Math.abs(d))}
        </span>
      )}
      <span className="text-(--color-text-tertiary)">vs {vs}</span>
    </p>
  );
}

export function BalanceSummary() {
  const [query, setQuery] = useState("");
  const [asOfPick, setAsOfPick] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<BalanceKind, boolean>>({ asset: true, liability: true, equity: false });
  const [selected, setSelected] = useState<string | null>(null);
  const asOf = AS_OF_OPTIONS.find((o) => asOfLabel(o) === asOfPick) ?? AS_OF_OPTIONS[0];
  const now = useMemo(() => balance(asOf), [asOf]);
  const before = useMemo(() => balance(yearAgo(asOf)), [asOf]);
  const nowLabel = asOfLabel(asOf);
  const beforeLabel = asOfLabel(yearAgo(asOf));

  const q = query.trim().toLowerCase();
  const matches = (l: BalanceLine) => !q || `${l.label} ${l.group}`.toLowerCase().includes(q);
  const expanded = (k: BalanceKind) => !!q || open[k];
  const balanced = Math.abs(now.assets - (now.liabilities + now.equity)) < 1;

  // Where the money sits: each group of what you own and what you owe, on one scale.
  const sits = (["asset", "liability"] as const).flatMap((kind) =>
    groupsOf(kind).map((g) => ({ kind, group: g, value: sum(BALANCE_LINES.filter((l) => l.kind === kind && l.group === g), now) })),
  );
  const maxSit = Math.max(1, ...sits.map((s) => s.value));

  const sel = selected ? BALANCE_LINES.find((l) => l.id === selected) : undefined;
  const selGood = sel ? sel.kind !== "liability" : true;

  // Table styles, as on the P&L: sections are subtotals (tinted), Net worth is the total.
  const row = "border-b border-(--gray-300)";
  const num = "w-[150px] px-3 py-3 text-right align-middle tabular-nums";
  const muted = "hidden md:table-cell text-(--color-text-secondary)";
  const labelCell = "px-3 py-3 text-left align-middle font-normal text-(--color-text-primary)";
  const cells = (n: number, b: number, good: boolean) => (
    <>
      <td className={num}>{usd(n)}</td>
      <td className={cn(num, muted)}>{usd(b)}</td>
      <td className={num}>
        <Change now={n} before={b} goodWhenUp={good} />
      </td>
    </>
  );
  const anyMatch = BALANCE_LINES.some(matches);

  return (
    <>
      <PageHeader title="Balance Sheet" />
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Search (the table's lines) and the month-end (everything below) */}
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <label className="hidden h-8 w-[260px] max-w-full items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 focus-within:border-(--color-focus-primary) md:flex">
            <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lines..." aria-label="Search lines" className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)" />
          </label>
          <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-(--color-border-default) md:block" />
          <FilterChip label="As of" icon={CalendarDays} anyLabel={LATEST} options={AS_OF_OPTIONS.slice(1).map(asOfLabel)} value={asOfPick} onChange={(v) => { setAsOfPick(v); setSelected(null); }} />
          <span className="ml-auto text-body-sm text-(--color-text-tertiary)">
            {ACCOUNTING_SOURCE} · all outlets · vs {beforeLabel}
          </span>
        </div>

        {/* Cards */}
        <div className="border-b border-(--color-border-default) px-4 pt-3 pb-3">
          <section aria-label="Net worth and where your money sits" className="flex flex-col gap-1.5 rounded-large bg-(--gray-300) p-1.5 md:flex-row">
            {/* Net worth: the headline */}
            <div className="flex shrink-0 flex-col justify-between gap-3 rounded-medium bg-(--color-background-secondary) p-4 md:w-[208px]">
              <div>
                <p className="text-body-sm text-(--color-text-secondary)" title="What you own minus what you owe. Owner's equity in the books.">
                  Net worth
                </p>
                <p className={cn("mt-2 text-jumbo-md tabular-nums", now.netWorth < 0 ? "text-(--color-text-danger)" : "text-(--color-text-success)")}>{usd(now.netWorth)}</p>
              </div>
              <div>
                <p className="pb-(--module-radius) text-body-md text-(--color-text-secondary) tabular-nums">
                  <span className="text-(--color-text-primary)">{usd(now.assets)}</span> − {usd(now.liabilities)}
                </p>
                <Delta now={now.netWorth} before={before.netWorth} vs={beforeLabel} />
              </div>
            </div>

            <div className="grid min-w-0 flex-1 gap-x-8 gap-y-4 rounded-medium bg-(--color-background-secondary) p-4 md:grid-cols-[minmax(220px,0.9fr)_1.4fr] md:px-5">
              {/* Cash in the bank */}
              <div className="flex min-w-0 flex-col justify-between gap-3">
                <div>
                  <p className="text-body-sm text-(--color-text-secondary)">Cash in the bank</p>
                  <p className="mt-2 text-jumbo-sm text-(--color-text-primary) tabular-nums">{usd(now.cash)}</p>
                </div>
                <dl className="grid max-w-[260px] grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-body-sm tabular-nums">
                  {BALANCE_LINES.filter((l) => l.group === "Cash & bank").map((l) => (
                    <div key={l.id} className="contents">
                      <dt className="text-(--color-text-secondary)">{l.label}</dt>
                      <dd className="text-right text-(--color-text-primary)">{usd(now[l.id])}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Where it sits: one bar and one amount per group */}
              <div className="min-w-0 border-t border-(--color-border-default) pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
                <p className="text-body-sm text-(--color-text-secondary)">What you own and what you owe</p>
                <ul className="mt-2">
                  {sits.map((s, i) => {
                    const owe = s.kind === "liability";
                    return (
                      <li key={s.group} className={cn("grid h-7 grid-cols-[150px_1fr_84px] items-center gap-3 text-body-sm", owe && sits[i - 1]?.kind === "asset" && "mt-1 border-t border-dashed border-(--color-border-default) pt-1")}>
                        <span className="truncate text-(--color-text-primary)">{s.group}</span>
                        <span className="h-2 overflow-hidden rounded-circle bg-(--gray-300)" title={`${s.group}: ${usd(s.value)}`}>
                          <span className={cn("block h-full rounded-circle", owe ? "bg-(--chart-lost)" : "bg-(--gray-900)")} style={{ width: `${(s.value / maxSit) * 100}%` }} />
                        </span>
                        <span className={cn("text-right tabular-nums", owe ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>
                          {owe ? "−" : ""}
                          {usd(s.value)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p role="status" className="mt-1 flex items-center gap-1.5 text-body-sm text-(--color-text-tertiary) tabular-nums">
                  {balanced ? <Check aria-hidden className="size-3.5 text-(--color-text-success)" /> : <TriangleAlert aria-hidden className="size-3.5 text-(--color-text-warning)" />}
                  {balanced ? "Balanced" : "Doesn't balance, flagged to the KoreFi team"}: own {usd(now.assets)} = owe {usd(now.liabilities)} + equity {usd(now.equity)}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* The full sheet */}
        <section aria-label={`Balance sheet as of ${nowLabel}`}>
          <table className="w-full text-body-md">
            <thead>
              <tr className="h-[42px] text-body-sm text-(--color-text-secondary) [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-(--gray-200) [&>th]:shadow-[inset_0_-1px_0_var(--gray-300)]">
                <th scope="col" className="w-[42px]" />
                <th scope="col" className="px-3 text-left font-normal">
                  Select a line for its 12-month history
                </th>
                <th scope="col" className="w-[150px] px-3 text-right font-normal">
                  {nowLabel}
                </th>
                <th scope="col" className="hidden w-[150px] px-3 text-right font-normal md:table-cell">
                  {beforeLabel}
                </th>
                <th scope="col" className="w-[150px] px-3 text-right font-normal">
                  vs a year ago
                </th>
              </tr>
            </thead>
            <tbody>
              {KINDS.map(({ kind, label, total, goodWhenUp }) => {
                const lines = BALANCE_LINES.filter((l) => l.kind === kind && matches(l));
                if (q && lines.length === 0) return null;
                const groups = [...new Set(lines.map((l) => l.group))];
                // Equity has one group, so its lines sit straight under the section.
                const flat = groupsOf(kind).length === 1;
                return [
                  <tr key={kind} className={cn(row, "h-16 bg-(--gray-200)")}>
                    <td className="w-[42px] pl-3 align-middle">
                      <button
                        type="button"
                        aria-expanded={expanded(kind)}
                        aria-label={`${expanded(kind) ? "Hide" : "Show"} ${label} lines`}
                        onClick={() => setOpen((o) => ({ ...o, [kind]: !o[kind] }))}
                        disabled={!!q}
                        className="grid size-6 place-items-center rounded-small text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-50"
                      >
                        <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-150", !expanded(kind) && "-rotate-90")} />
                      </button>
                    </td>
                    <th scope="row" className={cn(labelCell, "font-medium")}>
                      {label}
                    </th>
                    {cells(now[total], before[total], goodWhenUp)}
                  </tr>,
                  ...(expanded(kind)
                    ? groups.flatMap((g) => {
                        const ls = lines.filter((l) => l.group === g);
                        const all = BALANCE_LINES.filter((l) => l.kind === kind && l.group === g);
                        return [
                          ...(flat
                            ? []
                            : [
                                <tr key={`${kind}:${g}`} className={row}>
                                  <td />
                                  <th scope="row" className={cn(labelCell, "font-medium")}>
                                    {g}
                                  </th>
                                  {cells(sum(all, now), sum(all, before), goodWhenUp)}
                                </tr>,
                              ]),
                          ...ls.map((l) => (
                            <tr
                              key={l.id}
                              onClick={() => setSelected(l.id)}
                              className={cn(row, "cursor-pointer transition-colors hover:bg-(--color-neutral-lightest)", selected === l.id && "bg-(--gray-200)")}
                            >
                              <td />
                              <th scope="row" className={cn(labelCell, "text-(--color-text-secondary)", flat ? "" : "pl-8")}>
                                <button type="button" onClick={() => setSelected(l.id)} className="text-left outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                                  <span title={l.tip} className={cn(l.tip && "underline decoration-(--color-border-darker) decoration-dotted underline-offset-4")}>
                                    {l.label}
                                  </span>
                                </button>
                              </th>
                              {cells(now[l.id], before[l.id], goodWhenUp)}
                            </tr>
                          )),
                        ];
                      })
                    : []),
                ];
              })}
              {anyMatch && (
                <tr className={cn(row, "h-16 border-t border-t-(--gray-600) bg-(--gray-300)")}>
                  <td />
                  <th scope="row" className={cn(labelCell, "font-medium")}>
                    Net worth <span className="font-normal text-(--color-text-secondary)">· what you own − what you owe</span>
                  </th>
                  <td className={cn(num, "font-medium", now.netWorth < 0 ? "text-(--color-text-danger)" : "text-(--color-text-success)")}>{usd(now.netWorth)}</td>
                  <td className={cn(num, muted)}>{usd(before.netWorth)}</td>
                  <td className={num}>
                    <Change now={now.netWorth} before={before.netWorth} goodWhenUp />
                  </td>
                </tr>
              )}
              {!anyMatch && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-body-md text-(--color-text-secondary)">
                    No lines match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <DetailDrawer open={!!sel} onClose={() => setSelected(null)} eyebrow={sel?.group} title={sel?.label ?? ""} meta={sel ? `${ACCOUNTING_SOURCE} · account ${sel.code}` : undefined}>
        {sel && (
          <>
            <DetailList
              title={`As of ${nowLabel}`}
              rows={[
                { label: "Balance", value: usd(now[sel.id]) },
                { label: `A year ago (${beforeLabel})`, value: usd(before[sel.id]) },
                { label: "Change", value: <span className="flex flex-col items-end"><Change now={now[sel.id]} before={before[sel.id]} goodWhenUp={selGood} /></span> },
              ]}
            />
            <DrawerSection title="Month-end history">
              <dl>
                {AS_OF_OPTIONS.map((o) => (
                  <div key={asOfKey(o)} className="flex items-baseline justify-between gap-4 px-4 py-1.5 text-body-md tabular-nums">
                    <dt className="text-(--color-text-secondary)">{asOfLabel(o)}</dt>
                    <dd className="text-right text-(--color-text-primary)">{usd(balance(o)[sel.id])}</dd>
                  </div>
                ))}
              </dl>
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
