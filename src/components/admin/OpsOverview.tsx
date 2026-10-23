"use client";
import { useCallback, useState } from "react";
import { Check, ChevronDown, ChevronRight, FileWarning, Lightbulb, Mail, RefreshCw, ShieldAlert, UploadCloud, UserRoundX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipButton } from "@/components/ui/FilterChip";
import { Toast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/dashboard/primitives";
import { usd } from "@/components/finance/parts";
import { Section, StatRow } from "@/components/mvp2/parts";
import { APPS, daysBetween } from "@/lib/finance/chargebacks";
import { NOW, daysAgo } from "@/lib/admin/accounts";
import { AS_OF, daysLeft, useQueues } from "@/lib/admin/queue";
import { useSession } from "@/lib/admin/session";
import { WEEK_BEFORE, isToday, useActivity, type Activity, type ActivityKind } from "@/lib/admin/today";
import { completeTask, useTasks, type Task, type TaskCat } from "@/lib/admin/tasks";

// Dashboard → Overview: the ops person's start-of-day page. Calm on purpose (Mobbin: Jobber / Asana
// home, Deel "For you today", ClickUp's AI StandUp, Bonsai's activity rail), built from MVP 2's parts:
//   1. greeting, one sentence on the day, and a StatRow of the four numbers that matter;
//   2. "For you today" — the work as five categories, each one row with a count and who it's for;
//      only the most urgent is open. Opening one shows its items, soonest first, each with a tick and
//      one action;
//   3. a narrow side column: "Up next" (three short suggestions) and "Your week" (a one-line recap and
//      the last few things you did).
// Work: lib/admin/queue (chargebacks), the uploads seed, the accounts. Day state: lib/admin/today.

type CatKey = TaskCat;

const CATS: { key: CatKey; label: string; Icon: LucideIcon }[] = [
  { key: "chargebacks", label: "Chargebacks to file", Icon: ShieldAlert },
  { key: "files", label: "Files to sort out", Icon: FileWarning },
  { key: "setup", label: "Users stuck in setup", Icon: UserRoundX },
  { key: "data", label: "Reports to request", Icon: RefreshCw },
  { key: "invites", label: "Invites to chase", Icon: Mail },
];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ACT_ICON: Record<ActivityKind, LucideIcon> = { dispute: ShieldAlert, upload: UploadCloud, invite: Mail, data: RefreshCw, outlet: UserRoundX };

function when(a: Activity) {
  const t = new Date(a.at);
  const time = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday(a)) return `Today, ${time}`;
  return daysAgo(a.at) <= 1 ? `Yesterday, ${time}` : `${t.toLocaleDateString("en-US", { weekday: "short" })}, ${time}`;
}

export function OpsOverview({ onOpen }: { onOpen: (accountId: string, to: string) => void }) {
  const queues = useQueues();
  const activity = useActivity();
  const { email } = useSession();
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [opened, setOpened] = useState<CatKey | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const name = email ? email.split("@")[0].split(/[._-]/)[0].replace(/^\w/, (c) => c.toUpperCase()) : "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const open = useTasks(onOpen);

  const today = activity.filter(isToday);
  const total = open.length + today.length;
  const cats = CATS.map((c) => {
    const items = open.filter((t) => t.cat === c.key);
    return { ...c, items, urgent: items.filter((t) => t.urgency <= 3).length };
  }).filter((c) => c.items.length);
  // The most urgent category starts open; after that it's whatever the person chose.
  const openCat = opened === undefined ? (cats.find((c) => c.urgent)?.key ?? cats[0]?.key ?? null) : opened;

  const toFile = queues.flatMap((q) => q.toFile);
  const urgentFile = toFile.filter((c) => (daysLeft(c) ?? 99) <= 3);
  const awaiting = queues.flatMap((q) => q.awaiting);
  const waitingOnUs = open.filter((t) => t.cat !== "chargebacks").length;
  const filedToday = sum(today.filter((a) => a.kind === "dispute").map((a) => Number(/Filed (\d+)/.exec(a.text)?.[1] ?? 0)));

  const lead = cats.find((c) => c.urgent) ?? cats[0];
  const sentence = !lead
    ? "You're all caught up. Nothing needs you right now."
    : `Start with ${lead.key === "chargebacks" ? "the chargebacks closing soonest" : lead.label.toLowerCase()}. ${plural(open.length, "thing")} on your list today.`;

  // Up next: at most three, one line each.
  const rows = queues.flatMap((q) => q.rows);
  const appWin = APPS.map((x) => {
    const decided = rows.filter((c) => c.app === x.key && (c.status === "won" || c.status === "lost"));
    return { ...x, n: decided.length, rate: decided.length ? decided.filter((c) => c.status === "won").length / decided.length : 0 };
  })
    .filter((x) => x.n >= 5)
    .sort((a, b) => a.rate - b.rate);
  const grub = toFile.filter((c) => daysLeft(c) === null);
  const weekDue = toFile.filter((c) => c.windowCloses && daysBetween(AS_OF, c.windowCloses) <= 7);
  const tips = [
    weekDue.length > 0 && { title: `${plural(weekDue.length, "chargeback")} close this week`, body: `${usd(sum(weekDue.map((c) => c.amount)))} is lost if they aren't filed in time.` },
    appWin.length > 1 && appWin.at(-1)!.rate - appWin[0].rate > 0.08 && { title: `${appWin[0].label} wins least (${Math.round(appWin[0].rate * 100)}%)`, body: `Attach the order photo and hand-off time to ${appWin[0].label} disputes.` },
    grub.length > 0 && { title: `${plural(grub.length, "Grubhub chargeback")} can wait`, body: "Grubhub has no window. Clear the dated ones first." },
  ].filter(Boolean) as { title: string; body: string }[];

  const runTick = (t: Task) => setToast({ message: `Done: ${t.who}`, undo: completeTask(t) });
  const runQuick = (t: Task) => setToast({ message: `${t.quick!.label}: ${t.who}`, undo: t.quick!.run() });

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 pb-4">
      {/* 1 · Greeting, the day in one sentence, the numbers that matter */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-2">
        <div className="min-w-0">
          <p className="text-body-sm text-(--color-text-secondary)">{NOW.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-page-title text-(--color-text-primary)">
            {greeting}, {name}
          </h1>
          <p className="mt-1 text-body-md text-(--color-text-secondary)">{sentence}</p>
        </div>
        <div className="w-56">
          <p className="flex justify-between text-body-sm text-(--color-text-secondary)">
            <span>Today</span>
            <span className="text-(--color-text-primary) tabular-nums">
              {today.length} of {total} done
            </span>
          </p>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-circle bg-(--gray-300)">
            <span className="block h-full rounded-circle bg-(--color-primary) transition-[width]" style={{ width: `${total ? (today.length / total) * 100 : 0}%` }} />
          </span>
        </div>
      </header>

      <StatRow
        label="Today at a glance"
        stats={[
          { label: "To file", value: usd(sum(toFile.map((c) => c.amount))), tone: urgentFile.length ? "danger" : undefined, sub: urgentFile.length ? `${urgentFile.length} close in 3 days` : plural(toFile.length, "chargeback") },
          { label: "Waiting on us", value: waitingOnUs, sub: "Files, setups and requests" },
          { label: "Awaiting the apps", value: usd(sum(awaiting.map((c) => c.amount))), sub: `${awaiting.length} filed disputes` },
          { label: "Filed this week", value: WEEK_BEFORE.filed + filedToday, sub: filedToday ? `${filedToday} today` : "Last 7 days" },
        ]}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 2 · For you today: one row per kind of work, the urgent one open */}
        <Section title="For you today" sub="Grouped by kind of work, most urgent first">
          <ul className="border-t border-(--color-border-default)">
            {cats.map((c) => {
              const isOpen = openCat === c.key;
              const shown = isOpen ? (more ? c.items : c.items.slice(0, 5)) : [];
              return (
                <li key={c.key} className="border-b border-(--color-border-default) last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpened(isOpen ? null : c.key);
                      setMore(false);
                    }}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left outline-none hover:bg-(--color-neutral-lightest)/50 focus-visible:bg-(--color-neutral-lightest)/50"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-medium bg-(--color-neutral-lightest) text-(--color-text-secondary)">
                      <c.Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-md font-medium text-(--color-text-primary)">{c.label}</span>
                      <span className="block truncate text-body-sm text-(--color-text-secondary)">
                        {c.items
                          .slice(0, 3)
                          .map((t) => t.who)
                          .join(", ")}
                        {c.items.length > 3 ? ` and ${c.items.length - 3} more` : ""}
                      </span>
                    </span>
                    {c.urgent > 0 && <StatusBadge tone="danger">{c.urgent} urgent</StatusBadge>}
                    <span className="w-6 text-right text-subtitle-md text-(--color-text-primary) tabular-nums">{c.items.length}</span>
                    <ChevronDown className={cn("size-4 shrink-0 text-(--color-text-secondary) transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>

                  {isOpen && (
                    <ul className="pb-2">
                      {shown.map((t) => (
                        <li key={t.id} className="flex items-center gap-3 py-2 pr-5 pl-[60px] hover:bg-(--color-neutral-lightest)/40">
                          <button type="button" onClick={() => runTick(t)} aria-label={`Mark done: ${t.title}`} title="Mark done" className="grid size-[18px] shrink-0 place-items-center rounded-circle border border-(--color-border-darker) text-transparent transition-colors hover:border-(--color-primary) hover:text-(--color-primary)">
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-md text-(--color-text-primary)">{t.title}</p>
                            <p className="truncate text-body-sm text-(--color-text-secondary)">{t.detail}</p>
                          </div>
                          {t.due && <StatusBadge tone={t.due.tone}>{t.due.label}</StatusBadge>}
                          {t.quick && (
                            <ChipButton onClick={() => runQuick(t)}>{t.quick.label}</ChipButton>
                          )}
<button type="button" onClick={t.open.run} aria-label={`${t.open.label}: ${t.title}`} className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-medium px-2 text-menu-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                            {t.open.label}
                            <ChevronRight className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                      {c.items.length > 5 && (
                        <li className="pl-[60px]">
                          <button type="button" onClick={() => setMore((m) => !m)} className="py-1.5 text-body-sm text-(--color-text-clickable) hover:underline">
                            {more ? "Show fewer" : `Show all ${c.items.length}`}
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
            {cats.length === 0 && <li className="px-5 py-12 text-center text-body-md text-(--color-text-secondary)">All done for today.</li>}
          </ul>
        </Section>

        {/* 3 · Side column: what next, and what you did */}
        <div className="flex flex-col gap-4">
          {tips.length > 0 && (
            <Section title="Up next">
              <ul className="space-y-3 border-t border-(--color-border-default) px-5 py-4">
                {tips.map((t) => (
                  <li key={t.title} className="flex gap-2.5">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-(--color-text-tertiary)" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-body-md text-(--color-text-primary)">{t.title}</p>
                      <p className="text-body-sm text-(--color-text-secondary)">{t.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Your week" sub={`${WEEK_BEFORE.filed + filedToday} disputes filed, ${usd(WEEK_BEFORE.wonBack)} won back for users, ${WEEK_BEFORE.uploads} files handled.`}>
            <ol className="border-t border-(--color-border-default) px-5 py-4">
              {activity.slice(0, 5).map((a, i, list) => {
                const Icon = ACT_ICON[a.kind];
                return (
                  <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < list.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[9px] w-px bg-(--color-border-default)" />}
                    <span className={cn("relative grid size-5 shrink-0 place-items-center rounded-circle", isToday(a) ? "bg-(--color-primary)/15 text-(--color-primary)" : "bg-(--color-neutral-lightest) text-(--color-text-secondary)")}>
                      <Icon className="size-3" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-sm text-(--color-text-primary)">
                        {a.text}
                        {a.who && <span className="text-(--color-text-secondary)"> · {a.who}</span>}
                      </p>
                      <p className="text-body-sm text-(--color-text-tertiary)">{when(a)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>
        </div>
      </div>

      <Toast message={toast?.message ?? null} action={toast?.undo ? { label: "Undo", onClick: toast.undo } : undefined} onDismiss={dismissToast} />
    </div>
  );
}
