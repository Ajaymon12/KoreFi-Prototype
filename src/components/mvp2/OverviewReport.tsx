"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { AppName } from "@/components/ui/ReportTable";
import { Segmented, usd } from "@/components/finance/parts";
import { CHANNELS, pct0, pctOf, totals, type Col } from "@/components/finance/PnlStory";
import { TYPICAL } from "@/lib/finance/costSettings";
import { REPORT_SOURCES } from "@/lib/finance/reports";
import { cn } from "@/lib/utils";
import { Delta, ScopeBar, Section, StatRow, useScope } from "./parts";
import { OutletMix } from "./OutletMix";
import { NoOutlets } from "./OutletFilters";
import { RevenueFlow } from "./RevenueFlow";

// MVP 2 / Overview. Replaces the dev dashboard's Overview (revenue by outlet on two axes, a dashed
// flow tree, a by-platform table) with the same three questions, read off the uploaded reports the
// P&L uses, so the numbers match it everywhere:
//   tiles        sales, the apps' share, paid to you, chargebacks won back, each vs the period before
//   by outlet    a mosaic (width = size, height = channel mix) beside a ranking (OutletMix)
//   payout       total revenue → Non-3PD / 3PD → each channel, as connected cards (RevenueFlow; Non-3PD
//                locked until a Square report is in), then sales to paid to you per channel; $ or % of sales
// Report only, no actions.

type Line = { key: string; label: string; get: (c: Col) => number; kind: "start" | "cost" | "back" | "total"; hint?: string };
const LINES: Line[] = [
  { key: "sales", label: "Sales", get: (c) => c.sales, kind: "start" },
  { key: "cardFees", label: "Card fees", get: (c) => c.cardFees, kind: "cost", hint: "Square, in store and website" },
  { key: "commission", label: "App commission", get: (c) => c.commission, kind: "cost" },
  { key: "promos", label: "Your app promos", get: (c) => c.promos, kind: "cost", hint: "Promos and ads you funded" },
  { key: "chargebacks", label: "Chargebacks", get: (c) => c.chargebacks, kind: "cost", hint: "Order errors the apps charged to you" },
  { key: "moneyBack", label: "Won back", get: (c) => c.moneyBack, kind: "back", hint: "Paid back after KoreFi's disputes" },
  { key: "moneyIn", label: "Paid to you", get: (c) => c.moneyIn, kind: "total" },
];

type Unit = "usd" | "pct";

// The POS counts as integrated once ops uploads its report; the P&L's in-store column reads the same one.
const POS_CONNECTED = REPORT_SOURCES.some((r) => r.provider === "Square");

/** `ops`: the ops admin's copy (/admin/overview), which has no P&L page to link to. `pnlHref`: where
 * "Full P&L" goes (the ops admin's User's view mounts it under /admin/as). */
export function OverviewReport({ ops = false, pnlHref = "/mvp2/pnl" }: { ops?: boolean; pnlHref?: string } = {}) {
  const scope = useScope();
  const [unit, setUnit] = useState<Unit>("usd");
  const [a, b] = scope.range;
  const t = totals(scope.stores, a, b, () => TYPICAL);
  const p = scope.prev && totals(scope.stores, scope.prev[0], scope.prev[1], () => TYPICAL);
  const all = t.all;
  const appSales = (c: Record<string, Col>) => CHANNELS.filter((ch) => ch.app).reduce((n, ch) => n + c[ch.key].sales, 0);
  const appShare = pctOf(appSales(t.cols), all.sales);

  const fmt = (n: number, of: number, signed?: "−" | "+") => (unit === "pct" ? `${signed ?? ""}${(pctOf(n, of) * 100).toFixed(1)}%` : `${signed ?? ""}${usd(n)}`);

  return (
    <>
      <PageHeader title="Overview" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ScopeBar scope={scope} />
        {scope.stores.length === 0 ? (
          <NoOutlets scope={scope.outlets} />
        ) : (
          <div className="space-y-4 p-4">
            <StatRow
              label="This period at a glance"
              stats={[
                { label: "Sales", value: usd(all.sales), delta: p && <Delta now={all.sales} before={p.all.sales} />, sub: p && "vs period before" },
                { label: "From delivery apps", value: pct0(appShare), sub: `${usd(appSales(t.cols))} of sales` },
                { label: "Paid to you", value: usd(all.moneyIn), sub: `${Math.round(pctOf(all.moneyIn, all.sales) * 100)}¢ of every $1 sold`, delta: p && <Delta now={all.moneyIn} before={p.all.moneyIn} /> },
                { label: "Chargebacks won back", value: usd(all.moneyBack), tone: "success", sub: `of ${usd(all.chargebacks)} charged · ${pct0(pctOf(all.moneyBack, all.chargebacks))}` },
              ]}
            />

            <OutletMix stores={scope.stores} range={scope.range} prev={scope.prev} />

            <Section
              title="Revenue & payout"
              sub="Where your revenue comes from, in store and by delivery app"
              actions={
                <>
                  <Segmented<Unit>
                    label="Show as"
                    value={unit}
                    onChange={setUnit}
                    options={[
                      { key: "usd", label: "$" },
                      { key: "pct", label: "% of sales" },
                    ]}
                  />
                  {!ops && (
                    <Link href={pnlHref} className="inline-flex h-8 items-center gap-1 rounded-medium px-2 text-body-sm text-(--color-text-clickable) hover:bg-(--color-neutral-lightest)">
                      Full P&amp;L <ArrowUpRight aria-hidden className="size-3.5" />
                    </Link>
                  )}
                </>
              }
            >
              <RevenueFlow t={t} stores={scope.stores} range={scope.range} posConnected={POS_CONNECTED} />
              <ByChannel t={t} fmt={fmt} />
            </Section>
          </div>
        )}
      </div>
    </>
  );
}

/** The same lines per channel. Costs read −, money back +; only Paid to you is bold. */
function ByChannel({ t, fmt }: { t: ReturnType<typeof totals>; fmt: (n: number, of: number, s?: "−" | "+") => string }) {
  const cols = [...CHANNELS.map((c) => ({ key: c.key, head: <AppName source={c.source} name={c.label} />, v: t.cols[c.key], app: c.app })), { key: "all", head: "Total", v: t.all as Col, app: undefined }];
  return (
    <div className="overflow-x-auto border-t border-(--color-border-default)">
      <table className="w-full min-w-[720px] text-body-md">
        <caption className="px-5 pt-3 pb-2 text-left text-body-sm text-(--color-text-secondary)">By channel</caption>
        <thead>
          <tr className="h-10 bg-(--gray-200) text-body-sm text-(--color-text-secondary)">
            <th scope="col" className="px-5 text-left font-normal" />
            {cols.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 text-right font-normal", c.key === "all" && "border-l border-(--gray-300)")}>
                <span className="inline-flex justify-end">{c.head}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map((l) => (
            <tr key={l.key} className={cn("h-11 border-b border-(--gray-300) last:border-b-0", l.kind === "total" && "bg-(--gray-200)")}>
              <th scope="row" className={cn("px-5 text-left font-normal text-(--color-text-primary)", (l.kind === "start" || l.kind === "total") && "font-medium")}>
                {l.label}
                {l.hint && <span className="block text-body-sm text-(--color-text-tertiary)">{l.hint}</span>}
              </th>
              {cols.map((c) => {
                const v = l.get(c.v);
                // A line a channel doesn't have (card fees on the apps, commission in store).
                const none = c.app !== undefined && v === 0 && l.kind !== "start" && l.kind !== "total";
                return (
                  <td key={c.key} className={cn("px-4 text-right whitespace-nowrap tabular-nums", c.key === "all" && "border-l border-(--gray-300)", l.kind === "total" && "font-medium", l.kind === "back" && !none && "text-(--color-text-success)")}>
                    {none ? <span className="text-(--color-text-tertiary)">—</span> : fmt(v, c.v.sales, l.kind === "cost" ? "−" : l.kind === "back" ? "+" : undefined)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

