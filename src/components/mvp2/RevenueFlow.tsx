"use client";
import Image from "next/image";
import { Bike, CircleHelp, Lock, Mail, Store as StoreIcon, type LucideIcon } from "lucide-react";
import { asset } from "@/lib/asset";
import { AppName } from "@/components/ui/ReportTable";
import { StatusBadge } from "@/components/dashboard/primitives";
import { usd } from "@/components/finance/parts";
import { CHANNELS, WEEKS, pct0, pctOf, type Col } from "@/components/finance/PnlStory";
import { reconcile, type Recon } from "@/lib/finance/reconcile";
import type { AppKey } from "@/lib/finance/chargebacks";
import type { Store } from "@/lib/finance/books";
import { cn } from "@/lib/utils";

// MVP 2 / Overview / Revenue & payout: total revenue split into Non-3PD (the POS) and 3PD (the apps),
// as cards joined by dashed connectors:
//   Total revenue ┬→ Non-3PD ──→ In store & website (Square), or, POS locked: contact your POC / service@korefi.ai
//                 └→ 3PD ─────┬→ DoorDash / Uber Eats / Grubhub / Others
// Until the POS is integrated, Non-3PD is a locked card and the total is the apps' alone. Once it is,
// Non-3PD shows its sales, its leaf is the P&L's "In store & website" channel (same figure), and the
// two-way POS ⇄ app reconciliation table follows.
// Total revenue (Source) is a compact card whose icon is a ring of the channel mix. The two branches read
// apart by channel colour (OutletMix's): Non-3PD in brand, a tinted POS tile and one
// bar; 3PD neutral, a delivery tile and a bar split by app. Each carries its source and share of the total.
// Laid out on a fixed 1200 × 460 canvas; cards are HTML placed in % of it, connectors an SVG under them.

type Totals = { cols: Record<string, Col>; all: Col };

const APPS = CHANNELS.filter((c) => c.app);
const POS = CHANNELS.find((c) => !c.app)!;
const pctText = (n: number) => `${(n * 100).toFixed(1)}%`;
const orders = (n: number) => `${n} order${n === 1 ? "" : "s"}`;
const matchRate = (r: Recon) => pctOf(r.matched, Math.max(r.report, r.pos));

const W = 1200;
const H = 460;
const ROOT = { x: 20, y: 215.5, w: 230 };
const MID = { x: 350, w: 230, top: 110, bottom: 321 };
const LEAF = { x: 750, w: 280, rows: [240, 294, 348, 402] };
const box = (x: number, y: number, w: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%` });
const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
};

/** Total revenue: a compact light card whose icon is a ring of the channel mix (the outlet mosaic's colours),
 *  so the split shows before the branches spell it out. */
function Source({ value, orders, ring }: { value: string; orders: number; ring: { key: string; label: string; color: string; share: number }[] }) {
  const R = 19;
  const C = 2 * Math.PI * R;
  const GAP = ring.length > 1 ? 2 : 0;
  // Where each part starts round the ring: the shares before it.
  const starts = ring.map((_, i) => ring.slice(0, i).reduce((n, r) => n + r.share, 0) * C);
  return (
    <div className="flex min-h-19 items-center gap-3 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_16px_-10px_rgb(0_0_0/0.18)]">
      <svg viewBox="0 0 48 48" className="size-12 shrink-0 -rotate-90" role="img" aria-label={ring.map((r) => `${r.label} ${pct0(r.share)}`).join(", ")}>
        <circle cx="24" cy="24" r={R} fill="none" stroke="var(--gray-300)" strokeWidth={6} />
        {ring.map((r, i) => {
          const len = Math.max(0, r.share * C - GAP);
          return <circle key={r.key} cx="24" cy="24" r={R} fill="none" stroke={r.color} strokeWidth={6} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-starts[i]} />;
        })}
      </svg>
      <div className="min-w-0">
        <p className="truncate text-body-sm text-(--color-text-secondary)">Total revenue</p>
        <p className="text-subtitle-lg font-medium text-(--color-text-primary) tabular-nums">{value}</p>
        <p className="text-label-sm text-(--color-text-tertiary) tabular-nums">{orders.toLocaleString("en-US")} orders</p>
      </div>
    </div>
  );
}

function MatchBadge({ r }: { r: Recon }) {
  const gaps = r.posOnly.orders + r.appOnly.orders;
  return gaps ? <StatusBadge tone="warning">{pctText(matchRate(r))} matched</StatusBadge> : <StatusBadge tone="success">Fully matched</StatusBadge>;
}

/** A Non-3PD / 3PD card: the channel's colour on its icon tile, its source, its share, and a bar of that share
 *  split by `parts` (one part for the POS, one per app). */
function Branch({ icon: Icon, label, source, value, share, parts, tint }: { icon: LucideIcon; label: string; source: string; value: string; share: number; parts: { color: string; share: number }[]; tint: { bg: string; fg: string } }) {
  return (
    <div className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-3 pt-2.5 pb-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-medium" style={{ background: tint.bg }}>
          <Icon aria-hidden className="size-4" style={{ color: tint.fg }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2 text-body-sm text-(--color-text-secondary)">
            <span className="truncate">{label}</span>
            <span className="shrink-0 text-label-sm tabular-nums">{pct0(share)}</span>
          </p>
          <p className="text-subtitle-lg font-medium text-(--color-text-primary) tabular-nums">{value}</p>
        </div>
      </div>
      <div aria-hidden className="mt-2.5 flex h-1.5 overflow-hidden rounded-circle bg-(--gray-300)">
        {parts.map((p, i) => (
          <span key={i} className="h-full" style={{ width: `${p.share * 100}%`, background: p.color }} />
        ))}
      </div>
      <p className="mt-1.5 truncate text-label-sm text-(--color-text-tertiary)">{source}</p>
    </div>
  );
}

function Leaf({ name, meta, mark, value }: { name: string; meta?: string; mark: React.ReactNode; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center">
          {mark}
        </span>
        <p className="truncate text-body-sm text-(--color-text-primary)">
          {name}
          {meta && <span className="text-(--color-text-tertiary)"> · {meta}</span>}
        </p>
      </div>
      <span className="shrink-0 text-label-md font-medium text-(--color-text-primary) tabular-nums">{value}</span>
    </div>
  );
}

const locked = "border border-dashed border-(--purple-700) bg-(--purple-200)/40";

export function RevenueFlow({ t, stores, range, posConnected = false }: { t: Totals; stores: readonly Store[]; range: [number, number]; posConnected?: boolean }) {
  const weeks = WEEKS.slice(range[0], range[1] + 1);
  const recon = APPS.map((c) => reconcile(c.key as AppKey, stores, weeks));
  const sum = (get: (r: Recon) => number) => recon.reduce((n, r) => n + get(r), 0);
  const all = { report: sum((r) => r.report), pos: sum((r) => r.pos), matched: sum((r) => r.matched), posOnly: { orders: sum((r) => r.posOnly.orders), amount: sum((r) => r.posOnly.amount) }, appOnly: { orders: sum((r) => r.appOnly.orders), amount: sum((r) => r.appOnly.amount) } };

  const instore = t.cols.instore.sales;
  const appSales = APPS.reduce((n, c) => n + t.cols[c.key].sales, 0);
  const total = appSales + (posConnected ? instore : 0);
  const orderCount = APPS.reduce((n, c) => n + t.cols[c.key].orders, 0) + (posConnected ? t.cols.instore.orders : 0);

  // The ring: the POS (once connected), then each app.
  const ring = [...(posConnected ? [{ key: "pos", label: "Non-3PD", color: POS.color, share: pctOf(instore, total) }] : []), ...APPS.map((c) => ({ key: c.key, label: c.label, color: c.color, share: pctOf(t.cols[c.key].sales, total) }))];

  const ROOT_OUT = ROOT.x + ROOT.w;
  const MID_OUT = MID.x + MID.w;
  const paths = [
    curve(ROOT_OUT, ROOT.y, MID.x, MID.top),
    curve(ROOT_OUT, ROOT.y, MID.x, MID.bottom),
    curve(MID_OUT, MID.top, LEAF.x, MID.top),
    ...LEAF.rows.map((y) => curve(MID_OUT, MID.bottom, LEAF.x, y)),
  ];

  return (
    <>
      <div className="overflow-x-auto px-5 pb-5">
        <div className="relative mx-auto w-full max-w-[1200px] min-w-[960px]" style={{ height: H }}>
          <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <defs>
              <marker id="revenue-connector-arrow" markerHeight="8" markerUnits="userSpaceOnUse" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M1 1L7 4L1 7" stroke="var(--gray-700)" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            <g markerEnd="url(#revenue-connector-arrow)" stroke="var(--gray-700)" strokeDasharray="7 7" strokeLinecap="round" strokeWidth={1.25} vectorEffect="non-scaling-stroke">
              {paths.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </svg>

          <div className="absolute -translate-y-1/2" style={box(ROOT.x, ROOT.y, ROOT.w)}>
            <Source
              value={usd(total)}
              orders={orderCount}
              ring={ring}
            />
          </div>

          <div className="absolute -translate-y-1/2" style={box(MID.x, MID.top, MID.w)}>
            {posConnected ? (
              <Branch
                icon={StoreIcon}
                label="Non-3PD"
                source="Square POS · in store & website"
                value={usd(instore)}
                share={pctOf(instore, total)}
                parts={[{ color: POS.color, share: pctOf(instore, total) }]}
                tint={{ bg: "var(--brand-200)", fg: "var(--brand-1000)" }}
              />
            ) : (
              <div className={cn("relative flex min-h-19 items-start gap-3 overflow-hidden rounded-large px-3 py-3 backdrop-blur-sm", locked)}>
                <p aria-hidden className="pointer-events-none absolute -top-1 right-3 text-subtitle-lg font-medium text-(--color-text-primary)/10 blur-[3px] select-none">
                  $•,•••
                </p>
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-circle border border-dashed border-(--purple-700) bg-(--color-background-secondary)">
                  <Lock aria-hidden className="size-4 text-(--purple-1000)" />
                </span>
                <div className="relative min-w-0">
                  <p className="truncate text-body-sm text-(--color-text-secondary)">Non-3PD</p>
                  <span className="mt-0.5 block text-label-sm leading-snug text-(--purple-1100)/80">Enable POS integration for full revenue insights</span>
                </div>
              </div>
            )}
          </div>

          <div className="absolute -translate-y-1/2" style={box(MID.x, MID.bottom, MID.w)}>
            <Branch
              icon={Bike}
              label="3PD"
              source={`${APPS.length} delivery apps`}
              value={usd(appSales)}
              share={pctOf(appSales, total)}
              parts={APPS.map((c) => ({ color: c.color, share: pctOf(t.cols[c.key].sales, total) }))}
              tint={{ bg: "var(--gray-300)", fg: "var(--color-text-primary)" }}
            />
          </div>

          <div className="absolute -translate-y-1/2" style={box(LEAF.x, MID.top, LEAF.w)}>
            {posConnected ? (
              <Leaf name="In store & website" meta="Square" mark={<StoreIcon className="size-full text-(--color-text-secondary)" />} value={usd(instore)} />
            ) : (
              <div className={cn("flex min-h-12 items-center gap-2.5 rounded-large px-3 py-2", locked)}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-circle border border-dashed border-(--purple-700) bg-(--color-background-secondary)">
                  <Mail aria-hidden className="size-3.5 text-(--purple-1000)" />
                </span>
                <span className="text-label-sm leading-snug text-(--purple-1100)/80">
                  Contact your POC or send an email to{" "}
                  <a href="mailto:service@korefi.ai" className="font-medium text-(--purple-1200) underline underline-offset-2">
                    service@korefi.ai
                  </a>
                </span>
              </div>
            )}
          </div>

          {[
            ...APPS.map((c) => ({
              key: c.key,
              name: c.label,
              mark: <Image src={asset(`/dashboard/${c.source}.png`)} alt="" width={16} height={16} unoptimized className="size-full rounded-[2px] object-contain" />,
              value: t.cols[c.key].sales,
            })),
            { key: "other", name: "Others", mark: <CircleHelp className="size-full text-(--color-text-secondary)" />, value: 0 },
          ].map((a, i) => (
            <div key={a.key} className="absolute -translate-y-1/2" style={box(LEAF.x, LEAF.rows[i], LEAF.w)}>
              <Leaf name={a.name} mark={a.mark} value={usd(a.value)} />
            </div>
          ))}
        </div>
      </div>

      {posConnected && <Reconciliation recon={recon} all={all} />}
    </>
  );
}

/** Per app, both directions: what the POS has that the app didn't pay, and what the app paid that the POS lacks. */
function Reconciliation({ recon, all }: { recon: Recon[]; all: Omit<Recon, "app" | "matchedOrders" | "waiting" | "through" | "orders"> }) {
  const gap = (g: Recon["posOnly"], tone: "danger" | "warning") =>
    g.orders ? (
      <>
        <span className={cn("block", tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-warning)")}>{usd(g.amount)}</span>
        <span className="block text-body-sm text-(--color-text-secondary)">{orders(g.orders)}</span>
      </>
    ) : (
      <span className="text-(--color-text-tertiary)">None</span>
    );
  const cell = "px-4 py-3 text-right align-top tabular-nums whitespace-nowrap";
  return (
    <div className="overflow-x-auto border-t border-(--color-border-default)">
      <table className="w-full min-w-[860px] text-body-md">
        <caption className="px-5 pt-3 pb-2 text-left text-body-sm text-(--color-text-secondary)">
          <span className="font-medium text-(--color-text-primary)">Two-way reconciliation</span> · delivery orders in Square POS vs each app&apos;s payout report
        </caption>
        <thead>
          <tr className="h-10 bg-(--gray-200) text-body-sm text-(--color-text-secondary) [&>th]:font-normal">
            <th scope="col" className="px-5 text-left">App</th>
            <th scope="col" className="px-4 text-right">App report</th>
            <th scope="col" className="px-4 text-right">POS recorded</th>
            <th scope="col" className="px-4 text-right">Matched</th>
            <th scope="col" className="px-4 text-right" title="Rung up in the POS but not paid for in the app's report">
              POS → app: not paid
            </th>
            <th scope="col" className="px-4 text-right" title="Paid for by the app but never recorded in the POS">
              App → POS: not recorded
            </th>
            <th scope="col" className="px-5 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {recon.map((r) => {
            const c = APPS.find((x) => x.key === r.app)!;
            return (
              <tr key={r.app} className="border-b border-(--gray-300)">
                <th scope="row" className="px-5 py-3 text-left align-top font-normal whitespace-nowrap text-(--color-text-primary)">
                  <AppName source={c.source} name={c.label} />
                </th>
                <td className={cell}>{usd(r.report)}</td>
                <td className={cell}>{usd(r.pos)}</td>
                <td className={cell}>
                  <span className="block">{usd(r.matched)}</span>
                  <span className="block text-body-sm text-(--color-text-secondary)">≈ {orders(r.matchedOrders)}</span>
                </td>
                <td className={cell}>{gap(r.posOnly, "danger")}</td>
                <td className={cell}>{gap(r.appOnly, "warning")}</td>
                <td className="px-5 py-3 text-right align-top">
                  <MatchBadge r={r} />
                </td>
              </tr>
            );
          })}
          <tr className="bg-(--gray-200) font-medium">
            <th scope="row" className="px-5 py-3 text-left font-medium text-(--color-text-primary)">
              All apps
            </th>
            <td className={cell}>{usd(all.report)}</td>
            <td className={cell}>{usd(all.pos)}</td>
            <td className={cell}>{usd(all.matched)}</td>
            <td className={cell}>{gap(all.posOnly, "danger")}</td>
            <td className={cell}>{gap(all.appOnly, "warning")}</td>
            <td className="px-5 py-3 text-right tabular-nums">{pctText(pctOf(all.matched, Math.max(all.report, all.pos)))}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-5 py-3 text-body-sm text-(--color-text-secondary)">
        <span className="text-(--color-text-danger)">Not paid</span>: orders the POS rang up that the app hasn&apos;t paid for; KoreFi claims them from the app.{" "}
        <span className="text-(--color-text-warning)">Not recorded</span>: orders the app paid that never reached the POS, so POS sales read low; KoreFi fixes the mapping. Nothing is needed from you.
      </p>
    </div>
  );
}
