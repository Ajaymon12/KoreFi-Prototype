"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, FileText, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/primitives";
import { AppName, ReportTable, type TableColumn } from "@/components/ui/ReportTable";
import { StatRow, Tray } from "@/components/mvp2/parts";
import { appLabel, type AppKey, type CbStatus, type Chargeback } from "@/lib/finance/chargebacks";
import { SHEET_FIXES } from "@/lib/mvp3/masaFixture";
import type { Store } from "@/lib/finance/outlets";
import { outletDive, versusUsual } from "@/lib/mvp3/outletDive";
import { useAgents } from "./AgentsProvider";
import { Modal } from "./Modal";
import { Button, buttonVariants } from "@/components/ui/Button";

// MVP 3 / Chargebacks, one outlet ("Why is Damen high?" → its orders → send to the manager). The panel opens
// in the canvas beside the chat: what to fix, then every order charged back. "Send to manager" opens the one-page sheet
// the manager gets: this outlet only, what to fix, every order, no amounts.

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usd2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
/** The words the owner and KoreFi use for a dispute. */
const STATUS_LABEL: Record<CbStatus, string> = { won: "Won", disputing: "Awaiting decision", new: "Still to dispute", lost: "Denied" };
const LOGO: Record<AppKey, "doordash" | "ubereats" | "grubhub"> = { doordash: "doordash", uber: "ubereats", grubhub: "grubhub" };
const TONE: Record<CbStatus, "success" | "warning" | "danger" | "neutral"> = { new: "neutral", won: "success", disputing: "warning", lost: "danger" };
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const CHARGE_COLUMNS: TableColumn<Chargeback>[] = [
  { key: "day", header: "Day", cell: (c) => <span className="text-(--color-text-secondary)">{day(c.date)}</span> },
  { key: "app", header: "App", cell: (c) => <AppName source={LOGO[c.app]} name={appLabel(c.app)} /> },
  { key: "item", header: "Item", cell: (c) => c.item },
  { key: "reason", header: "Reason", cell: (c) => <span className="text-(--color-text-secondary)">{c.reason}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (c) => usd2(c.amount) },
  { key: "status", header: "Status", cell: (c) => <StatusBadge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusBadge> },
];
const btn = cn(buttonVariants({ type: "default", size: "small" }), "[&_svg]:size-4");

function Fixes({ store, sheet = false }: { store: Store; sheet?: boolean }) {
  const d = outletDive(store);
  return (
    <ol className="space-y-3">
      {(sheet && d.fx ? SHEET_FIXES : d.fixes).map((f, i) => (
        <li key={f.title} className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3">
          <span className="grid size-6 place-items-center rounded-circle bg-(--color-text-primary) text-body-sm font-medium text-(--color-text-inverse-primary)">{i + 1}</span>
          <p className="text-body-md text-(--color-text-secondary)">
            <b className="font-medium text-(--color-text-primary)">{f.title}.</b> {f.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The canvas panel for one outlet. `tools` are the canvas's expand and close buttons. */
export function OutletPanel({ store, tools, headerTo }: { store: Store; tools?: React.ReactNode; headerTo?: HTMLElement | null }) {
  const d = outletDive(store);
  const { setCanvas, dashboards, sheetsSent } = useAgents();
  const [sheet, setSheet] = useState(false);
  const sent = sheetsSent.includes(store);
  const dash = dashboards.find((x) => x.id === "dash-chargebacks");
  const tiles = [
    { label: "Charged back", value: usd(d.charged), sub: `${d.rate.toFixed(1)}% of app sales`, cls: "text-(--color-text-danger)" },
    { label: "Won back", value: usd(d.won), sub: `${d.orders.filter((c) => c.status === "won").length} disputes`, cls: "text-(--color-text-success)" },
    d.fx
      ? { label: "Still to dispute", value: usd2(d.orders.filter((c) => c.status === "new").reduce((n, c) => n + c.amount, 0)), sub: `${d.orders.filter((c) => c.status === "new").length} orders` }
      : { label: "Being disputed", value: usd(d.open), sub: `${d.orders.filter((c) => c.status === "disputing" || c.status === "new").length} orders` },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(() => {
        const bar = (
          <>
            <h2 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{d.name} · chargebacks</h2>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setSheet(true)} className={btn}>
                {sent ? <Check aria-hidden /> : <Send aria-hidden />}
                {sent ? "Sent to manager" : "Send to manager"}
              </button>
              {tools}
            </div>
          </>
        );
        if (headerTo !== undefined) return headerTo && createPortal(bar, headerTo);
        return <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-(--color-border-default) bg-(--color-background-secondary) py-1 pr-2 pl-4">{bar}</header>;
      })()}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] space-y-4 px-6 py-6">
          {dash && (
            <button type="button" onClick={() => setCanvas(`dash:${dash.id}`)} className="inline-flex items-center gap-1 text-body-sm text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
              <ArrowLeft className="size-3.5" aria-hidden /> All outlets
            </button>
          )}
          <div>
            <h2 className="text-subtitle-md font-medium text-(--color-text-primary)">
              {d.name}: {d.n} orders with errors, {versusUsual(d.n, d.usual)}
            </h2>
            <p className="text-body-sm text-(--color-text-secondary)">
              {d.week} · all 3 apps
            </p>
          </div>
          <StatRow label={`${d.name} this week`} cols="sm:grid-cols-3" stats={tiles.map((t) => ({ label: t.label, value: t.value, sub: t.sub, tone: t.cls?.includes("success") ? "success" : t.cls?.includes("danger") ? "danger" : undefined }))} />
          <Tray title="What to fix">
            <Fixes store={store} />
            <button type="button" onClick={() => setSheet(true)} className={cn(btn, "mt-4")}>
              {sent ? <Check aria-hidden /> : <Send aria-hidden />}
              {sent ? "Sent. View the sheet" : `Send this to ${d.name}'s manager`}
            </button>
          </Tray>
          <ReportTable
            title={`Every charge at ${d.name}`}
            description={`${d.n} charges add up to ${usd2(d.orders.reduce((n, c) => n + c.amount, 0))}`}
            columns={CHARGE_COLUMNS}
            rows={d.orders}
            rowKey={(c) => c.id}
            pageSize={25}
            noun="charges"
          />
        </div>
      </div>
      {sheet && <SheetModal store={store} onClose={() => setSheet(false)} />}
    </div>
  );
}

/** The page the manager gets. Only this outlet; no amounts. */
export function SheetModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const d = outletDive(store);
  const { sheetsSent, markSheetSent } = useAgents();
  const sent = sheetsSent.includes(store);
  return (
    <Modal label={`Sheet for ${d.name}'s manager`} onClose={onClose}>
      <div className="shrink-0 border-b border-(--color-border-default) py-3 pr-12 pl-5">
        <h2 className="text-body-lg font-medium text-(--color-text-primary)">Sheet for {d.name}&apos;s manager</h2>
        <p className="text-body-sm text-(--color-text-secondary)">One page, {d.name} only, no amounts.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-(--color-neutral-lightest) p-4 sm:p-6">
        <article className="space-y-5 rounded-small border border-(--color-border-default) bg-white p-6 text-(--color-text-primary) shadow-sm">
          <header className="flex items-end justify-between gap-4 border-b-2 border-(--color-text-primary) pb-3">
            <div>
              <p className="text-label-sm tracking-wide text-(--color-text-secondary)">KOREFI · DELIVERY ERRORS</p>
              <h3 className="text-page-title font-medium">{d.name}</h3>
              <p className="text-body-sm text-(--color-text-secondary)">Orders from {d.week}</p>
            </div>
            <div className="text-right">
              <p className="text-[34px] leading-none font-medium tabular-nums">{d.n}</p>
              <p className="text-body-sm text-(--color-text-secondary)">orders with errors · usual {d.usual}</p>
            </div>
          </header>
          <section>
            <h4 className="mb-2 text-body-md font-medium">What to fix this week</h4>
            <Fixes store={store} sheet />
          </section>
          <section>
            <h4 className="mb-2 text-body-md font-medium">Every order</h4>
            <table className="w-full text-left text-body-sm">
              <thead className="text-(--color-text-secondary)">
                <tr className="border-b border-(--color-border-default)">
                  {["Day", "App", "Item", "What went wrong"].map((h) => (
                    <th key={h} className="py-1.5 pr-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-default)">
                {d.orders.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{day(c.date)}</td>
                    <td className="py-1.5 pr-3">{appLabel(c.app)}</td>
                    <td className="py-1.5 pr-3">{c.item}</td>
                    <td className="py-1.5 pr-3">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-label-sm text-(--color-text-secondary)">Only {d.name} is shown. No amounts.</p>
        </article>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-(--color-border-default) px-5 py-3">
        {sent ? (
          <p className="flex items-center gap-1.5 text-body-md text-(--color-text-success)">
            <Check className="size-4" aria-hidden /> Sent to {d.name}&apos;s manager as a PDF by email.
          </p>
        ) : (
          <p className="text-body-sm text-(--color-text-secondary)">Sends as a PDF by email.</p>
        )}
        {sent ? (
          <button type="button" onClick={onClose} className={btn}>
            Done
          </button>
        ) : (
          <Button type="primary" size="small" className="[&_svg]:size-4" iconLeft={<Send aria-hidden />} onClick={() => markSheetSent(store)}>
            Send to {d.name}&apos;s manager
          </Button>
        )}
      </footer>
    </Modal>
  );
}

const card = "flex w-full max-w-sm items-center gap-3 rounded-large border bg-(--color-background-secondary) p-2.5 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

/** The chat card for an outlet's chargebacks: opens them in the canvas. */
export function OutletCard({ store }: { store: Store }) {
  const { canvas, setCanvas } = useAgents();
  const d = outletDive(store);
  const on = canvas === `outlet:${store}`;
  return (
    <button type="button" onClick={() => setCanvas(on ? null : `outlet:${store}`)} aria-pressed={on} className={cn(card, on ? "border-(--module-line) bg-(--module-soft)" : "border-(--color-border-default) hover:border-(--color-border-darker)")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-(--module-tint) text-(--module-strong)">
        <FileText className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{d.name} · chargebacks</span>
        <span className="block truncate text-body-sm text-(--color-text-secondary)">
          {d.week} · {d.n} orders · what to fix
        </span>
      </span>
      <span className="shrink-0 pr-1 text-body-sm text-(--color-text-clickable)">{on ? "Open" : "View"}</span>
    </button>
  );
}

/** The chat card for the manager sheet: review it, then send. */
/** `autoOpen`: open the preview as soon as the card appears (the chat's "Send Damen's sheet to its manager"). */
export function SheetCard({ store, autoOpen = false }: { store: Store; autoOpen?: boolean }) {
  const { sheetsSent } = useAgents();
  const [open, setOpen] = useState(autoOpen);
  const d = outletDive(store);
  const sent = sheetsSent.includes(store);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(card, "border-(--color-border-default) hover:border-(--color-border-darker)")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-(--module-tint) text-(--module-strong)">
          <MessageSquare className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-md font-medium text-(--color-text-primary)">Sheet for {d.name}&apos;s manager</span>
          <span className="block truncate text-body-sm text-(--color-text-secondary)">{sent ? "Sent as a PDF" : "1 page · no amounts · ready to send"}</span>
        </span>
        <span className="shrink-0 pr-1 text-body-sm text-(--color-text-clickable)">{sent ? "View" : "Review and send"}</span>
      </button>
      {open && <SheetModal store={store} onClose={() => setOpen(false)} />}
    </>
  );
}
