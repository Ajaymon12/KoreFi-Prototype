"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, ChevronRight, Copy, LayoutDashboard, Mail, Pencil, Play, Plug, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { StatusBadge } from "@/components/dashboard/primitives";
import { FOLDERS, type AgentReply } from "@/lib/mvp3/agents";
import { isSchedule, type Workflow } from "@/lib/mvp3/workflows";
import { runHistory, usd, type Run } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { useOnboarding } from "./Onboarding";
import { useAccount } from "./AccountSwitcher";

// A live agent's home (/mvp3/agent?id=chargebacks), kept to what the owner scans:
//  - header: who it is, one line of what it does, Edit and Run;
//  - one setup line: when it runs, what it reads, where results go;
//  - totals over the run history (same figures as the runs below);
//  - the runs, newest first. A row opens that run's chat.
// Report-only: the numbers say what happened; the KoreFi team does every fix.

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const btn = "inline-flex h-9 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-3 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-4";
const toneText = (tone?: "success" | "danger") => (tone === "success" ? "text-(--color-text-success)" : tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)");

type Row = { id: string; at: number | null; status: "completed" | "running"; trigger: "scheduled" | "manual"; week: string; headline: string; stats: NonNullable<AgentReply["stats"]>; reply: AgentReply; thread?: string };

export function AgentOverview({ w }: { w: Workflow }) {
  const router = useRouter();
  // A restaurant with no reports yet, or one that only just turned this agent on, has no past runs.
  const { threads, runAgent, duplicateAgent, openRun, dashboards, sample } = useAgents();
  // The signed-in owner's address: a new sign-up's own, not the demo account's.
  const { profile, isNew } = useOnboarding();
  const ownerEmail = isNew && profile.email ? profile.email : user.email;
  const skill = FOLDERS.flatMap((f) => f.skills).find((s) => s.id === w.id);
  const dash = dashboards.find((d) => d.workflow === w.id && d.pinned);
  const trigger = w.triggers.find(isSchedule) ?? w.triggers[0];
  const { account } = useAccount();
  const noPast = sample || !!account.agentsOff;
  const history = useMemo(() => (noPast ? [] : runHistory(w.id, skill?.thread)), [noPast, w.id, skill?.thread]);

  const rows: Row[] = useMemo(() => {
    // Runs started in this session: chats that begin with "Run <agent>".
    const mine: Row[] = threads
      .filter((t) => t.workflow === w.id && t.messages[0]?.role === "user" && t.messages[0].text.startsWith("Run "))
      .map((t) => {
        const last = t.messages.find((m) => m.role === "agent");
        const reply = last && "reply" in last ? last.reply : null;
        return { id: t.id, at: null, status: reply ? "completed" : "running", trigger: "manual", week: "Last 13 weeks", headline: reply?.title ?? "Running…", stats: reply?.stats ?? [], reply: reply ?? { agent: t.agent, title: "Running…", lines: [], work: [] }, thread: t.id };
      });
    const past: Row[] = history.map((r: Run) => ({ id: r.id, at: r.at, status: r.status, trigger: r.trigger, week: r.week, headline: r.headline, stats: r.reply.stats ?? [], reply: r.reply, thread: r.thread }));
    return [...mine, ...past];
  }, [threads, w.id, history]);

  // Totals over the scheduled runs, so they add up to the rows below.
  const totals = (history[0]?.metrics ?? []).map((m) => {
    const value = history.reduce((n, r) => n + (r.metrics.find((x) => x.label === m.label)?.value ?? 0), 0);
    return { label: m.label, tone: m.tone, text: m.money ? usd(value) : value.toLocaleString("en-US") };
  });
  const cols = rows.find((r) => r.stats.length)?.stats.map((s) => s.label) ?? [];

  const go = (r: Row) => {
    openRun({ id: r.id, thread: r.thread, week: r.week, reply: r.reply }, w);
    router.push("/mvp3");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-(--color-background-primary)" style={{ ["--hue" as string]: w.hue ?? "var(--color-primary)" }}>
      <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="space-y-4">
          <Link href="/mvp3/agents" className="inline-flex items-center gap-1.5 text-body-sm text-(--color-text-secondary) hover:text-(--color-text-primary)">
            <ArrowLeft className="size-4" aria-hidden />
            Agents
          </Link>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            {w.agent && <AgentAvatar agent={w.agent} size={44} />}
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-subtitle-lg font-medium text-(--color-text-primary)">{w.title}</h1>
                {sample ? <StatusBadge tone="neutral">Learning</StatusBadge> : <StatusBadge tone="success">Live</StatusBadge>}
              </div>
              <p className="mt-1 line-clamp-2 max-w-[640px] text-body-md text-(--color-text-secondary)">{w.overview}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/mvp3/agent?id=${w.id}&edit=1`} className={btn}>
                <Pencil aria-hidden />
                Edit
              </Link>
              <button type="button" onClick={() => router.push(`/mvp3/agent?id=${duplicateAgent(w)}`)} className={btn}>
                <Copy aria-hidden />
                Duplicate
              </button>
              {!sample && <button
                type="button"
                onClick={() => {
                  runAgent(w);
                  router.push("/mvp3");
                }}
                className={cn(btn, "border-transparent bg-(--color-primary) text-white hover:bg-(--color-primary) hover:opacity-90")}
              >
                <Play aria-hidden />
                Run now
              </button>}
            </div>
          </div>

          {/* Setup, in one line */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm text-(--color-text-secondary)">
            <li className="inline-flex items-center gap-1.5">
              {trigger && !isSchedule(trigger) ? <Zap className="size-4 text-(--hue)" aria-hidden /> : <CalendarClock className="size-4 text-(--hue)" aria-hidden />}
              {trigger ?? "Runs when you ask"}
            </li>
            {w.integrations.length > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <Plug className="size-4 text-(--hue)" aria-hidden />
                Reads {w.integrations.join(", ")}
              </li>
            )}
            {w.deliver.email && (
              <li className="inline-flex items-center gap-1.5">
                <Mail className="size-4 text-(--hue)" aria-hidden />
                Emails {ownerEmail}
              </li>
            )}
            {dash && (
              <li>
                <Link href={`/mvp3/dashboard?id=${dash.id}`} className="inline-flex items-center gap-1.5 hover:text-(--color-text-primary)">
                  <LayoutDashboard className="size-4 text-(--hue)" aria-hidden />
                  {dash.title} dashboard
                </Link>
              </li>
            )}
          </ul>
        </header>

        {/* Totals */}
        {totals.length > 0 && (
          <section aria-labelledby="totals-h" className="space-y-3">
            <h2 id="totals-h" className="flex items-baseline gap-2 text-body-md font-medium text-(--color-text-primary)">
              Last {history.length} weeks
            </h2>
            <dl className="grid divide-y divide-(--color-border-default) overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {totals.map((t) => (
                <div key={t.label} className="px-4 py-3.5">
                  <dt className="text-body-sm text-(--color-text-secondary)">{t.label}</dt>
                  <dd className={cn("mt-0.5 text-subtitle-lg font-medium tabular-nums", toneText(t.tone))}>{t.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Runs */}
        <section aria-labelledby="runs-h" className="space-y-3">
          <h2 id="runs-h" className="flex items-baseline gap-2 text-body-md font-medium text-(--color-text-primary)">
            Runs
            <span className="font-normal text-(--color-text-secondary)">{rows.length}</span>
          </h2>
          <div className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
            <table className="w-full text-left text-body-md">
              <thead className="text-body-sm text-(--color-text-secondary)">
                <tr className="border-b border-(--color-border-default)">
                  <th className="px-4 py-2.5 font-normal">Result</th>
                  {cols.map((c) => (
                    <th key={c} className="hidden px-4 py-2.5 text-right font-normal md:table-cell">
                      {c}
                    </th>
                  ))}
                  <th className="w-px px-4 py-2.5">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-default)">
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => go(r)} className="group cursor-pointer hover:bg-(--color-neutral-lightest)">
                    <td className="max-w-0 px-4 py-3 md:max-w-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          go(r);
                        }}
                        className="block max-w-full truncate text-left font-medium text-(--color-text-primary) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                      >
                        {r.headline}
                      </button>
                      <span className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
                        {r.at ? `${fmtDate(r.at)} · Week of ${r.week}` : `Just now · ${r.week}`}
                        {r.trigger === "manual" && <StatusBadge tone="neutral">Run by {user.firstName}</StatusBadge>}
                        {r.status === "running" && <StatusBadge tone="warning">Running</StatusBadge>}
                      </span>
                    </td>
                    {cols.map((c) => {
                      const st = r.stats.find((s) => s.label === c);
                      return (
                        <td key={c} className={cn("hidden px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums md:table-cell", toneText(st?.tone))}>
                          {st?.value ?? "–"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <ChevronRight className="size-4 text-(--color-text-secondary) group-hover:text-(--color-text-primary)" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="px-4 py-12 text-center text-body-md text-(--color-text-secondary)">No runs yet. The first one starts once your reports are in.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
