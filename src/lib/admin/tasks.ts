"use client";
import { useMemo } from "react";
import { usd } from "@/components/finance/parts";
import { APPS } from "@/lib/finance/chargebacks";
import { daysAgo, stepLabel } from "./accounts";
import { SEED_HISTORY, provider } from "./data";
import { SEED_NEEDS_MAPPING } from "./mock";
import { disputeKey, updateDispute } from "./disputes";
import { useQueues } from "./queue";
import { useAccounts } from "./store";
import { useSession } from "./session";
import { logActivity, setDone, useDone, type ActivityKind } from "./today";

// Every piece of work ops have across users, as tasks: chargebacks to file (one per user), files to
// map or replace, users stuck in setup, invites to chase, stale data to request. The Dashboard's
// Overview groups them; a user's Ops view Overview shows just theirs. Each has a tick, an action that
// opens the right page, and sometimes a quick action that does the job (with an undo).

export type TaskCat = "chargebacks" | "files" | "setup" | "data" | "invites";
export type Task = {
  id: string;
  cat: TaskCat;
  accountId: string;
  title: string;
  /** The task within this user's page, without their name ("File 6 chargebacks"). */
  label: string;
  detail: string;
  /** Lower = sooner; sorts the list, and ≤ 3 counts as urgent. */
  urgency: number;
  due?: { label: string; tone: "danger" | "warning" | "neutral" };
  open: { label: string; run: () => void };
  quick?: { label: string; run: () => () => void };
  doneText: string;
  kind: ActivityKind;
  who: string;
};

const UPLOADS = [SEED_NEEDS_MAPPING, ...SEED_HISTORY];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const dueTone = (d: number) => (d <= 3 ? "danger" : d <= 7 ? "warning" : "neutral") as "danger" | "warning" | "neutral";

/** Open tasks (ticked ones left out), soonest first. `onOpen(accountId, path)` opens a user's page. */
export function useTasks(onOpen: (accountId: string, to: string) => void) {
  const queues = useQueues();
  const accounts = useAccounts();
  const done = useDone();
  const { email } = useSession();
  const tasks = useMemo(() => {
    const out: Task[] = [];
    const tick = (id: string, kind: ActivityKind, text: string, who: string) => {
      const undoLog = logActivity({ kind, text, who });
      setDone(id, true);
      return () => {
        undoLog();
        setDone(id, false);
      };
    };

    for (const q of queues) {
      if (!q.toFile.length) continue;
      const a = q.account;
      const amount = sum(q.toFile.map((c) => c.amount));
      const d = q.nextDeadline;
      out.push({
        id: `cb-${a.id}`,
        cat: "chargebacks",
        accountId: a.id,
        title: a.company,
        label: `File ${plural(q.toFile.length, "chargeback")}`,
        detail: `${plural(q.toFile.length, "chargeback")} · ${usd(amount)} · ${APPS.filter((x) => q.toFile.some((c) => c.app === x.key))
          .map((x) => x.label)
          .join(", ")}`,
        urgency: d ?? 99,
        due: d === null ? undefined : { label: d <= 0 ? "Due today" : `${plural(d, "day")} left`, tone: dueTone(d) },
        open: { label: "Review", run: () => onOpen(a.id, "/admin/chargebacks?tab=transactions") },
        quick: {
          label: "Mark filed",
          run: () => {
            const undos = q.toFile.map((c) => updateDispute(disputeKey(c), { status: "disputing", note: "Filed from today's list", at: new Date().toISOString(), by: email || "KoreFi ops" }));
            const undoLog = logActivity({ kind: "dispute", text: `Filed ${plural(q.toFile.length, "dispute")}`, who: a.company, amount });
            return () => {
              undos.forEach((u) => u());
              undoLog();
            };
          },
        },
        doneText: `Filed ${plural(q.toFile.length, "dispute")}`,
        kind: "dispute",
        who: a.company,
      });
    }

    for (const u of UPLOADS) {
      if (u.status !== "needs_mapping" && u.status !== "rejected") continue;
      const company = accounts.find((x) => x.id === u.userId)?.company ?? "";
      const pv = provider(u.provider)?.name;
      const mapping = u.status === "needs_mapping";
      out.push({
        id: `up-${u.id}`,
        cat: "files",
        accountId: u.userId,
        title: mapping ? `${company} · map outlets in the ${pv} file` : `${company} · ${pv} file rejected`,
        label: mapping ? `Map outlets in the ${pv} file` : `Get a new ${pv} export`,
        detail: mapping ? `${u.fileName} · their reports stay empty until it's mapped` : `${u.fileName}${u.reason ? ` · ${u.reason}` : ""}`,
        urgency: mapping ? 0 : 1,
        due: mapping ? { label: "Blocking data", tone: "warning" } : { label: "Rejected", tone: "danger" },
        open: { label: mapping ? "Map outlets" : "Open", run: () => onOpen(u.userId, "/admin/uploads") },
        doneText: mapping ? `Mapped outlets in ${u.fileName}` : `Asked for a new ${pv} export`,
        kind: "upload",
        who: company,
      });
    }

    for (const a of accounts) {
      if (a.status === "stalled") {
        const stuck = daysAgo(a.lastActive ?? a.joined);
        out.push({
          id: `st-${a.id}`,
          cat: "setup",
          accountId: a.id,
          title: `${a.name} · ${a.company}`,
          label: "Nudge them to finish setup",
          detail: `Stuck at ${stepLabel(a.step)} for ${plural(stuck, "day")}`,
          urgency: 20 - stuck,
          due: { label: `${stuck}d stuck`, tone: stuck >= 10 ? "danger" : "warning" },
          open: { label: "Open", run: () => onOpen(a.id, "/admin/client") },
          quick: { label: "Resend link", run: () => tick(`st-${a.id}`, "invite", "Resent the setup link", a.company) },
          doneText: "Nudged to finish setup",
          kind: "invite",
          who: a.company,
        });
      } else if (a.status === "invited") {
        out.push({
          id: `in-${a.id}`,
          cat: "invites",
          accountId: a.id,
          title: `${a.name} · ${a.company}`,
          label: "Chase the invite",
          detail: `Invited ${plural(daysAgo(a.joined), "day")} ago, not opened yet`,
          urgency: 10 - daysAgo(a.joined),
          open: { label: "Open", run: () => onOpen(a.id, "/admin/client") },
          quick: { label: "Resend", run: () => tick(`in-${a.id}`, "invite", "Resent the invite", a.company) },
          doneText: "Chased the invite",
          kind: "invite",
          who: a.company,
        });
      } else if (a.data === "stale" && a.status !== "suspended") {
        out.push({
          id: `da-${a.id}`,
          cat: "data",
          accountId: a.id,
          title: a.company,
          label: "Ask for fresh reports",
          detail: `Nothing new in 7+ days · ${[a.pos, ...a.delivery]
            .filter(Boolean)
            .map((p) => provider(p!)?.name)
            .join(", ")}`,
          urgency: 5,
          open: { label: "Upload", run: () => onOpen(a.id, "/admin/uploads") },
          quick: { label: "Request", run: () => tick(`da-${a.id}`, "data", "Asked for fresh reports", a.company) },
          doneText: "Asked for fresh reports",
          kind: "data",
          who: a.company,
        });
      }
    }
    return out.sort((a, b) => a.urgency - b.urgency);
  }, [queues, accounts, onOpen, email]);
  return useMemo(() => tasks.filter((t) => !done.has(t.id)), [tasks, done]);
}

/** Ticks a task off and logs it. Returns an undo. */
export function completeTask(t: Task) {
  const undoLog = logActivity({ kind: t.kind, text: t.doneText, who: t.who });
  setDone(t.id, true);
  return () => {
    undoLog();
    setDone(t.id, false);
  };
}
