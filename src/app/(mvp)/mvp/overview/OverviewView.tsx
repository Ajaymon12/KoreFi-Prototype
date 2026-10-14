"use client";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { MvpFrame, latestSync } from "@/components/mvp/frame";
import { MvpInsights } from "@/components/mvp/MvpInsights";
import { DataSources } from "@/components/dashboard/DataSources";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { DataTable, DeltaChip, StatusBadge, type Column } from "@/components/dashboard/primitives";
import { HundredBar, usd } from "@/components/finance/parts";
import { dataMode, sum, type DashboardData } from "@/lib/sources/dashboard";
import { briefFor, insightsFor, scopeFor, storeRows, type StoreRow } from "@/lib/sources/overview";
import { promoStats } from "@/lib/sources/promos";
import { LATEST, MONTHS, STORES, pnl } from "@/lib/finance/books";
import { fmtCents as fmt, locations, user } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";

// MVP / Overview: how the week went in four numbers, the weekly brief, the top findings, where
// the app money went, and each store. Report only: nothing here asks the owner to act.

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: PERIOD.timezone }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export function OverviewView({ data }: { data: DashboardData }) {
  const scope = scopeFor(undefined, locations);
  const rows = storeRows(data, scope);
  const insights = insightsFor(data, scope, rows);
  const brief = briefFor(data, scope, rows);
  const mode = dataMode(data.connections);

  const gross = sum(data.payouts.map((p) => p.gross));
  const fees = sum(data.payouts.map((p) => p.fees));
  const net = sum(data.payouts.map((p) => p.net));
  const promos = promoStats(data.promos);
  const lost = sum(data.disputes.filter((d) => d.status === "lost").map((d) => d.amount));
  const open = data.disputes.filter((d) => d.status === "open");
  const deposits = sum(data.deposits.filter((x) => /DOORDASH|UBER|GRUBHUB/i.test(x.reference)).map((x) => x.amount));

  // With a POS the headline is the books' net profit for the latest closed month.
  const month = pnl(STORES, LATEST.year, LATEST.month, LATEST.month);
  const before = pnl(STORES, LATEST.year, LATEST.month - 1, LATEST.month - 1);
  const headline =
    mode === "consolidated"
      ? { label: `Net profit · ${MONTHS[LATEST.month]}`, value: usd(month.net), sub: <>{usd(month.revenue)} sales · <DeltaChip value={before.net ? (month.net - before.net) / Math.abs(before.net) : 0} /> vs {MONTHS[LATEST.month - 1]}</> }
      : { label: "Paid to you by the apps", value: fmt(net - lost), sub: `${fmt(gross)} app sales · ${PERIOD.label.toLowerCase()}` };

  const columns: Column<StoreRow>[] = [
    { key: "store", header: "Store", cell: (r) => r.store },
    { key: "gross", header: "App sales", align: "right", cell: (r) => fmt(r.gross) },
    { key: "change", header: "vs before", align: "right", cell: (r) => <DeltaChip value={r.change} /> },
    { key: "net", header: "Paid to you", align: "right", cell: (r) => fmt(r.net) },
    {
      key: "open",
      header: "Chargebacks",
      cell: (r) => {
        const n = open.filter((d) => d.store === r.store).length;
        return n ? <StatusBadge tone="warning">{n} being disputed</StatusBadge> : <StatusBadge tone="success">None open</StatusBadge>;
      },
    },
  ];

  return (
    <MvpFrame title="Overview" basePath="/mvp/overview" actions={<><DataSources syncedAt={latestSync(data.connections)} timezoneNote={PERIOD.timezoneNote} /><DateRangeFilter /></>}>
      <header className="px-1 pt-1">
        <h1 className="text-page-title text-(--color-text-primary)">
          {greeting()}, {user.firstName}
        </h1>
        <p className="mt-1 text-body-md text-(--color-text-secondary)">
          {scope.label}, {PERIOD.range}
          {mode === "3pd-only" && " · delivery apps only until your POS is connected"}
        </p>
      </header>

      <StatStrip
        stats={[
          headline,
          { label: "Reached your bank", value: fmt(deposits), sub: deposits < net ? `${fmt(net - deposits)} still to land` : "Every payout landed" },
          { label: "Chargebacks being disputed", value: fmt(sum(open.map((d) => d.amount))), sub: open.length ? `${open.length} order${open.length === 1 ? "" : "s"} · KoreFi is on it` : "None open", tone: open.length ? "warning" : "default" },
          { label: "Promo return", value: promos.spend ? `$${promos.perDollar.toFixed(2)}` : "–", sub: promos.spend ? `in sales per $1 · ${fmt(promos.spend)} spent` : "No promos running" },
        ]}
      />

      <Link
        href="/mvp/brief"
        className="group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-large border border-(--color-brand-lightest) bg-linear-to-r from-(--brand-200) to-(--color-background-secondary) px-5 py-4 outline-none hover:border-(--color-border-darker) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-circle bg-(--color-background-secondary) text-(--color-primary)">
          <Mail className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-subtitle-xs tracking-wide text-(--color-text-secondary) uppercase">{brief.eyebrow}</span>
          <span className="mt-0.5 block text-subtitle-md text-(--color-text-primary)">{brief.headline}</span>
          {brief.flag && <span className="mt-1 inline-flex h-5 items-center rounded-small bg-(--color-warning-lightest) px-2 text-body-sm text-(--color-warning-darkest)">{brief.flag}</span>}
        </span>
        <span className="flex items-center gap-1 text-body-md text-(--color-text-clickable)">
          Read the brief
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <MvpInsights insights={insights.slice(0, 3)} title="What to know this week" />
        <DashCard>
          <CardTitle title="Where every $100 of app sales went" />
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">Across DoorDash, Uber Eats and Grubhub, {PERIOD.range}.</p>
          <div className="mt-4">
            <HundredBar
              total={gross}
              legendClassName="grid-cols-2"
              parts={[
                { key: "paid", label: "Paid to you", value: net - lost, color: "var(--chart-won)" },
                { key: "fees", label: "Commissions & fees", value: Math.max(fees - promos.spend, 0), color: "var(--chart-neutral)" },
                { key: "promos", label: "Promos & ads", value: promos.spend, color: "var(--chart-series)" },
                { key: "lost", label: "Chargebacks lost", value: lost, color: "var(--chart-lost)" },
              ]}
            />
          </div>
        </DashCard>
      </div>

      <DashCard>
        <CardTitle title="Your stores" />
        <div className="mt-2">
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.store} empty="No store data yet." />
        </div>
      </DashCard>
    </MvpFrame>
  );
}
