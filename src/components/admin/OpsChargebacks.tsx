"use client";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Download, LayoutGrid, Pencil, ShieldAlert, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipButton } from "@/components/ui/FilterChip";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { MultiSelectChip } from "@/components/ui/MultiSelectChip";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { DetailDrawer, DetailList, DrawerSection, Timeline } from "@/components/ui/DetailDrawer";
import { StatusBadge } from "@/components/dashboard/primitives";
import { usd } from "@/components/finance/parts";
import { WEEKS, short } from "@/components/finance/PnlStory";
import { ScopeChips, useScope } from "@/components/mvp2/parts";
import { timeline } from "@/components/mvp2/ChargebackReport";
import { APPS, OPS_STATUS_LABEL, WINDOW_DAYS, appLabel, chargebacks, daysBetween, type AppKey, type CbStatus, type Chargeback } from "@/lib/finance/chargebacks";
import { applyUpdates, disputeKey, updateDispute, useDisputeUpdates } from "@/lib/admin/disputes";
import { AS_OF, accountChargebacks } from "@/lib/admin/queue";
import { logActivity } from "@/lib/admin/today";
import { useSession } from "@/lib/admin/session";
import type { Account } from "@/lib/admin/accounts";
import { UpdateDisputeDialog } from "./UpdateDisputeDialog";

// User workspace → Ops view → Chargebacks: where ops work a user's disputes. One screen, built from
// MVP 2's ReportTable:
//   header   status tabs with counts (To file first), so the list is already the work;
//   toolbar  ONE row: search, Outlets, Date, Apps, Reason, then the period and Export;
//   warning  a strip when anything closes in 3 days or less, and a red edge on those rows;
//   table    a "File by / Decision" column with deadline badges, one action per row (Update), the row
//            itself opens the details panel; the header stays put while the rows scroll;
//   bulk     tick rows to mark them filed, won or declined at once (with Undo), or export them.

type Tab = "new" | "disputing" | "decided" | "all";
const TABS: { key: Tab; label: string; test: (c: Chargeback) => boolean }[] = [
  { key: "new", label: "To file", test: (c) => c.status === "new" },
  { key: "disputing", label: "Awaiting decision", test: (c) => c.status === "disputing" },
  { key: "decided", label: "Decided", test: (c) => c.status === "won" || c.status === "lost" },
  { key: "all", label: "All", test: () => true },
];
const TONE: Record<CbStatus, "success" | "warning" | "danger" | "neutral"> = { new: "neutral", disputing: "warning", won: "success", lost: "danger" };
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const cents = (n: number) => `$${n.toFixed(2)}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const left = (c: Chargeback) => (c.windowCloses ? daysBetween(AS_OF, c.windowCloses) : null);
const urgent = (c: Chargeback) => c.status === "new" && (left(c) ?? 99) <= 3;

/** The deadline that matters for the row: when to file by, or when the app decides. */
function Deadline({ c }: { c: Chargeback }) {
  const d = left(c);
  if (c.decided) return <span className="text-(--color-text-secondary)">{c.status === "won" ? "Won" : "Declined"} {day(c.decided)}</span>;
  if (d === null) return <span className="text-(--color-text-tertiary)">No fixed window</span>;
  if (c.status === "new") {
    if (d < 0) return <StatusBadge tone="danger">Window closed</StatusBadge>;
    return (
      <span className="flex flex-col items-start gap-0.5">
        <StatusBadge tone={d <= 3 ? "danger" : d <= 7 ? "warning" : "neutral"}>{d === 0 ? "Due today" : `${plural(d, "day")} left`}</StatusBadge>
        <span className="text-body-sm text-(--color-text-tertiary)">File by {day(c.windowCloses!)}</span>
      </span>
    );
  }
  return <span className="text-(--color-text-secondary)">{d < 0 ? "Decision overdue" : `Decision in ${plural(d, "day")}`}</span>;
}

export function OpsChargebacks({ a }: { a: Account }) {
  const params = useSearchParams();
  const { email } = useSession();
  const updates = useDisputeUpdates();
  const scope = useScope(1);
  const [apps, setApps] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [editing, setEditing] = useState<Chargeback | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [from, to] = scope.range;
  const rows = useMemo(() => {
    const chosen = (apps.length ? apps : APPS.map((x) => x.key)) as AppKey[];
    return applyUpdates(accountChargebacks(a.id, chargebacks(WEEKS, from, to, scope.stores)), updates).filter((c) => chosen.includes(c.app));
  }, [a.id, from, to, scope.stores, updates, apps]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, rows.filter(t.test).length])) as Record<Tab, number>;
  const [tab, setTab] = useState<Tab>(() => (counts.new ? "new" : "all"));
  const shown = rows.filter(TABS.find((t) => t.key === tab)!.test);
  const soon = rows.filter(urgent);
  const cur = rows.find((c) => disputeKey(c) === openId) ?? null;
  const history = cur ? (updates[disputeKey(cur)] ?? []) : [];

  const save = (list: Chargeback[], status: CbStatus, note: string) => {
    const at = new Date().toISOString();
    const by = email || "KoreFi ops";
    const undos = list.map((c) => updateDispute(disputeKey(c), { status, note, at, by, recovered: status === "won" ? c.amount : undefined }));
    const undoLog = logActivity({ kind: "dispute", text: status === "disputing" ? `Filed ${plural(list.length, "dispute")}` : `Marked ${plural(list.length, "dispute")} ${OPS_STATUS_LABEL[status].toLowerCase()}`, who: a.company, amount: list.reduce((n, c) => n + c.amount, 0) });
    return () => {
      undos.forEach((u) => u());
      undoLog();
    };
  };
  const pickedRows = rows.filter((c) => picked.has(disputeKey(c)));
  const bulk = (status: CbStatus, label: string, eligible: (c: Chargeback) => boolean) => {
    const list = pickedRows.filter(eligible);
    if (!list.length) return;
    const undo = save(list, status, "Bulk update");
    setPicked(new Set());
    setToast({ message: `${plural(list.length, "chargeback")} ${label}`, undo });
  };
  const exportCsv = (list: Chargeback[]) => {
    const head = ["Order", "App", "Outlet", "Charged on", "Reason", "Amount", "Won back", "Status", "File by"];
    const body = list.map((c) => [c.id, appLabel(c.app), c.store, c.date, c.reason, c.amount.toFixed(2), c.wonBack.toFixed(2), OPS_STATUS_LABEL[c.status], c.windowCloses ?? ""]);
    const csv = [head, ...body].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `${a.company.toLowerCase().replace(/\W+/g, "-")}-chargebacks.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const columns: TableColumn<Chargeback>[] = [
    { key: "order", header: "Order", cell: (c) => <AppName source={APPS.find((x) => x.key === c.app)!.source} name={c.id} />, sub: (c) => appLabel(c.app), sort: (c) => c.id },
    { key: "outlet", header: "Outlet", cell: (c) => short(c.store), sort: (c) => c.store },
    { key: "date", header: "Charged on", cell: (c) => day(c.date), sort: (c) => c.date },
    { key: "what", header: "What happened", cell: (c) => c.reason, sub: (c) => <span className="block max-w-60 truncate">{c.detail}</span>, sort: (c) => c.reason },
    { key: "amount", header: "Amount", align: "right", cell: (c) => cents(c.amount), sort: (c) => c.amount },
    ...(tab === "decided" || tab === "all" ? [{ key: "back", header: "Won back", align: "right" as const, cell: (c: Chargeback) => (c.wonBack ? <span className="text-(--color-text-success)">+{cents(c.wonBack)}</span> : <span className="text-(--color-text-tertiary)">—</span>), sort: (c: Chargeback) => c.wonBack }] : []),
    { key: "status", header: "Status", cell: (c) => <StatusBadge tone={TONE[c.status]}>{OPS_STATUS_LABEL[c.status]}</StatusBadge>, sort: (c) => ["new", "disputing", "won", "lost"].indexOf(c.status) },
    { key: "deadline", header: tab === "new" ? "File by" : "Deadline", cell: (c) => <Deadline c={c} />, sort: (c) => c.decided ?? c.windowCloses ?? "9" },
    {
      key: "action",
      header: "",
      width: "w-px",
      align: "right",
      pinRight: true,
      cell: (c) => (
        <ChipButton
          icon={Pencil}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(c);
          }}
        >
          Update
        </ChipButton>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Title and status tabs in one bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 border-b border-(--color-border-default) bg-(--color-background-secondary) pl-4 pr-4">
        <h1 className="py-2.5 text-body-md text-(--color-text-primary)">Chargebacks</h1>
        <div role="tablist" aria-label="Status" className="flex gap-5 self-stretch">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setPicked(new Set());
              }}
              className={cn("-mb-px flex items-center gap-1.5 border-b-2 text-menu-md outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", tab === t.key ? "border-(--color-text-primary) text-(--color-text-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)")}
            >
              {t.label}
              <span className={cn("rounded-small px-1.5 text-body-sm tabular-nums", t.key === "new" && counts.new ? "bg-(--color-danger-lightest) text-(--color-danger-darkest)" : tab === t.key ? "bg-(--color-neutral-light)" : "bg-(--color-neutral-lightest)")}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {soon.length > 0 && (
        <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--color-border-default) bg-(--color-danger-lightest)/60 px-4 py-2 text-body-md text-(--color-text-primary)">
          <AlertTriangle className="size-4 shrink-0 text-(--color-text-danger)" aria-hidden />
          <span>
            <strong className="font-medium">{plural(soon.length, "chargeback")}</strong> ({usd(soon.reduce((n, c) => n + c.amount, 0))}) close in 3 days or less. File them first or the money is lost.
          </span>
          {tab !== "new" && (
            <button type="button" onClick={() => setTab("new")} className="text-(--color-text-clickable) hover:underline">
              Show them
            </button>
          )}
        </div>
      )}

      <ReportTable
        key={tab}
        fill
        columns={columns}
        rows={shown}
        rowKey={disputeKey}
        search={(c) => `${c.id} ${c.store} ${c.reason} ${c.detail} ${appLabel(c.app)}`}
        searchPlaceholder="Search orders, outlets…"
        chips={
          <>
            <ScopeChips scope={scope} />
            <MultiSelectChip label="Apps" noun="apps" icon={LayoutGrid} options={APPS.map((x) => ({ value: x.key, label: x.label }))} value={apps} onChange={setApps} />
          </>
        }
        filters={[{ key: "reason", label: "Reason", value: (c) => c.reason }]}
        actions={
          <>
            <span className="hidden text-body-sm text-(--color-text-tertiary) tabular-nums xl:inline">{scope.label}</span>
            <ChipButton icon={Download} onClick={() => exportCsv(shown)}>
              Export
            </ChipButton>
          </>
        }
        noun="chargebacks"
        pageSize={25}
        initialSort={tab === "new" ? { key: "deadline", dir: "asc" } : { key: "date", dir: "desc" }}
        onRowClick={(c) => setOpenId(disputeKey(c))}
        selectedKey={openId}
        viewColumn={false}
        rowClassName={(c) => (urgent(c) ? "shadow-[inset_3px_0_0_var(--color-danger-default)]" : undefined)}
        selection={{ keys: picked, onChange: setPicked, label: (c) => c.id }}
        empty={tab === "new" ? "Nothing to file. Every chargeback here is filed." : "No chargebacks for these outlets, apps and dates."}
      />

      {/* Bulk actions on the ticked chargebacks */}
      {picked.size > 0 && (
        <div role="toolbar" aria-label="Selected chargebacks" className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div className="flex items-center gap-1 rounded-large bg-(--gray-1200) p-1.5 pl-3 text-body-md text-(--color-text-inverse-primary) shadow-[0_12px_32px_rgb(0_0_0/0.25)]">
            <span className="pr-2 tabular-nums">{picked.size} selected</span>
            <span aria-hidden className="h-5 w-px bg-white/20" />
            {[
              { label: "Mark filed", Icon: Check, status: "disputing" as const, done: "marked filed", ok: (c: Chargeback) => c.status === "new" },
              { label: "Mark won", Icon: ThumbsUp, status: "won" as const, done: "marked won", ok: (c: Chargeback) => c.status !== "won" },
              { label: "Mark declined", Icon: ThumbsDown, status: "lost" as const, done: "marked declined", ok: (c: Chargeback) => c.status !== "lost" },
            ].map((b) => {
              const n = pickedRows.filter(b.ok).length;
              return (
                <button key={b.label} type="button" disabled={!n} onClick={() => bulk(b.status, b.done, b.ok)} className="flex h-8 items-center gap-1.5 rounded-medium px-2.5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent">
                  <b.Icon className="size-3.5" aria-hidden />
                  {b.label}
                  {n > 0 && n !== picked.size && <span className="text-white/60 tabular-nums">({n})</span>}
                </button>
              );
            })}
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

      <DetailDrawer
        open={!!cur}
        onClose={() => setOpenId(null)}
        icon={ShieldAlert}
        eyebrow={cur && `${appLabel(cur.app)} chargeback · ${cur.id}`}
        title={cur ? cents(cur.amount) : ""}
        status={cur && <StatusBadge tone={TONE[cur.status]}>{OPS_STATUS_LABEL[cur.status]}</StatusBadge>}
        meta={cur && `${cur.detail} · ${short(cur.store)} · ${day(cur.date)}`}
        footer={
          cur && (
            <Button type="primary" size="small" iconLeft={<Pencil aria-hidden />} onClick={() => setEditing(cur)}>
              Update dispute
            </Button>
          )
        }
      >
        {cur && (
          <>
            {urgent(cur) && (
              <p className="flex items-center gap-2 rounded-medium bg-(--color-danger-lightest) px-3 py-2 text-body-sm text-(--color-danger-darkest)">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                File by {day(cur.windowCloses!)} or {appLabel(cur.app)} keeps it.
              </p>
            )}
            <DrawerSection title="Where it is">
              <Timeline steps={timeline(cur)} />
            </DrawerSection>
            <DetailList
              rows={[
                { label: "Outlet", value: cur.store },
                { label: "Reason", value: cur.reason },
                { label: "Charged", value: cents(cur.amount) },
                { label: "Won back", value: cur.wonBack ? cents(cur.wonBack) : "—" },
                { label: "App's window", value: WINDOW_DAYS[cur.app] ? `${WINDOW_DAYS[cur.app]} days` : "No fixed window" },
              ]}
            />
            {history.length > 0 && (
              <DrawerSection title="Ops updates">
                <ul className="space-y-2.5 px-4">
                  {[...history].reverse().map((u, i) => (
                    <li key={i} className="text-body-sm">
                      <p className="text-(--color-text-primary)">
                        Set to {OPS_STATUS_LABEL[u.status]}
                        {u.status === "won" && u.recovered !== undefined && ` · ${cents(u.recovered)} recovered`}
                        {u.reason && ` · ${u.reason}`}
                      </p>
                      {u.note && <p className="text-(--color-text-secondary)">{u.note}</p>}
                      <p className="text-(--color-text-tertiary)">
                        {u.by} · {new Date(u.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </li>
                  ))}
                </ul>
              </DrawerSection>
            )}
          </>
        )}
      </DetailDrawer>

      {editing && (
        <UpdateDisputeDialog
          c={editing}
          asOf={AS_OF}
          onClose={() => setEditing(null)}
          onSave={(change) => {
            const undoUpdate = updateDispute(disputeKey(editing), { ...change, at: new Date().toISOString(), by: email || "KoreFi ops" });
            const undoLog = logActivity({ kind: "dispute", text: change.status === "disputing" ? `Filed 1 dispute (${editing.id})` : `Set ${editing.id} to ${OPS_STATUS_LABEL[change.status]}`, who: a.company, amount: change.status === "won" ? change.recovered : undefined });
            setToast({
              message: `${editing.id} set to ${OPS_STATUS_LABEL[change.status]}`,
              undo: () => {
                undoUpdate();
                undoLog();
              },
            });
            setEditing(null);
          }}
        />
      )}
      <Toast message={toast?.message ?? null} action={toast?.undo ? { label: "Undo", onClick: toast.undo } : undefined} onDismiss={dismissToast} />
    </div>
  );
}
