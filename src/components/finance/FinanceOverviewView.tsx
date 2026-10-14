"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DataSources } from "@/components/dashboard/DataSources";
import { DataTable, StatusBadge, type Column } from "@/components/dashboard/primitives";
import { SelectControl } from "@/components/ui/Select";
import { PERIOD } from "@/lib/period";
import {
  ACCOUNTING_SOURCE, BOOKS_SYNCED_AT, LATEST, MONTHS, PERIODS, STORES, balance, netTrend, periodMonths, pnl, yearAgo,
  type PeriodKey, type Pnl, type Store,
} from "@/lib/finance/books";
import { HundredBar, MonthBars, pct, usd, vsLastYear, type HundredPart } from "./parts";

const TOTAL = "All stores";
type Tone = "success" | "warning" | "danger" | "info" | "neutral";
type Insight = { tone: Tone; tag: string; text: string; href: string };
type StoreRow = { store: string; p: Pnl };

// Finance / Overview. A report, not a console: the four numbers an owner asks first (sales, costs,
// profit, cash), the trend behind them, where each $100 went, how the stores compare, and a few plain
// observations that link to the detail pages. Anything that needs fixing is handled by KoreFi.
export function FinanceOverviewView() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("this-month");
  const [storeSel, setStoreSel] = useState<string>(TOTAL);

  const stores: readonly Store[] = storeSel === TOTAL ? STORES : [storeSel as Store];
  const [from, to] = periodMonths(periodKey);
  const now = useMemo(() => pnl(stores, LATEST.year, from, to), [stores, from, to]);
  const lastYear = useMemo(() => pnl(stores, LATEST.year - 1, from, to), [stores, from, to]);
  const periodLabel = PERIODS.find((p) => p.key === periodKey)!.label;
  const scope = storeSel === TOTAL ? "all stores" : storeSel;

  // Cash and bills are company-wide month-end balances; the store filter does not split them.
  const asOf = { year: LATEST.year, month: to };
  const bal = useMemo(() => balance(asOf), [to]); // eslint-disable-line react-hooks/exhaustive-deps
  const balBefore = useMemo(() => balance(yearAgo(asOf)), [to]); // eslint-disable-line react-hooks/exhaustive-deps
  const owedOut = bal["vendor-bills"] + bal["sales-tax"] + bal["payroll-owed"] + bal["credit-cards"];

  const expenses = now.revenue - now.net;
  const expensesBefore = lastYear.revenue - lastYear.net;
  const margin = now.revenue ? now.net / now.revenue : 0;
  const marginBefore = lastYear.revenue ? lastYear.net / lastYear.revenue : 0;
  const prime = now.revenue ? now.prime / now.revenue : 0;
  const feeShare = now.revenue ? now.commissions / now.revenue : 0;
  const feeShareBefore = lastYear.revenue ? lastYear.commissions / lastYear.revenue : 0;

  const trend = useMemo(() => netTrend(stores), [stores]);
  const rows: StoreRow[] = useMemo(() => STORES.map((s) => ({ store: s, p: pnl([s], LATEST.year, from, to) })), [from, to]);

  const parts: HundredPart[] = [
    { key: "food", label: "Food & drink", value: now.cogs, color: "var(--chart-open)" },
    { key: "labor", label: "Labor", value: now.labor, color: "var(--chart-series)" },
    { key: "fees", label: "Delivery app fees", value: now.commissions, color: "var(--chart-lost)", hint: "DoorDash, Uber Eats, Grubhub" },
    { key: "other", label: "Rent & other costs", value: now.opex - now.commissions, color: "var(--chart-neutral)" },
    { key: "keep", label: "You keep", value: now.net, color: "var(--chart-won)", hint: "Profit" },
  ];

  const insights: Insight[] = [
    {
      tone: prime > 0.65 ? "warning" : "success",
      tag: "Costs",
      text: `Food and labor took ${pct(prime)} of sales. Restaurants typically run 55–65%.`,
      href: "/finance/pnl",
    },
    {
      tone: feeShare > feeShareBefore + 0.002 ? "warning" : "neutral",
      tag: "Delivery fees",
      text: `Delivery app fees were ${pct(feeShare)} of all sales, ${feeShare >= feeShareBefore ? "up from" : "down from"} ${pct(feeShareBefore)} a year ago.`,
      href: "/operations/fees-and-commissions",
    },
    {
      tone: "info",
      tag: "Payouts",
      text: `${usd(bal["payouts-owed"])} in delivered orders is waiting to be paid out by the delivery apps.`,
      href: "/finance/payout",
    },
    {
      tone: "neutral",
      tag: "Tax",
      text: `${usd(bal["sales-tax"])} of sales tax is set aside to remit; KoreFi files it.`,
      href: "/finance/tax",
    },
    {
      tone: margin < marginBefore ? "warning" : "success",
      tag: "Profit",
      text: `Profit margin is ${pct(margin)}, ${margin >= marginBefore ? "up" : "down"} ${Math.abs((margin - marginBefore) * 100).toFixed(1)} points on the same period last year.`,
      href: "/finance/pnl",
    },
  ];

  const columns: Column<StoreRow>[] = [
    { key: "store", header: "Store", cell: (r) => r.store },
    { key: "rev", header: "Sales", align: "right", cell: (r) => usd(r.p.revenue) },
    { key: "prime", header: "Food + labor", align: "right", cell: (r) => (r.p.revenue ? pct(r.p.prime / r.p.revenue) : "–") },
    { key: "net", header: "Profit", align: "right", cell: (r) => usd(r.p.net) },
    { key: "margin", header: "Margin", align: "right", cell: (r) => (r.p.revenue ? pct(r.p.net / r.p.revenue) : "–") },
  ];

  return (
    <>
      <PageHeader title="Finance overview" />
      <div className="relative min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 [scrollbar-gutter:stable]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <DataSources syncedAt={BOOKS_SYNCED_AT} timezoneNote={PERIOD.timezoneNote} />
          <span className="text-body-sm text-(--color-text-secondary)">Source: {ACCOUNTING_SOURCE}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52">
            <SelectControl aria-label="Period" value={periodKey} onChange={(e) => setPeriodKey(e.target.value as PeriodKey)} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
          </div>
          <div className="w-52">
            <SelectControl aria-label="Store" value={storeSel} onChange={(e) => setStoreSel(e.target.value)} options={[TOTAL, ...STORES].map((s) => ({ value: s, label: s }))} />
          </div>
        </div>

        <StatStrip
          stats={[
            { label: "Revenue", value: usd(now.revenue), sub: vsLastYear(now.revenue, lastYear.revenue) },
            { label: "Expenses", value: usd(expenses), sub: vsLastYear(expenses, expensesBefore) },
            { label: "Profit", value: usd(now.net), sub: `${pct(margin)} margin · ${vsLastYear(now.net, lastYear.net)}`, tone: now.net < 0 ? "danger" : "default" },
            { label: "Cash in the bank", value: usd(bal.cash), sub: `${vsLastYear(bal.cash, balBefore.cash, "a year ago")} · all stores` },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <DashCard className="lg:col-span-2">
            <CardTitle title="Profit by month" />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">{LATEST.year} against {LATEST.year - 1}, {scope}.</p>
            <div className="mt-4">
              <MonthBars points={trend} valueLabel={String(LATEST.year)} compareLabel={String(LATEST.year - 1)} ariaLabel={`Profit by month, ${MONTHS[0]} to ${MONTHS[LATEST.month]}`} />
            </div>
          </DashCard>

          <DashCard>
            <CardTitle title="Cash" value={usd(bal.cash)} />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">Month-end, all stores.</p>
            <dl className="mt-4 divide-y divide-(--color-border-default) text-body-md tabular-nums">
              {[
                ["Operating checking", usd(bal.checking)],
                ["Savings reserve", usd(bal.savings)],
                ["Coming in: delivery payouts and card sales", usd(bal["payouts-owed"] + bal["card-deposits"])],
                ["Going out: bills, taxes, payroll, cards", usd(owedOut)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-(--color-text-secondary)">{k}</dt>
                  <dd className="text-right text-(--color-text-primary)">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href="/finance/balance-summary" className="group mt-auto flex items-center gap-1 pt-3 text-body-md text-(--color-text-clickable) hover:underline">
              Balance Sheet <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </DashCard>
        </div>

        <DashCard>
          <CardTitle title="Where every $100 of sales went" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">{periodLabel}, {scope}.</p>
          <div className="mt-4">
            <HundredBar parts={parts} total={now.revenue} />
          </div>
        </DashCard>

        <div className="grid gap-4 lg:grid-cols-5">
          <DashCard className="lg:col-span-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle title="Stores side by side" />
              <Link href="/finance/pnl" className="group flex items-center gap-1 text-body-md text-(--color-text-clickable) hover:underline">
                P&L <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">{periodLabel}.</p>
            <div className="mt-2">
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.store} />
            </div>
          </DashCard>

          <DashCard className="lg:col-span-2">
            <CardTitle title="Financial insights" />
            <ul className="mt-3 divide-y divide-(--color-border-default)">
              {insights.map((i) => (
                <li key={i.tag}>
                  <Link href={i.href} className="group flex items-start gap-3 py-3 outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                    <StatusBadge tone={i.tone}>{i.tag}</StatusBadge>
                    <span className="min-w-0 flex-1 text-body-md text-(--color-text-primary)">{i.text}</span>
                    <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-(--color-text-secondary) transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </DashCard>
        </div>
      </div>
    </>
  );
}
