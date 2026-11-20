"use client";
import { useEffect, useRef } from "react";
import { CircleCheck, CircleMinus, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { useOutletFilter } from "@/components/mvp2/OutletFilters";
import { Tray } from "@/components/mvp2/parts";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import { LAST } from "@/components/finance/PnlStory";
import * as FX from "@/lib/mvp3/masaFixture";
import { useOrderAnswer } from "@/lib/mvp3/orderAnswer";
import { useAgents } from "./AgentsProvider";
import { FilterBar } from "./masaParts";
import { OrderAction } from "./OrderAction";

// Masa Kitchen's Payouts dashboard: the complete week Nov 1–7, as the Friday email reports it (leadership flow 2,
// 2026-11-20). A 2-way check: Toast orders against each app's report and payout; bank deposits aren't checked.
// Every figure is in lib/mvp3/masaFixture and matches the chat and the email. The chat's replies switch it to the
// unpaid orders ("unmatched") or the Uber Eats breakdown ("uber"). The app figures cover every outlet.

const SOURCE = { dd: "doordash", ue: "ubereats", grubhub: "grubhub", gh: "grubhub" } as const;
const usd = FX.usd0;

export function MasaPayouts() {
  const scope = useOutletFilter([LAST, LAST]);
  const { canvasView } = useAgents();
  const [answer] = useOrderAnswer();
  const unmatched = useRef<HTMLElement>(null);
  const uber = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = canvasView === "unmatched" ? unmatched.current : canvasView === "uber" ? uber.current : null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [canvasView]);
  const status = (u: FX.Unmatched) => (u.status === "Needs you" ? (answer === "yes" ? "Claimed" : answer === "no" ? "Not made" : "Needs you") : u.status);

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
  const breakdown: [string, (p: FX.PayRow) => number, boolean?][] = [
    ["Sales", (p) => p.sales],
    ["Commission", (p) => p.commission],
    ["Promos", (p) => p.promos],
    ["Ads", (p) => p.ads],
    ["Chargebacks, after money back", (p) => p.chargebacks],
    ["Paid to you", (p) => p.paid, true],
  ];

  return (
    <>
      <PageHeader title="Payouts" />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="px-6 pt-4">
          <FilterBar scope={scope} />
        </div>
        <div className="flex flex-col gap-4 px-6 py-6 [&>*]:shrink-0">
          <p className="text-body-sm text-(--color-text-secondary)">
            {FX.WEEK} · Toast orders matched to each app&apos;s payout · bank deposits not checked
          </p>
          {scope.filtered && <p className="rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-secondary)">These figures cover every outlet.</p>}

          {/* One tile per app: when it paid, what it paid, and the share of sales it paid over the last 4 payouts. */}
          <section aria-label="Each app's payout" className="grid gap-1.5 rounded-large bg-(--gray-300) p-1.5 sm:grid-cols-3">
            {FX.PAY.map((p) => {
              const over = FX.kept(p) > FX.PAY_LIMIT;
              return (
                <div key={p.app} className="flex min-w-0 flex-col gap-3 rounded-medium bg-(--color-background-secondary) p-4">
                  <span className="flex items-center justify-between gap-2 text-body-sm text-(--color-text-secondary)">
                    <AppName source={SOURCE[p.app]} name={FX.PAY_APP[p.app]} />
                    <span>Paid {p.paidOn}</span>
                  </span>
                  <div>
                    <p className="text-jumbo-sm tabular-nums text-(--color-text-primary)">{usd(p.paid)}</p>
                    <p className="mt-1 text-body-sm text-(--color-text-success)">▲ {usd(p.up)} vs last week</p>
                  </div>
                  <div>
                    <p className="text-body-sm text-(--color-text-secondary)">Paid to you, % of sales · last 4 payouts</p>
                    <p className="mt-0.5 text-body-md tabular-nums text-(--color-text-primary)">{p.trend.join(" · ")}</p>
                    {over && <p className="mt-1 text-body-sm font-medium text-(--color-text-warning)">Kept {FX.kept(p)}%, over your {FX.PAY_LIMIT}% limit</p>}
                  </div>
                </div>
              );
            })}
          </section>

          <Tray title="Did you get all your money?">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-body-sm text-(--color-text-secondary)">Delivery orders in Toast</dt>
                <dd className="text-subtitle-lg font-medium tabular-nums">{FX.ORDERS.toast.toLocaleString("en-US")}</dd>
                <dd className="text-body-sm text-(--color-text-secondary)">{usd(FX.PAY_SALES)} sold</dd>
              </div>
              <div>
                <dt className="text-body-sm text-(--color-text-secondary)">Paid by the apps</dt>
                <dd className="text-subtitle-lg font-medium tabular-nums">{FX.ORDERS.paid.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt className="text-body-sm text-(--color-text-secondary)">Not paid</dt>
                <dd className="text-subtitle-lg font-medium tabular-nums text-(--color-text-danger)">{FX.ORDERS.unpaid}</dd>
                <dd className="text-body-sm text-(--color-text-secondary)">{FX.usd2(FX.UNPAID)}</dd>
              </div>
            </dl>
          </Tray>

          {!answer && <OrderAction />}

          <Tray title="Checks">
            <ul className="space-y-2">
              {checks.map((c) => (
                <li key={c.text} className="flex items-start gap-2 text-body-md text-(--color-text-primary)">
                  {c.tone === "ok" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-(--color-text-success)" aria-label="Passed" /> : c.tone === "flag" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-(--color-text-warning)" aria-label="Needs a look" /> : <CircleMinus className="mt-0.5 size-4 shrink-0 text-(--color-text-tertiary)" aria-label="Not checked" />}
                  <span className={cn(c.tone === "off" && "text-(--color-text-secondary)")}>{c.text}</span>
                </li>
              ))}
            </ul>
          </Tray>

          <section ref={uber} aria-label="Where each app's sales went" className={cn("scroll-mt-4 rounded-large transition-shadow", canvasView === "uber" && "ring-2 ring-(--color-primary)")}>
            <Tray title="Where each app's sales went" sub={canvasView === "uber" ? `Uber Eats: commission ${FX.PAY[1].rate}%, promos ${usd(FX.PAY[1].promos)}, ads ${usd(FX.PAY[1].ads)}` : undefined}>
              <div className="-mx-5 -mb-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-body-md">
                  <thead className="bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary)">
                    <tr>
                      <th scope="col" className="px-5 py-2 font-medium" />
                      {FX.PAY.map((p) => (
                        <th key={p.app} scope="col" className={cn("px-5 py-2 text-right font-medium", canvasView === "uber" && p.app === "ue" && "text-(--color-text-primary)")}>
                          {FX.PAY_APP[p.app]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border-default)">
                    {breakdown.map(([label, get, total]) => (
                      <tr key={label} className={cn(total && "bg-(--color-neutral-lightest)")}>
                        <th scope="row" className={cn("px-5 py-2 text-left", total ? "font-semibold" : "font-normal text-(--color-text-secondary)")}>
                          {label}
                        </th>
                        {FX.PAY.map((p) => (
                          <td key={p.app} className={cn("px-5 py-2 text-right tabular-nums", total && "font-semibold", canvasView === "uber" && p.app === "ue" && "bg-(--color-brand-lightest)")}>
                            {usd(get(p))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tray>
          </section>

          <section ref={unmatched} aria-label="Unpaid orders" className={cn("scroll-mt-4 rounded-large", canvasView === "unmatched" && "ring-2 ring-(--color-primary)")}>
            <Tray title="Orders not paid" sub={`${FX.UNMATCHED.length} orders · ${FX.usd2(FX.UNPAID)}`}>
              <div className="-mx-5 -mb-4 [&>section]:mx-0 [&>section]:border-y-0">
                <ReportTable columns={columns} rows={FX.UNMATCHED} rowKey={(u) => u.id} noun="orders" />
              </div>
            </Tray>
          </section>
        </div>
      </div>
    </>
  );
}
