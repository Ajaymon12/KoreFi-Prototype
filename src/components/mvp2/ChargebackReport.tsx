"use client";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Pencil, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MultiSelectChip } from "@/components/ui/MultiSelectChip";
import {
  AppName,
  ReportTable,
  type TableColumn,
} from "@/components/ui/ReportTable";
import {
  DetailDrawer,
  DetailList,
  DrawerSection,
  Timeline,
  type TimelineStep,
} from "@/components/ui/DetailDrawer";
import { StatusBadge } from "@/components/dashboard/primitives";
import { Segmented, usd } from "@/components/finance/parts";
import {
  CHANNELS,
  WEEKS,
  pct0,
  pctOf,
  short,
} from "@/components/finance/PnlStory";
import {
  APPS,
  OPS_STATUS_LABEL,
  STATUS_LABEL,
  WINDOW_DAYS,
  appLabel,
  chargebacks,
  daysBetween,
  type AppKey,
  type CbStatus,
  type Chargeback,
} from "@/lib/finance/chargebacks";
import { reportWeek } from "@/lib/finance/reports";
import {
  applyUpdates,
  disputeKey,
  updateDispute,
  useDisputeUpdates,
  type DisputeUpdate,
} from "@/lib/admin/disputes";
import { useSession } from "@/lib/admin/session";
import { accountChargebacks } from "@/lib/admin/queue";
import { logActivity } from "@/lib/admin/today";
import { useClient } from "@/lib/admin/client";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { UpdateDisputeDialog } from "@/components/admin/UpdateDisputeDialog";
import { cn } from "@/lib/utils";
import { Key, ScopeBar, Section, StatRow, useScope } from "./parts";
import { ChargebackTable } from "./ChargebackTable";
import { NoOutlets } from "./OutletFilters";
import { outletOf } from "@/lib/finance/outlets";

// MVP 2 / Chargebacks: the dev dashboard's Chargeback Overview and Transactions as one report, two
// views (?tab=transactions). Same outlets + date bar as the P&L, plus Apps; 13 weeks by default so the
// trend has a shape. Everything comes from lib/finance/chargebacks, so it adds up to the P&L's figures.
// What changed from the dev screens:
//   - one set of words for the money: Charged back → Won back / Being disputed / Kept by the app. The
//     dev cards mixed "Claimable", "Won $0" and "Total recovered $199" for overlapping things.
//   - error rate by week, one line per app on one axis (a single monthly bar said nothing)
//   - by outlet as one bar per outlet split by outcome, instead of three mostly-empty bars each
//   - transactions in plain words with the outcome and the app's deadline; a row opens its timeline
// KoreFi files every dispute, so nothing here asks the owner to act. The ops admin uses the same report
// with `ops` (/admin/chargebacks): status in ops' words, plus Update dispute on each transaction. Ops'
// updates (lib/admin/disputes) apply in both, so the owner sees the outcome but never the notes.

const TONE: Record<CbStatus, "success" | "warning" | "danger" | "neutral"> = {
  new: "neutral",
  won: "success",
  disputing: "warning",
  lost: "danger",
};
const COLOR: Record<CbStatus, string> = {
  new: "var(--chart-open)",
  won: "var(--chart-won)",
  disputing: "var(--chart-open)",
  lost: "var(--chart-lost)",
};
// Outcome buckets for the money. "Not filed yet" counts with "Being disputed": both are still open.
const STATUSES = ["won", "disputing", "lost"] as const;
const ORDER: CbStatus[] = ["new", "disputing", "won", "lost"];
const open = (c: Chargeback) => c.status === "disputing" || c.status === "new";
const APP_COLOR = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.color]),
) as Record<AppKey, string>;
const LAST = WEEKS.length - 1;
const AS_OF = new Date(WEEKS[LAST].start.getTime() + 6 * 86_400_000)
  .toISOString()
  .slice(0, 10);

const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const cents = (n: number) => `$${n.toFixed(2)}`;
const sum = (
  rows: Chargeback[],
  get: (c: Chargeback) => number = (c) => c.amount,
) => rows.reduce((n, c) => n + get(c), 0);
const key = disputeKey;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const winRate = (rows: Chargeback[]) => {
  const decided = rows.filter((c) => !open(c));
  return decided.length
    ? decided.filter((c) => c.status === "won").length / decided.length
    : null;
};

/** `ops` + `accountId`: the ops admin's copy for one user, from lib/admin/queue (their chargebacks, with
 * the not-yet-filed ones), so it matches the Dashboard. */
export function ChargebackReport({
  ops = false,
  accountId,
}: {
  ops?: boolean;
  accountId?: string;
}) {
  const params = useSearchParams();
  const updates = useDisputeUpdates();
  // Ops only work the transactions (the overview's charts are in the user's view).
  const view =
    ops || params.get("tab") === "transactions" ? "transactions" : "overview";
  const scope = useScope(1);
  const [apps, setApps] = useState<string[]>([]);
  const chosenApps = (apps.length ? apps : APPS.map((a) => a.key)) as AppKey[];
  const [a, b] = scope.range;
  const generated = chargebacks(WEEKS, a, b, scope.stores);
  const rows = applyUpdates(
    accountId ? accountChargebacks(accountId, generated) : generated,
    updates,
  ).filter((c) => chosenApps.includes(c.app));

  return (
    <>
      <PageHeader
        title={
          ops
            ? "Chargebacks"
            : view === "transactions"
              ? "Chargeback Transactions"
              : "Chargeback Overview"
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ScopeBar scope={scope}>
          <MultiSelectChip
            label="Apps"
            noun="apps"
            icon={LayoutGrid}
            options={APPS.map((x) => ({ value: x.key, label: x.label }))}
            value={apps}
            onChange={setApps}
          />
        </ScopeBar>
        {scope.stores.length === 0 ? (
          <NoOutlets scope={scope.outlets} />
        ) : view === "overview" ? (
          <Overview rows={rows} scope={scope} apps={chosenApps} ops={ops} />
        ) : (
          <Transactions
            rows={rows}
            linked={params.get("open")}
            ops={ops}
            updates={updates}
            accountId={accountId}
          />
        )}
      </div>
    </>
  );
}

// ───────────────────────── Overview ─────────────────────────

const OUTLETS_SHOWN = 8;

function Overview({
  rows,
  scope,
  apps,
  ops,
}: {
  rows: Chargeback[];
  scope: ReturnType<typeof useScope>;
  apps: AppKey[];
  ops: boolean;
}) {
  const [sort, setSort] = useState<"charged" | "won" | "rate">("charged");
  // The top outlets for the sort until "Show all": a chain can have dozens.
  const [allOutlets, setAllOutlets] = useState(false);
  const by = (s: CbStatus) =>
    rows.filter((c) => (s === "disputing" ? open(c) : c.status === s));
  const charged = sum(rows);
  const won = sum(by("won"), (c) => c.wonBack);
  const disputing = sum(by("disputing"));
  // Lost, plus what a partly-won charge didn't get back.
  const kept = charged - won - disputing;
  const rate = winRate(rows);
  const [a, b] = scope.range;

  // Error rate: what the apps charged back as a share of their sales, week by week.
  const weeks = Array.from({ length: b - a + 1 }, (_, i) => {
    const w = WEEKS[a + i];
    const sales = Object.fromEntries(APPS.map((x) => [x.key, 0])) as Record<
      AppKey,
      number
    >;
    for (const s of scope.stores) {
      const r = reportWeek(s, w.year, w.w);
      for (const x of APPS) sales[x.key] += r[x.key].sales;
    }
    const mine = rows.filter((c) => c.week === a + i);
    const per = Object.fromEntries(
      apps.map((k) => [
        k,
        pctOf(sum(mine.filter((c) => c.app === k)), sales[k]),
      ]),
    ) as Partial<Record<AppKey, number>>;
    return {
      label: day(w.start.toISOString().slice(0, 10)),
      per,
      all: pctOf(
        sum(mine),
        apps.reduce((n, k) => n + sales[k], 0),
      ),
    };
  });
  // Each app's sales for the period, for the by-app table's error rates.
  const salesByApp = Object.fromEntries(APPS.map((x) => [x.key, 0])) as Record<
    AppKey,
    number
  >;
  for (const s of scope.stores)
    for (let i = a; i <= b; i++) {
      const r = reportWeek(s, WEEKS[i].year, WEEKS[i].w);
      for (const x of APPS) salesByApp[x.key] += r[x.key].sales;
    }
  const appSales = weeks.length
    ? scope.stores.reduce(
        (n, s) =>
          n +
          Array.from({ length: b - a + 1 }, (_, i) =>
            reportWeek(s, WEEKS[a + i].year, WEEKS[a + i].w),
          ).reduce((m, r) => m + apps.reduce((k, x) => k + r[x].sales, 0), 0),
        0,
      )
    : 0;

  const outlets = scope.stores
    .map((s) => {
      const mine = rows.filter((c) => c.store === s);
      const parts = {
        won: sum(
          mine.filter((c) => c.status === "won"),
          (c) => c.wonBack,
        ),
        disputing: sum(mine.filter(open)),
        lost: 0,
      };
      const total = sum(mine);
      parts.lost = total - parts.won - parts.disputing;
      const sales = Array.from({ length: b - a + 1 }, (_, i) =>
        reportWeek(s, WEEKS[a + i].year, WEEKS[a + i].w),
      ).reduce((m, r) => m + apps.reduce((k, x) => k + r[x].sales, 0), 0);
      return {
        store: s,
        total,
        parts,
        count: mine.length,
        rate: pctOf(total, sales),
        winRate: winRate(mine),
      };
    })
    .sort((x, y) =>
      sort === "charged"
        ? y.total - x.total
        : sort === "won"
          ? y.parts.won - x.parts.won
          : y.rate - x.rate,
    );
  const maxOutlet = Math.max(...outlets.map((o) => o.total), 1);

  const reasons = [...new Set(rows.map((c) => c.reason))]
    .map((r) => {
      const mine = rows.filter((c) => c.reason === r);
      return { reason: r, amount: sum(mine), count: mine.length };
    })
    .sort((x, y) => y.amount - x.amount);
  const maxReason = Math.max(...reasons.map((r) => r.amount), 1);

  return (
    <div className="space-y-4 p-4">
      <StatRow
        label={
          ops
            ? "Where this client's chargebacks stand"
            : "Where your chargebacks stand"
        }
        stats={[
          {
            label: "Charged back",
            value: usd(charged),
            sub: `${plural(rows.length, "order")} · ${(pctOf(charged, appSales) * 100).toFixed(1)}% of app sales`,
          },
          {
            label: "Won back",
            value: usd(won),
            tone: "success",
            sub:
              rate === null
                ? "None decided yet"
                : `${pct0(rate)} of decided disputes won`,
          },
          {
            label: "Being disputed",
            value: usd(disputing),
            sub:
              ops && by("new").length
                ? `${plural(by("disputing").length, "order")} · ${by("new").length} not filed yet`
                : `${plural(by("disputing").length, "order")} · filed by KoreFi`,
          },
          {
            label: "Kept by the apps",
            value: usd(kept),
            tone: kept > 0 ? "danger" : undefined,
            sub: `${plural(by("lost").length, "order")} lost`,
          },
        ]}
      />

      {/* Where every dollar charged back went */}
      {charged > 0 && (
        <div>
          <div
            className="flex h-2.5 overflow-hidden rounded-circle bg-(--gray-300)"
            role="img"
            aria-label={`Of ${usd(charged)} charged back: ${usd(won)} won back, ${usd(disputing)} being disputed, ${usd(kept)} kept by the apps`}
          >
            {[
              { s: "won" as const, v: won },
              { s: "disputing" as const, v: disputing },
              { s: "lost" as const, v: kept },
            ].map((x) => (
              <span
                key={x.s}
                className="h-full border-r-2 border-(--color-background-secondary) last:border-r-0"
                style={{
                  width: `${pctOf(x.v, charged) * 100}%`,
                  background: COLOR[x.s],
                }}
              />
            ))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Key color={COLOR.won}>Won back {pct0(pctOf(won, charged))}</Key>
            <Key color={COLOR.disputing}>
              Being disputed {pct0(pctOf(disputing, charged))}
            </Key>
            <Key color={COLOR.lost}>
              Kept by the apps {pct0(pctOf(kept, charged))}
            </Key>
            {!ops && (
              <span className="text-body-sm text-(--color-text-tertiary)">
                KoreFi disputes every eligible charge within a day. Nothing is
                needed from you.
              </span>
            )}
          </p>
        </div>
      )}

      <Section
        title="By app"
        sub="Where each app's chargebacks ended up. Open Charged back for the reasons."
      >
        <div className="overflow-x-auto border-t border-(--color-border-default) [&>table]:border-t-0 [&>table]:border-l-0">
          <ChargebackTable rows={rows} apps={apps} sales={salesByApp} />
        </div>
      </Section>

      <Section
        title="Error rate by week"
        sub="Charged back as a share of each app's sales. Lower is better."
      >
        <RateChart weeks={weeks} apps={apps} />
      </Section>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Section
          title="By outlet"
          sub="What each outlet was charged, and where it ended up"
          actions={
            <Segmented
              label="Sort outlets by"
              value={sort}
              onChange={setSort}
              options={[
                { key: "charged", label: "Charged back" },
                { key: "won", label: "Won back" },
                { key: "rate", label: "Error rate" },
              ]}
            />
          }
        >
          <ul className="divide-y divide-(--gray-300) border-t border-(--color-border-default)">
            {(allOutlets ? outlets : outlets.slice(0, OUTLETS_SHOWN)).map((o) => (
              <li key={o.store} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">
                    {short(o.store)}
                    <span className="ml-2 font-normal text-body-sm text-(--color-text-tertiary)">
                      {outletOf(o.store).city}, {outletOf(o.store).state}
                    </span>
                  </span>
                  <span className="text-body-md text-(--color-text-primary) tabular-nums">
                    {usd(o.total)}
                  </span>
                </div>
                <span className="mt-2 flex h-2 overflow-hidden rounded-circle bg-(--gray-200)">
                  <span
                    className="flex h-full"
                    style={{ width: `${(o.total / maxOutlet) * 100}%` }}
                  >
                    {STATUSES.map((s) => (
                      <span
                        key={s}
                        className="h-full"
                        style={{
                          width: `${pctOf(o.parts[s], o.total) * 100}%`,
                          background: COLOR[s],
                        }}
                        title={`${STATUS_LABEL[s]}: ${usd(o.parts[s])}`}
                      />
                    ))}
                  </span>
                </span>
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-body-sm text-(--color-text-secondary) tabular-nums">
                  <span>{plural(o.count, "order")}</span>
                  <span className="text-(--color-text-success)">
                    {usd(o.parts.won)} won back
                  </span>
                  <span>
                    {o.winRate === null
                      ? "none decided"
                      : `${pct0(o.winRate)} win rate`}
                  </span>
                  <span>{(o.rate * 100).toFixed(1)}% error rate</span>
                </p>
              </li>
            ))}
            {outlets.length === 0 && (
              <li className="px-5 py-8 text-center text-body-md text-(--color-text-secondary)">
                No outlets chosen.
              </li>
            )}
          </ul>
          {outlets.length > OUTLETS_SHOWN && (
            <button
              type="button"
              onClick={() => setAllOutlets((v) => !v)}
              className="w-full border-t border-(--gray-300) px-5 py-3 text-left text-body-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus-primary)"
            >
              {allOutlets
                ? `Show top ${OUTLETS_SHOWN}`
                : `Show all ${outlets.length} outlets`}
            </button>
          )}
        </Section>

        <Section
          title="What went wrong"
          sub="Chargebacks by the reason the app gave"
        >
          <ul className="space-y-3 border-t border-(--color-border-default) px-5 py-4">
            {reasons.map((r) => (
              <li key={r.reason}>
                <div className="flex items-baseline justify-between gap-3 text-body-md">
                  <span className="truncate text-(--color-text-primary)">
                    {r.reason}
                  </span>
                  <span className="text-(--color-text-primary) tabular-nums">
                    {usd(r.amount)}{" "}
                    <span className="text-body-sm text-(--color-text-secondary)">
                      · {r.count}
                    </span>
                  </span>
                </div>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-circle bg-(--gray-200)">
                  <span
                    className="block h-full rounded-circle bg-(--chart-neutral)"
                    style={{ width: `${(r.amount / maxReason) * 100}%` }}
                  />
                </span>
              </li>
            ))}
            {reasons.length === 0 && (
              <li className="py-4 text-center text-body-md text-(--color-text-secondary)">
                No chargebacks in this period.
              </li>
            )}
          </ul>
        </Section>
      </div>
    </div>
  );
}

/** One line per app and a heavier one for all of them, on one % axis. Hover a week for its numbers. */
function RateChart({
  weeks,
  apps,
}: {
  weeks: { label: string; per: Partial<Record<AppKey, number>>; all: number }[];
  apps: AppKey[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(
    0.005,
    ...weeks.flatMap((w) => [w.all, ...apps.map((k) => w.per[k] ?? 0)]),
  );
  const step = Math.ceil((max * 1000) / 4) / 1000; // tidy 0.1-point steps
  const top = step * 4;
  const x = (i: number) =>
    weeks.length === 1 ? 50 : (i / (weeks.length - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  const line = (get: (w: (typeof weeks)[number]) => number) =>
    weeks.map((w, i) => `${x(i)},${y(get(w))}`).join(" ");
  const every = Math.ceil(weeks.length / 8);
  const pctText = (v: number) => `${(v * 100).toFixed(1)}%`;
  const h = hover !== null ? weeks[hover] : null;

  return (
    <div className="border-t border-(--color-border-default) px-5 pt-4 pb-4">
      <div className="flex gap-3">
        <div className="flex h-52 w-10 shrink-0 flex-col justify-between text-right text-body-sm text-(--color-text-tertiary) tabular-nums">
          {[4, 3, 2, 1, 0].map((n) => (
            <span key={n} className="-my-2">
              {pctText(step * n)}
            </span>
          ))}
        </div>
        <div
          className="relative h-52 min-w-0 flex-1"
          onMouseLeave={() => setHover(null)}
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <span
              key={n}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-(--gray-300)"
              style={{ top: `${n * 25}%` }}
            />
          ))}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            role="img"
            aria-label={`Error rate by week, ${weeks[0]?.label} to ${weeks.at(-1)?.label}`}
          >
            {apps.map((k) => (
              <polyline
                key={k}
                points={line((w) => w.per[k] ?? 0)}
                fill="none"
                stroke={APP_COLOR[k]}
                strokeWidth={1.5}
                strokeOpacity={hover === null ? 0.75 : 0.5}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            ))}
            {apps.length > 1 && (
              <polyline
                points={line((w) => w.all)}
                fill="none"
                stroke="var(--color-primary-solid)"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            )}
          </svg>
          {h && hover !== null && (
            <>
              <span
                aria-hidden
                className="absolute inset-y-0 w-px bg-(--color-border-darker)"
                style={{ left: `${x(hover)}%` }}
              />
              <div
                className={cn(
                  "pointer-events-none absolute top-1 z-10 w-48 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.12)]",
                  x(hover) > 60
                    ? "-translate-x-[calc(100%+8px)]"
                    : "translate-x-2",
                )}
                style={{ left: `${x(hover)}%` }}
              >
                <p className="mb-1.5 text-subtitle-xs text-(--color-text-primary)">
                  Week of {h.label}
                </p>
                {apps.length > 1 && (
                  <p className="flex justify-between text-body-sm font-medium text-(--color-text-primary) tabular-nums">
                    <Key color="var(--color-primary-solid)">All apps</Key>
                    {pctText(h.all)}
                  </p>
                )}
                {apps.map((k) => (
                  <p
                    key={k}
                    className="flex justify-between text-body-sm text-(--color-text-primary) tabular-nums"
                  >
                    <Key color={APP_COLOR[k]}>{appLabel(k)}</Key>
                    {pctText(h.per[k] ?? 0)}
                  </p>
                ))}
              </div>
            </>
          )}
          {/* Hover targets, one per week */}
          <div className="absolute inset-0 flex">
            {weeks.map((w, i) => (
              <span
                key={i}
                className="h-full flex-1"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="relative mt-2 ml-[52px] h-4 text-body-sm text-(--color-text-tertiary)">
        {weeks.map((w, i) =>
          i % every === 0 || i === weeks.length - 1 ? (
            <span
              key={i}
              className={cn(
                "absolute whitespace-nowrap",
                i === 0
                  ? ""
                  : i === weeks.length - 1
                    ? "-translate-x-full"
                    : "-translate-x-1/2",
              )}
              style={{ left: `${x(i)}%` }}
            >
              {w.label}
            </span>
          ) : null,
        )}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {apps.length > 1 && (
          <Key color="var(--color-primary-solid)">All apps</Key>
        )}
        {apps.map((k) => (
          <Key key={k} color={APP_COLOR[k]}>
            {appLabel(k)}
          </Key>
        ))}
      </p>
    </div>
  );
}

// ───────────────────────── Transactions ─────────────────────────

/** The dispute's steps, as far as it has got. */
export function timeline(c: Chargeback): TimelineStep[] {
  const app = appLabel(c.app);
  const steps: TimelineStep[] = [
    {
      label: `${app} charged ${cents(c.amount)} back`,
      date: day(c.date),
      state: "done",
    },
  ];
  if (c.status === "new") {
    steps.push({ label: "KoreFi is preparing the dispute", state: "current" });
    steps.push({
      label: c.windowCloses
        ? `File by ${day(c.windowCloses)}`
        : `Decision from ${app}`,
      state: "upcoming",
    });
    return steps;
  }
  steps.push({
    label: "KoreFi filed the dispute with the order evidence",
    date: day(c.date),
    state: "done",
  });
  if (c.status === "disputing") {
    steps.push({ label: `Waiting on ${app}`, state: "current" });
    steps.push({
      label: c.windowCloses
        ? `${app} decides by ${day(c.windowCloses)}`
        : `Decision from ${app}`,
      state: "upcoming",
    });
  } else if (c.status === "won") {
    steps.push({
      label:
        c.wonBack < c.amount
          ? `Won back ${cents(c.wonBack)} of ${cents(c.amount)}`
          : `Won back ${cents(c.wonBack)}`,
      date: c.decided && day(c.decided),
      state: "done",
    });
  } else {
    steps.push({
      label: `${app} kept it, siding with the customer`,
      date: c.decided && day(c.decided),
      state: "failed",
    });
  }
  return steps;
}

function Transactions({
  rows,
  linked,
  ops,
  updates,
  accountId,
}: {
  rows: Chargeback[];
  linked: string | null;
  ops: boolean;
  updates: Record<string, DisputeUpdate[]>;
  accountId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(linked);
  const [editing, setEditing] = useState<Chargeback | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    undo: () => void;
  } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const { email } = useSession();
  const { client } = useClient();
  const cur = rows.find((c) => key(c) === openId);
  const at = cur ? rows.indexOf(cur) : -1;
  const label = ops ? OPS_STATUS_LABEL : STATUS_LABEL;
  const history = cur ? (updates[key(cur)] ?? []) : [];

  const columns: TableColumn<Chargeback>[] = [
    {
      key: "order",
      header: "Order",
      cell: (c) => (
        <AppName
          source={APPS.find((x) => x.key === c.app)!.source}
          name={c.id}
        />
      ),
      sub: (c) => appLabel(c.app),
      sort: (c) => c.id,
    },
    {
      key: "outlet",
      header: "Outlet",
      cell: (c) => short(c.store),
      sort: (c) => c.store,
    },
    {
      key: "date",
      header: "Charged on",
      cell: (c) => day(c.date),
      sort: (c) => c.date,
    },
    {
      key: "what",
      header: "What happened",
      cell: (c) => c.reason,
      sub: (c) => <span className="block max-w-64 truncate">{c.detail}</span>,
      sort: (c) => c.reason,
    },
    {
      key: "amount",
      header: "Charged",
      align: "right",
      cell: (c) => cents(c.amount),
      sort: (c) => c.amount,
    },
    {
      key: "back",
      header: "Won back",
      align: "right",
      cell: (c) =>
        c.wonBack ? (
          <span className="text-(--color-text-success)">
            +{cents(c.wonBack)}
          </span>
        ) : (
          <span className="text-(--color-text-tertiary)">—</span>
        ),
      sort: (c) => c.wonBack,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <StatusBadge tone={TONE[c.status]}>{label[c.status]}</StatusBadge>
      ),
      sort: (c) => ORDER.indexOf(c.status),
    },
    {
      key: "when",
      header: "Decision",
      cell: (c) => {
        if (c.decided) return `Decided ${day(c.decided)}`;
        if (!c.windowCloses) return "No fixed deadline";
        const left = daysBetween(AS_OF, c.windowCloses);
        if (c.status === "new")
          return (
            <span className={cn(left <= 3 && "text-(--color-text-danger)")}>
              {left < 0
                ? "Window closed"
                : `File within ${plural(left, "day")}`}
            </span>
          );
        return left < 0 ? "Awaiting decision" : `Due in ${plural(left, "day")}`;
      },
      sort: (c) => c.decided ?? c.windowCloses ?? "9",
    },
    ...(ops
      ? [
          {
            key: "edit",
            header: "",
            width: "w-px",
            align: "right" as const,
            cell: (c: Chargeback) => (
              <Button
                type="text"
                size="tiny"
                icon={<Pencil aria-hidden />}
                aria-label={`Update dispute for ${c.id}`}
                title="Update dispute"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(c);
                }}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-4">
      <ReportTable
        columns={columns}
        rows={rows}
        rowKey={key}
        search={(c) =>
          `${c.id} ${c.store} ${c.reason} ${c.detail} ${appLabel(c.app)}`
        }
        searchPlaceholder="Search orders, outlets, reasons…"
        filters={[
          { key: "status", label: "Status", value: (c) => label[c.status] },
          { key: "reason", label: "Reason", value: (c) => c.reason },
        ]}
        noun="chargebacks"
        pageSize={15}
        initialSort={{ key: "date", dir: "desc" }}
        onRowClick={(c) => setOpenId(key(c))}
        selectedKey={openId}
        empty="No chargebacks for these outlets, apps and dates."
      />

      <DetailDrawer
        open={!!cur}
        onClose={() => setOpenId(null)}
        onPrev={at > 0 ? () => setOpenId(key(rows[at - 1])) : undefined}
        onNext={
          at >= 0 && at < rows.length - 1
            ? () => setOpenId(key(rows[at + 1]))
            : undefined
        }
        icon={ShieldAlert}
        eyebrow={cur && `${appLabel(cur.app)} chargeback`}
        title={cur ? cents(cur.amount) : ""}
        status={
          cur && (
            <StatusBadge tone={TONE[cur.status]}>
              {label[cur.status]}
            </StatusBadge>
          )
        }
        meta={cur && `${cur.detail} · Order ${cur.id} · ${day(cur.date)}`}
        permalink={
          cur
            ? `${ops ? "/admin" : accountId ? "/admin/as" : "/mvp2"}/chargebacks?tab=transactions&open=${encodeURIComponent(key(cur))}`
            : undefined
        }
        footer={
          ops &&
          cur && (
            <Button
              type="primary"
              size="small"
              iconLeft={<Pencil aria-hidden />}
              onClick={() => setEditing(cur)}
            >
              Update dispute
            </Button>
          )
        }
      >
        {cur && (
          <>
            <DrawerSection title="Where it is">
              <Timeline steps={timeline(cur)} />
            </DrawerSection>
            <DetailList
              rows={[
                { label: "Outlet", value: cur.store },
                { label: "Reason", value: cur.reason },
                { label: "Charged", value: cents(cur.amount) },
                {
                  label: "Won back",
                  value: cur.wonBack ? cents(cur.wonBack) : "—",
                },
                {
                  label: "App's window",
                  value: WINDOW_DAYS[cur.app]
                    ? `${WINDOW_DAYS[cur.app]} days`
                    : "No fixed window",
                },
              ]}
            />
            {ops && history.length > 0 && (
              <DrawerSection title="Ops updates">
                <ul className="space-y-2.5 px-4">
                  {[...history].reverse().map((u, i) => (
                    <li key={i} className="text-body-sm">
                      <p className="text-(--color-text-primary)">
                        Set to {OPS_STATUS_LABEL[u.status]}
                        {u.status === "won" &&
                          u.recovered !== undefined &&
                          ` · ${cents(u.recovered)} recovered`}
                        {u.reason && ` · ${u.reason}`}
                      </p>
                      {u.note && (
                        <p className="text-(--color-text-secondary)">
                          {u.note}
                        </p>
                      )}
                      <p className="text-(--color-text-tertiary)">
                        {u.by} ·{" "}
                        {new Date(u.at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </DrawerSection>
            )}
            <p className="text-body-sm text-(--color-text-secondary)">
              {cur.status === "new"
                ? "Not filed with the app yet."
                : cur.status === "disputing"
                  ? "KoreFi filed this dispute. Nothing is needed from you."
                  : cur.status === "won"
                    ? "Paid back by the app after KoreFi's dispute."
                    : "Disputed by KoreFi, but the app sided with the customer."}
            </p>
            <p className="text-body-sm text-(--color-text-tertiary)">
              Source: {appLabel(cur.app)} payout report.
            </p>
          </>
        )}
      </DetailDrawer>

      {editing && (
        <UpdateDisputeDialog
          c={editing}
          asOf={AS_OF}
          onClose={() => setEditing(null)}
          onSave={(change) => {
            const undoUpdate = updateDispute(key(editing), {
              ...change,
              at: new Date().toISOString(),
              by: email || "KoreFi ops",
            });
            const undoLog = logActivity({
              kind: "dispute",
              text:
                change.status === "disputing"
                  ? `Filed 1 dispute (${editing.id})`
                  : `Set ${editing.id} to ${OPS_STATUS_LABEL[change.status]}`,
              who: client?.company,
              amount: change.status === "won" ? change.recovered : undefined,
            });
            const undo = () => {
              undoUpdate();
              undoLog();
            };
            setToast({
              message: `${editing.id} set to ${OPS_STATUS_LABEL[change.status]}`,
              undo,
            });
            setEditing(null);
          }}
        />
      )}
      <Toast
        message={toast?.message ?? null}
        action={toast ? { label: "Undo", onClick: toast.undo } : undefined}
        onDismiss={dismissToast}
      />
    </div>
  );
}
