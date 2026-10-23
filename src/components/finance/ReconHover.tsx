"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { DetailDrawer, DrawerSection } from "@/components/ui/DetailDrawer";
import { cn } from "@/lib/utils";
import type { AppKey } from "@/lib/finance/chargebacks";
import { matchShare, type Mismatch, type Recon } from "@/lib/finance/reconcile";
import { shortStore } from "@/lib/finance/outlets";

// The card has a small triangle pointing at the figure it belongs to, and the figure stays shaded while it's open,
// so in a wide table it's clear which column it speaks for.
// The POS ⇄ 3PD check beside each app's Sales figure in the P&L (and All's). A status tag says it at a glance:
// a red alert when the app hasn't paid for something, amber when only Square is short, a green tick when every
// order matches (its hover says "Matches your Square: 55 of 55 DoorDash orders").
// Hovering or focusing the figure or chip opens a card that stays light:
//   one sentence    only when every order matches: "Matches your Square: 55 of 55 DoorDash orders"
//   one line each   Missing in 3PD (red), Missing in POS (amber): count and amount
//   View all        opens a drawer (DetailDrawer, docked beside the table) with every order, grouped by kind,
//                   after Origin's "Preview matches" list (Mobbin): a dot, the id, date and outlet, the amount.
//                   The kind tiles at its top filter the list.
// Orders show the id the owner can look up: the app's when it has the order, else Square's. The card stays open
// while the pointer moves into it (a short grace on leaving). Report only: nothing in it is an action.

const WIDTH = 360;
const GAP = 10;
const GRACE = 150;
const APP_NAME: Record<AppKey, string> = { doordash: "DoorDash", uber: "Uber Eats", grubhub: "Grubhub" };

type Order = Mismatch & { app: AppKey };
/** One app's check, or several summed (All). */
export type ReconSummary = Pick<Recon, "matchedOrders" | "posOnly" | "appOnly" | "waiting" | "through"> & { orders: Order[]; apps: number };

export function summarize(recons: readonly Recon[]): ReconSummary {
  const gap = (k: "posOnly" | "appOnly" | "waiting") => ({ orders: recons.reduce((n, r) => n + r[k].orders, 0), amount: recons.reduce((n, r) => n + r[k].amount, 0) });
  const orders = recons.flatMap((r) => r.orders.map((o) => ({ ...o, app: r.app }))).sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    matchedOrders: recons.reduce((n, r) => n + r.matchedOrders, 0),
    posOnly: gap("posOnly"),
    appOnly: gap("appOnly"),
    waiting: gap("waiting"),
    through: new Date(Math.min(...recons.map((r) => r.through.getTime()))),
    orders,
    apps: recons.length,
  };
}

const KINDS: { kind: Mismatch["kind"]; title: (app: string) => string; short: string; dot: string; tone: string; means: (app: string) => string }[] = [
  { kind: "posOnly", title: () => "Missing in 3PD", short: "Missing in 3PD", dot: "bg-(--color-danger-default)", tone: "text-(--color-text-danger)", means: (app) => `In Square, but missing from ${app}'s report. KoreFi is claiming them.` },
  { kind: "appOnly", title: () => "Missing in POS", short: "Missing in POS", dot: "bg-(--color-warning-default)", tone: "text-(--color-text-warning)", means: (app) => `${app} paid for these, but they never reached Square. Already in your sales.` },
];

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${one}${n === 1 ? "" : "s"}`;
/** Rounded down, so a few mismatches never read as 100%. */
const matchPct = (n: number) => `${(Math.floor(n * 1000) / 10).toFixed(1)}%`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const outlet = shortStore;

type Props = { check: ReconSummary; name: string; children: React.ReactNode };

export function ReconHover({ check, name, children }: Props) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: number; below: boolean } | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  // A short grace, so the pointer can cross from the figure into the card.
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), GRACE);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const leaves = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (!card.current?.contains(to) && !trigger.current?.contains(to)) hide();
  };

  // Under the figure, right-aligned to it; above when the bottom is too close.
  useLayoutEffect(() => {
    if (!open) return;
    const b = trigger.current?.getBoundingClientRect();
    const h = card.current?.offsetHeight ?? 0;
    if (!b) return;
    const below = b.bottom + GAP + h <= window.innerHeight - 8;
    const left = Math.max(8, Math.min(b.right - WIDTH, window.innerWidth - WIDTH - 8));
    // The triangle points at the figure's middle, kept off the card's rounded corners.
    setPos({ top: below ? b.bottom + GAP : Math.max(8, b.top - GAP - h), left, arrow: Math.max(16, Math.min(WIDTH - 16, (b.left + b.right) / 2 - left)), below });
  }, [open]);

  const off = check.orders.length;
  const tone = check.posOnly.orders ? "text-(--color-text-danger)" : check.appOnly.orders ? "text-(--color-text-warning)" : "text-(--color-text-secondary)";
  const appName = check.apps > 1 ? "the app" : name;
  // Only a clean check gets a sentence; when orders differ the lines below say it.
  const matched = check.matchedOrders.toLocaleString("en-US");
  const headline = off === 0 ? <>Matches your Square: {matched} of {matched} {check.apps > 1 ? "delivery" : (name.split(" · ").pop() ?? name)} orders</> : null;

  return (
    <>
      <span
        ref={trigger}
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={leaves}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn("group/recon -mx-1 inline-flex cursor-default items-center gap-1 rounded-small px-1 outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", open && "bg-(--gray-300)")}
      >
        {off > 0 && (
          <span className={cn("inline-flex", tone)}>
            <CircleAlert aria-hidden className="size-3" />
            <span className="sr-only">{off} differ</span>
          </span>
        )}
        {off === 0 && check.matchedOrders > 0 && (
          <span className="inline-flex text-(--color-text-success)">
            <CircleCheck aria-hidden className="size-3" />
            <span className="sr-only">Matches Square</span>
          </span>
        )}
        {children}
      </span>

      {open &&
        createPortal(
          <div
            ref={card}
            id={id}
            role="dialog"
            aria-label={`${name} vs Square`}
            onMouseEnter={show}
            onMouseLeave={hide}
            onBlur={leaves}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: WIDTH }}
            className="fixed z-50 flex max-h-[min(440px,calc(100vh-16px))] flex-col rounded-large border border-(--color-border-default) bg-(--color-background-secondary) text-left text-body-sm font-normal whitespace-normal shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
          >
            <span
              aria-hidden
              className={cn("absolute size-2.5 rotate-45 bg-(--color-background-secondary)", pos?.below === false ? "-bottom-[6px] border-r border-b border-(--color-border-default)" : "-top-[6px] border-t border-l border-(--color-border-default)")}
              style={{ left: (pos?.arrow ?? 24) - 5 }}
            />
            <div className="px-4 pt-3 pb-2">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-body-md font-medium text-(--color-text-primary)">{name} vs Square</span>
                <span className="text-(--color-text-tertiary) tabular-nums">{matchPct(matchShare(check))} match</span>
              </p>
              {headline && <p className="mt-1 text-body-md text-(--color-text-secondary)">{headline}</p>}
            </div>

            {off > 0 && (
              <ul className="min-h-0 overflow-y-auto border-t border-(--color-border-default) px-2 py-1.5">
                {KINDS.map((k) => {
                  const rows = check.orders.filter((o) => o.kind === k.kind);
                  if (!rows.length) return null;
                  const amount = money(rows.reduce((t, o) => t + o.amount, 0));
                  return (
                    <li key={k.kind} className="flex h-8 items-center gap-2 px-2">
                      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-circle", k.dot)} />
                      <span className="min-w-0 flex-1 truncate text-(--color-text-primary)">{k.title(appName)}</span>
                      <span className="shrink-0 text-(--color-text-tertiary) tabular-nums">{plural(rows.length, "order")}</span>
                      <span className={cn("w-[84px] shrink-0 text-right font-medium tabular-nums", k.tone)}>{amount}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center gap-3 border-t border-(--color-border-default) py-1.5 pr-1.5 pl-4">
              <p className="min-w-0 flex-1 truncate text-(--color-text-tertiary)">
                Checked to {day(check.through)}
                {check.waiting.orders > 0 && ` · ${plural(check.waiting.orders, "order")} waiting`}
              </p>
              {off > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setDrawer(true);
                  }}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-medium px-2 font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                >
                  View all {off}
                  <ArrowRight aria-hidden className="size-3.5" />
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
      <ReconDrawer open={drawer} onClose={() => setDrawer(false)} check={check} name={name} headline={headline} />
    </>
  );
}

/** Every order the check flagged, beside the table. Tiles per kind (count and amount) filter the list
 *  below them; each kind keeps its one-line meaning above its orders. */
function ReconDrawer({ open, onClose, check, name, headline }: { open: boolean; onClose: () => void; check: ReconSummary; name: string; headline: React.ReactNode }) {
  const [only, setOnly] = useState<Mismatch["kind"] | null>(null);
  const appName = check.apps > 1 ? "the app" : name;
  const several = new Set(check.orders.map((o) => o.store)).size > 1;
  const kinds = KINDS.map((k) => ({ ...k, rows: check.orders.filter((o) => o.kind === k.kind) })).filter((k) => k.rows.length);
  const total = (k: (typeof kinds)[number]) => money(k.rows.reduce((t, o) => t + o.amount, 0));

  return (
    <DetailDrawer
      open={open}
      onClose={() => {
        setOnly(null);
        onClose();
      }}
      icon={ArrowLeftRight}
      eyebrow="Delivery check"
      title={`${name} vs Square`}
      status={<span className="rounded-small bg-(--color-neutral-light) px-1.5 py-0.5 text-label-sm text-(--color-text-secondary) tabular-nums">{matchPct(matchShare(check))} match</span>}
      meta={headline}
      footer={
        <p className="text-body-sm text-(--color-text-tertiary)">
          Checked to {day(check.through)}
          {check.waiting.orders > 0 && ` · ${plural(check.waiting.orders, "order")} waiting for the next report`} · nothing needed from you
        </p>
      }
    >
      {/* Kind tiles: also the filter */}
      <div role="group" aria-label="Show" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${kinds.length}, minmax(0, 1fr))` }}>
        {kinds.map((k) => {
          const on = only === k.kind;
          return (
            <button
              key={k.kind}
              type="button"
              aria-pressed={on}
              onClick={() => setOnly(on ? null : k.kind)}
              className={cn(
                "rounded-medium border px-3 py-2.5 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                on ? "border-(--color-text-primary) bg-(--color-neutral-lightest)" : "border-(--color-border-default) hover:bg-(--color-neutral-lightest)",
              )}
            >
              <span className="flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-circle", k.dot)} />
                <span className="truncate" title={k.title(appName)}>{k.short}</span>
              </span>
              <span className={cn("mt-1 block text-subtitle-md font-medium tabular-nums", k.tone)}>{total(k)}</span>
              <span className="text-label-sm text-(--color-text-tertiary) tabular-nums">{plural(k.rows.length, "order")}</span>
            </button>
          );
        })}
      </div>

      {kinds
        .filter((k) => !only || only === k.kind)
        .map((k) => (
          <DrawerSection key={k.kind} title={`${k.title(appName)} · ${plural(k.rows.length, "order")}`}>
            <p className="px-4 pb-2 text-body-sm text-(--color-text-tertiary)">{k.means(appName)}</p>
            <ul className="divide-y divide-(--color-border-default)">
              {k.rows.map((o) => (
                <li key={`${o.app}${o.at.getTime()}${o.appId ?? o.posId}`} className="flex items-center gap-3 px-4 py-2.5 tabular-nums">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-circle", k.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-md text-(--color-text-primary)" title={o.appId ? `${APP_NAME[o.app]} order` : "Square receipt"}>
                      {o.appId ? `${APP_NAME[o.app]} #${o.appId}` : `Square ${o.posId}`}
                    </span>
                    <span className="block truncate text-body-sm text-(--color-text-tertiary)">
                      {day(o.at)}
                      {several && ` · ${outlet(o.store)}`}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right text-body-md", k.tone)}>{money(o.amount)}</span>
                </li>
              ))}
            </ul>
          </DrawerSection>
        ))}
    </DetailDrawer>
  );
}
