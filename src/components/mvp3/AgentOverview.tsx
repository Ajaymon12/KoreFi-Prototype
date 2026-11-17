"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, ChevronRight, LayoutDashboard, Mail, MessageSquare, Pencil, Play, Search, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { StatusBadge } from "@/components/dashboard/primitives";
import { FOLDERS, type AgentReply } from "@/lib/mvp3/agents";
import { isSchedule, type Workflow } from "@/lib/mvp3/workflows";
import { asOf, runHistory, type Run } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { IntegrationMark } from "./WorkflowEditor";

// A live agent's home (/mvp3/agent?id=chargebacks), after the "live automation" screens in Dots-style tools:
//  - top: back to Agents, Edit (opens the workflow editor) and Run;
//  - left: what it does, who set it up, what it reads, its triggers and where results go;
//  - right: runs over the last 7 / 30 / 90 days;
//  - below: every run with its trigger, the headline it posted and its numbers. A row opens that run's chat.
// Report-only: the numbers say what happened; the KoreFi team does every fix.

const DAY = 86_400_000;
const btn = "inline-flex h-9 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-4";
const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const SPANS = [90, 30, 7] as const;

type Row = { id: string; at: number | null; minutes: number; status: "completed" | "running"; trigger: "scheduled" | "manual"; week: string; headline: string; stats: NonNullable<AgentReply["stats"]>; reply: AgentReply; thread?: string };

function RunsChart({ runs }: { runs: Row[] }) {
  const [span, setSpan] = useState<(typeof SPANS)[number]>(30);
  const end = asOf();
  const days = Array.from({ length: span }, (_, i) => end - (span - 1 - i) * DAY);
  const counts = days.map((d) => runs.filter((r) => (r.at ?? end) >= d && (r.at ?? end) < d + DAY).length);
  // At least 2 on the scale, so a weekly agent's single runs read as steady ticks, not walls.
  const max = Math.max(2, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const tick = span === 7 ? 1 : span === 30 ? 7 : 21;
  const label = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <section className="rounded-xlarge border border-(--color-border-default) bg-(--color-background-secondary) p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-body-lg font-medium text-(--color-text-primary)">Runs</h2>
          <p className="text-body-sm text-(--color-text-secondary)">
            {total} in the last {span} days
          </p>
        </div>
        <div role="group" aria-label="Period" className="flex overflow-hidden rounded-medium border border-(--color-border-default)">
          {SPANS.map((s) => (
            <button key={s} type="button" aria-pressed={span === s} onClick={() => setSpan(s)} className={cn("h-8 px-3 text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&+&]:border-l [&+&]:border-(--color-border-default)", span === s ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)")}>
              Last {s} days
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex h-36 items-end gap-px border-b border-(--color-border-default)" role="img" aria-label={`${total} runs in the last ${span} days`}>
        {counts.map((c, i) => (
          <div key={i} title={`${label(days[i])}: ${c} ${c === 1 ? "run" : "runs"}`} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
            <span className={cn("w-full max-w-3 rounded-t-small bg-[color-mix(in_srgb,var(--hue)_55%,var(--color-background-secondary))] transition-colors group-hover:bg-(--hue)", !c && "h-px bg-transparent")} style={c ? { height: `${(c / max) * 100}%` } : undefined} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-px">
        {days.map((d, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-(--color-text-tertiary)">
            {(span - 1 - i) % tick === 0 ? label(d) : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

export function AgentOverview({ w }: { w: Workflow }) {
  const router = useRouter();
  const { threads, runAgent, openRun, dashboards } = useAgents();
  const [q, setQ] = useState("");
  const [trigger, setTrigger] = useState<"all" | "scheduled" | "manual">("all");
  const skill = FOLDERS.flatMap((f) => f.skills).find((s) => s.id === w.id);
  const dash = dashboards.find((d) => d.workflow === w.id && d.pinned);
  const schedule = w.triggers.filter(isSchedule);
  const events = w.triggers.filter((t) => !isSchedule(t));

  const rows: Row[] = useMemo(() => {
    // Runs started in this session: chats that begin with "Run <agent>".
    const mine: Row[] = threads
      .filter((t) => t.workflow === w.id && t.messages[0]?.role === "user" && t.messages[0].text.startsWith("Run "))
      .map((t) => {
        const last = t.messages.find((m) => m.role === "agent");
        const reply = last && "reply" in last ? last.reply : null;
        return { id: t.id, at: null, minutes: 1, status: reply ? "completed" : "running", trigger: "manual", week: "Last 13 weeks", headline: reply?.title ?? "Running…", stats: reply?.stats ?? [], reply: reply ?? { agent: t.agent, title: "Running…", lines: [], work: [] }, thread: t.id };
      });
    const past: Row[] = runHistory(w.id, skill?.thread).map((r: Run) => ({ id: r.id, at: r.at, minutes: r.minutes, status: r.status, trigger: r.trigger, week: r.week, headline: r.headline, stats: r.reply.stats ?? [], reply: r.reply, thread: r.thread }));
    return [...mine, ...past];
  }, [threads, w.id, skill?.thread]);

  const shown = rows.filter((r) => (trigger === "all" || r.trigger === trigger) && (!q.trim() || `${r.headline} ${r.week}`.toLowerCase().includes(q.trim().toLowerCase())));
  const cols = rows.find((r) => r.stats.length)?.stats.map((s) => s.label) ?? [];

  const go = (r: Row) => {
    openRun({ id: r.id, thread: r.thread, week: r.week, reply: r.reply }, w);
    router.push("/mvp3");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-(--color-background-primary)" style={{ ["--hue" as string]: w.hue ?? "var(--color-primary)" }}>
      <div className="mx-auto w-full max-w-[1280px] space-y-8 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/mvp3/agents" className="inline-flex items-center gap-1.5 text-body-md text-(--color-text-secondary) hover:text-(--color-text-primary)">
            <ArrowLeft className="size-4" aria-hidden />
            Back to Agents
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/mvp3/agent?id=${w.id}&edit=1`} className={btn}>
              <Pencil aria-hidden />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => {
                runAgent(w);
                router.push("/mvp3");
              }}
              className={cn(btn, "border-transparent bg-(--color-primary) text-white hover:bg-(--color-primary) hover:opacity-90")}
            >
              <Play aria-hidden />
              Run
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {w.agent && <AgentAvatar agent={w.agent} size={36} />}
                <h1 className="min-w-0 flex-1 text-subtitle-lg font-medium text-(--color-text-primary)">{w.title}</h1>
                <StatusBadge tone="success">Live</StatusBadge>
              </div>
              <p className="text-body-md leading-relaxed text-(--color-text-secondary)">{w.overview}</p>
              <p className="text-body-sm text-(--color-text-tertiary)">Set up by the KoreFi team · Live since {rows.length ? fmtDate(rows[rows.length - 1].at ?? asOf()) : "today"}</p>
            </div>

            <dl className="divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-background-secondary) text-body-sm">
              <div className="flex items-start gap-4 px-4 py-3">
                <dt className="w-24 shrink-0 text-(--color-text-secondary)">Triggers</dt>
                <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {[...schedule, ...events].length ? (
                    [...schedule, ...events].map((t) => (
                      <span key={t} className="inline-flex items-center gap-1.5 rounded-medium bg-(--color-neutral-lightest) px-2 py-1 text-(--color-text-primary)">
                        {isSchedule(t) ? <CalendarClock className="size-3.5 text-(--hue)" aria-hidden /> : <Zap className="size-3.5 text-(--hue)" aria-hidden />}
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-(--color-text-secondary)">Runs when you ask</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start gap-4 px-4 py-3">
                <dt className="w-24 shrink-0 text-(--color-text-secondary)">Reads</dt>
                <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {w.integrations.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1.5 rounded-medium bg-(--color-neutral-lightest) py-1 pr-2 pl-1 text-(--color-text-primary)">
                      <IntegrationMark name={a} size={16} />
                      {a}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="flex items-start gap-4 px-4 py-3">
                <dt className="w-24 shrink-0 text-(--color-text-secondary)">Sends to</dt>
                <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-medium bg-(--color-neutral-lightest) px-2 py-1 text-(--color-text-primary)">
                    <MessageSquare className="size-3.5 text-(--hue)" aria-hidden />
                    Chat
                  </span>
                  {w.deliver.email && (
                    <span className="inline-flex items-center gap-1.5 rounded-medium bg-(--color-neutral-lightest) px-2 py-1 text-(--color-text-primary)">
                      <Mail className="size-3.5 text-(--hue)" aria-hidden />
                      {user.email}
                    </span>
                  )}
                  {dash && (
                    <Link href={`/mvp3/dashboard?id=${dash.id}`} className="inline-flex items-center gap-1.5 rounded-medium bg-(--color-neutral-lightest) px-2 py-1 text-(--color-text-primary) hover:bg-(--color-neutral-light)">
                      <LayoutDashboard className="size-3.5 text-(--hue)" aria-hidden />
                      {dash.title} dashboard
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <RunsChart runs={rows} />
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-body-lg font-medium text-(--color-text-primary)">Run history</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 w-60 items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-(--color-text-secondary) focus-within:outline-2 focus-within:outline-(--color-focus-primary)">
                <Search className="size-4" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search results or weeks" className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)" />
              </label>
              <select aria-label="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)} className="h-9 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-sm text-(--color-text-primary) outline-none">
                <option value="all">All triggers</option>
                <option value="scheduled">Scheduled</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
            <table className="w-full min-w-[960px] text-left text-body-md">
              <thead className="text-body-sm text-(--color-text-secondary)">
                <tr className="border-b border-(--color-border-default)">
                  <th className="px-4 py-3 font-normal">Started</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Trigger</th>
                  <th className="px-4 py-3 font-normal">Result</th>
                  {cols.map((c) => (
                    <th key={c} className="px-4 py-3 text-right font-normal">
                      {c}
                    </th>
                  ))}
                  <th className="w-px px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-default)">
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => go(r)} className="group cursor-pointer align-top hover:bg-(--color-neutral-lightest)">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block text-(--color-text-primary)">{r.at ? fmtDate(r.at) : "Today"}</span>
                      <span className="block text-body-sm text-(--color-text-secondary)">
                        {r.at ? fmtTime(r.at) : "Just now"} · {r.minutes} {r.minutes === 1 ? "min" : "mins"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={r.status === "completed" ? "success" : "warning"}>{r.status === "completed" ? "Completed" : "Running"}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-medium border border-(--color-border-default) px-2 py-0.5 text-body-sm text-(--color-text-primary)">
                        {r.trigger === "scheduled" ? <CalendarClock className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
                        {r.trigger === "scheduled" ? "Scheduled" : "Manual"}
                      </span>
                      <span className="mt-1 block text-body-sm text-(--color-text-secondary)">{r.trigger === "scheduled" ? (schedule[0] ?? "Weekly") : `by ${user.firstName}`}</span>
                    </td>
                    <td className="max-w-[320px] px-4 py-3">
                      <span className="block truncate font-medium text-(--color-text-primary)">{r.headline}</span>
                      <span className="block text-body-sm text-(--color-text-secondary)">{r.trigger === "scheduled" ? `Week of ${r.week}` : r.week}</span>
                    </td>
                    {cols.map((c) => {
                      const st = r.stats.find((s) => s.label === c);
                      return (
                        <td key={c} className={cn("px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums", st?.tone === "success" ? "text-(--color-text-success)" : st?.tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>
                          {st?.value ?? "–"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          go(r);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-medium border border-(--color-border-default) px-2.5 text-body-sm font-medium whitespace-nowrap text-(--color-text-primary) outline-none hover:bg-(--color-background-secondary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                      >
                        Open chat
                        <ChevronRight className="size-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="py-12 text-center text-body-md text-(--color-text-secondary)">No runs match.</p>}
          </div>
          <p className="text-body-sm text-(--color-text-secondary)">
            {shown.length} of {rows.length} runs
          </p>
        </section>
      </div>
    </div>
  );
}
