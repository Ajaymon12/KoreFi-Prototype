"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarClock, FileText, LayoutDashboard, MessageSquare, Pin } from "lucide-react";
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

// MVP 3 / Home: the restaurant at a glance, from what the agents already read. Taco Pros only (Account.home).
//  - Pulse: last week's sales (Sales and Net after fees both open the weekly P&L chat), the apps' share, net after fees, chargebacks won back (same figures and spans as
//    the agent replies they open, so the numbers match).
//  - Agents: each live agent's latest run, with a sparkline of its runs. Opens that run's chat.
//  - Needs a look: what the agents flagged. Each asks its question in a chat.
//  - Your dashboards: what the owner pinned (Taco Pros starts with three). Opens the dashboard beside the chat it
//    was built in, sidebar folded to icons.
// Home is fixed: it can't be customised, pinned or scheduled; that's what pinned dashboards are for.
// Report only: the one action is asking (a chat), never a fix.

const focus = "outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";
const card = cn("group rounded-large border border-(--color-border-default) bg-(--color-background-secondary) text-left transition-colors hover:border-(--color-border-darker) hover:bg-(--color-neutral-lightest)", focus);
const SOURCES = "DoorDash, Uber Eats, Grubhub and Square";

/** "Ask →" on hover: says what a click does. */
function AskHint({ label = "Ask" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      <MessageSquare aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

function Spark({ values, tone }: { values: number[]; tone?: "success" | "danger" }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const W = 96;
  const H = 28;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`).join(" ");
  const color = tone === "danger" ? "var(--color-text-danger)" : tone === "success" ? "var(--color-text-success)" : "var(--color-primary)";
  return (
    <svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const when = (at: number) => new Date(at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

// The live agents and the run metric each sparkline follows.
const LIVE: { id: string; metric: string }[] = [
  { id: "chargebacks", metric: "Won back" },
  { id: "payouts", metric: "Matched" },
];

export function AgentHome() {
  const router = useRouter();
  const { account } = useAccount();
  const { ask, openRun, getWorkflow, dashboards } = useAgents();

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
      LIVE.map(({ id, metric }) => {
        const skill = FOLDERS.flatMap((f) => f.skills).find((s) => s.id === id)!;
        const folder = FOLDERS.find((f) => f.skills.some((s) => s.id === id))!;
        const runs = runHistory(id, skill.thread);
        const m = runs[0]?.metrics.find((x) => x.label === metric);
        return { id, name: skill.name, agent: folder.agent as AgentId, latest: runs[0] as Run | undefined, spark: [...runs].reverse().map((r) => r.metrics.find((x) => x.label === metric)?.value ?? 0), metric, tone: m?.tone };
      }),
    [],
  );

  if (!account.home) return null;

  const go = (question: string) => {
    ask(question);
    router.push("/mvp3");
  };
  const openLatest = (a: (typeof agents)[number]) => {
    const w = getWorkflow(a.id);
    if (!w || !a.latest) return;
    openRun({ id: a.latest.id, thread: a.latest.thread, week: a.latest.week, reply: a.latest.reply }, w);
    router.push("/mvp3");
  };

  const { week, prev, won, cbs, sumOf } = data;
  const tiles: { label: string; value: string; delta?: React.ReactNode; sub: string; question: string; tone?: "success" }[] = [
    { label: "Sales", value: usd(week.all.sales), delta: <Delta now={week.all.sales} before={prev.all.sales} />, sub: "vs week before", question: "How did we do last week?" },
    { label: "From delivery apps", value: `${Math.round(data.appShare * 100)}%`, delta: <Delta now={data.appShare} before={data.appShareBefore} points />, sub: "of sales", question: "Which delivery app pays me more?" },
    { label: "Net after fees", value: usd(week.all.moneyIn), delta: <Delta now={week.all.moneyIn} before={prev.all.moneyIn} />, sub: `${Math.round((week.all.moneyIn / (week.all.sales || 1)) * 100)}¢ of every $1`, question: "How did we do last week?" },
    { label: "Chargebacks won back", value: usd(sumOf(won, "wonBack")), sub: `of ${usd(sumOf(cbs, "amount"))} · last 13 weeks`, question: "How are chargebacks going?", tone: "success" },
  ];

  const flags: { title: string; sub: string; agent: AgentId; question: string }[] = [
    data.off > 0 && { title: data.pay.title, sub: `Week of ${WEEK_LABEL} · the KoreFi team is checking them with the apps`, agent: "finance" as AgentId, question: "Did every payout match Square?" },
    data.topCb && { title: `${data.topCb.label} has the most chargebacks`, sub: `${data.topCb.sub} · ${data.topCb.value} over 13 weeks`, agent: "operations" as AgentId, question: "Which outlets get the most chargebacks?" },
    data.worst && { title: `${data.worst.label} kept the least`, sub: `${data.worst.value} profit margin over 4 weeks`, agent: "finance" as AgentId, question: "Which outlets made the least?" },
  ].filter(Boolean) as { title: string; sub: string; agent: AgentId; question: string }[];

  const pinned = dashboards.filter((d) => d.pinned);

  return (
    <>
      <PageHeader title="Home" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 sm:px-6">
          {/* Pulse */}
          <section aria-labelledby="pulse-h" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="pulse-h" className="text-subtitle-md text-(--color-text-primary)">
                Last week at a glance
              </h2>
              <p className="text-body-sm text-(--color-text-secondary)">
                Week of {WEEK_LABEL} · from {SOURCES} reports
              </p>
            </div>
            <div className="grid gap-1.5 rounded-large bg-(--gray-300) p-1.5 sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((t) => (
                <button key={t.label} type="button" onClick={() => go(t.question)} title={`Ask: ${t.question}`} className={cn("group flex min-w-0 flex-col justify-between gap-3 rounded-medium bg-(--color-background-secondary) p-4 text-left transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-border-darker)]", focus)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-body-sm text-(--color-text-secondary)">{t.label}</span>
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
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Agents */}
            <section aria-labelledby="agents-h" className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="agents-h" className="text-subtitle-md text-(--color-text-primary)">
                  Your agents
                </h2>
                <Link href="/mvp3/agents" className={cn("inline-flex items-center gap-1 rounded-medium text-body-sm text-(--color-text-clickable) hover:underline", focus)}>
                  All agents <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </div>
              <ul className="space-y-2">
                {agents.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => openLatest(a)} className={cn(card, "flex w-full items-center gap-3 p-4")}>
                      <AgentAvatar agent={a.agent} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body-md font-medium text-(--color-text-primary)">{a.name}</span>
                          {a.latest && <span className="shrink-0 text-body-sm text-(--color-text-secondary)">Ran {when(a.latest.at)}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-body-sm text-(--color-text-secondary)">{a.latest?.headline ?? "No runs yet"}</span>
                      </span>
                      <span className="hidden flex-col items-end gap-1 sm:flex">
                        <Spark values={a.spark} tone={a.tone} />
                        <span className="text-[11px] text-(--color-text-tertiary)">
                          {a.metric}, {a.spark.length} weeks
                        </span>
                      </span>
                      <span className="sr-only">Open the latest run&rsquo;s chat</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Needs a look */}
            <section aria-labelledby="flags-h" className="space-y-2.5">
              <h2 id="flags-h" className="text-subtitle-md text-(--color-text-primary)">
                Needs a look
              </h2>
              {flags.length ? (
                <ul className="space-y-2">
                  {flags.map((f) => (
                    <li key={f.question}>
                      <button type="button" onClick={() => go(f.question)} title={`Ask: ${f.question}`} className={cn(card, "flex w-full items-start gap-3 p-4")}>
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-circle bg-(--color-warning-default)" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-md font-medium text-(--color-text-primary)">{f.title}</span>
                          <span className="mt-0.5 block text-body-sm text-(--color-text-secondary)">{f.sub}</span>
                        </span>
                        <AskHint label="Ask why" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-large border border-dashed border-(--color-border-default) p-4 text-body-md text-(--color-text-secondary)">Nothing flagged this week. Your agents will post here when something changes.</p>
              )}
            </section>
          </div>

          {/* Your dashboards */}
          <section aria-labelledby="dash-h" className="space-y-2.5">
            <h2 id="dash-h" className="text-subtitle-md text-(--color-text-primary)">
              Your dashboards
            </h2>
            {pinned.length ? (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {pinned.map((d) => (
                  <li key={d.id}>
                    <DashCard d={d} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-large border border-dashed border-(--color-border-default) p-4 text-body-md text-(--color-text-secondary)">
                <Pin aria-hidden className="size-4 shrink-0" />
                Pin anything from a chat to keep it here. Ask an agent, then say “pin it”.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** A pinned dashboard: title, one headline figure, its schedule. Opens it in its chat with the canvas. */
function DashCard({ d }: { d: Dashboard }) {
  const headline = d.report ? REPORTS[d.report].sub : `${usd(dashData(d.config).kpis.won)} won back`;
  const sub = d.report ? "Pinned report" : scopeLabel(d.config);
  const openPinned = useOpenPinned();
  return (
    <Link href={`/mvp3/dashboard?id=${d.id}`} onClick={(e) => openPinned(d.id) && e.preventDefault()} className={cn(card, "flex h-full flex-col gap-2 p-4")}>
      <span className="flex items-center gap-2 text-body-md font-medium text-(--color-text-primary)">
        {d.report ? <FileText aria-hidden className="size-4 shrink-0 text-(--color-text-secondary)" /> : <LayoutDashboard aria-hidden className="size-4 shrink-0 text-(--color-text-secondary)" />}
        <span className="truncate">{d.title}</span>
      </span>
      <span className="text-subtitle-md tabular-nums text-(--color-text-primary)">{headline}</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-2 text-body-sm text-(--color-text-secondary)">
        <span>{sub}</span>
        {d.automation ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock aria-hidden className="size-3.5" />
            {d.automation.schedule}
          </span>
        ) : (
          <span>Updated {d.updated}</span>
        )}
      </span>
    </Link>
  );
}
