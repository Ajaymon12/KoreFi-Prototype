"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarClock, ChevronRight, LayoutGrid, MessageSquare, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAST } from "@/components/finance/PnlStory";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";
import type { TimelineWeek } from "@/components/finance/TimelineRange";
import { FOLDERS, REPORTS, WEEK_LABEL, chargebackOutlets, payoutCheck, worstOutlets, type AgentId } from "@/lib/mvp3/agents";
import { hasHome } from "@/lib/mvp3/accounts";
import { runHistory, usd, type Run } from "@/lib/mvp3/runs";
import { dashData, scopeLabel, type Dashboard } from "@/lib/mvp3/dashboards";
import { RUNS, RUN_FROM, clip, homeData, net, over, periodsFor, totalOf, type HomeData } from "@/lib/mvp3/home";
import * as FX from "@/lib/mvp3/masaFixture";
import { useAgents } from "./AgentsProvider";
import { Note, OUTLETS_SHOWN, OutletBars, OutletKey, PageTabs, PayoutTable, Section, ShowAs, StatTiles, card, inset, type Stat, type Unit } from "./pageParts";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";
import { useOpenPinned } from "./Mvp3Sidebar";
import { focusRing } from "@/components/mvp3/styles";

// MVP 3 / Home, as Figma "Korefi – Agents" › Home · scenarios (node 49:1253):
//  - At a glance, two tabs over one period chip (opens on last week):
//      Summary   last week: app sales, what the apps kept, what they paid (vs the week before), won back over 13 weeks.
//                Any tile opens Breakdown. A longer period shows totals from the weekly agent runs instead (H4);
//                a period the agents never ran in says so (H5).
//      Breakdown revenue & payout per app (in $ or as % of each app's sales), and sales by outlet, 3PD vs the rest.
//  - Needs a look (Taco Pros only): what the agents flagged; each asks its question in a chat.
//  - Your agents: a card per live agent (latest run, its figure and 13-week trend). Opens the agent's page.
//  - Your dashboards: what's pinned, with its schedule. Opens the dashboard beside the chat it was built in.
//  - First run (H7, an account with every agent off): no figures yet, the agents to set up, no dashboards yet.
// Home is fixed: it can't be customised, pinned or scheduled; that's what pinned dashboards are for. Report only.

const DAY = 86_400_000;
const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
const when = (at: number) => new Date(at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const fmt = (d: Date, year = false) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year && { year: "numeric" }), timeZone: "UTC" });
const weekEnd = (w: TimelineWeek) => new Date(w.start.getTime() + 6 * DAY);
/** "Nov 1, 2026 – Nov 7, 2026" */
const rangeText = (weeks: TimelineWeek[], [a, b]: [number, number]) => `${fmt(weeks[a].start, true)} – ${fmt(weekEnd(weeks[b]), true)}`;
/** "Aug 9–15", or "Jul 30 – Aug 5" across a month. */
const weekText = (w: TimelineWeek) => {
  const end = weekEnd(w);
  return end.getUTCMonth() === w.start.getUTCMonth() ? `${fmt(w.start)}–${end.getUTCDate()}` : `${fmt(w.start)} – ${fmt(end)}`;
};
const weeksText = (n: number) => `${n} week${n === 1 ? "" : "s"}`;

// The live agents on Home. Each card leads with one figure from its runs (the sparkline follows it).
const LIVE = [
  { id: "chargebacks", tag: "Delivery" },
  { id: "payouts", tag: "Delivery" },
] as const;

export function AgentHome() {
  const router = useRouter();
  const { account } = useAccount();
  const { ask, dashboards, getWorkflow } = useAgents();
  const allowed = hasHome(account);

  // Home is for accounts with it: any other restaurant (or switching to one while here) goes back to the chat.
  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  const firstRun = LIVE.every((a) => getWorkflow(a.id)?.state !== "live");
  const data = useMemo(() => homeData(account.stores), [account.id]); // eslint-disable-line react-hooks/exhaustive-deps -- follows the open account
  const [tab, setTab] = useState<"summary" | "breakdown">("summary");
  const [range, setRange] = useState<[number, number]>([LAST, LAST]);

  if (!allowed) return null;

  const pinned = dashboards.filter((d) => d.pinned);
  const go = (question: string) => {
    ask(question);
    router.push("/");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1080px] space-y-10 px-4 py-6 sm:p-8">
        {firstRun ? (
          <section aria-labelledby="glance-h" className="space-y-3">
            <h1 id="glance-h" className="sr-only">
              Home
            </h1>
            <Note title="No figures yet" text="Your sales, payouts and chargebacks show up here after an agent's first run." />
          </section>
        ) : (
          <Glance data={data} tab={tab} setTab={setTab} range={range} setRange={setRange} />
        )}

        {!firstRun && !account.limited && <Flags go={go} />}

        <Section
          id="agents"
          title="Your agents"
          aside={
            <Link href="/agents" className={cn("inline-flex items-center gap-1 rounded-medium text-body-md text-(--color-text-clickable) hover:underline", focusRing)}>
              All agents <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          }
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {LIVE.map((a) => (
              <li key={a.id}>{getWorkflow(a.id)?.state === "live" ? <AgentTile id={a.id} data={data} /> : <SetupTile id={a.id} tag={a.tag} />}</li>
            ))}
          </ul>
        </Section>

        <Section id="dash" title="Your dashboards">
          {pinned.length ? (
            <ul className={cn(card, "divide-y divide-(--color-border-default) overflow-hidden")}>
              {pinned.map((d) => (
                <li key={d.id}>
                  <DashRow d={d} />
                </li>
              ))}
            </ul>
          ) : firstRun ? (
            <Note title="No dashboards yet" text="Each agent adds its dashboard here once it has run." />
          ) : (
            <Note title="No dashboards yet" text="Pin anything from a chat to keep it here. Ask an agent, then say “pin it”." />
          )}
        </Section>
      </div>
    </div>
  );
}

// ───────── At a glance ─────────

type GlanceProps = { data: HomeData; tab: "summary" | "breakdown"; setTab: (t: "summary" | "breakdown") => void; range: [number, number]; setRange: (r: [number, number]) => void };

function Glance({ data, tab, setTab, range, setRange }: GlanceProps) {
  const [unit, setUnit] = useState<Unit>("usd");
  const ran = clip(range);
  const empty = !ran && (
    <p className={cn(card, "px-5 py-6 text-body-md text-(--color-text-secondary)")}>
      No weekly runs in {rangeText(data.weeks, range)}. The runs here start {weekText(data.weeks[RUN_FROM])}; older weeks can be pulled on request.
    </p>
  );

  return (
    <section aria-labelledby="glance-h" className="space-y-3">
      {/* No visible title (user ask 2026-11-27): the tabs lead. Kept for screen readers. */}
      <h1 id="glance-h" className="sr-only">
        Home
      </h1>
      <PageTabs
        id="glance"
        tabs={[
          { value: "summary", label: "Summary" },
          { value: "breakdown", label: "Breakdown" },
        ]}
        value={tab}
        onChange={setTab}
        trailing={
          <>
            {tab === "breakdown" && <ShowAs value={unit} onChange={setUnit} />}
            <DateRangeFilter weeks={data.weeks} presets={periodsFor(data.weeks)} value={range} onChange={setRange} dates align="right" accent />
          </>
        }
      />

      {tab === "summary" ? (
        <div id="glance-summary" role="tabpanel">
          {empty || (range[0] === LAST ? <WeekTiles data={data} onOpen={() => setTab("breakdown")} /> : <RunTiles data={data} range={range} ran={ran!} />)}
        </div>
      ) : (
        <div id="glance-breakdown" role="tabpanel" className="space-y-10 pt-2">
          {empty || <Breakdown data={data} ran={ran!} unit={unit} />}
        </div>
      )}
    </section>
  );
}

/** Last week: four figures in one panel, split by hairlines. Each opens the Breakdown tab. */
function WeekTiles({ data, onOpen }: { data: HomeData; onOpen: () => void }) {
  const t = totalOf(data.byApp([LAST, LAST]));
  const paid = net(t);
  const diff = paid - data.series.paid[RUNS - 2];
  const all: [number, number] = [RUN_FROM, LAST];
  const stats: Stat[] = [
    { label: "App sales", value: usd(t.sales), sub: "DoorDash, Uber Eats and Grubhub", onOpen },
    { label: "The apps kept", value: pct1((t.sales - paid) / (t.sales || 1)), sub: "Commission, promos, ads and chargebacks", onOpen },
    { label: "Paid by the apps", value: usd(paid), sub: `${diff >= 0 ? "▲" : "▼"} ${usd(Math.abs(diff))} vs week before`, onOpen },
    // The one figure here that isn't last week: its label says so, so it can't be read as last week's.
    { label: `Won back, last ${RUNS} weeks`, value: usd(over(data.series.won, all)), sub: `of ${usd(over(data.series.charged, all))} charged back`, tone: "success", onOpen },
  ];
  return <StatTiles stats={stats} />;
}

/** A longer period: what the weekly runs found, added up over the weeks the agents ran in. */
function RunTiles({ data, range, ran }: { data: HomeData; range: [number, number]; ran: [number, number] }) {
  const s = data.series;
  const n = weeksText(ran[1] - ran[0] + 1);
  const charged = over(s.charged, ran);
  const won = over(s.won, ran);
  const orders = over(s.unmatchedOrders, ran);
  const stats: Stat[] = [
    { label: "Paid by the apps", value: usd(over(s.paid, ran)), sub: n },
    { label: "Charged back", value: usd(charged), sub: n },
    { label: "Won back", value: usd(won), sub: `${Math.round((won / (charged || 1)) * 100)}% of charged back`, tone: "success" },
    { label: "Didn't match Toast", value: FX.usd2(over(s.unmatched, ran)), sub: `${orders.toLocaleString("en-US")} order${orders === 1 ? "" : "s"}` },
  ];
  return <StatTiles stats={stats} caption={<>Totals from the weekly agent runs{ran[0] !== range[0] && ` · ${rangeText(data.weeks, ran)}`}</>} />;
}

// ───────── Breakdown ─────────

function Breakdown({ data, ran, unit }: { data: HomeData; ran: [number, number]; unit: Unit }) {
  const outlets = data.byOutlet(ran);
  return (
    <>
      <Section id="revenue" title="Revenue & payout">
        <PayoutTable figs={data.byApp(ran)} unit={unit} />
      </Section>
      <Section id="outlets" title="By outlet" aside={<OutletKey total={outlets.length} />}>
        <OutletBars rows={outlets.slice(0, OUTLETS_SHOWN)} unit={unit} />
      </Section>
    </>
  );
}

// ───────── Needs a look (Taco Pros) ─────────

function Flags({ go }: { go: (q: string) => void }) {
  const data = useMemo(() => {
    const pay = payoutCheck();
    return { pay, off: pay.rows?.filter((r) => r.tone === "danger").length ?? 0, worst: worstOutlets().rows?.[0], topCb: chargebackOutlets().rows?.[0] };
  }, []);
  // alert: a real exception (money not matched). The rest are rankings worth a look, so they get a neutral mark.
  type Flag = { title: string; sub: string; question: string; alert?: boolean };
  const flags = [
    data.off > 0 && { title: data.pay.title, sub: `Week of ${WEEK_LABEL} · KoreFi is checking them with the apps`, question: "Did every payout match Toast?", alert: true },
    data.topCb && { title: `${data.topCb.label} has the most chargebacks`, sub: `${data.topCb.sub} · ${data.topCb.value} over 13 weeks`, question: "Which outlets get the most chargebacks?" },
    data.worst && { title: `${data.worst.label} has the lowest profit margin`, sub: `${data.worst.value} of sales kept as profit · last 4 weeks`, question: "Which outlets made the least?" },
  ].filter(Boolean) as Flag[];

  return (
    <Section id="flags" title="Needs a look" aside={flags.length ? <span className="text-body-sm text-(--color-text-secondary)">{flags.length} this week</span> : undefined}>
      {flags.length ? (
        <ul className={cn(card, "divide-y divide-(--color-border-default) overflow-hidden")}>
          {flags.map((f) => (
            <li key={f.question}>
              <button type="button" onClick={() => go(f.question)} title={`Ask: ${f.question}`} className={cn("group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-(--color-neutral-lightest)", inset)}>
                <span className="grid size-10 shrink-0 place-items-center">
                  <span className={cn("size-2 rounded-circle", f.alert ? "bg-(--color-warning-default)" : "bg-(--color-border-darker)")} />
                  {f.alert && <span className="sr-only">Needs checking:</span>}
                </span>
                <Lines title={f.title} sub={f.sub} />
                <span className="inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <MessageSquare aria-hidden className="size-3.5" />
                  Ask why
                </span>
                <Chevron />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Note title="Nothing flagged this week" text="Your agents will post here when something changes." />
      )}
    </Section>
  );
}

// ───────── Agents ─────────

const skillOf = (id: string) => {
  const folder = FOLDERS.find((f) => f.skills.some((s) => s.id === id))!;
  return { skill: folder.skills.find((s) => s.id === id)!, agent: folder.agent as AgentId };
};

/** What a live agent's card leads with: the latest run's headline, figure and trend, all from the same runs. */
function useTile(id: string, data: HomeData) {
  return useMemo(() => {
    const { skill, agent } = skillOf(id);
    const latest = runHistory(id, skill.thread)[0] as Run | undefined;
    const s = data.series;
    const ran = data.ran?.[id] ?? (latest ? when(latest.at) : undefined);
    if (id === "chargebacks") {
      const won = s.won[RUNS - 1];
      const headline = FX.masaFixture() ? `${FX.CHARGES.filter((x) => x.status === "Won").length} disputes won, ${usd(won)} back` : latest?.headline;
      return { name: skill.name, agent, headline, value: usd(won), label: "won back, last run", second: `of ${usd(s.charged[RUNS - 1])} charged back`, spark: s.won, ran };
    }
    const n = s.unmatchedOrders[RUNS - 1];
    return {
      name: skill.name,
      agent,
      headline: n ? `${n} order${n === 1 ? "" : "s"} don't match Toast` : "Every payout matched Toast",
      value: FX.usd2(s.unmatched[RUNS - 1]),
      label: "not matched yet, last run",
      second: `${data.orders.matched.toLocaleString("en-US")} of ${data.orders.all.toLocaleString("en-US")} orders matched`,
      spark: s.unmatched,
      ran,
    };
  }, [id, data]);
}

/** A trend line in neutral ink: it shows shape over time, not good or bad, so it never takes a status colour. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const W = 200;
  const H = 56;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full shrink overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A live agent as a card: face, name and Live badge; the latest run's headline; its figure over 13 weeks; when it ran.
 *  The whole card opens the agent's page (overview, runs, activity). */
function AgentTile({ id, data }: { id: string; data: HomeData }) {
  const a = useTile(id, data);
  return (
    <Link
      href={`/agent?id=${id}`}
      className={cn(card, "group flex h-full flex-col px-5 pt-5 pb-3 transition-[border-color,box-shadow] hover:border-(--color-border-darker) hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]", focusRing, "focus-visible:outline-offset-2")}
    >
      <span className="flex items-center gap-3">
        <AgentAvatar agent={a.agent} size={36} />
        <span className="min-w-0 flex-1 truncate text-subtitle-md font-medium text-(--color-text-primary)">{a.name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-circle bg-(--color-success-lightest) px-2 py-0.5 text-body-sm font-medium text-(--color-text-success) shadow-[0_0_0_1px_var(--color-border-default)]">
          <span className="size-1.5 rounded-circle bg-current" />
          Live
        </span>
      </span>
      <span className="pt-5 text-body-md text-(--color-text-secondary)">{a.headline ?? "No runs yet"}</span>
      <span className="flex items-end justify-between gap-4 pt-4">
        <span className="shrink-0">
          <span className="block text-jumbo-sm tabular-nums text-(--color-text-primary)">{a.value}</span>
          <span className="block pt-1 text-body-sm text-(--color-text-secondary)">{a.label}</span>
          <span className="block text-body-sm tabular-nums text-(--color-text-tertiary)">{a.second}</span>
        </span>
        <span className="flex min-w-0 flex-col items-end gap-1">
          <Spark values={a.spark} />
          <span className="text-body-sm text-(--color-text-tertiary)">{a.spark.length} weeks</span>
        </span>
      </span>
      <span className="mt-5 flex items-center justify-between gap-2 border-t border-(--color-border-default) pt-3">
        <span className="text-body-sm text-(--color-text-secondary)">{a.ran ? `Ran ${a.ran}` : "Not run yet"}</span>
        <span className="inline-flex items-center gap-1 text-body-md text-(--color-text-clickable)">
          View details
          <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

/** An agent not turned on yet (first run): what it does, Not live, and Set up (its editor). */
function SetupTile({ id, tag }: { id: string; tag: string }) {
  const { getWorkflow } = useAgents();
  const { skill, agent } = skillOf(id);
  const w = getWorkflow(id);
  return (
    <div className={cn(card, "relative flex h-full flex-col p-5")}>
      <span className="flex items-center gap-3">
        <AgentAvatar agent={agent} size={32} mood="sleeping" />
        <Link href={`/agent?id=${id}`} className="min-w-0 flex-1 truncate text-subtitle-md font-medium text-(--color-text-primary) outline-none after:absolute after:inset-0 after:rounded-large focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--color-focus-primary)">
          {w?.title ?? skill.name}
        </Link>
      </span>
      <p className="mt-4 line-clamp-2 text-body-md text-(--color-text-secondary)">{w?.overview ?? skill.blurb}</p>
      <span className="mt-4 flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
        <span className="rounded-circle px-2 py-0.5 shadow-[0_0_0_1px_var(--color-border-default)]">Not running</span>
        {tag}
        <Link
          href={`/agent?id=${id}&edit=1&from=home`}
          className={cn("relative z-10 ml-auto inline-flex h-7 items-center gap-1.5 rounded-medium border border-(--color-border-default) px-2.5 text-body-md text-(--color-text-primary) hover:border-(--color-primary) hover:text-(--color-text-clickable)", focusRing)}
        >
          <SlidersHorizontal aria-hidden className="size-3.5" />
          Set up
        </Link>
      </span>
    </div>
  );
}

// ───────── Shared parts ─────────

/** A row's title and one-line subtitle; both truncate so every row stays one height. */
function Lines({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{title}</span>
      <span className="block truncate text-body-sm text-(--color-text-secondary)">{sub}</span>
    </span>
  );
}

const Chevron = () => <ChevronRight aria-hidden className="size-4 shrink-0 text-(--color-text-tertiary) transition-colors group-hover:text-(--color-text-secondary)" />;

/** What a pinned dashboard's row says under its title. The team-pinned sample dashboards lead with the sample week. */
function dashSub(d: Dashboard) {
  if (d.pinnedBy === "team" && FX.masaFixture()) {
    const lead = d.workflow === "chargebacks" ? `${usd(FX.CBST.won)} won back` : d.workflow === "payouts" ? `${usd(FX.PAID)} paid` : d.report ? REPORTS[d.report].sub : null;
    if (lead) return `${lead} · Last week · All apps · All outlets`;
  }
  return d.report ? `${REPORTS[d.report].sub} · Pinned report` : `${usd(dashData(d.config).kpis.won)} won back · ${scopeLabel(d.config)}`;
}

/** A pinned dashboard as a row: title and headline, schedule. Opens it in its chat with the canvas. */
function DashRow({ d }: { d: Dashboard }) {
  const openPinned = useOpenPinned();
  return (
    <Link href={`/dashboard?id=${d.id}`} onClick={(e) => openPinned(d.id) && e.preventDefault()} className={cn("group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-(--color-neutral-lightest)", inset)}>
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-medium bg-(--gray-300) text-(--color-text-secondary)">
        <LayoutGrid className="size-[18px]" />
      </span>
      <Lines title={d.title} sub={dashSub(d)} />
      <span className="hidden shrink-0 items-center gap-1.5 text-body-sm text-(--color-text-secondary) md:inline-flex">
        {d.automation ? (
          <>
            <CalendarClock aria-hidden className="size-4" />
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
