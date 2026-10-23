"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Mail, RefreshCw, ShieldAlert, UploadCloud, UserRoundX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipButton } from "@/components/ui/FilterChip";
import { Toast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/dashboard/primitives";
import { usd } from "@/components/finance/parts";
import { Section, StatRow } from "@/components/mvp2/parts";
import { APPS } from "@/lib/finance/chargebacks";
import { DATA_META, STATUS_META, STEPS, ago, daysAgo, stepLabel, type Account } from "@/lib/admin/accounts";
import { SEED_HISTORY, UPLOAD_STATUS, provider } from "@/lib/admin/data";
import { SEED_NEEDS_MAPPING } from "@/lib/admin/mock";
import { useDisputeUpdates } from "@/lib/admin/disputes";
import { userQueue } from "@/lib/admin/queue";
import { completeTask, useTasks, type Task } from "@/lib/admin/tasks";
import { isToday, useActivity, type ActivityKind } from "@/lib/admin/today";
import { ProviderLogo } from "./ProviderLogo";

// User workspace → Ops view → Overview: one user's page for the ops person (Mobbin: Twenty / Attio
// record pages, Lightfield's account overview, Jobber's client page). What to do for them, who they are
// and what has happened, not their revenue charts (those are in User's view):
//   header    name, owner, status, and a two-line account summary written from their data;
//   numbers   their chargebacks over the last 4 weeks (StatRow), when they have data;
//   To do     their tasks from the shared list (lib/admin/tasks), each with a tick and one action;
//   Activity  what ops did for them and their uploads, newest first;
//   Details   the facts ops look up: contact, setup, connections, outlets, data freshness.

const UPLOADS = [SEED_NEEDS_MAPPING, ...SEED_HISTORY];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const TASK_ICON: Record<Task["cat"], LucideIcon> = { chargebacks: ShieldAlert, files: UploadCloud, setup: UserRoundX, data: RefreshCw, invites: Mail };
const ACT_ICON: Record<ActivityKind | "file", LucideIcon> = { dispute: ShieldAlert, upload: UploadCloud, invite: Mail, data: RefreshCw, outlet: UserRoundX, file: UploadCloud };

export function UserOverview({ a }: { a: Account }) {
  const router = useRouter();
  const go = useCallback((_: string, to: string) => router.push(to), [router]);
  const tasks = useTasks(go).filter((t) => t.accountId === a.id);
  const updates = useDisputeUpdates();
  const q = useMemo(() => (a.data === "none" ? null : userQueue(a, updates)), [a, updates]);
  const activity = useActivity();
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const st = STATUS_META[a.status];
  const dt = DATA_META[a.data];
  const listed = a.restaurants.reduce((n, r) => n + r.outlets.length, 0) || a.outlets;
  const delivery = a.delivery.map((d) => provider(d)?.name ?? d);
  const uploads = UPLOADS.filter((u) => u.userId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  // Newest of their upload history and any upload ops logged for them.
  const lastUpload = [uploads[0]?.at, activity.find((x) => x.who === a.company && x.kind === "upload")?.at].filter((x): x is string => !!x).sort().at(-1);
  const sum = (xs: { amount: number }[]) => xs.reduce((n, c) => n + c.amount, 0);

  // Account summary: who they are, where setup is, how their chargebacks stand.
  const summary = [
    `${a.company} runs ${plural(listed, "outlet")}${a.pos ? ` on ${provider(a.pos)?.name}` : ""}${delivery.length ? ` and sells on ${list(delivery)}` : ""}.`,
    a.step !== "done"
      ? `${a.status === "invited" ? "They haven't accepted the invite yet" : `Setup is at ${stepLabel(a.step)}${a.status === "stalled" ? `, with no progress for ${plural(daysAgo(a.lastActive ?? a.joined), "day")}` : ""}`}.`
      : a.data === "stale"
        ? "Their data has gone stale: nothing new in over a week."
        : "Setup is complete and their data is up to date.",
    q && (q.toFile.length || q.awaiting.length)
      ? `${plural(q.toFile.length, "chargeback")} to file and ${q.awaiting.length} awaiting the apps${q.winRate !== null ? `; ${Math.round(q.winRate * 100)}% of decided disputes won in the last 4 weeks` : ""}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Activity: ops' actions for this user, and their uploads.
  const feed = [
    ...activity.filter((x) => x.who === a.company).map((x) => ({ id: x.id, at: x.at, kind: x.kind as ActivityKind | "file", text: x.text, sub: isToday(x) ? "You" : "KoreFi ops", tone: undefined as undefined | { tone: "success" | "warning" | "danger" | "info"; label: string } })),
    ...uploads.map((u) => ({ id: u.id, at: u.at, kind: "file" as const, text: `${provider(u.provider)?.name} report uploaded · ${u.fileName}`, sub: u.uploadedBy, tone: UPLOAD_STATUS[u.status] })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 6);

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Owner", value: a.name },
    { label: "Email", value: <span className="truncate">{a.email}</span> },
    { label: "Role", value: a.role },
    { label: "Joined", value: fmtDate(a.joined) },
    { label: "Onboarding", value: a.step === "done" ? "Complete" : `${stepLabel(a.step)} · step ${STEPS.findIndex((s) => s.id === a.step) + 1} of ${STEPS.length - 1}` },
    {
      label: "POS",
      value: a.pos ? (
        <span className="inline-flex items-center gap-1.5">
          <ProviderLogo id={a.pos} size={14} />
          {provider(a.pos)?.name}
        </span>
      ) : (
        <span className="text-(--color-text-tertiary)">Not connected</span>
      ),
    },
    {
      label: "Delivery apps",
      value: a.delivery.length ? (
        <span className="inline-flex items-center gap-1.5">
          {a.delivery.map((d) => (
            <ProviderLogo key={d} id={d} size={14} />
          ))}
        </span>
      ) : (
        <span className="text-(--color-text-tertiary)">None yet</span>
      ),
    },
    {
      label: "Outlets",
      value: (
        <button type="button" onClick={() => router.push("/admin/outlets")} className="text-(--color-text-clickable) hover:underline">
          {listed}
        </button>
      ),
    },
    { label: "Data", value: <StatusBadge tone={dt.tone}>{dt.label}</StatusBadge> },
    { label: "Last upload", value: lastUpload ? fmtDate(lastUpload) : <span className="text-(--color-text-tertiary)">None</span> },
    { label: "Last active", value: ago(a.lastActive) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Overview" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 p-4 sm:p-6">
          {/* Who this is, in a sentence or two */}
          <header className="flex items-start gap-4">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-large bg-(--color-brand-lightest) text-subtitle-md text-(--color-primary)">
              {initials(a.company)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title text-(--color-text-primary)">{a.company}</h1>
                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
              </div>
              <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">
                {a.name} · {a.role} · {a.email}
              </p>
              <p className="mt-2 max-w-[760px] text-body-md text-(--color-text-primary)">{summary}</p>
            </div>
          </header>

          {q && (
            <StatRow
              label="Chargebacks, last 4 weeks"
              stats={[
                { label: "To file", value: usd(sum(q.toFile)), tone: q.urgent.length ? "danger" : undefined, sub: q.nextDeadline !== null ? `${q.toFile.length} · next closes in ${plural(q.nextDeadline, "day")}` : plural(q.toFile.length, "chargeback") },
                { label: "Awaiting the apps", value: usd(sum(q.awaiting)), sub: plural(q.awaiting.length, "dispute") },
                { label: "Won back", value: usd(q.wonBack), tone: "success", sub: `of ${usd(q.charged)} charged` },
                { label: "Win rate", value: q.winRate === null ? "—" : `${Math.round(q.winRate * 100)}%`, sub: APPS.filter((x) => q.rows.some((c) => c.app === x.key)).map((x) => x.label).join(", ") || "No apps yet" },
              ]}
            />
          )}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-4">
              <Section title="To do" sub={tasks.length ? `${plural(tasks.length, "thing")} for ${a.company}, soonest first` : undefined}>
                <ul className="divide-y divide-(--color-border-default) border-t border-(--color-border-default)">
                  {tasks.map((t) => {
                    const Icon = TASK_ICON[t.cat];
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                        <button type="button" onClick={() => setToast({ message: `Done: ${t.doneText}`, undo: completeTask(t) })} aria-label={`Mark done: ${t.doneText}`} title="Mark done" className="grid size-[18px] shrink-0 place-items-center rounded-circle border border-(--color-border-darker) text-transparent transition-colors hover:border-(--color-primary) hover:text-(--color-primary)">
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        </button>
                        <Icon className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-md text-(--color-text-primary)">{t.label}</p>
                          <p className="truncate text-body-sm text-(--color-text-secondary)">{t.detail}</p>
                        </div>
                        {t.due && <StatusBadge tone={t.due.tone}>{t.due.label}</StatusBadge>}
                        {t.quick && (
                          <ChipButton onClick={() => setToast({ message: `${t.quick!.label}: done`, undo: t.quick!.run() })}>{t.quick.label}</ChipButton>
                        )}
                        <button type="button" onClick={t.open.run} className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-medium px-2 text-menu-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                          {t.open.label}
                          <ChevronRight className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                  {tasks.length === 0 && <li className="px-5 py-8 text-center text-body-md text-(--color-text-secondary)">Nothing to do for {a.company} right now.</li>}
                </ul>
              </Section>

              <Section title="Activity" sub="What KoreFi did for them, and their uploads">
                <ol className="border-t border-(--color-border-default) px-5 py-4">
                  {feed.map((f, i) => {
                    const Icon = ACT_ICON[f.kind];
                    return (
                      <li key={f.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < feed.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[9px] w-px bg-(--color-border-default)" />}
                        <span className="relative grid size-5 shrink-0 place-items-center rounded-circle bg-(--color-neutral-lightest) text-(--color-text-secondary)">
                          <Icon className="size-3" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-md text-(--color-text-primary)">{f.text}</p>
                          <p className="text-body-sm text-(--color-text-tertiary)">
                            {f.sub} · {new Date(f.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        {f.tone && <StatusBadge tone={f.tone.tone}>{f.tone.label}</StatusBadge>}
                      </li>
                    );
                  })}
                  {feed.length === 0 && <li className="py-4 text-center text-body-md text-(--color-text-secondary)">No activity yet.</li>}
                </ol>
              </Section>
            </div>

            <Section title="Details">
              <dl className="divide-y divide-(--color-border-default) border-t border-(--color-border-default)">
                {details.map((d) => (
                  <div key={d.label} className="flex items-center justify-between gap-3 px-5 py-2.5 text-body-md">
                    <dt className="shrink-0 text-(--color-text-secondary)">{d.label}</dt>
                    <dd className={cn("min-w-0 truncate text-right text-(--color-text-primary)")}>{d.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>
        </div>
      </div>
      <Toast message={toast?.message ?? null} action={toast?.undo ? { label: "Undo", onClick: toast.undo } : undefined} onDismiss={dismissToast} />
    </div>
  );
}
