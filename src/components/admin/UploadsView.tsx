"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check as CheckIcon, ChevronDown, ChevronRight, CircleAlert, FileSpreadsheet, FlaskConical, Info, Lock, Loader2, MapPin, RefreshCw, Search, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Select, SelectControl } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/dashboard/primitives";
import { ProviderLogo } from "./ProviderLogo";
import { takeUpload } from "@/lib/admin/pending";
import { PROVIDERS, SEED_HISTORY, UPLOAD_STATUS as STATUS, USERS, outlet, provider, restaurant, user, type Category, type ProviderId, type Upload } from "@/lib/admin/data";
import {
  SAMPLES,
  SEED_NEEDS_MAPPING,
  autoMatchStores,
  ext,
  fileChecks,
  formatBytes,
  formatRange,
  fromPicked,
  reportTypeOf,
  reviewChecks,
  storesIn,
  type Check,
  type CheckAction,
  type MockFile,
} from "@/lib/admin/mock";

// Ops file upload (replaces the Google Drive drop folders). The page is the upload history.
//   1. "Upload report" opens a one-step popup: user → restaurant → category → provider → file.
//   2. Once the file is uploaded the popup closes and the row appears as "Extracting" — KoreFi
//      reads the file and finds its locations, which can take up to ~5 minutes.
//   3. When extraction is done the row turns "Needs mapping". Ops clicks "Map outlets" in that row
//      to match each location to an outlet; the row then moves on to Processing → Completed.
// The report type is read from the file. Everything is dummy data; the Demo panel triggers states.

const ME = "Nitish Agarwal";
const READ_MS = 1200;
/** Demo stand-in for extraction (real: up to ~5 minutes). */
const EXTRACT_MS = 9000;
const TICK_MS = 110;
const STEP = 6;
const SKIP = "skip";

type UploadState = { state: "idle" | "uploading" | "validating" | "failed"; progress: number };
type StatusFilter = "all" | Upload["status"];
type ProviderFilter = "all" | ProviderId;

/** `accountId` scopes the page to one client (the ops client workspace): only their uploads, and the
 * upload form's User is fixed to them. */
export function UploadsView({ accountId }: { accountId?: string } = {}) {
  // Form
  const [userId, setUserId] = useState(accountId ?? "");
  const [restaurantId, setRestaurantId] = useState(() => {
    const only = accountId ? user(accountId)?.restaurantIds : undefined;
    return only?.length === 1 ? only[0] : "";
  });
  const [category, setCategory] = useState<Category>("3pd");
  const [providerId, setProviderId] = useState<ProviderId | "">("");
  const [file, setFile] = useState<MockFile | null>(null);
  const [reading, setReading] = useState(false);
  // Set when someone tries to add a file before the required choices: missing fields then show errors.
  const [nudged, setNudged] = useState(false);
  // Upload
  const [upload, setUpload] = useState<UploadState>({ state: "idle", progress: 0 });
  const [failNext, setFailNext] = useState(false);
  // Page
  const [history, setHistory] = useState<Upload[]>([SEED_NEEDS_MAPPING, ...SEED_HISTORY]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [failHistory, setFailHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<Upload | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [details, setDetails] = useState<Upload | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useRef(0);
  const seq = useRef(0);

  const u = user(userId);
  const r = restaurant(restaurantId);
  const p = provider(providerId);
  const busy = upload.state === "uploading" || upload.state === "validating";
  const failed = upload.state === "failed";

  const loadHistory = useCallback((fail: boolean) => {
    setHistoryState("loading");
    setTimeout(() => setHistoryState(fail ? "error" : "ready"), 900);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setHistoryState("ready"), 900);
    return () => clearTimeout(t);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  // "Upload report" or a drop on the user workspace's panel: open the dialog, with the file if one came.
  useEffect(() => {
    const take = () => {
      const p = takeUpload();
      if (!p) return;
      setOpen(true);
      if (p.file) {
        setFile(fromPicked(p.file));
        setUpload({ state: "idle", progress: 0 });
        setReading(true);
        setTimeout(() => setReading(false), READ_MS);
      }
    };
    const t = setTimeout(take, 0);
    window.addEventListener("kf-admin-upload", take);
    return () => {
      clearTimeout(t);
      window.removeEventListener("kf-admin-upload", take);
    };
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setProviderFilter("all");
  };
  const flash = (id: string) => {
    setHighlight(id);
    setTimeout(() => setHighlight((x) => (x === id ? null : x)), 6000);
  };

  const pickFile = (f: MockFile) => {
    setFile(f);
    setUpload({ state: "idle", progress: 0 });
    setReading(true);
    setTimeout(() => setReading(false), READ_MS);
  };
  const clearFile = () => {
    if (timer.current) clearInterval(timer.current);
    setFile(null);
    setReading(false);
    setUpload({ state: "idle", progress: 0 });
  };
  const chooseUser = (id: string) => {
    setUserId(id);
    const only = user(id)?.restaurantIds;
    setRestaurantId(only?.length === 1 ? only[0] : "");
  };

  const fileProblems = useMemo(() => (file && !reading ? fileChecks(file, providerId, history) : []), [file, reading, providerId, history]);
  const fileErrors = fileProblems.filter((c) => c.tone === "error").length;
  const missing = [!userId && "user", userId && !restaurantId && "restaurant", !providerId && "provider", !file && "file"].filter(Boolean) as string[];
  const needed = [!userId && "User", !restaurantId && "Restaurant", !providerId && "Provider"].filter(Boolean) as string[];
  const showNeed = nudged && !file;
  const canUpload = missing.length === 0 && !reading && fileErrors === 0;

  const onAction = (a: CheckAction) => {
    if (a.kind === "provider" && a.value) setProviderId(a.value as ProviderId);
  };

  const startUpload = () => {
    if (!file || !p) return;
    const failAt = failNext ? 64 : null;
    setFailNext(false);
    if (upload.state !== "failed") progress.current = 0;
    setUpload({ state: "uploading", progress: progress.current });
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      const next = Math.min(100, progress.current + STEP);
      if (failAt !== null && next >= failAt && progress.current < failAt) {
        clearInterval(timer.current!);
        progress.current = failAt;
        setUpload({ state: "failed", progress: failAt });
        setToast("Upload failed at 64%. Open “Upload report” to retry.");
        return;
      }
      progress.current = next;
      if (next >= 100) {
        clearInterval(timer.current!);
        setUpload({ state: "validating", progress: 100 });
        setTimeout(finish, 1400);
        return;
      }
      setUpload({ state: "uploading", progress: next });
    }, TICK_MS);
  };

  /** Upload is done: close the popup and let the row go through extraction in the table. */
  const finish = () => {
    if (!file || !p || !r) return;
    const id = `new-${(seq.current += 1)}`;
    const fr = file;
    const rid = r.id;
    const row: Upload = {
      id,
      fileName: fr.name,
      size: fr.size,
      rows: fr.rows,
      userId,
      restaurantId: rid,
      outletIds: [],
      provider: p.id,
      reportType: reportTypeOf(fr, p.id),
      uploadedBy: ME,
      status: "extracting",
      start: fr.start,
      end: fr.end,
      at: new Date().toISOString(),
      source: fr,
    };
    setHistory((h) => [row, ...h]);
    setHistoryState("ready");
    setOpen(false);
    clearFilters();
    flash(id);
    setToast("Uploaded. Extracting locations — this can take up to 5 minutes.");
    setTimeout(() => {
      setHistory((h) => h.map((x) => (x.id === id ? { ...x, status: "needs_mapping", locations: storesIn(fr, rid).map((l) => ({ ...l, outletId: "" })) } : x)));
      flash(id);
      setToast(`Extraction finished — ${fr.name} needs mapping.`);
    }, EXTRACT_MS);
    // Keep user, restaurant and provider: ops usually uploads several reports in a row.
    setFile(null);
    setUpload({ state: "idle", progress: 0 });
  };

  /** Ops mapped the locations from the table: start the import and settle the final status. */
  const confirmMapping = (row: Upload, map: Record<string, string>, imported: number, skippedRows: number) => {
    const src = row.source!;
    const locs = storesIn(src, row.restaurantId);
    const outletIds = [...new Set(locs.map((l) => map[l.name]).filter((o) => o && o !== SKIP))];
    const noDate = src.missingDates ?? 0;
    const skipped = noDate + skippedRows;
    const reason = [noDate && "no date", skippedRows && "location skipped"].filter(Boolean).join(" + ") || undefined;
    setHistory((h) => h.map((x) => (x.id === row.id ? { ...x, status: "processing", rows: imported, outletIds, locations: locs.map((l) => ({ ...l, outletId: map[l.name] === SKIP ? "" : map[l.name] })) } : x)));
    setMapping(null);
    clearFilters();
    flash(row.id);
    setToast(`Outlets mapped. Importing ${imported.toLocaleString()} rows — usually under 2 minutes.`);
    setTimeout(() => setHistory((h) => h.map((x) => (x.id === row.id ? { ...x, status: skipped ? "partial" : "completed", skipped, skipReason: reason } : x))), 4000);
  };

  const buttonLabel = upload.state === "validating" ? "Validating…" : busy ? `Uploading… ${upload.progress}%` : failed ? "Retry upload" : "Upload report";
  const helper = needed.length
    ? "Fill in the required fields (*), then add the file."
    : missing.length
      ? `Choose ${listJoin(missing)} to upload.`
      : reading
        ? "Reading the file…"
        : fileErrors
          ? "Fix the problem with the file, or choose another one."
          : busy
            ? "You can close this — the upload keeps going."
            : failed
              ? "Your file and choices are kept."
              : "Next: KoreFi extracts the locations, then you map them from the table.";

  const statusCount = (st: Upload["status"]) => history.filter((h) => h.status === st && (!accountId || h.userId === accountId)).length;
  const q = search.trim().toLowerCase();
  const filtered = Boolean(q) || statusFilter !== "all" || providerFilter !== "all";
  const shown = history.filter(
    (h) =>
      (!accountId || h.userId === accountId) &&
      (statusFilter === "all" || h.status === statusFilter) &&
      (providerFilter === "all" || h.provider === providerFilter) &&
      (!q || [h.fileName, restaurant(h.restaurantId)?.name, user(h.userId)?.name].some((x) => x?.toLowerCase().includes(q))),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="File uploads" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4 sm:px-6">
        {/* Filters on the left, the primary action on the right (same row, above the table). */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <label className="flex h-8 w-[217px] items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest)/60 px-2.5 text-(--color-text-secondary) transition-colors focus-within:border-(--color-focus-primary) focus-within:bg-(--color-background-secondary)">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search uploads by file, restaurant or user"
              className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
            />
          </label>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-(--color-border-default) sm:block" />
          <FilterSelect
            label="Status"
            allLabel="All status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "needs_mapping", label: "Needs mapping", count: statusCount("needs_mapping") },
              { value: "extracting", label: "Extracting", count: statusCount("extracting") },
              { value: "processing", label: "Processing", count: statusCount("processing") },
              { value: "completed", label: "Completed", count: statusCount("completed") },
              { value: "partial", label: "Partially imported", count: statusCount("partial") },
              { value: "rejected", label: "Rejected", count: statusCount("rejected") },
            ]}
          />
          <FilterSelect label="Provider" allLabel="All providers" value={providerFilter} onChange={setProviderFilter} options={PROVIDERS.map((x) => ({ value: x.id, label: x.name, logo: x.id }))} />
          <div className="ml-auto flex items-center gap-2">
            <Button size="small" icon={<RefreshCw className={cn(historyState === "loading" && "animate-spin")} aria-hidden />} aria-label="Refresh" title="Refresh" onClick={() => loadHistory(failHistory)} disabled={historyState === "loading"} />
            <Button type="primary" size="small" onClick={() => setOpen(true)} iconLeft={<UploadCloud aria-hidden />}>
              {busy ? `Uploading… ${upload.progress}%` : "Upload report"}
            </Button>
          </div>
        </div>
        <HistoryTable state={historyState} rows={shown} filtered={filtered} onClear={clearFilters} highlight={highlight} onOpen={setDetails} onMap={setMapping} onRetry={() => loadHistory(failHistory)} onUpload={() => setOpen(true)} />
      </div>

      {open && (
        <UploadDialog
          title="Upload a report"
          busy={busy}
          onClose={() => setOpen(false)}
          footer={
            <>
              <p className={cn("min-w-0 flex-1 text-body-sm", fileErrors ? "text-(--color-text-danger)" : "text-(--color-text-secondary)")}>{helper}</p>
              <Button size="small" onClick={() => setOpen(false)}>
                {busy ? "Hide" : "Cancel"}
              </Button>
              <Button type="primary" size="small" loading={busy} disabled={!canUpload} onClick={startUpload} iconLeft={<UploadCloud aria-hidden />}>
                {buttonLabel}
              </Button>
            </>
          }
        >
          {(busy || failed) && file ? (
            <UploadProgress file={file} upload={upload} onRetry={startUpload} onHide={() => setOpen(false)} />
          ) : (
            <div className="flex flex-col gap-4">
              <Select
                label={<Req>{accountId ? "Client" : "User"}</Req>}
                error={showNeed && !userId ? "Select a user" : undefined}
                placeholder="Select the customer account"
                value={userId}
                onChange={(e) => chooseUser(e.target.value)}
                disabled={!!accountId}
                options={(accountId ? [user(accountId)!] : USERS).map((x) => ({ value: x.id, label: `${x.name} · ${x.email}` }))}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <Select
                  label={<Req>Restaurant</Req>}
                  error={showNeed && userId && !restaurantId ? "Select a restaurant" : undefined}
                  placeholder={u ? "Select a restaurant" : "Choose a user first"}
                  disabled={!u}
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  options={u?.restaurantIds.map((id) => ({ value: id, label: restaurant(id)!.name })) ?? []}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-label-sm text-(--color-text-secondary)">Category</span>
                  <div role="radiogroup" aria-label="Report category" className="flex h-10 gap-0.5 rounded-medium bg-(--color-neutral-lightest) p-0.5">
                    {(
                      [
                        ["3pd", "3PD"],
                        ["pos", "POS"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={category === k}
                        title={k === "3pd" ? "Third-party delivery" : "Point of sale"}
                        onClick={() => {
                          if (category === k) return;
                          setCategory(k);
                          setProviderId("");
                        }}
                        className={cn(
                          "w-16 rounded-[6px] text-body-sm transition-colors",
                          category === k ? "bg-(--color-background-secondary) font-medium text-(--color-text-primary) shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-label-sm text-(--color-text-secondary)">
                  <Req>Provider</Req>
                </span>
                <div role="radiogroup" aria-label="Provider" className={cn("grid gap-2", category === "3pd" ? "grid-cols-3" : "grid-cols-2")}>
                  {PROVIDERS.filter((x) => x.category === category).map((x) => {
                    const on = providerId === x.id;
                    const bad = on && fileProblems.some((c) => c.id === "provider");
                    return (
                      <button
                        key={x.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setProviderId(x.id)}
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-medium border px-2.5 text-body-sm transition-colors",
                          on
                            ? bad
                              ? "border-(--color-danger-default) bg-(--color-danger-lightest) font-medium"
                              : "border-(--color-primary) bg-(--color-primary)/10 font-medium"
                            : showNeed && !providerId
                              ? "border-(--color-danger-default)/60 hover:border-(--color-danger-default)"
                              : "border-(--color-border-default) hover:border-(--color-border-darker)",
                        )}
                      >
                        <ProviderLogo id={x.id} />
                        {x.name}
                      </button>
                    );
                  })}
                </div>
                {showNeed && !providerId && (
                  <p className="flex items-center gap-1.5 text-body-sm text-(--color-text-danger)">
                    <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                    Select the provider that produced the file
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-label-sm text-(--color-text-secondary)">
                  <Req>Report file</Req>
                </span>
                {file ? <FileRow file={file} reading={reading} bad={fileErrors > 0} onClear={clearFile} onReplace={(f) => pickFile(fromPicked(f))} /> : <DropZone locked={needed} onLockedTry={() => setNudged(true)} onFile={(f) => pickFile(fromPicked(f))} />}
              </div>
              {fileProblems.length > 0 && (
                <ul className="flex flex-col gap-2.5 rounded-medium border border-(--color-danger-default)/40 bg-(--color-danger-lightest)/50 p-3">
                  {fileProblems.map((c) => (
                    <CheckRow key={c.id} c={c} onAction={onAction} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </UploadDialog>
      )}

      {mapping && <MapDialog upload={mapping} history={history} onClose={() => setMapping(null)} onConfirm={(map, imported, skippedRows) => confirmMapping(mapping, map, imported, skippedRows)} />}

      {details && (
        <DetailsDrawer
          upload={details}
          onClose={() => setDetails(null)}
          onMap={() => {
            setMapping(details);
            setDetails(null);
          }}
        />
      )}

      <DemoPanel
        onSample={(f) => {
          if (busy) return;
          setOpen(true);
          pickFile(f);
        }}
        onPrefill={() => {
          setOpen(true);
          if (!accountId) {
            setUserId("priya");
            setRestaurantId("eggholic");
          }
          setCategory("3pd");
          setProviderId("doordash");
        }}
        failNext={failNext}
        setFailNext={setFailNext}
        failHistory={failHistory}
        setFailHistory={(v) => {
          setFailHistory(v);
          loadHistory(v);
        }}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/** "All status ⌄" style dropdown: shows the choice, or the "all" label when nothing is filtered. */
function FilterSelect<K extends string>({ label, allLabel, value, onChange, options }: { label: string; allLabel: string; value: K | "all"; onChange: (v: K | "all") => void; options: { value: K; label: string; count?: number; logo?: ProviderId }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  const current = options.find((o) => o.value === value);
  const pick = (v: K | "all") => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? allLabel}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-medium border px-2.5 text-body-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
          current ? "border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-primary)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)",
        )}
      >
        {current?.logo && <ProviderLogo id={current.logo} size={14} />}
        {current?.label ?? allLabel}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute top-full left-0 z-30 mt-1.5 min-w-52 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-md">
          {[{ value: "all" as const, label: allLabel, count: undefined, logo: undefined }, ...options].map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={value === o.value} onClick={() => pick(o.value)} className="flex h-8 w-full items-center gap-2 rounded-small px-2 text-left text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-lightest)">
                <CheckIcon className={cn("size-3.5 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} aria-hidden />
                {o.logo && <ProviderLogo id={o.logo} size={14} />}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.count !== undefined && <span className="text-body-sm tabular-nums text-(--color-text-secondary)">{o.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const listJoin = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-body-sm text-(--color-text-secondary)">{label}</p>
      <p className="truncate text-subtitle-sm text-(--color-text-primary)">{value}</p>
      {sub && <p className="truncate text-body-sm text-(--color-text-secondary)">{sub}</p>}
    </div>
  );
}

/** Map outlets header: which file, for whom, and how much is in it — one soft block, no inner borders. */
function ContextCard({ file, providerId, reportType, userName, userEmail, restaurantName, locations }: { file: MockFile; providerId: ProviderId; reportType: string; userName: string; userEmail: string; restaurantName: string; locations: number }) {
  const pv = provider(providerId)!;
  const facts = [
    { label: "User", value: userName, title: userEmail },
    { label: "Restaurant", value: restaurantName },
    { label: "Source rows", value: file.rows.toLocaleString() },
    { label: "Source locations", value: String(locations) },
  ];
  return (
    <section aria-label="File summary" className="rounded-medium bg-(--color-neutral-lightest)/70 px-4 py-3">
      <div className="flex items-center gap-2">
        <ProviderLogo id={pv.id} size={16} />
        <p className="min-w-0 flex-1 truncate text-body-md font-medium text-(--color-text-primary)" title={file.name}>
          {file.name}
        </p>
      </div>
      <p className="mt-0.5 truncate pl-6 text-body-sm text-(--color-text-secondary)">
        {pv.name} {reportType} · {formatRange(file.start, file.end)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-body-sm text-(--color-text-secondary)">{f.label}</dt>
            <dd className="truncate text-body-md font-medium tabular-nums text-(--color-text-primary)" title={f.title}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function UploadDialog({ title, busy, onClose, footer, children }: { title: string; busy: boolean; onClose: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  // Escape or a click on the backdrop hides the dialog. State lives in the page, so an upload in
  // progress keeps going and reopening shows it where it was.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-3 sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_16px_48px_rgb(0_0_0/0.18)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border-default) px-5 py-3.5">
          <h2 className="min-w-0 flex-1 text-subtitle-md text-(--color-text-primary)">{title}</h2>
          <button type="button" aria-label={busy ? "Hide" : "Close"} onClick={onClose} className="-mr-1.5 grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex shrink-0 items-center gap-2 border-t border-(--color-border-default) px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}

/** Map outlets: opened from a "Needs mapping" row once extraction has found the file's locations. */
function MapDialog({ upload: u, history, onClose, onConfirm }: { upload: Upload; history: Upload[]; onClose: () => void; onConfirm: (map: Record<string, string>, imported: number, skippedRows: number) => void }) {
  const file = u.source!;
  const r = restaurant(u.restaurantId)!;
  const usr = user(u.userId);
  const locations = storesIn(file, r.id);
  const [outletMap, setOutletMap] = useState<Record<string, string>>(() => autoMatchStores(file, r.id));
  const [keepBoth, setKeepBoth] = useState(false);

  const unmapped = locations.filter((l) => !outletMap[l.name]);
  const mappedOutlets = [...new Set(locations.map((l) => outletMap[l.name]).filter((o) => o && o !== SKIP))];
  const skippedRows = locations.filter((l) => outletMap[l.name] === SKIP).reduce((n, l) => n + l.rows, 0);
  const imported = file.rows - skippedRows - (file.missingDates ?? 0);
  const ok = unmapped.length === 0 && mappedOutlets.length > 0;
  const notes = reviewChecks(
    file,
    u.provider,
    mappedOutlets,
    skippedRows,
    history.filter((h) => h.id !== u.id),
    keepBoth,
  ).filter((c) => c.tone !== "ok");
  const auto = autoMatchStores(file, r.id);
  const helper = unmapped.length ? `Map ${unmapped.length} location${unmapped.length > 1 ? "s" : ""} to an outlet, or skip ${unmapped.length > 1 ? "them" : "it"}.` : mappedOutlets.length === 0 ? "Map at least one location to an outlet." : "";

  return (
    <UploadDialog
      title="Map outlets"
      busy={false}
      onClose={onClose}
      footer={
        <>
          <p className={cn("min-w-0 flex-1 text-body-sm", unmapped.length ? "text-(--color-text-warning)" : "text-(--color-text-secondary)")}>{helper}</p>
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button type="primary" size="small" disabled={!ok} onClick={() => onConfirm(outletMap, imported, skippedRows)}>
            {`Confirm & import ${imported.toLocaleString()} rows`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ContextCard file={file} providerId={file.provider ?? u.provider} reportType={u.reportType} userName={usr?.name ?? ""} userEmail={usr?.email ?? ""} restaurantName={r.name} locations={locations.length} />
        <div className="flex flex-col gap-1.5">
          <span className="text-label-sm text-(--color-text-secondary)">Locations → {r.name} outlets</span>
          <ul className="overflow-hidden rounded-medium border border-(--color-border-default)">
            {locations.map((l) => {
              const v = outletMap[l.name] ?? "";
              const isAuto = v && v !== SKIP && auto[l.name] === v;
              return (
                <li key={l.name} className={cn("flex items-center gap-3 border-t border-(--color-border-default) px-3 py-2 first:border-t-0", !v && "bg-(--color-warning-lightest)/40")}>
                  <MapPin className={cn("size-4 shrink-0", v ? "text-(--color-text-secondary)" : "text-(--color-text-warning)")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-body-md text-(--color-text-primary)">
                      <span className="truncate">{l.name}</span>
                      {isAuto && <CheckIcon className="size-3.5 shrink-0 text-(--color-text-success)" aria-label="Matched automatically" />}
                    </p>
                    <p className="truncate text-body-sm text-(--color-text-secondary)">
                      {l.rows.toLocaleString()} rows · ID {l.externalId}
                    </p>
                  </div>
                  <SelectControl
                    aria-label={`Outlet for ${l.name}`}
                    placeholder="Choose outlet"
                    value={v}
                    onChange={(e) => setOutletMap((m) => ({ ...m, [l.name]: e.target.value }))}
                    className={cn("h-8 w-[156px] text-body-md", !v && "border-(--color-warning-default)")}
                    options={[...r.outlets.map((o) => ({ value: o.id, label: o.name })), { value: SKIP, label: "Skip these rows" }]}
                  />
                </li>
              );
            })}
          </ul>
        </div>
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {notes.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)" title={c.detail}>
                <AlertTriangle className="size-3.5 shrink-0 text-(--color-text-warning)" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {c.action && (
                  <button type="button" onClick={() => c.action!.kind === "keepBoth" && setKeepBoth(true)} className="shrink-0 font-medium text-(--color-text-clickable) hover:underline">
                    {c.action.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </UploadDialog>
  );
}

/** Red asterisk for required fields. */
function Req({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <span className="ml-0.5 text-(--color-text-danger)" aria-hidden>
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

/** File drop area. Stays locked until the required choices above are made, and says which are missing. */
function DropZone({ locked, onLockedTry, onFile }: { locked: string[]; onLockedTry: () => void; onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isLocked = locked.length > 0;
  const open = () => (isLocked ? onLockedTry() : input.current?.click());
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={isLocked || undefined}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (isLocked) return onLockedTry();
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center gap-1 rounded-medium border-[1.5px] border-dashed px-4 py-5 text-center outline-none transition-colors focus-visible:border-(--color-focus-primary)",
        isLocked
          ? "cursor-not-allowed border-(--color-border-default) bg-(--color-neutral-lightest)/40"
          : over
            ? "cursor-pointer border-(--color-primary) bg-(--color-primary)/8"
            : "cursor-pointer border-(--color-border-darker) bg-(--color-neutral-lightest)/60 hover:border-(--color-primary)",
      )}
    >
      <span className={cn("grid size-9 place-items-center rounded-circle", isLocked ? "bg-(--color-neutral-lightest) text-(--color-text-disabled)" : "bg-(--color-primary)/12 text-(--color-text-clickable)")}>
        {isLocked ? <Lock className="size-4" aria-hidden /> : <UploadCloud className="size-4.5" aria-hidden />}
      </span>
      {isLocked ? (
        <>
          <p className="text-body-md font-medium text-(--color-text-secondary)">Choose {listJoin(locked.map((l) => l.toLowerCase()))} first</p>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {["User", "Restaurant", "Provider"].map((k) => {
              const done = !locked.includes(k);
              return (
                <span key={k} className={cn("inline-flex items-center gap-1 rounded-circle px-2 py-0.5 text-body-sm", done ? "bg-(--color-success-lightest) text-(--color-text-success)" : "bg-(--color-neutral-lightest) text-(--color-text-secondary)")}>
                  {done ? <CheckIcon className="size-3" aria-hidden /> : <span className="size-1.5 rounded-circle bg-current opacity-60" aria-hidden />}
                  {k}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="text-body-md font-medium text-(--color-text-primary)">{over ? "Drop to add the file" : "Drop the report here or browse"}</p>
          <p className="text-body-sm text-(--color-text-secondary)">CSV, XLSX or XLS · up to 20 MB · one report per upload</p>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const FILE_TINT: Record<string, string> = {
  csv: "bg-(--color-info-lightest) text-(--color-text-information)",
  xlsx: "bg-(--color-success-lightest) text-(--color-text-success)",
  xls: "bg-(--color-success-lightest) text-(--color-text-success)",
};

/** The picked file: format icon, name, what we found in it, and Replace / remove. */
function FileRow({ file, reading, bad, onClear, onReplace }: { file: MockFile; reading: boolean; bad: boolean; onClear: () => void; onReplace: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const e = ext(file.name);
  const facts = [formatBytes(file.size), file.rows ? `${file.rows.toLocaleString()} rows` : null, file.sheets.length > 1 ? `${file.sheets.length} sheets` : null].filter(Boolean).join(" · ");
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-medium border transition-colors",
        bad ? "border-(--color-danger-default) bg-(--color-danger-lightest)/40" : reading ? "border-(--color-border-default)" : "border-(--color-border-default) bg-(--color-neutral-lightest)/50",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-medium", bad ? "bg-(--color-danger-lightest) text-(--color-text-danger)" : (FILE_TINT[e] ?? "bg-(--color-neutral-lightest) text-(--color-text-secondary)"))}>
          {bad ? <CircleAlert className="size-5" aria-hidden /> : <FileSpreadsheet className="size-5" aria-hidden />}
          <span className="absolute -right-1.5 -bottom-1 rounded-[4px] border border-(--color-border-default) bg-(--color-background-secondary) px-1 text-[9px] leading-[14px] font-semibold tracking-wide text-(--color-text-secondary) uppercase">{e.slice(0, 4)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md font-medium text-(--color-text-primary)" title={file.name}>
            {file.name}
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            {reading ? (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                <span className="truncate">Reading file…</span>
              </>
            ) : bad ? (
              <span className="truncate text-(--color-text-danger)">Can’t be used · {formatBytes(file.size)}</span>
            ) : (
              <>
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-(--color-text-success)">
                  <CheckIcon className="size-3.5" aria-hidden />
                  Ready
                </span>
                <span aria-hidden>·</span>
                <span className="truncate">{facts}</span>
              </>
            )}
          </p>
        </div>
        {!reading && (
          <button type="button" onClick={() => input.current?.click()} className="shrink-0 rounded-small px-2 py-1 text-body-sm font-medium text-(--color-text-clickable) hover:bg-(--color-primary)/10">
            Replace
          </button>
        )}
        <button type="button" aria-label="Remove file" title="Remove file" onClick={onClear} className="grid size-7 shrink-0 place-items-center rounded-small text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)">
          <X className="size-4" aria-hidden />
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          tabIndex={-1}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) onReplace(f);
            ev.target.value = "";
          }}
        />
      </div>
      {reading && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-(--color-neutral-light)">
          <span className="block h-full w-2/5 kf-indeterminate bg-(--color-primary)" />
        </span>
      )}
    </div>
  );
}

const TONE_ICON = {
  ok: { Icon: CheckIcon, cls: "bg-(--color-success-lightest) text-(--color-text-success)" },
  error: { Icon: X, cls: "bg-(--color-danger-lightest) text-(--color-text-danger)" },
  warning: { Icon: AlertTriangle, cls: "bg-(--color-warning-lightest) text-(--color-text-warning)" },
};

function CheckRow({ c, onAction }: { c: Check; onAction?: (a: CheckAction) => void }) {
  const { Icon, cls } = TONE_ICON[c.tone];
  return (
    <li className="flex items-start gap-2.5">
      <span className={cn("mt-px grid size-5 shrink-0 place-items-center rounded-circle", cls)}>
        <Icon className="size-3" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-body-md font-medium", c.tone === "error" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{c.title}</p>
        {c.detail && <p className="text-body-sm text-(--color-text-secondary)">{c.detail}</p>}
      </div>
      {c.action && onAction && (
        <button type="button" onClick={() => onAction(c.action!)} className="shrink-0 rounded-small px-1.5 py-0.5 text-body-sm font-medium text-(--color-text-clickable) hover:bg-(--color-primary)/10">
          {c.action.label}
        </button>
      )}
    </li>
  );
}

/** While uploading: one focused progress view with the three stages, instead of the review. */
function UploadProgress({ file, upload, onRetry, onHide }: { file: MockFile; upload: UploadState; onRetry: () => void; onHide: () => void }) {
  const failed = upload.state === "failed";
  const validating = upload.state === "validating";
  const secondsLeft = Math.max(1, Math.ceil((((100 - upload.progress) / STEP) * TICK_MS) / 1000));
  type Stage = { label: string; detail: string; status: "done" | "active" | "failed" | "todo" };
  const stages: Stage[] = [
    {
      label: "Upload file",
      detail: failed
        ? `Connection lost at ${upload.progress}%. Your file and choices are kept.`
        : validating
          ? `${formatBytes(file.size)} uploaded`
          : `${formatBytes((file.size * upload.progress) / 100)} of ${formatBytes(file.size)} · about ${secondsLeft}s left`,
      status: failed ? "failed" : validating ? "done" : "active",
    },
    { label: "Validate on KoreFi", detail: "Columns, dates and duplicates, checked on the server", status: validating ? "active" : "todo" },
    { label: "Extract locations", detail: "Runs in the background (up to 5 min). The row says “Needs mapping” when it’s ready.", status: "todo" },
  ];
  return (
    <div>
      <div>
        <div className="flex items-center gap-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-medium", failed ? "bg-(--color-danger-lightest) text-(--color-text-danger)" : "bg-(--color-primary)/12 text-(--color-text-clickable)")}>
            {failed ? <CircleAlert className="size-5" aria-hidden /> : <FileSpreadsheet className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-md font-medium text-(--color-text-primary)">{file.name}</p>
            <p className={cn("text-body-sm", failed ? "text-(--color-text-danger)" : "text-(--color-text-secondary)")}>{failed ? "Upload failed" : validating ? "Uploaded — validating…" : `Uploading · ${upload.progress}%`}</p>
          </div>
          <span className="text-subtitle-lg tabular-nums text-(--color-text-primary)">{upload.progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-circle bg-(--color-neutral-light)" role="progressbar" aria-valuenow={upload.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className={cn("relative h-full overflow-hidden rounded-circle transition-[width] duration-150", failed ? "bg-(--color-danger-default)" : validating ? "bg-(--color-success-default)" : "bg-(--color-primary)")} style={{ width: `${upload.progress}%` }}>
            {!failed && <span className="absolute inset-0 animate-pulse bg-white/25" />}
          </div>
        </div>
        <ol className="mt-5 flex flex-col">
          {stages.map((st, i) => (
            <li key={st.label} className="relative flex gap-3 pb-4 last:pb-0">
              {i < stages.length - 1 && <span aria-hidden className={cn("absolute top-6 left-[11px] h-[calc(100%-20px)] w-px", st.status === "done" ? "bg-(--color-success-default)" : "bg-(--color-border-default)")} />}
              <span
                className={cn(
                  "relative grid size-6 shrink-0 place-items-center rounded-circle border text-body-sm",
                  st.status === "done" && "border-transparent bg-(--color-success-lightest) text-(--color-text-success)",
                  st.status === "active" && "border-(--color-primary) bg-(--color-background-secondary) text-(--color-text-clickable)",
                  st.status === "failed" && "border-transparent bg-(--color-danger-lightest) text-(--color-text-danger)",
                  st.status === "todo" && "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary)",
                )}
              >
                {st.status === "done" ? <CheckIcon className="size-3.5" aria-hidden /> : st.status === "active" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : st.status === "failed" ? <X className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn("text-body-md font-medium", st.status === "todo" ? "text-(--color-text-secondary)" : st.status === "failed" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{st.label}</p>
                <p className="text-body-sm text-(--color-text-secondary)">{st.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center gap-3 rounded-medium bg-(--color-neutral-lightest) px-3 py-2.5">
          {failed ? (
            <>
              <p className="min-w-0 flex-1 text-body-sm text-(--color-text-secondary)">Retry continues from {upload.progress}%.</p>
              <Button type="primary" size="tiny" onClick={onRetry} iconLeft={<RefreshCw aria-hidden />}>
                Retry upload
              </Button>
            </>
          ) : (
            <>
              <p className="min-w-0 flex-1 text-body-sm text-(--color-text-secondary)">You don’t have to wait — close this and the upload keeps going.</p>
              <Button size="tiny" onClick={onHide}>
                Continue in background
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Locations stored with the upload, or (for older seed rows) one per outlet. */
function locationsOf(u: Upload) {
  if (u.locations) return u.locations;
  const r = restaurant(u.restaurantId)!;
  return u.outletIds.map((o, i) => ({ name: `${r.name} (${outlet(r.id, o)?.name})`, rows: Math.round(u.rows / u.outletIds.length), externalId: String(455501 + i), outletId: o }));
}

/** Customer-column subtitle: who, and which outlet(s) — or what's still to do. */
function outletSummary(u: Upload) {
  if (u.status === "extracting") return "Locations pending";
  if (u.status === "needs_mapping") return `${locationsOf(u).length} locations to map`;
  return u.outletIds.length > 1 ? `${u.outletIds.length} outlets` : (outlet(u.restaurantId, u.outletIds[0])?.name ?? "");
}

function HistoryTable({ state, rows, filtered, onClear, highlight, onOpen, onMap, onRetry, onUpload }: { state: "loading" | "ready" | "error"; rows: Upload[]; filtered: boolean; onClear: () => void; highlight: string | null; onOpen: (u: Upload) => void; onMap: (u: Upload) => void; onRetry: () => void; onUpload: () => void }) {
  if (state === "error")
    return (
      <div className="flex flex-col items-center gap-2 rounded-medium border border-(--color-border-default) py-14 text-center">
        <p className="text-body-md font-medium text-(--color-text-primary)">Couldn’t load upload history</p>
        <p className="text-body-sm text-(--color-text-secondary)">Something went wrong on our side. Your uploads are safe — try again in a moment.</p>
        <Button size="small" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  if (state === "ready" && rows.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 rounded-medium border border-(--color-border-default) py-14 text-center">
        <p className="text-body-md font-medium text-(--color-text-primary)">{filtered ? "No uploads match these filters" : "No uploads yet"}</p>
        {filtered ? (
          <Button size="small" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <Button size="small" type="primary" onClick={onUpload} iconLeft={<UploadCloud aria-hidden />}>
            Upload report
          </Button>
        )}
      </div>
    );
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-medium border border-(--color-border-default)">
      <table className="w-full min-w-[840px] text-left">
        <thead className="sticky top-0 z-[1] bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary)">
          <tr>
            {["File", "Customer", "Provider", "Status", "Updated", "Action"].map((h) => (
              <th key={h} className={cn("px-3 py-2 font-normal", h === "Action" && "w-px pr-4 text-right whitespace-nowrap")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-body-md">
          {state === "loading"
            ? Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-t border-(--color-border-default)">
                  {[70, 50, 40, 40, 45, 30].map((w, j) => (
                    <td key={j} className="px-3 py-4">
                      <span className={cn("block h-2.5 animate-pulse rounded-small bg-(--color-neutral-lightest)", j === 5 && "ml-auto")} style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((u) => {
                const s = STATUS[u.status];
                const pv = provider(u.provider)!;
                const r = restaurant(u.restaurantId);
                return (
                  <tr key={u.id} onClick={() => onOpen(u)} className={cn("cursor-pointer border-t border-(--color-border-default) align-middle transition-colors duration-700 hover:bg-(--color-neutral-lightest)/60", highlight === u.id && "bg-(--color-primary)/8")}>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <p className="truncate text-(--color-text-primary)">{u.fileName}</p>
                      <p className="text-body-sm text-(--color-text-secondary)">
                        {u.rows.toLocaleString()} rows · {u.reportType}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p>{r?.name}</p>
                      <p className="text-body-sm text-(--color-text-secondary)">
                        {user(u.userId)?.name} · {outletSummary(u)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <ProviderLogo id={pv.id} size={16} />
                        {pv.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        {(u.status === "processing" || u.status === "extracting") && <Loader2 className="size-3 animate-spin text-(--color-text-information)" aria-hidden />}
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                        <StatusTip upload={u} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-(--color-text-secondary)">{new Date(u.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="w-px py-2 pr-4 pl-3 text-right whitespace-nowrap">
                      {u.status === "needs_mapping" ? (
                        // The one action that needs doing: soft brand fill, so it stands out without shouting.
                        <Button
                          type="link"
                          size="tiny"
                          aria-label={`Map outlets for ${u.fileName}`}
                          className="bg-(--color-primary)/12 hover:bg-(--color-primary)/22"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMap(u);
                          }}
                          iconRight={<ArrowRight aria-hidden />}
                        >
                          Map outlets
                        </Button>
                      ) : (
                        // Everything else: a quiet ghost link into Report details.
                        <Button
                          type="text"
                          size="tiny"
                          aria-label={`View ${u.fileName}`}
                          className="text-(--color-text-secondary) hover:text-(--color-text-primary)"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(u);
                          }}
                          iconRight={<ChevronRight aria-hidden />}
                        >
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}

/** What's behind a status, in a hover / focus tooltip next to the badge. */
function statusDetail(u: Upload): { title: string; lines: string[] } {
  const by = `Uploaded by ${u.uploadedBy}`;
  switch (u.status) {
    case "extracting":
      return { title: "Extracting", lines: ["Reading the file and finding its locations.", "Usually up to 5 minutes. It becomes “Needs mapping” when ready.", by] };
    case "needs_mapping":
      return { title: "Needs mapping", lines: [`Extraction finished — ${locationsOf(u).length} locations found.`, "Map them to outlets to start the import.", by] };
    case "processing":
      return { title: "Processing", lines: ["Validating… → Importing", by] };
    case "completed":
      return { title: "Completed", lines: [`All ${u.rows.toLocaleString()} rows imported`, by] };
    case "partial":
      return { title: "Partially imported", lines: [`${(u.skipped ?? 0).toLocaleString()} rows skipped (${u.skipReason ?? "no date"})`, `${u.rows.toLocaleString()} rows imported`, by] };
    case "rejected":
      return { title: "Rejected", lines: [u.reason ?? "The report couldn’t be imported.", by] };
  }
}

function StatusTip({ upload }: { upload: Upload }) {
  // The table scrolls inside its own box, so the tooltip is fixed to the viewport instead of
  // positioned in the cell (where it would be clipped).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const { title, lines } = statusDetail(upload);
  const show = (el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    setPos({ x: Math.min(b.left - 8, window.innerWidth - 268), y: b.bottom + 6 });
  };
  return (
    <>
      <button
        type="button"
        aria-label={`${title}: ${lines.join(". ")}`}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        className="grid size-5 place-items-center rounded-circle text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {pos && (
        <span role="tooltip" className="pointer-events-none fixed z-50 w-64 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) p-3 text-body-sm shadow-md" style={{ left: pos.x, top: pos.y }}>
          <span className="block font-medium text-(--color-text-primary)">{title}</span>
          {lines.map((l, i) => (
            <span key={i} className={cn("mt-1 block", upload.status === "rejected" && i === 0 ? "text-(--color-text-danger)" : "text-(--color-text-secondary)")}>
              {l}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

/** Report details (from the ops reference): source rows and locations, and where each location went. */
function DetailsDrawer({ upload: u, onClose, onMap }: { upload: Upload; onClose: () => void; onMap: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const s = STATUS[u.status];
  const r = restaurant(u.restaurantId);
  const locs = locationsOf(u);
  const message = {
    extracting: { cls: "text-(--color-text-information)", text: "KoreFi is reading the file and finding its locations. This can take up to 5 minutes." },
    needs_mapping: { cls: "text-(--color-text-warning)", text: "Extraction finished. Map each location to an outlet to start the import." },
    processing: { cls: "text-(--color-text-information)", text: "This report is being validated and imported." },
    completed: { cls: "text-(--color-text-success)", text: "This report has been processed successfully." },
    partial: { cls: "text-(--color-text-warning)", text: `Imported with ${u.skipped} rows skipped (${u.skipReason ?? "no order date"}).` },
    rejected: { cls: "text-(--color-text-danger)", text: u.reason ?? "This report was rejected." },
  }[u.status];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label="Report details" className="flex h-full w-full max-w-[520px] flex-col border-l border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_0_48px_rgb(0_0_0/0.16)]">
        <div className="flex items-start gap-3 border-b border-(--color-border-default) px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-subtitle-md text-(--color-text-primary)">Report details</h2>
            <p className="mt-0.5 text-body-sm break-all text-(--color-text-secondary)">{u.fileName}</p>
          </div>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-7 place-items-center rounded-small text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Source rows" value={(u.source?.rows ?? locs.reduce((n, l) => n + l.rows, 0)).toLocaleString()} />
            <Stat label="Source locations" value={u.status === "extracting" ? "…" : String(locs.length)} />
            <Stat label="Restaurant" value={r?.name ?? ""} sub={user(u.userId)?.name} />
            <Stat label="Report" value={`${provider(u.provider)!.name} · ${u.reportType}`} sub={u.start && u.end ? formatRange(u.start, u.end) : undefined} />
          </div>
          {u.status === "extracting" && (
            <div className="flex items-center gap-3 rounded-medium bg-(--color-neutral-lightest) px-4 py-4 text-body-md text-(--color-text-secondary)">
              <Loader2 className="size-4 shrink-0 animate-spin text-(--color-text-information)" aria-hidden />
              Locations will appear here once extraction finishes.
            </div>
          )}
          <ul className={cn("overflow-hidden rounded-medium border border-(--color-border-default)", locs.length === 0 && "hidden")}>
            {locs.map((l) => (
              <li key={l.name} className="flex items-center gap-3 border-t border-(--color-border-default) px-4 py-3 first:border-t-0">
                <MapPin className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-medium text-(--color-text-primary)">{l.name}</p>
                  <p className="text-body-sm text-(--color-text-secondary)">{l.rows.toLocaleString()} rows</p>
                  <p className="text-body-sm text-(--color-text-secondary)">External location ID: {l.externalId}</p>
                </div>
                <ArrowRight className="size-4 text-(--color-text-secondary)" aria-hidden />
                <span className={cn("w-28 text-right text-body-md", l.outletId ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>{l.outletId ? outlet(u.restaurantId, l.outletId)?.name : u.status === "needs_mapping" ? "Not mapped" : "Skipped"}</span>
              </li>
            ))}
          </ul>
          <p className={cn("text-body-md", message.cls)}>{message.text}</p>
          {u.status === "needs_mapping" && (
            <Button type="primary" size="medium" onClick={onMap} iconRight={<ArrowRight aria-hidden />}>
              Map outlets
            </Button>
          )}
          <p className="text-body-sm text-(--color-text-secondary)">
            Uploaded by {u.uploadedBy} · {new Date(u.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {formatBytes(u.size)}
          </p>
        </div>
      </aside>
    </div>
  );
}

function DemoPanel({
  onSample,
  onPrefill,
  failNext,
  setFailNext,
  failHistory,
  setFailHistory,
}: {
  onSample: (f: MockFile) => void;
  onPrefill: () => void;
  failNext: boolean;
  setFailNext: (v: boolean) => void;
  failHistory: boolean;
  setFailHistory: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="max-h-[80vh] w-[300px] overflow-y-auto rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-3 shadow-[0_12px_32px_rgb(0_0_0/0.16)]">
          <div className="flex items-center justify-between">
            <p className="text-subtitle-sm text-(--color-text-primary)">Prototype controls</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-6 place-items-center rounded-small text-(--color-text-secondary) hover:bg-(--color-neutral-lightest)">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
          <button type="button" onClick={onPrefill} className="mt-2 w-full rounded-medium border border-dashed border-(--color-border-darker) px-2 py-1.5 text-left text-body-sm text-(--color-text-primary) hover:bg-(--color-neutral-lightest)">
            Fill form: Priya Shah › EggHolic › DoorDash
          </button>
          <p className="mt-3 mb-1 text-body-sm text-(--color-text-secondary)">Try a sample file</p>
          <ul className="flex flex-col">
            {SAMPLES.map((s) => (
              <li key={s.label}>
                <button type="button" onClick={() => onSample(s.file)} className="w-full rounded-small px-2 py-1 text-left hover:bg-(--color-neutral-lightest)">
                  <span className="block text-body-sm text-(--color-text-primary)">{s.label}</span>
                  <span className="block text-body-sm text-(--color-text-secondary)">{s.hint}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-1.5 border-t border-(--color-border-default) pt-2.5 text-body-sm text-(--color-text-primary)">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} className="accent-(--color-primary)" />
              Fail the next upload at 64%
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={failHistory} onChange={(e) => setFailHistory(e.target.checked)} className="accent-(--color-primary)" />
              Upload history fails to load
            </label>
          </div>
        </div>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-circle bg-(--gray-1200) px-3.5 text-body-sm text-(--color-text-inverse-primary) shadow-lg">
          <FlaskConical className="size-4" aria-hidden />
          Demo
        </button>
      )}
    </div>
  );
}
