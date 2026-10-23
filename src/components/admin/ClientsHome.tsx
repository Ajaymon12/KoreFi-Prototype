"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, LayoutDashboard, Mail, Plus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipButton } from "@/components/ui/FilterChip";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { StatusBadge } from "@/components/dashboard/primitives";
import { StatRow } from "@/components/mvp2/parts";
import { ProviderLogo } from "./ProviderLogo";
import { OnboardCustomerDialog } from "./OnboardCustomerDialog";
import { OpsOverview } from "./OpsOverview";
import { useQueues } from "@/lib/admin/queue";
import { DATA_META, STATUS_META, STEPS, activeWithin, ago, daysAgo, stepLabel, type Account } from "@/lib/admin/accounts";
import { provider } from "@/lib/admin/data";
import { selectClient } from "@/lib/admin/client";
import { useAccounts } from "@/lib/admin/store";

// Ops Dashboard (/admin), where every session starts. No sidebar; two tabs on top:
//   Overview — the ops person's daily briefing (OpsOverview): today's list, suggestions, recent work;
//   Users — laid out like MVP 2's report pages: a StatRow of the numbers across users, then every
//   user in a ReportTable (search, Status / Data / Onboarding filters, sort, pages). Opening a user
//   enters their workspace (components/admin/Workspace). Rows can be ticked for bulk actions in a bar
//   at the bottom. "Add user" is the invite flow and lands in the new user's Account. Dummy data.

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const pending = (a: Account) => a.status === "invited" || a.status === "onboarding" || a.status === "stalled";

export function ClientsHome() {
  const params = useSearchParams();
  const router = useRouter();
  const ACCOUNTS = useAccounts();
  const queues = useQueues();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"overview" | "users">(() => (params.get("tab") === "users" ? "users" : "overview"));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const openBy = useMemo(() => new Map(queues.map((q) => [q.account.id, q.toFile.length + q.awaiting.length])), [queues]);
  const openCount = (a: Account) => openBy.get(a.id) ?? 0;

  const open = useCallback(
    (id: string, to = "/admin/overview") => {
      selectClient(id);
      router.push(to);
    },
    [router],
  );

  const exportCsv = (list: Account[]) => {
    const head = ["User", "Owner", "Email", "Outlets", "Status", "Onboarding", "Data", "Open chargebacks", "Last active"];
    const body = list.map((a) => [a.company, a.name, a.email, a.outlets, STATUS_META[a.status].label, stepLabel(a.step), DATA_META[a.data].label, openCount(a), a.lastActive ?? "Never"]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "korefi-users.csv" }).click();
    URL.revokeObjectURL(url);
  };

  const count = (pred: (a: Account) => boolean) => ACCOUNTS.filter(pred).length;
  const pickedRows = ACCOUNTS.filter((a) => picked.has(a.id));
  const pickedPending = pickedRows.filter(pending);

  const columns: TableColumn<Account>[] = [
    { key: "user", header: "User", cell: (a) => a.company, sub: (a) => `${a.name} · ${plural(a.outlets, "outlet")}`, sort: (a) => a.company.toLowerCase() },
    { key: "sources", header: "Sources", cell: (a) => <Sources a={a} /> },
    { key: "status", header: "Status", cell: (a) => <StatusBadge tone={STATUS_META[a.status].tone}>{STATUS_META[a.status].label}</StatusBadge>, sort: (a) => STATUS_META[a.status].label },
    {
      key: "onboarding",
      header: "Onboarding",
      cell: (a) => (a.step === "done" ? <span className="text-(--color-text-secondary)">Complete</span> : stepLabel(a.step)),
      sub: (a) => (a.step === "done" ? undefined : `Step ${STEPS.findIndex((s) => s.id === a.step) + 1} of ${STEPS.length - 1}`),
      sort: (a) => STEPS.findIndex((s) => s.id === a.step),
    },
    { key: "data", header: "Data", cell: (a) => <StatusBadge tone={DATA_META[a.data].tone}>{DATA_META[a.data].label}</StatusBadge>, sort: (a) => DATA_META[a.data].label },
    { key: "chargebacks", header: "Open chargebacks", align: "right", cell: (a) => openCount(a) || <span className="text-(--color-text-tertiary)">—</span>, sort: openCount },
    { key: "last", header: "Last active", cell: (a) => <span className="text-(--color-text-secondary)">{ago(a.lastActive)}</span>, sort: (a) => (a.lastActive ? Date.parse(a.lastActive) : 0) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--color-border-default) bg-(--color-background-secondary) px-4 sm:px-6">
        <div role="tablist" aria-label="Dashboard" className="flex gap-5">
          {(
            [
              ["overview", "Overview", LayoutDashboard, undefined],
              ["users", "Users", Users, ACCOUNTS.length],
            ] as const
          ).map(([k, label, Icon, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px flex h-11 items-center gap-1.5 border-b-2 text-menu-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                tab === k ? "border-(--color-text-primary) text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {n !== undefined && <span className={cn("rounded-small px-1.5 text-body-sm tabular-nums", tab === k ? "bg-(--color-neutral-light)" : "bg-(--color-neutral-lightest)")}>{n}</span>}
            </button>
          ))}
        </div>
        <Button type="primary" size="tiny" onClick={() => setAdding(true)} iconLeft={<Plus aria-hidden />}>
          Add user
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "overview" ? (
          <div className="px-4 pt-4 sm:px-6">
            <OpsOverview onOpen={open} />
          </div>
        ) : (
          // Same frame as MVP 2's reports: p-4, a StatRow, then the edge-to-edge ReportTable.
          <div className={cn("space-y-4 p-4", picked.size > 0 && "pb-20")}>
            <StatRow
              label="Users at a glance"
              stats={[
                { label: "Users", value: ACCOUNTS.length, sub: `${count((a) => daysAgo(a.joined) < 30)} joined in the last 30 days` },
                { label: "Active this week", value: count((a) => activeWithin(a, 7)), sub: `${count((a) => a.data === "fresh")} with up-to-date data` },
                { label: "Still onboarding", value: count(pending), sub: `${count((a) => a.status === "stalled")} stalled · ${count((a) => a.status === "invited")} not accepted` },
                { label: "Open chargebacks", value: ACCOUNTS.reduce((n, a) => n + openCount(a), 0), sub: `across ${count((a) => openCount(a) > 0)} users` },
              ]}
            />
            <ReportTable
              columns={columns}
              rows={ACCOUNTS}
              rowKey={(a) => a.id}
              search={(a) => `${a.company} ${a.name} ${a.email}`}
              searchPlaceholder="Search users…"
              filters={[
                { key: "status", label: "Status", value: (a) => STATUS_META[a.status].label },
                { key: "data", label: "Data", value: (a) => DATA_META[a.data].label },
                { key: "onboarding", label: "Onboarding", value: (a) => (a.step === "done" ? "Complete" : "In progress") },
              ]}
              actions={
                <ChipButton icon={Download} onClick={() => exportCsv(ACCOUNTS)}>
                  Export CSV
                </ChipButton>
              }
              noun="users"
              pageSize={12}
              initialSort={{ key: "last", dir: "desc" }}
              onRowClick={(a) => open(a.id)}
              selection={{ keys: picked, onChange: setPicked, label: (a) => a.company }}
              empty="No users yet."
            />
          </div>
        )}
      </div>

      {/* Bulk actions on the ticked users. */}
      {tab === "users" && picked.size > 0 && (
        <div role="toolbar" aria-label="Selected users" className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div className="flex items-center gap-1 rounded-large bg-(--gray-1200) p-1.5 pl-3 text-body-md text-(--color-text-inverse-primary) shadow-[0_12px_32px_rgb(0_0_0/0.25)]">
            <span className="pr-2 tabular-nums">{picked.size} selected</span>
            <span aria-hidden className="h-5 w-px bg-white/20" />
            <button
              type="button"
              disabled={pickedPending.length === 0}
              onClick={() => {
                setToast(`Invite resent to ${plural(pickedPending.length, "user")}`);
                setPicked(new Set());
              }}
              title={pickedPending.length ? undefined : "Only users still onboarding or invited get a reminder"}
              className="flex h-8 items-center gap-1.5 rounded-medium px-2.5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Mail className="size-3.5" aria-hidden />
              Resend invite{pickedPending.length ? ` (${pickedPending.length})` : ""}
            </button>
            <button type="button" onClick={() => exportCsv(pickedRows)} className="flex h-8 items-center gap-1.5 rounded-medium px-2.5 hover:bg-white/10">
              <Download className="size-3.5" aria-hidden />
              Export
            </button>
            <button type="button" aria-label="Clear selection" onClick={() => setPicked(new Set())} className="grid size-8 place-items-center rounded-medium hover:bg-white/10">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
      <Toast message={toast} onDismiss={dismissToast} />

      {adding && (
        <OnboardCustomerDialog
          accounts={ACCOUNTS}
          onClose={() => setAdding(false)}
          onDone={(a, sent) => {
            setAdding(false);
            open(a.id, `/admin/client?added=${sent ? "sent" : "link"}`);
          }}
        />
      )}
    </div>
  );
}

function Sources({ a }: { a: Account }) {
  const ids = [...(a.pos ? [a.pos] : []), ...a.delivery];
  if (ids.length === 0) return <span className="text-body-sm text-(--color-text-secondary)">None connected</span>;
  return (
    <span className="flex items-center gap-1.5" title={ids.map((i) => provider(i)?.name).join(", ")}>
      {ids.map((i) => (
        <ProviderLogo key={i} id={i} size={16} />
      ))}
    </span>
  );
}
