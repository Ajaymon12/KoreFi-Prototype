"use client";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/dashboard/primitives";
import { ProviderLogo } from "./ProviderLogo";
import { NOW, STEPS, activeWithin, ago, daysAgo } from "@/lib/admin/accounts";
import { PROVIDERS, SEED_HISTORY, UPLOAD_STATUS, provider, restaurant } from "@/lib/admin/data";
import { SEED_NEEDS_MAPPING } from "@/lib/admin/mock";
import { useAccounts } from "@/lib/admin/store";

// Ops Dashboard (/admin): what needs doing today, then how the customer base is doing. Every
// "needs attention" row links to the list it refers to, already filtered. Dummy data
// (src/lib/admin/accounts.ts, src/lib/admin/data.ts).

const UPLOADS = [SEED_NEEDS_MAPPING, ...SEED_HISTORY].sort((a, b) => b.at.localeCompare(a.at));

const needsMapping = UPLOADS.filter((u) => u.status === "needs_mapping").length;
const rejected = UPLOADS.filter((u) => u.status === "rejected").length;

type Task = { title: string; detail: string; count: number; href: string; tone: "warning" | "danger" | "info" };

const TONE_DOT = { warning: "bg-(--color-warning-default)", danger: "bg-(--color-danger-default)", info: "bg-(--color-info-default)" } as const;

export function OverviewView() {
  const ACCOUNTS = useAccounts();
  const total = ACCOUNTS.length;
  const active7 = ACCOUNTS.filter((a) => activeWithin(a, 7)).length;
  const joined30 = ACCOUNTS.filter((a) => daysAgo(a.joined) < 30).length;
  const inFlight = ACCOUNTS.filter((a) => a.status === "onboarding" || a.status === "stalled" || a.status === "invited");
  const stalled = ACCOUNTS.filter((a) => a.status === "stalled").length;
  const invited = ACCOUNTS.filter((a) => a.status === "invited").length;
  const staleData = ACCOUNTS.filter((a) => a.data === "stale" && a.status !== "suspended").length;
  const chargebacks = ACCOUNTS.reduce((n, a) => n + a.openChargebacks, 0);
  const chargebackCustomers = ACCOUNTS.filter((a) => a.openChargebacks > 0).length;
  const QUEUES: Task[] = [
    { title: "Uploads waiting for outlet mapping", detail: "Match each location in the file to an outlet", count: needsMapping, href: "/admin/uploads", tone: "warning" },
    { title: "Rejected uploads", detail: "Re-export the report and upload it again", count: rejected, href: "/admin/uploads", tone: "danger" },
    { title: "Stalled onboarding", detail: "No progress for over a week", count: stalled, href: "/admin/users?status=stalled", tone: "warning" },
    { title: "Customers with stale data", detail: "Nothing uploaded in 7+ days", count: staleData, href: "/admin/users?data=stale", tone: "warning" },
    { title: "Invites not accepted", detail: "Never signed in", count: invited, href: "/admin/users?status=invited", tone: "info" },
  ];
  const TASKS = QUEUES.filter((t) => t.count > 0);

  const funnel = STEPS.map((s) => ({ ...s, n: ACCOUNTS.filter((a) => a.step === s.id && a.status !== "suspended").length }));
  const funnelMax = Math.max(...funnel.map((f) => f.n));
  const coverage = PROVIDERS.map((p) => ({ p, n: ACCOUNTS.filter((a) => a.pos === p.id || a.delivery.includes(p.id)).length }));
  const coverageMax = Math.max(...coverage.map((c) => c.n));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Dashboard" actions={<span className="text-body-sm text-(--color-text-secondary)">{NOW.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
        <section aria-label="Key numbers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Customers" value={total} sub={`${joined30} joined in the last 30 days`} href="/admin/users" />
          <Kpi label="Active this week" value={active7} sub={`${Math.round((active7 / total) * 100)}% of customers signed in`} href="/admin/users" />
          <Kpi label="Still onboarding" value={inFlight.length} sub={`${stalled} stalled · ${invited} not accepted`} href="/admin/users?status=onboarding" />
          <Kpi label="Open chargebacks" value={chargebacks} sub={`across ${chargebackCustomers} customers`} />
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card title="Needs attention" aside={`${TASKS.length} ${TASKS.length === 1 ? "queue" : "queues"}`}>
            {TASKS.length === 0 ? (
              <p className="py-6 text-center text-body-md text-(--color-text-secondary)">All caught up.</p>
            ) : (
              <ul className="-mx-4 divide-y divide-(--color-border-default)">
                {TASKS.map((t) => (
                  <li key={t.title}>
                    <Link href={t.href} className="group flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-(--color-neutral-lightest)/60 focus-visible:bg-(--color-neutral-lightest)/60">
                      <span aria-hidden className={cn("size-2 shrink-0 rounded-circle", TONE_DOT[t.tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-md text-(--color-text-primary)">{t.title}</span>
                        <span className="block truncate text-body-sm text-(--color-text-secondary)">{t.detail}</span>
                      </span>
                      <span className="text-subtitle-md tabular-nums text-(--color-text-primary)">{t.count}</span>
                      <ChevronRight className="size-4 shrink-0 text-(--color-text-secondary) transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Onboarding funnel" aside="Where customers are now">
            <ol className="flex flex-col gap-2.5">
              {funnel.map((f) => (
                <li key={f.id} className="grid grid-cols-[96px_minmax(0,1fr)_24px] items-center gap-3 text-body-md">
                  <span className={cn("truncate", f.id === "done" ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>{f.label}</span>
                  <span className="h-2 overflow-hidden rounded-circle bg-(--color-neutral-lightest)">
                    <span className={cn("block h-full rounded-circle", f.id === "done" ? "bg-(--color-primary)" : "bg-(--color-primary)/45")} style={{ width: `${(f.n / funnelMax) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-(--color-text-primary)">{f.n}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card
            title="Recent uploads"
            aside={
              <Link href="/admin/uploads" className="inline-flex items-center gap-1 text-(--color-text-clickable) hover:underline">
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            <ul className="-mx-4 divide-y divide-(--color-border-default)">
              {UPLOADS.slice(0, 5).map((u) => {
                const s = UPLOAD_STATUS[u.status];
                const pv = provider(u.provider)!;
                return (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ProviderLogo id={pv.id} size={18} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md text-(--color-text-primary)">{u.fileName}</span>
                      <span className="block truncate text-body-sm text-(--color-text-secondary)">
                        {restaurant(u.restaurantId)?.name} · {u.rows.toLocaleString()} rows · {ago(u.at)}
                      </span>
                    </span>
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Connected sources" aside="Customers per provider">
            <ul className="flex flex-col gap-2.5">
              {coverage.map(({ p, n }) => (
                <li key={p.id} className="grid grid-cols-[104px_minmax(0,1fr)_24px] items-center gap-3 text-body-md">
                  <span className="flex items-center gap-2 text-(--color-text-primary)">
                    <ProviderLogo id={p.id} size={16} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-circle bg-(--color-neutral-lightest)">
                    <span className="block h-full rounded-circle bg-(--color-primary)/70" style={{ width: `${(n / coverageMax) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-(--color-text-primary)">{n}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, href }: { label: string; value: number; sub: string; href?: string }) {
  const body = (
    <>
      <p className="text-body-sm text-(--color-text-secondary)">{label}</p>
      <p className="mt-1 text-[28px] leading-9 font-medium tabular-nums text-(--color-text-primary)">{value}</p>
      <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{sub}</p>
    </>
  );
  const cls = "block rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-4";
  return href ? (
    <Link href={href} className={cn(cls, "outline-none transition-colors hover:border-(--color-border-darker) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-body-md font-medium text-(--color-text-primary)">{title}</h2>
        {aside && <span className="text-body-sm text-(--color-text-secondary)">{aside}</span>}
      </header>
      {children}
    </section>
  );
}
