"use client";
import { useState } from "react";
import { LayoutDashboard, Megaphone, Smartphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MvpFrame, latestSync, useTab } from "@/components/mvp/frame";
import { MvpInsights } from "@/components/mvp/MvpInsights";
import { DataSources } from "@/components/dashboard/DataSources";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { DashCard, CardTitle, SplitBar } from "@/components/dashboard/parts";
import { StatusBadge } from "@/components/dashboard/primitives";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { DetailDrawer, DetailList } from "@/components/ui/DetailDrawer";
import { HundredBar } from "@/components/finance/parts";
import { cn } from "@/lib/utils";
import { type DashboardData } from "@/lib/sources/dashboard";
import { promoStats, promosByApp, promosByCampaign, promosByType, promoTrend, type CampaignRow } from "@/lib/sources/promos";
import { forPage } from "@/lib/mvp/insights";
import { insightsFor, scopeFor, storeRows } from "@/lib/sources/overview";
import { fmtCents as fmt, locations } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";

// MVP / Promos: what the promotions and ads on the delivery apps cost and what they brought in.
// Summary = the headline numbers and which kinds pay; Campaigns = every promo, best return first;
// Apps = DoorDash vs Uber Eats vs Grubhub. Report only: it never offers to change a promo.

const TABS = [
  { key: "summary", label: "Summary", Icon: LayoutDashboard },
  { key: "campaigns", label: "By campaign", Icon: Megaphone },
  { key: "apps", label: "By app", Icon: Smartphone },
] as const;

const COLORS = ["var(--brand-900)", "var(--chart-series)", "var(--chart-won)", "var(--chart-open)"];
const per = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const WEEKS = ["Sep 8 – 14", "Sep 15 – 21", "Sep 22 – 28", "Sep 29 – Oct 5"];

/** Return per $1 coloured: green when sales are at least 3× the spend, red under 1×. */
const Return = ({ value }: { value: number }) => <span className={cn("tabular-nums", value >= 3 ? "text-(--color-text-success)" : value < 1 ? "text-(--color-text-danger)" : "")}>{per(value)}</span>;

export function PromosView({ data }: { data: DashboardData }) {
  const active = useTab(TABS);
  // `?open=` reopens a campaign from a copied link.
  const linked = useSearchParams().get("open");
  const [openKey, setOpenKey] = useState<string | null>(linked);
  const scope = scopeFor(undefined, locations);
  const insights = forPage(insightsFor(data, scope, storeRows(data, scope)), "promos");
  const { promos } = data;
  const stats = promoStats(promos);
  const campaigns = promosByCampaign(promos);
  const types = promosByType(promos);
  const apps = promosByApp(promos);
  const trend = promoTrend(promos);
  const cur = campaigns.find((c) => c.key === openKey);
  const at = campaigns.findIndex((c) => c.key === openKey);

  // After the Figma table: the campaign on two lines, the app with its logo, every figure sortable.
  const campaignColumns: TableColumn<CampaignRow>[] = [
    { key: "campaign", header: "Campaign", cell: (r) => r.campaign, sub: (r) => `${r.typeLabel} · ${r.store}`, sort: (r) => r.campaign },
    { key: "app", header: "App", cell: (r) => <AppName source={r.source} name={r.app} />, sort: (r) => r.app },
    { key: "spend", header: "Cost to you", align: "right", cell: (r) => fmt(r.spend), sort: (r) => r.spend },
    { key: "orders", header: "Orders", align: "right", cell: (r) => String(r.orders), sub: (r) => (r.newCustomers ? `${r.newCustomers} new` : "–"), sort: (r) => r.orders },
    { key: "sales", header: "Sales", align: "right", cell: (r) => fmt(r.sales), sort: (r) => r.sales },
    { key: "per", header: "Per $1", align: "right", cell: (r) => <Return value={r.perDollar} />, sort: (r) => r.perDollar },
  ];

  type TypeRow = (typeof types)[number];
  const typeColumns: TableColumn<TypeRow>[] = [
    { key: "label", header: "Kind", cell: (r) => r.label, sub: (r) => `${r.campaigns} campaign${r.campaigns === 1 ? "" : "s"}`, sort: (r) => r.label },
    { key: "share", header: "Share of spend", cell: (r) => <span className="flex items-center gap-2"><SplitBar fill={stats.spend ? r.spend / stats.spend : 0} className="w-24" />{pct(stats.spend ? r.spend / stats.spend : 0)}</span>, sort: (r) => r.spend },
    { key: "sales", header: "Sales", align: "right", cell: (r) => fmt(r.sales), sub: (r) => `on ${fmt(r.spend)} spent`, sort: (r) => r.sales },
    { key: "per", header: "Per $1", align: "right", cell: (r) => <Return value={r.perDollar} />, sort: (r) => r.perDollar },
  ];

  type AppRow = (typeof apps)[number];
  const appColumns: TableColumn<AppRow>[] = [
    { key: "app", header: "App", cell: (r) => <AppName source={r.source} name={r.app} />, sub: (r) => `${r.campaigns} campaign${r.campaigns === 1 ? "" : "s"}`, sort: (r) => r.app },
    { key: "spend", header: "Cost to you", align: "right", cell: (r) => fmt(r.spend), sort: (r) => r.spend },
    { key: "orders", header: "Orders", align: "right", cell: (r) => String(r.orders), sub: (r) => `${r.newCustomers} new`, sort: (r) => r.orders },
    { key: "sales", header: "Sales", align: "right", cell: (r) => fmt(r.sales), sort: (r) => r.sales },
    { key: "cost", header: "Cost of sales", align: "right", cell: (r) => pct(r.costRate), sort: (r) => r.costRate },
    { key: "per", header: "Per $1", align: "right", cell: (r) => <Return value={r.perDollar} />, sort: (r) => r.perDollar },
  ];

  return (
    <MvpFrame title="Promos" tabs={TABS} active={active} actions={<DataSources syncedAt={latestSync(data.connections, "marketplace")} timezoneNote={PERIOD.timezoneNote} />}>
      {active === "summary" && (
        <>
          <StatStrip
            stats={[
              { label: "Spent on promos & ads", value: fmt(stats.spend), sub: `${PERIOD.label} · ${pct(stats.costRate)} of the sales they touched` },
              { label: "Sales from promo orders", value: fmt(stats.sales), sub: `${stats.orders} orders` },
              { label: "First-time customers", value: String(stats.newCustomers), sub: `${pct(stats.orders ? stats.newCustomers / stats.orders : 0)} of promo orders` },
              { label: "Return per $1", value: stats.spend ? per(stats.perDollar) : "–", sub: "in sales for every dollar of promo", tone: stats.perDollar >= 3 ? "success" : stats.perDollar < 1 ? "danger" : "default" },
            ]}
          />
          <DashCard>
            <CardTitle title="Spend by week" />
            <ul className="mt-4 space-y-3">
              {trend.map((n, i) => (
                <li key={i} className="flex items-center gap-3 text-body-md">
                  <span className="w-28 shrink-0 text-(--color-text-secondary)">{WEEKS[i] ?? `Week ${i + 1}`}</span>
                  <SplitBar fill={Math.max(...trend) ? n / Math.max(...trend) : 0} className="flex-1" />
                  <span className="w-20 text-right tabular-nums">{fmt(n)}</span>
                </li>
              ))}
            </ul>
          </DashCard>
          {/* Tables run edge to edge across the page (Figma), so this one gets its own row. */}
          <ReportTable title="Which kinds of promo pay" columns={typeColumns} rows={types} rowKey={(r) => r.type} noun="kinds of promo" initialSort={{ key: "per", dir: "desc" }} empty="No promos ran this period." />
          <MvpInsights insights={insights} />
        </>
      )}

      {active === "campaigns" && (
        <>
          <ReportTable
            title="Every campaign"
            description="Best return first. Select a campaign for its weekly cost and customers."
            columns={campaignColumns}
            rows={campaigns}
            rowKey={(r) => r.key}
            search={(r) => `${r.campaign} ${r.store} ${r.typeLabel} ${r.app}`}
            searchPlaceholder="Search campaigns…"
            filters={[
              { key: "app", label: "App", value: (r) => r.app },
              { key: "kind", label: "Kind", value: (r) => r.typeLabel },
              { key: "store", label: "Store", value: (r) => r.store },
            ]}
            initialSort={{ key: "per", dir: "desc" }}
            noun="campaigns"
            onRowClick={(r) => setOpenKey(r.key)}
            selectedKey={openKey}
            empty="No promos ran this period."
          />
          <MvpInsights insights={insights} />
        </>
      )}

      {active === "apps" && (
        <>
          <DashCard>
            <CardTitle title="Where every $100 of promo spend went" />
            <div className="mt-4">
              <HundredBar total={stats.spend} parts={apps.map((a, i) => ({ key: a.source, label: a.app, value: a.spend, color: COLORS[i] }))} />
            </div>
          </DashCard>
          <ReportTable title="By app" columns={appColumns} rows={apps} rowKey={(r) => r.source} noun="apps" empty="No promos ran this period." />
          <MvpInsights insights={insights} />
        </>
      )}

      <DetailDrawer
        open={!!cur}
        onClose={() => setOpenKey(null)}
        onPrev={at > 0 ? () => setOpenKey(campaigns[at - 1].key) : undefined}
        onNext={at >= 0 && at < campaigns.length - 1 ? () => setOpenKey(campaigns[at + 1].key) : undefined}
        icon={Megaphone}
        eyebrow={cur && `${cur.app} promo`}
        title={cur?.campaign ?? ""}
        status={cur && <StatusBadge tone="neutral">{cur.typeLabel}</StatusBadge>}
        meta={cur?.store}
        permalink={cur ? `/mvp/promos?tab=campaigns&open=${encodeURIComponent(cur.key)}` : undefined}
      >
        {cur && (
          <>
            <div>
              <p className="text-jumbo-md text-(--color-text-primary) tabular-nums">{per(cur.perDollar)}</p>
              <p className="mt-1.5 text-body-sm text-(--color-text-secondary)">in sales for every $1 this promo cost you</p>
            </div>
            <DetailList
              title={PERIOD.range}
              rows={[
                { label: "Cost to you", value: fmt(cur.spend) },
                { label: "Orders", value: String(cur.orders) },
                { label: "First-time customers", value: `${cur.newCustomers} (${pct(cur.newShare)})` },
                { label: "Sales", value: fmt(cur.sales) },
                { label: "Cost of those sales", value: pct(cur.costRate) },
              ]}
            />
            <DetailList title="Cost by week" rows={cur.weeklySpend.map((n, i) => ({ label: WEEKS[i] ?? `Week ${i + 1}`, value: fmt(n) }))} />
            <p className="text-body-sm text-(--color-text-tertiary)">Source: {cur.app} marketing report.</p>
          </>
        )}
      </DetailDrawer>
    </MvpFrame>
  );
}
