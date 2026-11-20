"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { OutletUniverse, useOutletFilter } from "@/components/mvp2/OutletFilters";
import { StatRow, Tray } from "@/components/mvp2/parts";
import { LAST, PRESETS, WEEKS } from "@/components/finance/PnlStory";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import type { Preset } from "@/components/finance/TimelineRange";
import { appLabel, type AppKey } from "@/lib/finance/chargebacks";
import * as FX from "@/lib/mvp3/masaFixture";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { FilterBar, NoOutlets, TableCard } from "./masaParts";
import { pill } from "@/components/mvp3/styles";

// Masa Kitchen's pinned Chargebacks dashboard: the agent-journey prototype's words and figures (journey 3, sample week
// Nov 1–7 in lib/mvp3/masaFixture), built from the /mvp2 report parts: the outlet filters, StatRow, the payout report's
// tray card and the shared ReportTable. The filters narrow the outlets; the totals follow them. By app, What went wrong
// and the issues list are not split by outlet in the sample, so they show for all outlets only.
// Report-only, except "Ask why", which asks the agent.

export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** The period chip opens on "Last week" (the sample week). Its calendar uses the shared report weeks, which end Sep 30. */
export const PERIODS: Preset[] = [{ label: "Last week", range: [LAST, LAST] }, ...PRESETS];
const SOURCE: Record<AppKey, string> = { doordash: "doordash", uber: "ubereats", grubhub: "grubhub" };

type OutletRow = FX.FxOutlet & { total?: boolean };
const OUTLET_COLUMNS: TableColumn<OutletRow>[] = [
  { key: "outlet", header: "Outlet", cell: (x) => (FX.flagged.includes(x) || x.total ? <b className="font-medium">{x.name}</b> : x.name) },
  { key: "charged", header: "Charged back", align: "right", cell: (x) => usd(x.charged) },
  { key: "rate", header: "% of app sales", align: "right", cell: (x) => (FX.flagged.includes(x) ? <span className="font-medium text-(--color-text-danger)">{FX.rateLabel(x)}</span> : FX.rateLabel(x)) },
  { key: "errors", header: "Orders with errors", align: "right", cell: (x) => x.errors,  },
  { key: "won", header: "Won back", align: "right", cell: (x) => usd(x.won) },
];
const APP_COLUMNS: TableColumn<(typeof FX.BY_APP)[number]>[] = [
  { key: "app", header: "App", cell: (a) => <AppName source={SOURCE[a.app]} name={appLabel(a.app)} /> },
  { key: "orders", header: "Orders", align: "right", cell: (a) => a.orders },
  { key: "charged", header: "Charged back", align: "right", cell: (a) => usd(a.charged) },
  { key: "won", header: "Won back", align: "right", cell: (a) => usd(a.won) },
];

export function MasaChargebacks() {
  const { account } = useAccount();
  return (
    <OutletUniverse stores={account.stores}>
      <Body />
    </OutletUniverse>
  );
}

function Body() {
  const { active, ask, send } = useAgents();
  const router = useRouter();
  const [range, setRange] = useState<[number, number]>(PERIODS[0].range);
  const scope = useOutletFilter(range);
  const rows = FX.FX_OUTLETS.filter((x) => scope.stores.includes(x.store));
  const all = rows.length === FX.FX_OUTLETS.length;
  // In the dashboard's own chat the answer lands there; from the full page there is no chat open, so one starts.
  const askWhy = (q: string) => {
    if (active?.dashboard === "dash-chargebacks") return send(q);
    ask(q);
    router.push("/mvp3");
  };

  const charged = rows.reduce((n, x) => n + x.charged, 0);
  const errors = rows.reduce((n, x) => n + x.errors, 0);
  const won = rows.reduce((n, x) => n + x.won, 0);
  const sales = rows.reduce((n, x) => n + x.sales, 0);
  const flagged = rows.filter((x) => FX.rate(x) > FX.LIMIT);
  const total: OutletRow = { ...rows[0], store: rows[0]?.store, name: all ? "All outlets" : `${rows.length} ${rows.length === 1 ? "outlet" : "outlets"}`, sales, charged, errors, usual: 0, won, total: true };
  const chip = cn(pill, "h-7 px-3");

  return (
    <>
      <FilterBar scope={scope}>
        <DateRangeFilter weeks={WEEKS} presets={PERIODS} value={range} onChange={setRange} />
      </FilterBar>
      {rows.length === 0 ? (
        <NoOutlets scope={scope} />
      ) : (
        <>
          <StatRow
            label="Chargebacks this week"
            cols="sm:grid-cols-3"
            stats={[
              { label: "Charged back", value: usd(charged), sub: `${errors} orders` },
              { label: "Won back", value: usd(won), tone: "success", sub: all ? `${FX.WON_SHARE}% of ${usd(FX.DISPUTED)} disputed` : "so far" },
              ...(all ? [{ label: "Still to dispute", value: usd(FX.CBST.todo), sub: "not filed yet" }] : [{ label: "Share of app sales", value: `${((charged / sales) * 100).toFixed(1)}%`, sub: `your limit is ${FX.LIMIT}%` }]),
            ]}
          />

          {flagged.length > 0 && (
            // One line per outlet over the limit: no card in a card, the figures and Ask why on the same row.
            <Tray title="Needs a look" sub={`Over your ${FX.LIMIT}% limit`}>
              <ul className="-mx-2 divide-y divide-(--color-border-default)">
                {flagged.map((x) => (
                  <li key={x.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2">
                    <span aria-hidden className="size-2 shrink-0 rounded-circle bg-(--color-danger-darkest)" />
                    <b className="font-medium text-(--color-text-primary)">{x.name}</b>
                    <span className="text-body-sm font-medium text-(--color-text-danger) tabular-nums">{FX.rateLabel(x)} of app sales</span>
                    <span className="min-w-0 text-body-sm text-(--color-text-secondary)">
                      {x.errors} orders with errors, usually {x.usual}
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                      <span className="text-body-md font-medium tabular-nums text-(--color-text-primary)">{usd(x.charged)}</span>
                      <button type="button" className={chip} onClick={() => askWhy(`Why is ${x.name} high?`)}>
                        Ask why
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </Tray>
          )}

          <TableCard title="All outlets" sub={`Red = over your ${FX.LIMIT}% limit`}>
          <ReportTable
            columns={OUTLET_COLUMNS}
            rows={[...rows.filter((x) => x.charged), total] as OutletRow[]}
            rowKey={(x) => (x.total ? "total" : x.name)}
            rowClassName={(x) => (x.total ? "bg-(--color-neutral-lightest) font-medium" : undefined)}
            noun="outlets"
          />
          {all && FX.zero.length > 0 && <p className="px-5 py-3 text-body-sm text-(--color-text-secondary)">No chargebacks this week: {FX.zero.map((x) => x.name).join(", ")}.</p>}
          </TableCard>

          {all ? (
            <>
              <TableCard title="By app">
                <ReportTable columns={APP_COLUMNS} rows={FX.BY_APP} rowKey={(a) => a.app} noun="apps" />
              </TableCard>

              <Tray title="What went wrong">
                <ul className="space-y-2">
                  {FX.WRONG.map(([label, n]) => (
                    <li key={label} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-body-md">
                      <span className="text-(--color-text-primary)">{label}</span>
                      <span className="h-2.5 overflow-hidden rounded-circle bg-(--gray-300)">
                        <span className="block h-full rounded-circle bg-(--color-primary)" style={{ width: `${(n / FX.WRONG[0][1]) * 100}%` }} />
                      </span>
                      <b className="font-medium tabular-nums">{n}</b>
                    </li>
                  ))}
                </ul>
              </Tray>

            </>
          ) : (
            <p className={cn("rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-secondary)")}>By app and What went wrong cover all outlets. Clear the filters to see them.</p>
          )}
        </>
      )}
    </>
  );
}

