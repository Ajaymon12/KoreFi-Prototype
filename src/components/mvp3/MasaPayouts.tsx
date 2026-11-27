"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CircleCheck, CircleMinus, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import { LAST } from "@/components/finance/PnlStory";
import { homeData } from "@/lib/mvp3/home";
import * as FX from "@/lib/mvp3/masaFixture";
import { useOrderAnswer } from "@/lib/mvp3/orderAnswer";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { OrderAction } from "./OrderAction";
import { PageTabs, PayoutTable, Section, ShowAs, StatTiles, card, type Stat, type Unit } from "./pageParts";

// Masa Kitchen's Payouts dashboard: the complete week Nov 1–7, as the Friday email reports it (leadership flow 2,
// 2026-11-20). A 2-way check: Toast orders against each app's report and payout; bank deposits aren't checked.
// Every figure is in lib/mvp3/masaFixture and matches the chat, the email and Home. Laid out like Home (pageParts):
//   Summary    the week's figures, each app's payout, the orders not paid, the checks.
//   Breakdown  Revenue & payout per app, in $ or as % of each app's sales (the same table as Home's Breakdown).
// The chat's replies switch it to the unpaid orders ("unmatched") or the Uber Eats breakdown ("uber").

const SOURCE = { dd: "doordash", ue: "ubereats", gh: "grubhub" } as const;
const usd = FX.usd0;
type PayTab = "summary" | "breakdown";

export function MasaPayouts() {
  const { account } = useAccount();
  const { canvasView } = useAgents();
  const [answer] = useOrderAnswer();
  const figs = useMemo(() => homeData(account.stores).byApp([LAST, LAST]), [account.stores]);
  const [tab, setTab] = useState<PayTab>(canvasView === "uber" ? "breakdown" : "summary");
  const [unit, setUnit] = useState<Unit>("usd");
  // A chat reply that points at part of the dashboard opens its tab (then scrolls to it, below).
  const [seenView, setSeenView] = useState(canvasView);
  if (canvasView !== seenView) {
    setSeenView(canvasView);
    if (canvasView === "uber") setTab("breakdown");
    if (canvasView === "unmatched") setTab("summary");
  }
  const unmatched = useRef<HTMLElement>(null);
  useEffect(() => {
    if (canvasView === "unmatched") unmatched.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [canvasView, tab]);
  const status = (u: FX.Unmatched) => (u.status === "Needs you" ? (answer === "yes" ? "Claimed" : answer === "no" ? "Not made" : "Needs you") : u.status);

  const stats: Stat[] = [
    { label: "Paid by the apps", value: usd(FX.PAID), sub: `▲ ${usd(FX.PAID_UP)} vs week before`, onOpen: () => setTab("breakdown") },
    { label: "The apps kept", value: FX.KEPT_ALL, sub: "Commission, promos, ads and chargebacks", onOpen: () => setTab("breakdown") },
    { label: "Orders paid", value: FX.ORDERS.paid.toLocaleString("en-US"), sub: `of ${FX.ORDERS.toast.toLocaleString("en-US")} delivery orders in Toast` },
    { label: "Not paid", value: FX.usd2(FX.UNPAID), sub: `${FX.ORDERS.unpaid} orders`, tone: "danger", onOpen: () => unmatched.current?.scrollIntoView({ behavior: "smooth", block: "start" }), hint: "Orders" },
  ];

  const columns: TableColumn<FX.Unmatched>[] = [
    { key: "id", header: "Order", cell: (u) => <b className="font-medium">{u.id}</b> },
    { key: "outlet", header: "Outlet", cell: (u) => u.outlet },
    { key: "day", header: "Day", cell: (u) => u.day },
    { key: "what", header: "What's wrong", cell: (u) => `In Toast, missing from ${FX.PAY_APP[u.app]}'s payout` },
    { key: "amount", header: "Amount", align: "right", cell: (u) => FX.usd2(u.amount) },
    { key: "status", header: "Status", cell: (u) => <span className={cn(status(u) === "Needs you" && "font-medium text-(--color-text-warning)")}>{status(u)}</span> },
  ];

  const checks: { tone: "ok" | "flag" | "off"; text: string }[] = [
    { tone: "ok", text: "Every app paid on its usual day" },
    { tone: "ok", text: `Commission charged at your plan rate (${FX.PAY.map((p) => `${FX.PAY_APP[p.app]} ${p.rate}%`).join(", ")})` },
    { tone: "flag", text: `${FX.ORDERS.unpaid} orders in Toast were not paid · ${FX.usd2(FX.UNPAID)}` },
    { tone: "flag", text: `Uber Eats kept ${FX.kept(FX.PAY[1])}% of sales, over your ${FX.PAY_LIMIT}% limit` },
    { tone: "ok", text: "No negative payouts or unexplained adjustments" },
    { tone: "off", text: "Deposits reached your bank · bank not connected yet" },
  ];

  return (
    <>
      <PageHeader title="Payouts" />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1080px] space-y-10 px-4 py-6 sm:px-6">
          <section aria-label="Payouts" className="space-y-3">
            <PageTabs
              id="payouts"
              tabs={[
                { value: "summary", label: "Summary" },
                { value: "breakdown", label: "Breakdown" },
              ]}
              value={tab}
              onChange={setTab}
              trailing={
                <>
                  {tab === "breakdown" && <ShowAs value={unit} onChange={setUnit} />}
                  {/* One complete week: the agent checks a week at a time, so there's no period to pick. */}
                  <span className="inline-flex h-8 items-center gap-1.5 px-1 text-menu-sm text-(--color-text-secondary)">
                    <CalendarDays aria-hidden className="size-3.5" />
                    Nov 1, 2026 – Nov 7, 2026
                  </span>
                </>
              }
            />
            {tab === "summary" ? (
              <div id="payouts-summary" role="tabpanel">
                <StatTiles stats={stats} caption="Toast orders matched to each app's payout · bank deposits not checked" />
              </div>
            ) : (
              <div id="payouts-breakdown" role="tabpanel" className="pt-2">
                <Section id="pay-revenue" title="Revenue & payout" aside={canvasView === "uber" ? <span className="text-body-sm text-(--color-text-secondary)">Uber Eats: commission {FX.PAY[1].rate}%, promos {usd(FX.PAY[1].promos)}, ads {usd(FX.PAY[1].ads)}</span> : undefined}>
                  <PayoutTable figs={figs} unit={unit} highlight={canvasView === "uber" ? "uber" : undefined} />
                </Section>
              </div>
            )}
          </section>

          {tab === "summary" && (
            <>
              {/* One tile per app: when it paid, what it paid, and the share of sales it paid over the last 4 payouts. */}
              <Section id="pay-apps" title="Each app's payout">
                <div className={cn(card, "grid gap-px overflow-hidden bg-(--color-border-default) sm:grid-cols-3")}>
                  {FX.PAY.map((p) => {
                    const over = FX.kept(p) > FX.PAY_LIMIT;
                    return (
                      <div key={p.app} className="flex min-w-0 flex-col gap-3 bg-(--color-background-secondary) p-5">
                        <span className="flex items-center justify-between gap-2 text-body-sm text-(--color-text-secondary)">
                          <AppName source={SOURCE[p.app]} name={FX.PAY_APP[p.app]} />
                          <span>Paid {p.paidOn}</span>
                        </span>
                        <div>
                          <p className="text-jumbo-sm tabular-nums text-(--color-text-primary)">{usd(p.paid)}</p>
                          <p className="mt-1.5 text-body-sm text-(--color-text-secondary)">▲ {usd(p.up)} vs week before</p>
                        </div>
                        <div className="border-t border-(--color-border-default) pt-3">
                          <p className="text-body-sm text-(--color-text-secondary)">Paid to you, % of sales · last 4 payouts</p>
                          <p className="mt-0.5 text-body-md tabular-nums text-(--color-text-primary)">{p.trend.join(" · ")}</p>
                          {over && <p className="mt-1 text-body-sm font-medium text-(--color-text-warning)">Kept {FX.kept(p)}%, over your {FX.PAY_LIMIT}% limit</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section
                id="pay-unpaid"
                title="Orders not paid"
                aside={<span className="text-body-sm text-(--color-text-secondary)">{`${FX.UNMATCHED.length} orders · ${FX.usd2(FX.UNPAID)}`}</span>}
                sectionRef={unmatched}
                className={cn("rounded-large", canvasView === "unmatched" && "ring-2 ring-(--color-primary) ring-offset-4")}
              >
                <div className={cn(card, "overflow-hidden [&>section]:mx-0 [&>section]:rounded-none [&>section]:border-0")}>
                  <ReportTable columns={columns} rows={FX.UNMATCHED} rowKey={(u) => u.id} noun="orders" />
                </div>
                {!answer && (
                  <div className="pt-2">
                    <OrderAction />
                  </div>
                )}
              </Section>

              <Section id="pay-checks" title="Checks">
                <ul className={cn(card, "divide-y divide-(--color-border-default)")}>
                  {checks.map((c) => (
                    <li key={c.text} className="flex items-start gap-3 px-5 py-3 text-body-md text-(--color-text-primary)">
                      {c.tone === "ok" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-(--color-text-success)" aria-label="Passed" /> : c.tone === "flag" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-(--color-text-warning)" aria-label="Needs a look" /> : <CircleMinus className="mt-0.5 size-4 shrink-0 text-(--color-text-tertiary)" aria-label="Not checked" />}
                      <span className={cn(c.tone === "off" && "text-(--color-text-secondary)")}>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
