"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Copy, LayoutDashboard, Mail, Pencil, Play, Plug, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Table, useTablePagination, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { FOLDERS, type AgentReply } from "@/lib/mvp3/agents";
import { isSchedule, type Workflow } from "@/lib/mvp3/workflows";
import { runHistory, usd, type Run } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { useOnboarding } from "./Onboarding";
import { useAccount } from "./AccountSwitcher";
import { EmailPreviewButton } from "./EmailPreview";
import { ActivityLog } from "./ActivityLog";
import { activityLog } from "@/lib/mvp3/activity";

// A live agent's home (/mvp3/agent?id=chargebacks), kept to what the owner scans:
//  - header: who it is, one line of what it does, Edit and Run;
//  - one setup line: when it runs, what it reads, where results go;
//  - totals over the run history (same figures as the runs below);
//  - two tabs: Runs (newest first; a run's headline opens that run's chat) and
//    Activity: what KoreFi and the agent did each week (reports uploaded, disputes filed, dashboard updated).
// Report-only: the numbers say what happened; KoreFi does every fix.
// Built with Astryx (Button, Badge, TabList, Table + pagination); colours come through app/(mvp3)/mvp3/astryx-bridge.css.

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const PAGE_SIZE = 10;
const icon = "size-4";
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
  const activity = useMemo(() => activityLog(w.id, { account, agent: w.agent ?? "operations", dashboard: dash?.title }), [account, w.id, w.agent, dash?.title]);

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
    router.push("/");
  };
  const [tab, setTab] = useState<"runs" | "activity">("runs");
  const [page, setPage] = useState(1);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagination = useTablePagination<Row>({ page, onPageChange: setPage, totalItems: rows.length, pageSize: PAGE_SIZE, variant: "count", align: "end", label: "Runs pages" });
  const columns: TableColumn<Row>[] = [
    {
      key: "result",
      header: "Result",
      width: proportional(3, { minWidth: 240 }),
      // Astryx Table has no row click, so the headline is the control: a real button, reachable by keyboard.
      renderCell: (r) => (
        <div className="space-y-1 py-0.5">
          <button type="button" onClick={() => go(r)} className="text-left font-medium text-(--color-text-primary) hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            {r.headline}
          </button>
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-(--color-text-secondary)">
            {r.at ? `${fmtDate(r.at)} · Week of ${r.week}` : `Just now · ${r.week}`}
            {r.trigger === "manual" && <Badge variant="neutral" label={`Run by ${user.firstName}`} />}
            {r.status === "running" && <Badge variant="warning" label="Running" />}
          </div>
        </div>
      ),
    },
    ...cols.map(
      (c): TableColumn<Row> => ({
        key: c,
        header: c,
        align: "end",
        width: proportional(1, { minWidth: 110 }),
        renderCell: (r) => {
          const st = r.stats.find((s) => s.label === c);
          return <span className={cn("font-medium whitespace-nowrap tabular-nums", toneText(st?.tone))}>{st?.value ?? "–"}</span>;
        },
      }),
    ),
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-(--color-background-primary)" style={{ ["--hue" as string]: w.hue ?? "var(--color-primary)" }}>
      <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="space-y-4">
          <Button variant="ghost" size="sm" href="/agents" label="Agents" icon={<ArrowLeft className={icon} aria-hidden />} />
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            {w.agent && <AgentAvatar agent={w.agent} size={44} />}
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-subtitle-lg font-medium text-(--color-text-primary)">{w.title}</h1>
                {sample ? <Badge variant="neutral" label="Learning" /> : <Badge variant="success" label="Running" />}
              </div>
              <p className="mt-1 line-clamp-2 max-w-[640px] text-body-md text-(--color-text-secondary)">{w.overview}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" href={`/agent?id=${w.id}&edit=1&from=agent`} label="Edit" icon={<Pencil className={icon} aria-hidden />} />
              {!account.limited && (
                <Button size="sm" label="Duplicate" icon={<Copy className={icon} aria-hidden />} onClick={() => router.push(`/agent?id=${duplicateAgent(w)}`)} />
              )}
              {!sample && (
                <Button
                  variant="primary"
                  size="sm"
                  label="Run now"
                  icon={<Play className={icon} aria-hidden />}
                  onClick={() => {
                    runAgent(w);
                    router.push("/");
                  }}
                />
              )}
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
                Reads {w.integrations.map((i) => (i === "POS" ? "Toast" : i)).join(", ")}
              </li>
            )}
            {w.deliver.email && (
              <li className="inline-flex items-center gap-1.5">
                <Mail className="size-4 text-(--hue)" aria-hidden />
                Emails {ownerEmail}
                <EmailPreviewButton workflow={w.id} label="See the email" className="ml-1" />
              </li>
            )}
            {dash && (
              <li>
                <Link href={`/dashboard?id=${dash.id}`} className="inline-flex items-center gap-1.5 hover:text-(--color-text-primary)">
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

        {/* Runs and Activity, as tabs */}
        <section className="space-y-4">
          <TabList role="tablist" value={tab} onChange={(v) => setTab(v as "runs" | "activity")} hasDivider>
            <Tab value="runs" label="Runs" panelId="agent-runs" endContent={<span className="tabular-nums text-(--color-text-secondary)">{rows.length}</span>} />
            <Tab value="activity" label="Activity" panelId="agent-activity" />
          </TabList>
          {tab === "runs" ? (
            <div id="agent-runs" role="tabpanel" className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-body-md text-(--color-text-secondary)">No runs yet. The first one starts once your reports are in.</p>
              ) : (
                <Table<Row> data={pageRows} columns={columns} idKey="id" hasHover verticalAlign="top" plugins={{ pagination }} />
              )}
            </div>
          ) : (
            <div id="agent-activity" role="tabpanel" className="space-y-2">
              <p className="text-body-sm text-(--color-text-secondary)">What KoreFi and this agent did</p>
              <div className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
                <ActivityLog items={activity} days={5} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
