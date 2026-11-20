"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarClock, ChevronRight, FileText, LayoutDashboard, MessageSquare, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { Delta } from "@/components/mvp2/parts";
import { CHANNELS } from "@/components/finance/PnlStory";
import { FOLDERS, REPORTS, WEEK_LABEL, chargebackOutlets, payoutCheck, snapshot, worstOutlets, type AgentId } from "@/lib/mvp3/agents";
import { runHistory, usd, type Run } from "@/lib/mvp3/runs";
import { dashData, scopeLabel, type Dashboard } from "@/lib/mvp3/dashboards";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";
import { useOpenPinned } from "./Mvp3Sidebar";
import { focusRing } from "@/components/mvp3/styles";

// MVP 3 / Home: the restaurant at a glance, from what the agents already read. Taco Pros only (Account.home).
//  - Pulse: last week's sales (Sales and Net after fees both open the weekly P&L chat), the apps' share, net after fees, chargebacks won back (same figures and spans as
//    the agent replies they open, so the numbers match).
//  - Agents: a card per live agent (latest run, its metric and sparkline). Opens the agent's details page.
//  - Needs a look: what the agents flagged. Each asks its question in a chat.
//  - Your dashboards: what the owner pinned (Taco Pros starts with three). Opens the dashboard beside the chat it
//    was built in, sidebar folded to icons.
// Layout: four stacked full-width sections, each the grey tray around a white panel; lists are divided rows of one
// height, so the page stays even however many agents, flags or dashboards there are.
// Home is fixed: it can't be customised, pinned or scheduled; that's what pinned dashboards are for.
// Report only: the one action is asking (a chat), never a fix.

// Every list row: one height, icon slot, title + subtitle, right-hand detail, chevron. Focus ring sits inside the panel.
const inset = "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus-primary)";
const row = cn("group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--color-neutral-lightest)", inset);
const SOURCES = "DoorDash, Uber Eats, Grubhub and Toast";

/** "Ask →" on hover: says what a click does. */
function AskHint({ label = "Ask" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      <MessageSquare aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

/** A trend line in neutral ink: it shows shape over time, not good or bad, so it never takes a status colour. */
function Spark({ values, wide }: { values: number[]; wide?: boolean }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const W = wide ? 240 : 96;
  const H = wide ? 44 : 28;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`).join(" ");
  const color = "var(--color-text-secondary)";
  return (
    <svg aria-hidden width={wide ? "100%" : W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="shrink-0 overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const when = (at: number) => new Date(at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

// The live agents and the figure each card leads with (its sparkline follows the same figure). Payouts leads with
// what hasn't matched yet, the money still at stake; what did match is the quieter second line.
type Lead = { label: string; value: (r: Run) => number; money: boolean; second?: (r: Run) => string | undefined };
const metric = (r: Run, label: string) => r.metrics.find((x) => x.label === label)?.value ?? 0;
const LIVE: { id: string; lead: Lead }[] = [
  { id: "chargebacks", lead: { label: "won back, last run", value: (r) => metric(r, "Won back"), money: true, second: (r) => `of ${usd(metric(r, "Charged back"))} charged back` } },
  {
    id: "payouts",
    lead: {
      label: "not matched yet, last run",
      value: (r) => metric(r, "In Toast only") + metric(r, "In app only"),
      money: true,
      second: (r) => `${usd(metric(r, "Matched"))} matched`,
    },
  },
];

export function AgentHome() {
  const router = useRouter();
  const { account } = useAccount();
  const { ask, dashboards } = useAgents();

  // Home is Taco Pros only: any other restaurant (or switching to one while here) goes back to the chat.
  useEffect(() => {
    if (!account.home) router.replace("/mvp3");
  }, [account.home, router]);

  const data = useMemo(() => {
    const { week, prev, won, cbs, sumOf } = snapshot();
    const apps = (c: typeof week.cols) => CHANNELS.filter((ch) => ch.app).reduce((n, ch) => n + c[ch.key].sales, 0);
    const pay = payoutCheck();
    const off = pay.rows?.reduce((n, r) => n + (r.tone === "danger" ? 1 : 0), 0) ?? 0;
    const worst = worstOutlets().rows?.[0];
    const topCb = chargebackOutlets().rows?.[0];
    return { week, prev, won, cbs, sumOf, appShare: apps(week.cols) / (week.all.sales || 1), appShareBefore: apps(prev.cols) / (prev.all.sales || 1), pay, off, worst, topCb };
  }, [account.id]); // eslint-disable-line react-hooks/exhaustive-deps -- snapshot() follows the open account

  const agents = useMemo(
    () =>
      LIVE.map(({ id, lead }) => {
        const skill = FOLDERS.flatMap((f) => f.skills).find((s) => s.id === id)!;
        const folder = FOLDERS.find((f) => f.skills.some((s) => s.id === id))!;
        const runs = runHistory(id, skill.thread);
        return { id, name: skill.name, agent: folder.agent as AgentId, latest: runs[0] as Run | undefined, spark: [...runs].reverse().map(lead.value), lead };
      }),
    [],
  );

  if (!account.home) return null;

  const go = (question: string) => {
    ask(question);
    router.push("/mvp3");
  };

  const { week, prev, won, cbs, sumOf } = data;
  const tiles: { label: string; value: string; delta?: React.ReactNode; sub: string; question: string; tone?: "success" }[] = [
    { label: "Sales", value: usd(week.all.sales), delta: <Delta now={week.all.sales} before={prev.all.sales} />, sub: "vs week before", question: "How did we do last week?" },
    { label: "From delivery apps", value: `${Math.round(data.appShare * 100)}%`, delta: <Delta now={data.appShare} before={data.appShareBefore} points />, sub: "of sales", question: "Which delivery app pays me more?" },
    { label: "Net after fees", value: usd(week.all.moneyIn), delta: <Delta now={week.all.moneyIn} before={prev.all.moneyIn} />, sub: `${Math.round((week.all.moneyIn / (week.all.sales || 1)) * 100)}¢ of every $1`, question: "How did we do last week?" },
    // The one figure here that isn't last week: its label says so, so it can't be read as last week's.
    { label: "Won back, last 13 weeks", value: usd(sumOf(won, "wonBack")), sub: `of ${usd(sumOf(cbs, "amount"))} charged back`, question: "How are chargebacks going?", tone: "success" },
  ];

  // alert: a real exception (money not matched). The rest are rankings worth a look, so they get a neutral mark.
  type Flag = { title: string; sub: string; agent: AgentId; question: string; alert?: boolean };
  const flags: Flag[] = [
    data.off > 0 && { title: data.pay.title, sub: `Week of ${WEEK_LABEL} · the KoreFi team is checking them with the apps`, agent: "finance" as AgentId, question: "Did every payout match Toast?", alert: true },
    data.topCb && { title: `${data.topCb.label} has the most chargebacks`, sub: `${data.topCb.sub} · ${data.topCb.value} over 13 weeks`, agent: "operations" as AgentId, question: "Which outlets get the most chargebacks?" },
    data.worst && { title: `${data.worst.label} has the lowest profit margin`, sub: `${data.worst.value} of sales kept as profit · last 4 weeks`, agent: "finance" as AgentId, question: "Which outlets made the least?" },
  ].filter(Boolean) as Flag[];

  const pinned = dashboards.filter((d) => d.pinned);

  return (
    <>
      <PageHeader title="Home" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] space-y-8 px-4 py-6 sm:px-6">
          {/* Pulse: four figures in one panel, split by hairlines */}
          <Section id="pulse" title="Last week at a glance" aside={<span className="text-body-sm text-(--color-text-secondary)">Week of {WEEK_LABEL} · from {SOURCES} reports</span>}>
            <div className="grid gap-px bg-(--color-border-default) sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((t) => (
                <button key={t.label} type="button" onClick={() => go(t.question)} title={`Ask: ${t.question}`} className={cn("group flex min-w-0 flex-col gap-3 bg-(--color-background-secondary) px-5 py-4 text-left transition-colors hover:bg-(--color-neutral-lightest)", inset)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-body-sm text-(--color-text-secondary)">{t.label}</span>
                    <AskHint />
                  </span>
                  <span>
                    <span className={cn("block text-jumbo-sm tabular-nums", t.tone === "success" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{t.value}</span>
                    <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-body-sm text-(--color-text-secondary)">
                      {t.delta}
                      <span>{t.sub}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Needs a look: what the agents flagged, first thing after the figures. Not for Masa Kitchen (user ask 2026-11-20). */}
          {!account.limited && (
          <Section id="flags" title="Needs a look" aside={flags.length ? <span className="text-body-sm text-(--color-text-secondary)">{flags.length} this week</span> : undefined}>
            {flags.length ? (
              <ul className="divide-y divide-(--color-border-default)">
                {flags.map((f) => (
                  <li key={f.question}>
                    <button type="button" onClick={() => go(f.question)} title={`Ask: ${f.question}`} className={row}>
                      <span className="grid size-8 shrink-0 place-items-center">
                        <span className={cn("size-2 rounded-circle", f.alert ? "bg-(--color-warning-default)" : "bg-(--color-border-darker)")} />
                        {f.alert && <span className="sr-only">Needs checking:</span>}
                      </span>
                      <Lines title={f.title} sub={f.sub} />
                      <AskHint label="Ask why" />
                      <Chevron />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-body-md text-(--color-text-secondary)">Nothing flagged this week. Your agents will post here when something changes.</p>
            )}
          </Section>
          )}

          {/* Agents: each live agent's latest run */}
          <Section
            id="agents"
            bare
            title="Your agents"
            aside={
              <Link href="/mvp3/agents" className={cn("inline-flex items-center gap-1 rounded-medium text-body-sm text-(--color-text-clickable) hover:underline", focusRing)}>
                All agents <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            }
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {agents.map((a) => (
                <li key={a.id}>
                  <AgentTile a={a} />
                </li>
              ))}
            </ul>
          </Section>

          {/* Your dashboards: what the owner pinned */}
          <Section id="dash" title="Your dashboards">
            {pinned.length ? (
              <ul className="divide-y divide-(--color-border-default)">
                {pinned.map((d) => (
                  <li key={d.id}>
                    <DashRow d={d} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-4 text-body-md text-(--color-text-secondary)">
                <Pin aria-hidden className="size-4 shrink-0" />
                Pin anything from a chat to keep it here. Ask an agent, then say “pin it”.
              </p>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

type AgentSummary = { id: string; name: string; agent: AgentId; latest?: Run; spark: number[]; lead: Lead };

/** A live agent as a card: face, name and Live badge; the latest run's headline; its lead figure over 13 weeks; when it ran.
 *  The whole card opens the agent's details page (overview, runs, activity). */
function AgentTile({ a }: { a: AgentSummary }) {
  const value = a.latest ? a.lead.value(a.latest) : undefined;
  const second = a.latest && a.lead.second?.(a.latest);
  return (
    <Link
      href={`/mvp3/agent?id=${a.id}`}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-xlarge border border-(--color-border-default) bg-(--color-background-secondary) p-5 transition-[border-color,box-shadow]",
        "hover:border-(--color-border-darker) hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]",
        focusRing,
        "focus-visible:outline-offset-2",
      )}
    >
      <span className="flex items-center gap-3">
        <AgentAvatar agent={a.agent} size={32} />
        <span className="min-w-0 flex-1 truncate text-body-lg font-medium text-(--color-text-primary)">{a.name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-circle bg-(--color-success-lightest) px-2 py-0.5 text-body-sm font-medium text-(--color-text-success) shadow-[0_0_0_1px_var(--color-border-default)]">
          <span className="size-1.5 rounded-circle bg-current" />
          Live
        </span>
      </span>
      <span className="text-body-md text-(--color-text-secondary)">{a.latest?.headline ?? "No runs yet"}</span>
      <span className="flex items-end gap-4">
        {value !== undefined && (
          <span className="shrink-0">
            <span className="block text-jumbo-sm tabular-nums text-(--color-text-primary)">{a.lead.money ? usd(value) : value.toLocaleString("en-US")}</span>
            <span className="mt-1 block text-body-sm text-(--color-text-secondary)">{a.lead.label}</span>
            {second && <span className="mt-0.5 block text-body-sm tabular-nums text-(--color-text-tertiary)">{second}</span>}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <Spark values={a.spark} wide />
          <span className="mt-1 block text-right text-body-sm text-(--color-text-tertiary)">{a.spark.length} weeks</span>
        </span>
      </span>
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-(--color-border-default) pt-3 text-body-sm">
        <span className="text-(--color-text-secondary)">{a.latest ? `Ran ${when(a.latest.at)}` : "Not run yet"}</span>
        <span className="inline-flex items-center gap-1 text-(--color-text-clickable)">
          View details
          <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

/** One home section: a title row, then the app's grey tray around a white panel (as on the Payout report). */
function Section({ id, title, aside, bare, children }: { id: string; title: string; aside?: React.ReactNode; bare?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-h`} className="text-subtitle-md text-(--color-text-primary)">
          {title}
        </h2>
        {aside}
      </div>
      {bare ? (
        children
      ) : (
        <div className="rounded-large bg-(--gray-300) p-1">
          <div className="overflow-hidden rounded-medium bg-(--color-background-secondary)">{children}</div>
        </div>
      )}
    </section>
  );
}

/** A row's title and one-line subtitle; both truncate so every row stays one height. */
function Lines({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{title}</span>
      <span className="mt-0.5 block truncate text-body-sm text-(--color-text-secondary)">{sub}</span>
    </span>
  );
}

const Chevron = () => <ChevronRight aria-hidden className="size-4 shrink-0 text-(--color-text-tertiary) transition-colors group-hover:text-(--color-text-secondary)" />;

/** A pinned dashboard as a row: title and headline, scope, schedule. Opens it in its chat with the canvas. */
function DashRow({ d }: { d: Dashboard }) {
  const headline = d.report ? REPORTS[d.report].sub : `${usd(dashData(d.config).kpis.won)} won back`;
  const sub = d.report ? "Pinned report" : scopeLabel(d.config);
  const openPinned = useOpenPinned();
  const Icon = d.report ? FileText : LayoutDashboard;
  return (
    <Link href={`/mvp3/dashboard?id=${d.id}`} onClick={(e) => openPinned(d.id) && e.preventDefault()} className={row}>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-medium bg-(--color-neutral-lightest) text-(--color-text-secondary)">
        <Icon className="size-4" />
      </span>
      <Lines title={d.title} sub={`${headline} · ${sub}`} />
      <span className="hidden shrink-0 items-center gap-1 text-body-sm text-(--color-text-secondary) md:inline-flex">
        {d.automation ? (
          <>
            <CalendarClock aria-hidden className="size-3.5" />
            {d.automation.schedule}
          </>
        ) : (
          <>Updated {d.updated}</>
        )}
      </span>
      <Chevron />
    </Link>
  );
}
