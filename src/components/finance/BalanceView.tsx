"use client";
import { useMemo, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DataSources } from "@/components/dashboard/DataSources";
import { SelectControl } from "@/components/ui/Select";
import { DetailDrawer, DetailList, DrawerSection } from "@/components/ui/DetailDrawer";
import { PERIOD } from "@/lib/period";
import {
  ACCOUNTING_SOURCE, AS_OF_OPTIONS, BALANCE_LINES, BOOKS_SYNCED_AT, asOfKey, asOfLabel, balance, balanceTrend, yearAgo,
  type Balance, type BalanceKind, type BalanceLine,
} from "@/lib/finance/books";
import { StatementTable, type StmtColumn, type StmtRow } from "./StatementTable";
import { ChangeAmount, ChangeBoth, ChangePct, ExportButton, MonthBars, downloadCsv, usd, vsLastYear } from "./parts";

const KINDS: { kind: BalanceKind; label: string; total: keyof Balance; goodWhenUp: boolean }[] = [
  { kind: "asset", label: "What you own", total: "assets", goodWhenUp: true },
  { kind: "liability", label: "What you owe", total: "liabilities", goodWhenUp: false },
  { kind: "equity", label: "Owner's equity", total: "equity", goodWhenUp: true },
];

// Finance / Balance summary: a snapshot at a month-end, set against the same date a year earlier.
// Grouped in plain English (what you own, what you owe, owner's equity) with the bookkeeping term in
// a tooltip. Restaurant-specific lines (marketplace payouts owed, sales tax, gift cards) are named
// outright because that's where owners' books usually go quiet.
export function BalanceView() {
  const [key, setKey] = useState(asOfKey(AS_OF_OPTIONS[0]));
  const [selected, setSelected] = useState<string | null>(null);
  const asOf = AS_OF_OPTIONS.find((o) => asOfKey(o) === key)!;
  const now = useMemo(() => balance(asOf), [asOf]);
  const before = useMemo(() => balance(yearAgo(asOf)), [asOf]);
  const trend = useMemo(() => balanceTrend(), []);
  const nowLabel = asOfLabel(asOf);
  const beforeLabel = asOfLabel(yearAgo(asOf));

  const columns: StmtColumn[] = [
    { key: "now", header: nowLabel },
    { key: "before", header: beforeLabel, muted: true },
    { key: "chg", header: "vs a year ago" },
  ];
  const cells = (n: number, b: number, good: boolean): React.ReactNode[] => [usd(n), usd(b), <ChangeBoth key="c" now={n} before={b} goodWhenUp={good} />];
  const leaf = (l: BalanceLine, good: boolean): StmtRow => ({ id: l.id, label: l.label, tip: l.tip, cells: cells(now[l.id], before[l.id], good) });

  const rows: StmtRow[] = KINDS.map(({ kind, label, total, goodWhenUp }) => {
    const lines = BALANCE_LINES.filter((l) => l.kind === kind);
    const groups = [...new Set(lines.map((l) => l.group))];
    const sum = (ls: BalanceLine[], b: Balance) => ls.reduce((s, l) => s + b[l.id], 0);
    return {
      id: kind,
      label,
      cells: cells(now[total], before[total], goodWhenUp),
      // Equity has a single group, so skip the middle level.
      children:
        groups.length === 1
          ? lines.map((l) => leaf(l, goodWhenUp))
          : groups.map((g) => {
              const ls = lines.filter((l) => l.group === g);
              return { id: `${kind}:${g}`, label: g, cells: cells(sum(ls, now), sum(ls, before), goodWhenUp), children: ls.map((l) => leaf(l, goodWhenUp)) };
            }),
    };
  });

  const balanced = Math.abs(now.assets - (now.liabilities + now.equity)) < 1;
  const sel = selected ? BALANCE_LINES.find((l) => l.id === selected) : undefined;
  const selGood = sel ? sel.kind !== "liability" : true;

  const exportCsv = () => {
    const out: (string | number)[][] = [["Line", nowLabel, beforeLabel, "$ change"]];
    KINDS.forEach(({ kind, label, total }) => {
      out.push([label, now[total], before[total], now[total] - before[total]]);
      BALANCE_LINES.filter((l) => l.kind === kind).forEach((l) => out.push([`  ${l.label}`, now[l.id], before[l.id], now[l.id] - before[l.id]]));
    });
    downloadCsv(`balance-summary-${asOfKey(asOf)}.csv`, out);
  };

  return (
    <>
      <PageHeader title="Balance summary" actions={<ExportButton onClick={exportCsv} />} />
      <div className="relative min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 [scrollbar-gutter:stable]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <DataSources syncedAt={BOOKS_SYNCED_AT} timezoneNote={PERIOD.timezoneNote} />
          <span className="text-body-sm text-(--color-text-secondary)">Source: {ACCOUNTING_SOURCE} · all stores</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
            <SelectControl aria-label="As of" value={key} onChange={(e) => { setKey(e.target.value); setSelected(null); }} options={AS_OF_OPTIONS.map((o) => ({ value: asOfKey(o), label: `As of ${asOfLabel(o)}` }))} />
          </div>
          <span className="text-body-sm text-(--color-text-secondary)">Compared with {beforeLabel}</span>
        </div>

        <p className="max-w-3xl text-body-lg text-(--color-text-primary)">
          On {nowLabel} you owned <strong className="font-medium">{usd(now.assets)}</strong> and owed <strong className="font-medium">{usd(now.liabilities)}</strong>, so the business is worth{" "}
          <strong className="font-medium">{usd(now.netWorth)}</strong> on paper. {usd(now.cash)} of what you own is cash.
        </p>

        <StatStrip
          stats={[
            { label: "Cash in the bank", value: usd(now.cash), sub: vsLastYear(now.cash, before.cash, "a year ago") },
            { label: "What you own", value: usd(now.assets), sub: vsLastYear(now.assets, before.assets, "a year ago") },
            { label: "What you owe", value: usd(now.liabilities), sub: vsLastYear(now.liabilities, before.liabilities, "a year ago") },
            { label: "Worth (owner's equity)", value: usd(now.equity), sub: vsLastYear(now.equity, before.equity, "a year ago") },
          ]}
        />

        <DashCard>
          <CardTitle title="Cash and net worth" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Month-end balances for the last 12 months. Net worth is what you own minus what you owe.</p>
          <div className="mt-4">
            <MonthBars points={trend} valueLabel="Cash" compareLabel="Net worth" ariaLabel="Cash and net worth at each of the last 12 month-ends" />
          </div>
        </DashCard>

        <DashCard>
          <CardTitle title="Full breakdown" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Open a row to see what is inside it; select a line for its 12-month history.</p>
          <div className="mt-2">
            <StatementTable caption={`Balance summary as of ${nowLabel}`} columns={columns} rows={rows} onSelect={setSelected} selectedId={selected} />
          </div>
          <div
            role="status"
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-md tabular-nums text-(--color-text-secondary)"
          >
            {balanced ? <Check aria-hidden className="size-4 text-(--color-text-success)" /> : <TriangleAlert aria-hidden className="size-4 text-(--color-text-warning)" />}
            <span>
              {balanced ? "Balanced" : "Doesn't balance — flagged to the KoreFi team"}: what you own {usd(now.assets)} = what you owe {usd(now.liabilities)} + equity {usd(now.equity)}
            </span>
          </div>
        </DashCard>
      </div>

      <DetailDrawer open={!!sel} onClose={() => setSelected(null)} eyebrow={sel?.group} title={sel?.label ?? ""} meta={sel ? `${ACCOUNTING_SOURCE} · account ${sel.code}` : undefined}>
        {sel && (
          <>
            <DetailList
              title={`As of ${nowLabel}`}
              rows={[
                { label: "Balance", value: usd(now[sel.id]) },
                { label: `A year ago (${beforeLabel})`, value: usd(before[sel.id]) },
                { label: "Change", value: <span className="flex justify-end gap-2"><ChangeAmount now={now[sel.id]} before={before[sel.id]} goodWhenUp={selGood} /><ChangePct now={now[sel.id]} before={before[sel.id]} goodWhenUp={selGood} /></span> },
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
