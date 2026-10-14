"use client";
import { useState } from "react";
import { ArrowLeftRight, CalendarDays, History } from "lucide-react";
import { MvpFrame, useTab } from "@/components/mvp/frame";
import { InsightBanner } from "@/components/mvp/MvpInsights";
import { BigStat, COLUMNS_CLASS, Column, Fact, InOutBars, Panel, ShareBars, Sparkline, columnsClass } from "@/components/mvp/charts";
import { DataTable, FreshnessStamp, StatusBadge, type Column as TableColumn } from "@/components/dashboard/primitives";
import { DetailDrawer, DetailList, DrawerSection, Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { HundredBar } from "@/components/finance/parts";
import { channelName, payoutStatus, payoutWeeks, sum, type DashboardData, type PayoutStatus, type PayoutWeek } from "@/lib/sources/dashboard";
import { forPage } from "@/lib/mvp/insights";
import { insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { fmtCents as fmt, locations } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";
import type { Payout } from "@/lib/sources/types";

// MVP / Payouts, charts first like Profit:
//   This cycle      what the apps paid out, how much of it reached the bank, what they kept; a card per app
//   Reconciliation  app payout against Mercury deposit, app by app; gaps are KoreFi's to chase
//   History         the weeks before, estimated from each app's daily sales
// Report only: the owner reads where the money is; KoreFi follows up every gap.

const TABS = [
  { key: "week", label: "This cycle", Icon: CalendarDays },
  { key: "reconciliation", label: "Reconciliation", Icon: ArrowLeftRight },
  { key: "history", label: "History", Icon: History },
] as const;

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const pct = (n: number) => `${Math.round(n * 100)}%`;

type Row = { source: Payout["source"]; app: string; payout?: Payout; status: PayoutStatus | "none"; deposited: number; delta: number; depositDate?: string; note?: string };
type Reported = Row & { payout: Payout };

const STATUS: Record<Row["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  landed: { label: "Landed", tone: "success" },
  short: { label: "Short · KoreFi is reviewing", tone: "danger" },
  due: { label: "Due", tone: "warning" },
  none: { label: "No report yet", tone: "neutral" },
};

const Source = ({ children }: { children: React.ReactNode }) => <p className="px-1 text-body-sm text-(--color-text-tertiary)">{children}</p>;
const ChartLabel = ({ children }: { children: React.ReactNode }) => <p className="mb-2 text-body-sm text-(--color-text-secondary)">{children}</p>;

/** Where one payout is, step by step. */
const timeline = (r: Reported): TimelineStep[] => [
  { label: `Sales period ${r.payout.period}`, state: "done" },
  { label: `${r.app} paid out ${fmt(r.payout.net)}`, state: "done" },
  r.depositDate ? { label: `${fmt(r.deposited)} landed in Mercury`, date: day(r.depositDate), state: "done" } : { label: "Waiting for the deposit to land in Mercury", state: "current" },
  ...(r.status === "short" ? [{ label: `KoreFi is following up on ${fmt(Math.abs(r.delta))} with ${r.app}`, state: "current" as const }] : []),
  ...(r.status === "landed" ? [{ label: "Matched to the cent", state: "done" as const }] : []),
];

export function PayoutsView({ data }: { data: DashboardData }) {
  const active = useTab(TABS);
  const [openId, setOpenId] = useState<string | null>(null);
  const scope = scopeFor(undefined, locations);
  const insights = forPage(insightsFor(data, scope, storeRows(data, scope)), "payouts");
  const mercury = data.connections.find((c) => c.id === "mercury");

  // One row per connected app: its payout and where the money is, or why there is no report.
  const rows: Row[] = data.connections
    .filter((c) => c.group === "marketplace" && c.connected)
    .map((c) => {
      const payout = data.payouts.find((p) => p.source === c.id);
      if (!payout) return { source: c.id, app: c.name, status: "none", deposited: 0, delta: 0, note: c.detail ?? "KoreFi has not uploaded this app's payout report yet." };
      const s = payoutStatus(payout, data.deposits);
      return { source: c.id, app: c.name, payout, ...s };
    });
  const reported = rows.filter((r): r is Reported => !!r.payout);
  const gross = sum(reported.map((r) => r.payout.gross));
  const fees = sum(reported.map((r) => r.payout.fees));
  const expected = sum(reported.map((r) => r.payout.net));
  const landed = sum(reported.map((r) => r.deposited));
  const toLand = sum(reported.map((r) => (r.status === "due" ? r.payout.net : r.status === "short" ? -r.delta : 0)));
  const short = reported.filter((r) => r.status === "short");
  const weeks = payoutWeeks(data.payouts, data.ops, PERIOD.start);
  const appWeeks = (source: Row["source"]) => weeks.map((w) => ({ label: w.label, value: w.byChannel.find((c) => c.source === source)?.net ?? 0 }));
  const cur = rows.find((r) => r.source === openId);
  const banner = <InsightBanner insights={insights} title="What KoreFi sees in this cycle" />;

  const details = (r: Row) => (
    <button type="button" onClick={() => setOpenId(r.source)} className="text-body-sm text-(--color-text-clickable) hover:underline">
      Where it is
    </button>
  );

  /** One app's card: headline, trend, the figures, and where its money is. */
  const AppCard = ({ r, view }: { r: Row; view: "cycle" | "recon" }) => (
    <Panel className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        {r.payout ? (
          view === "cycle" ? (
            <BigStat label={`${r.app} · ${r.payout.period}`} value={fmt(r.payout.net)} sub="paid out after fees" />
          ) : (
            <BigStat label={`${r.app} · difference`} value={r.delta < 0 ? `−${fmt(Math.abs(r.delta))}` : "$0.00"} tone={r.delta < 0 ? "danger" : "success"} sub={r.delta < 0 ? "KoreFi is following it up" : "Matched to the cent"} />
          )
        ) : (
          <BigStat label={r.app} value="–" sub={r.note} />
        )}
        <StatusBadge tone={r.status === "landed" && view === "recon" ? "success" : STATUS[r.status].tone}>{r.status === "landed" && view === "recon" ? "Matched" : STATUS[r.status].label}</StatusBadge>
      </div>
      {r.payout && <Sparkline points={appWeeks(r.source)} format={fmt} ariaLabel={`${r.app} paid to you by week`} />}
      {r.payout && (
        <div>
          {view === "cycle" ? (
            <>
              <Fact label="Sales" value={fmt(r.payout.gross)} />
              <Fact label="Fees" value={`−${fmt(r.payout.fees)} · ${pct(r.payout.fees / (r.payout.gross || 1))}`} />
              <Fact label="Paid out" value={fmt(r.payout.net)} />
              <Fact label="In your bank" value={r.depositDate ? `${fmt(r.deposited)} · ${day(r.depositDate)}` : "Not yet"} />
            </>
          ) : (
            <>
              <Fact label={`${r.app} says it paid`} value={fmt(r.payout.net)} />
              <Fact label="Mercury deposit" value={r.depositDate ? `${fmt(r.deposited)} · ${day(r.depositDate)}` : "Not yet"} />
              <Fact label="Difference" value={r.delta < 0 ? <span className="text-(--color-text-danger)">−{fmt(Math.abs(r.delta))}</span> : "None"} />
            </>
          )}
          <div className="pt-2.5">{details(r)}</div>
        </div>
      )}
    </Panel>
  );

  type Week = PayoutWeek;
  const historyColumns: TableColumn<Week>[] = [
    { key: "week", header: "Week", cell: (w) => w.label },
    { key: "gross", header: "App sales", align: "right", cell: (w) => fmt(w.gross) },
    { key: "fees", header: "Fees", align: "right", cell: (w) => `−${fmt(w.fees)}` },
    { key: "net", header: "Paid to you", align: "right", cell: (w) => fmt(w.net) },
    { key: "split", header: "By app", cell: (w) => w.byChannel.map((c) => `${c.name} ${fmt(c.net)}`).join(" · ") },
  ];

  return (
    <MvpFrame
      title="Payouts"
      tabs={TABS}
      active={active}
      basePath="/mvp/payouts"
      actions={mercury?.connected ? <FreshnessStamp at={mercury.lastSyncedAt} label="Mercury synced" /> : <StatusBadge tone="neutral">Mercury not connected</StatusBadge>}
    >
      {active === "week" && (
        <>
          {banner}
          <div className={COLUMNS_CLASS}>
            <Column title="Paid out by the apps">
              <BigStat label={`This cycle · ${reported[0]?.payout.period ?? PERIOD.range}`} value={fmt(expected)} sub={`${reported.length} of ${rows.length} apps reported · ${fmt(gross)} in sales`} />
              <div>
                <ChartLabel>Paid out by week</ChartLabel>
                <Sparkline points={weeks.map((w) => ({ label: w.label, value: w.net }))} format={fmt} ariaLabel="Paid out by the apps, by week" />
              </div>
              <ShareBars title="By app" rows={reported.map((r) => ({ key: r.source, label: r.app, value: r.payout.net }))} format={fmt} />
            </Column>
            <Column title="Reached your bank" href="/mvp/payouts?tab=reconciliation">
              <BigStat label={mercury?.connected ? "In Mercury" : "Connect your bank to match deposits"} value={fmt(landed)} tone={toLand ? undefined : "success"} sub={toLand ? `${fmt(toLand)} still to land · KoreFi is on it` : "Every payout landed"} />
              <div>
                <ChartLabel>Of every $100 the apps paid out</ChartLabel>
                <HundredBar
                  total={expected || 1}
                  legendClassName="grid-cols-2"
                  parts={[
                    { key: "landed", label: "In your bank", value: landed, color: "var(--brand-900)" },
                    { key: "toland", label: "Still to land", value: toLand, color: "var(--chart-lost)" },
                  ]}
                />
              </div>
              <div>
                {reported.map((r) => (
                  <Fact key={r.source} label={r.app} value={<StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge>} />
                ))}
              </div>
            </Column>
            <Column title="Fees taken">
              <BigStat label="Commissions, fees and promos" value={`−${fmt(fees)}`} sub={`${pct(fees / (gross || 1))} of app sales`} />
              <div>
                {reported.map((r) => (
                  <Fact key={r.source} label={`${r.app} keeps`} value={`${pct(r.payout.fees / (r.payout.gross || 1))} · ${Math.round((r.payout.net / (r.payout.gross || 1)) * 100)}¢ to you`} />
                ))}
              </div>
              <ShareBars title="By app" rows={reported.map((r) => ({ key: r.source, label: r.app, value: r.payout.fees }))} format={fmt} color="var(--chart-neutral)" />
            </Column>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((r) => (
              <AppCard key={r.source} r={r} view="cycle" />
            ))}
          </div>
          <Source>Source: each app&apos;s payout report and Mercury. Weeks are estimated from the apps&apos; daily sales; the apps report one payout per cycle.</Source>
        </>
      )}

      {active === "reconciliation" && (
        <>
          {banner}
          <div className={columnsClass("2-3")}>
            <Column title="Unreconciled">
              <BigStat label="App payouts not yet in your bank" value={fmt(sum(reported.map((r) => Math.max(-r.delta, 0))))} tone={short.length ? "danger" : "success"} sub={short.length ? `${short.length} payout${short.length === 1 ? "" : "s"} short · KoreFi chases every gap` : "Every payout matched to the cent"} />
              <div>
                {reported.map((r) => (
                  <Fact key={r.source} label={r.app} value={r.delta < 0 ? <span className="text-(--color-text-danger)">−{fmt(Math.abs(r.delta))}</span> : "Matched"} />
                ))}
                {rows.filter((r) => !r.payout).map((r) => (
                  <Fact key={r.source} label={r.app} value="No report yet" />
                ))}
              </div>
            </Column>
            <Column title="App payout vs Mercury deposit">
              <InOutBars periods={reported.map((r) => ({ label: r.app, in: r.payout.net, out: r.deposited }))} inLabel="App says it paid" outLabel="Reached Mercury" outTone="neutral" format={fmt} ariaLabel="App payout against Mercury deposit, by app" />
            </Column>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((r) => (
              <AppCard key={r.source} r={r} view="recon" />
            ))}
          </div>
          <Source>What the apps say they paid, against the deposits Mercury shows. A short deposit is usually a split payout or a held adjustment; KoreFi confirms which with the app.</Source>
        </>
      )}

      {active === "history" && (
        <>
          <div className={COLUMNS_CLASS}>
            <Column title="Paid to you">
              <BigStat label={`Last ${weeks.length} weeks`} value={fmt(sum(weeks.map((w) => w.net)))} sub={`${fmt(sum(weeks.map((w) => w.net)) / (weeks.length || 1))} a week on average`} />
              <div>
                <ChartLabel>By week</ChartLabel>
                <Sparkline points={weeks.map((w) => ({ label: w.label, value: w.net }))} format={fmt} ariaLabel="Paid to you by week" />
              </div>
            </Column>
            <Column title="App sales vs fees">
              <BigStat label="App sales" value={fmt(sum(weeks.map((w) => w.gross)))} sub={`−${fmt(sum(weeks.map((w) => w.fees)))} in fees · ${pct(sum(weeks.map((w) => w.fees)) / (sum(weeks.map((w) => w.gross)) || 1))}`} />
              <InOutBars periods={weeks.map((w) => ({ label: w.label, in: w.gross, out: w.fees }))} inLabel="App sales" outLabel="Fees" format={fmt} ariaLabel="App sales and fees by week" />
            </Column>
            <Column title="By app">
              {(() => {
                const byApp = reported.map((r) => ({ key: r.source, label: r.app, value: sum(weeks.map((w) => w.byChannel.find((c) => c.source === r.source)?.net ?? 0)) })).sort((a, b) => b.value - a.value);
                const all = sum(byApp.map((a) => a.value)) || 1;
                return (
                  <>
                    <BigStat label={`${byApp[0]?.label ?? "No app"} paid the most`} value={fmt(byApp[0]?.value ?? 0)} sub={`${pct((byApp[0]?.value ?? 0) / all)} of what reached you over ${weeks.length} weeks`} />
                    <ShareBars rows={byApp} format={fmt} />
                  </>
                );
              })()}
            </Column>
          </div>
          <Panel title="Week by week" sub="Estimated from each app's daily sales; the apps report one payout per cycle.">
            <div className="-mx-5 -mb-5">
              <DataTable columns={historyColumns} rows={weeks} rowKey={(w) => w.start} />
            </div>
          </Panel>
        </>
      )}

      <DetailDrawer open={!!cur?.payout} onClose={() => setOpenId(null)} eyebrow={cur && `${cur.app} → Mercury`} title={cur ? `${cur.app} payout` : ""} meta={cur?.payout?.period}>
        {cur?.payout && (
          <>
            <DrawerSection title="Where it is">
              <Timeline steps={timeline(cur as Reported)} />
            </DrawerSection>
            <DetailList
              title="The money"
              rows={[
                { label: "Sales", value: fmt(cur.payout.gross) },
                { label: "Fees", value: `−${fmt(cur.payout.fees)}` },
                { label: "Paid out", value: fmt(cur.payout.net) },
                { label: "Reached your bank", value: cur.depositDate ? fmt(cur.deposited) : "Not yet" },
                { label: "Difference", value: cur.delta < 0 ? `−${fmt(Math.abs(cur.delta))}` : "None" },
              ]}
            />
            <DetailList title="By store" rows={cur.payout.byStore.map((s) => ({ label: s.store, value: `${fmt(s.net)} of ${fmt(s.gross)}` }))} />
            <p className="text-body-sm text-(--color-text-tertiary)">Source: {channelName(cur.source)} payout report{cur.depositDate ? " and Mercury" : ""}.</p>
          </>
        )}
      </DetailDrawer>
    </MvpFrame>
  );
}
