"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronRight, Copy, Download, Mail, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { DetailDrawer, DetailList, DrawerSection, Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/dashboard/primitives";
import { FilterSelect } from "./FilterSelect";
import { Pager } from "./Pager";
import { ProviderLogo } from "./ProviderLogo";
import { DATA_META, STATUS_META, STEPS, ago, stepLabel, type Account, type AccountStatus, type DataHealth } from "@/lib/admin/accounts";
import { provider } from "@/lib/admin/data";
import { Toast } from "@/components/ui/Toast";
import { OnboardCustomerDialog } from "./OnboardCustomerDialog";
import { inviteLink, useAccounts } from "@/lib/admin/store";

// Ops "Users" tab: every customer account, same layout as File uploads (search + filters on top, a
// 12-row table, pager below). Row click opens the account's detail panel. Dummy data
// (src/lib/admin/accounts.ts). The Dashboard deep-links here with ?status= / ?data=.

const PAGE_SIZE = 12;

type SortKey = "name" | "company" | "last";
type StatusFilter = "all" | AccountStatus;
type DataFilter = "all" | DataHealth;

const isStatus = (v: string | null): v is AccountStatus => !!v && v in STATUS_META;
const isData = (v: string | null): v is DataHealth => !!v && v in DATA_META;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function UsersView() {
  const params = useSearchParams();
  const ACCOUNTS = useAccounts();
  const [onboarding, setOnboarding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(() => (isStatus(params.get("status")) ? (params.get("status") as AccountStatus) : "all"));
  const [data, setData] = useState<DataFilter>(() => (isData(params.get("data")) ? (params.get("data") as DataHealth) : "all"));
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "last", dir: -1 });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = Boolean(q) || status !== "all" || data !== "all";
  const rows = useMemo(() => {
    const list = ACCOUNTS.filter((a) => (status === "all" || a.status === status) && (data === "all" || a.data === data) && (!q || [a.name, a.email, a.company].some((x) => x.toLowerCase().includes(q))));
    const by = {
      name: (a: Account) => a.name.toLowerCase(),
      company: (a: Account) => a.company.toLowerCase(),
      last: (a: Account) => (a.lastActive ? new Date(a.lastActive).getTime() : -Infinity),
    }[sort.key];
    return [...list].sort((a, b) => (by(a) < by(b) ? -sort.dir : by(a) > by(b) ? sort.dir : 0));
  }, [ACCOUNTS, q, status, data, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const count = (s: AccountStatus) => ACCOUNTS.filter((a) => a.status === s).length;
  const dataCount = (d: DataHealth) => ACCOUNTS.filter((a) => a.data === d).length;

  // Filter changes send the table back to page 1.
  const set = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "last" ? -1 : 1 }));
  const clear = () => {
    setSearch("");
    setStatus("all");
    setData("all");
    setPage(1);
  };

  const selected = rows.findIndex((a) => a.id === openId);
  const account = selected >= 0 ? rows[selected] : null;

  const exportCsv = () => {
    const head = ["Name", "Email", "Role", "Company", "Outlets", "Status", "Onboarding", "Data", "Last active"];
    const body = rows.map((a) => [a.name, a.email, a.role, a.company, a.outlets, STATUS_META[a.status].label, stepLabel(a.step), DATA_META[a.data].label, a.lastActive ?? "Never"]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "korefi-users.csv" });
    link.click();
    URL.revokeObjectURL(url);
  };

  const headers: { label: string; sort?: SortKey; className?: string }[] = [
    { label: "User", sort: "name" },
    { label: "Company", sort: "company" },
    { label: "Sources" },
    { label: "Status" },
    { label: "Onboarding" },
    { label: "Data" },
    { label: "Last active", sort: "last" },
    { label: "Actions", className: "w-px pr-4 text-right whitespace-nowrap" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Users" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <label className="flex h-8 w-[217px] items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest)/60 px-2.5 text-(--color-text-secondary) transition-colors focus-within:border-(--color-focus-primary) focus-within:bg-(--color-background-secondary)">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              aria-label="Search users by name, email or company"
              className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
            />
          </label>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-(--color-border-default) sm:block" />
          <FilterSelect
            label="Status"
            allLabel="All status"
            value={status}
            onChange={set(setStatus)}
            options={(Object.keys(STATUS_META) as AccountStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label, count: count(s) }))}
          />
          <FilterSelect
            label="Data"
            allLabel="All data"
            value={data}
            onChange={set(setData)}
            options={(Object.keys(DATA_META) as DataHealth[]).map((d) => ({ value: d, label: DATA_META[d].label, count: dataCount(d) }))}
          />
          <div className="ml-auto flex items-center gap-2">
            <Button size="small" onClick={exportCsv} disabled={rows.length === 0} iconLeft={<Download aria-hidden />}>
              Export CSV
            </Button>
            <Button type="primary" size="small" onClick={() => setOnboarding(true)} iconLeft={<Plus aria-hidden />}>
              Onboard customer
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-medium border border-(--color-border-default) py-14 text-center">
            <p className="text-body-md font-medium text-(--color-text-primary)">No users match these filters</p>
            {filtered && (
              <Button size="small" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-medium border border-(--color-border-default)">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="sticky top-0 z-[1] bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary)">
                  <tr>
                    {headers.map((h) => (
                      <th key={h.label} aria-sort={h.sort && sort.key === h.sort ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className={cn("px-3 py-2 font-normal", h.className)}>
                        {h.sort ? (
                          <button type="button" onClick={() => toggleSort(h.sort!)} className="inline-flex items-center gap-1.5 rounded-small outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                            {h.label}
                            <ArrowUpDown className={cn("size-3", sort.key === h.sort && "text-(--color-text-clickable)")} aria-hidden />
                          </button>
                        ) : (
                          h.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-body-md">
                  {shown.map((a) => {
                    const st = STATUS_META[a.status];
                    const dt = DATA_META[a.data];
                    const stepIdx = STEPS.findIndex((s) => s.id === a.step);
                    return (
                      <tr key={a.id} onClick={() => setOpenId(a.id)} className={cn("cursor-pointer border-t border-(--color-border-default) align-middle transition-colors hover:bg-(--color-neutral-lightest)/60", openId === a.id && "bg-(--color-primary)/8")}>
                        <td className="max-w-[240px] px-3 py-2.5">
                          <p className="truncate text-(--color-text-primary)">{a.name}</p>
                          <p className="truncate text-body-sm text-(--color-text-secondary)">{a.email}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p>{a.company}</p>
                          <p className="text-body-sm text-(--color-text-secondary)">
                            {a.role} · {a.outlets} {a.outlets === 1 ? "outlet" : "outlets"}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Sources a={a} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {a.step === "done" ? (
                            <span className="text-(--color-text-secondary)">Complete</span>
                          ) : (
                            <>
                              <p>{stepLabel(a.step)}</p>
                              <p className="text-body-sm text-(--color-text-secondary)">
                                Step {stepIdx + 1} of {STEPS.length - 1}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={dt.tone}>{dt.label}</StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-(--color-text-secondary)">{ago(a.lastActive)}</td>
                        <td className="w-px py-2 pr-4 pl-3 text-right whitespace-nowrap">
                          <Button
                            type="text"
                            size="tiny"
                            aria-label={`View ${a.name}`}
                            className="text-(--color-text-secondary) hover:text-(--color-text-primary)"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(a.id);
                            }}
                            iconRight={<ChevronRight aria-hidden />}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageSize={PAGE_SIZE} total={rows.length} noun="users" onPage={setPage} />
          </div>
        )}
      </div>
      <div className="h-3 shrink-0 sm:h-4" aria-hidden />

      {onboarding && (
        <OnboardCustomerDialog
          accounts={ACCOUNTS}
          onClose={() => setOnboarding(false)}
          onDone={(a, sent) => {
            setOnboarding(false);
            clear();
            setSort({ key: "last", dir: -1 });
            setOpenId(a.id);
            setToast(sent ? `Invitation sent to ${a.email}` : `${a.name} added. Share their invite link to get them started.`);
          }}
        />
      )}
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <DetailDrawer
        open={account !== null}
        onClose={() => setOpenId(null)}
        eyebrow={account?.company}
        title={account?.name ?? ""}
        meta={account?.email}
        onPrev={selected > 0 ? () => setOpenId(rows[selected - 1].id) : undefined}
        onNext={selected >= 0 && selected < rows.length - 1 ? () => setOpenId(rows[selected + 1].id) : undefined}
      >
        {account && <AccountDetails a={account} onToast={setToast} />}
      </DetailDrawer>
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

function AccountDetails({ a, onToast }: { a: Account; onToast: (m: string) => void }) {
  const st = STATUS_META[a.status];
  const dt = DATA_META[a.data];
  const idx = STEPS.findIndex((s) => s.id === a.step);
  const steps: TimelineStep[] = STEPS.filter((s) => s.id !== "done").map((s, i) => ({
    label: s.label,
    state: a.step === "done" || i < idx ? "done" : i === idx ? "current" : "upcoming",
    date: i === idx && a.status === "stalled" ? "Stuck here — no activity for over a week" : undefined,
  }));
  return (
    <>
      {a.status === "invited" && (
        <DrawerSection title="Invitation">
          <p className="text-body-sm text-(--color-text-secondary)">{a.name.split(" ")[0]} hasn&rsquo;t accepted yet. The link expires 7 days after it was sent.</p>
          <div className="mt-2 flex gap-2">
            <Button size="small" iconLeft={<Mail aria-hidden />} onClick={() => onToast(`Invitation resent to ${a.email}`)}>
              Resend invite
            </Button>
            <Button
              size="small"
              iconLeft={<Copy aria-hidden />}
              onClick={() => {
                void navigator.clipboard?.writeText(inviteLink(a)).catch(() => {});
                onToast("Invite link copied");
              }}
            >
              Copy link
            </Button>
          </div>
        </DrawerSection>
      )}
      <DetailList
        rows={[
          { label: "Status", value: <StatusBadge tone={st.tone}>{st.label}</StatusBadge> },
          { label: "Role", value: a.role },
          { label: "Outlets", value: a.outlets },
          { label: "Joined", value: fmtDate(a.joined) },
          { label: "Last active", value: a.lastActive ? fmtDateTime(a.lastActive) : "Never signed in" },
        ]}
      />
      <DrawerSection title="Onboarding">
        <Timeline steps={steps} />
      </DrawerSection>
      <DetailList
        title="Data"
        rows={[
          { label: "Freshness", value: <StatusBadge tone={dt.tone}>{dt.label}</StatusBadge> },
          {
            label: "POS",
            value: a.pos ? (
              <span className="inline-flex items-center gap-1.5">
                <ProviderLogo id={a.pos} size={14} />
                {provider(a.pos)?.name}
              </span>
            ) : (
              "Not connected"
            ),
          },
          {
            label: "Delivery apps",
            value:
              a.delivery.length === 0 ? (
                "Not connected"
              ) : (
                <span className="flex flex-col items-end gap-1">
                  {a.delivery.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1.5">
                      <ProviderLogo id={d} size={14} />
                      {provider(d)?.name}
                    </span>
                  ))}
                </span>
              ),
          },
          { label: "Open chargebacks", value: a.openChargebacks },
        ]}
      />
    </>
  );
}
