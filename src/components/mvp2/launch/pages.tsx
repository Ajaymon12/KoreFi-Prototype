"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LaunchState } from "../LaunchState";
import { APPS, AppIcon, Canvas, Label, SOURCES, STORE_COLOR, StoreIcon, UPLOAD_NOTE } from "./parts";

// The launch state of every /mvp2 report except the P&L (finance/PnlLaunch): the page's headline,
// then four of its ideas, each drawn small with sample figures. The drawings follow the real reports
// (OverviewReport, PayoutReport, ChargebackReport, BalanceSummary), so the owner sees what's coming.

/** For pages still being built (3PD Payouts, Balance Sheet). */
const SOON_NOTE = "We're building this now. It'll show up here as soon as it's ready.";

const CHANNEL_ROWS = [{ key: "store", name: "In store", color: STORE_COLOR }, ...APPS];
const ChannelIcon = ({ k, size = 14 }: { k: string; size?: number }) => (k === "store" ? <StoreIcon size={size} /> : <AppIcon app={k} size={size} />);

// ── Overview ────────────────────────────────────────────────────────────────────────────────

const TilesPreview = () => (
  <Canvas className="grid grid-cols-2 gap-3">
    {[
      { l: "Sales", v: "$112.8k", d: "▲ 4%" },
      { l: "From delivery apps", v: "34%", sub: "$38.9k of sales" },
      { l: "Paid to you", v: "$101.0k", d: "▲ 3%" },
      { l: "Won back", v: "$412", sub: "from disputes" },
    ].map((t) => (
      <div key={t.l}>
        <Label>{t.l}</Label>
        <p className="mt-1 text-subtitle-lg text-(--color-text-primary) tabular-nums">{t.v}</p>
        <p className={cn("text-[11px] tabular-nums", t.d ? "text-(--color-text-success)" : "text-(--color-text-tertiary)")}>{t.d ?? t.sub}</p>
      </div>
    ))}
  </Canvas>
);

const MosaicPreview = () => {
  // width = outlet size, height = channel mix
  const outlets = [
    { name: "Kitchen", w: 46, mix: [62, 18, 12, 8] },
    { name: "Midtown", w: 32, mix: [48, 26, 18, 8] },
    { name: "Lakeview", w: 22, mix: [70, 12, 10, 8] },
  ];
  return (
    <Canvas>
      <Label>Revenue by outlet</Label>
      <div className="mt-3 flex h-[120px] gap-1">
        {outlets.map((o) => (
          <div key={o.name} className="flex flex-col gap-0.5" style={{ width: `${o.w}%` }}>
            {o.mix.map((m, i) => (
              <span key={i} className="rounded-[2px]" style={{ height: `${m}%`, background: CHANNEL_ROWS[i].color, opacity: 0.85 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 text-[10px] text-(--color-text-tertiary)">
        {outlets.map((o) => (
          <span key={o.name} style={{ width: `${o.w}%` }}>
            {o.name}
          </span>
        ))}
      </div>
    </Canvas>
  );
};

const FlowPreview = () => (
  <Canvas className="flex items-center gap-3">
    <div className="rounded-medium border border-(--color-border-default) px-2.5 py-2">
      <Label>Revenue</Label>
      <p className="text-[13px] font-medium tabular-nums">$112.8k</p>
    </div>
    <svg aria-hidden viewBox="0 0 24 100" className="h-[120px] w-6 shrink-0 text-(--color-border-darker)" preserveAspectRatio="none">
      <path d="M0 50C12 50 12 18 24 18M0 50C12 50 12 82 24 82" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="flex flex-1 flex-col gap-2">
      {[
        { l: "Non-3PD", v: "$73.9k", icons: ["store"] },
        { l: "3PD", v: "$38.9k", icons: APPS.map((a) => a.key) },
      ].map((b) => (
        <div key={b.l} className="rounded-medium border border-(--color-border-default) px-2.5 py-2">
          <div className="flex items-center justify-between">
            <Label>{b.l}</Label>
            <span className="flex gap-0.5">
              {b.icons.map((k) => (
                <ChannelIcon key={k} k={k} size={12} />
              ))}
            </span>
          </div>
          <p className="text-[13px] font-medium tabular-nums">{b.v}</p>
        </div>
      ))}
    </div>
  </Canvas>
);

const ReconPreview = () => (
  <Canvas>
    <Label>Square ⇄ delivery apps</Label>
    <ul className="mt-3 space-y-2.5 text-[12px]">
      {[
        { dot: "bg-(--color-danger-default)", l: "Rung up, not paid", n: "8 orders", v: "$241.44", tone: "text-(--color-text-danger)" },
        { dot: "bg-(--color-warning-default)", l: "Paid, not in Square", n: "1 order", v: "$22.39", tone: "text-(--color-text-warning)" },
        { dot: "bg-(--color-success-default)", l: "Matched", n: "1,515 orders", v: "97.2%", tone: "text-(--color-text-success)" },
      ].map((r) => (
        <li key={r.l} className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-circle", r.dot)} />
          <span className="flex-1 text-(--color-text-primary)">{r.l}</span>
          <span className="text-(--color-text-tertiary) tabular-nums">{r.n}</span>
          <span className={cn("w-14 text-right font-medium tabular-nums", r.tone)}>{r.v}</span>
        </li>
      ))}
    </ul>
  </Canvas>
);

export function OverviewLaunch({ restaurant }: { restaurant: string }) {
  return (
    <LaunchState
      eyebrow="Overview"
      title="Your restaurant, at a glance"
      body={`Where ${restaurant}'s sales come from, which outlets and apps carry them, and how much of every sale actually reaches you.`}
      sources={[SOURCES.pos, SOURCES.apps]}
      note={UPLOAD_NOTE}
      features={[
        { title: "The numbers that matter", body: "Sales, the apps' share, what was paid to you and what was won back, each against the period before.", preview: <TilesPreview /> },
        { title: "Revenue by outlet", body: "Each outlet sized by its sales and split by channel, so the mix behind every store is plain.", preview: <MosaicPreview /> },
        { title: "Follow the money", body: "From total revenue to in store and the apps, then to each channel, in dollars or share of sales.", preview: <FlowPreview /> },
        { title: "Square checked against the apps", body: "Every delivery order matched both ways. Anything rung up but not paid, KoreFi claims.", preview: <ReconPreview /> },
      ]}
    />
  );
}

// ── 3PD Payouts ─────────────────────────────────────────────────────────────────────────────

const LinesPreview = () => (
  <Canvas className="p-0">
    <table className="w-full text-[11px] tabular-nums">
      <tbody>
        {[
          ["", "Sales", "$19,779", ""],
          ["−", "Commission", "$4,552", ""],
          ["−", "Your promos", "$226", ""],
          ["+", "Won back", "$61", "green"],
          ["=", "Paid to you", "$14,904", "total"],
        ].map(([op, l, v, k]) => (
          <tr key={l} className={cn("border-b border-(--color-border-default) last:border-0", k === "total" && "font-medium")}>
            <td className="w-6 py-2 pl-3 text-(--color-text-tertiary)">{op}</td>
            <td className="py-2 text-(--color-text-primary)">{l}</td>
            <td className={cn("py-2 pr-3 text-right", k === "green" ? "text-(--color-text-success)" : "text-(--color-text-primary)")}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Canvas>
);

const DollarPreview = () => (
  <Canvas>
    <Label>Where each $1 went</Label>
    <ul className="mt-4 space-y-3.5">
      {[
        { app: "doordash", name: "DoorDash", kept: 75, fee: 23 },
        { app: "ubereats", name: "Uber Eats", kept: 72, fee: 27 },
        { app: "grubhub", name: "Grubhub", kept: 79, fee: 20 },
      ].map((r) => (
        <li key={r.app} className="grid grid-cols-[16px_60px_1fr] items-center gap-2 text-[12px]">
          <AppIcon app={r.app} />
          <span className="truncate text-(--color-text-primary)">{r.name}</span>
          <span className="flex h-2 overflow-hidden rounded-circle bg-(--color-neutral-lightest)">
            <span className="bg-(--color-success-default)" style={{ width: `${r.kept}%` }} />
            <span className="bg-(--gray-700)" style={{ width: `${r.fee}%` }} />
          </span>
        </li>
      ))}
    </ul>
    <p className="mt-4 flex gap-3 text-[10px] text-(--color-text-tertiary)">
      <span className="flex items-center gap-1">
        <span className="size-1.5 rounded-circle bg-(--color-success-default)" />
        Paid to you
      </span>
      <span className="flex items-center gap-1">
        <span className="size-1.5 rounded-circle bg-(--gray-700)" />
        Fees and promos
      </span>
    </p>
  </Canvas>
);

const TracedPreview = () => (
  <Canvas className="flex flex-col items-start justify-center gap-2">
    <span className="grid size-9 place-items-center rounded-circle bg-(--color-success-lightest) text-(--color-text-success)">
      <Check className="size-5" />
    </span>
    <p className="text-subtitle-md text-(--color-text-primary)">Every dollar traced</p>
    <p className="text-[12px] text-(--color-text-secondary) tabular-nums">Unaccounted: $0.00 across 1,528 orders</p>
  </Canvas>
);

const TaxPreview = () => (
  <Canvas>
    <dl className="grid grid-cols-[1fr_auto] gap-y-2.5 text-[12px] tabular-nums">
      <dt className="font-medium text-(--color-text-primary)">Paid to you</dt>
      <dd className="text-right font-medium text-(--color-text-success)">$29,069</dd>
      <dt className="border-t border-(--color-border-default) pt-2.5 text-(--color-text-secondary)">Sales tax collected</dt>
      <dd className="border-t border-(--color-border-default) pt-2.5 text-right text-(--color-text-secondary)">$2,318</dd>
      <dt className="text-(--color-text-secondary)">Tax the apps paid for you</dt>
      <dd className="text-right text-(--color-text-secondary)">−$1,104</dd>
      <dt className="border-t border-(--color-border-default) pt-2.5 text-(--color-text-primary)">Deposited</dt>
      <dd className="border-t border-(--color-border-default) pt-2.5 text-right text-(--color-text-primary)">$30,283</dd>
    </dl>
  </Canvas>
);

export function PayoutsLaunch({ restaurant }: { restaurant: string }) {
  return (
    <LaunchState
      eyebrow="3PD Payouts"
      title="Every payout, line by line"
      body={`Each delivery app's payout to ${restaurant}, read as one sum from sales to the deposit, so you can see exactly what each app took.`}
      soon
      note={SOON_NOTE}
      features={[
        { title: "A payout you can read", body: "Sales, less commission and promos, plus what was won back, equals what reached you.", preview: <LinesPreview /> },
        { title: "Where each $1 went", body: "One bar per app: what you kept and what fees and promos took, to compare apps at a glance.", preview: <DollarPreview /> },
        { title: "Every dollar traced", body: "Each payout is checked against its orders, so nothing goes unaccounted for.", preview: <TracedPreview /> },
        { title: "Tax kept separate", body: "Sales tax that passes through a payout sits below what's yours, so the deposit adds up.", preview: <TaxPreview /> },
      ]}
    />
  );
}

// ── Chargebacks ─────────────────────────────────────────────────────────────────────────────

const OutcomePreview = () => {
  const parts = [
    { l: "Won back", v: "$612", w: 49, c: "bg-(--color-success-default)" },
    { l: "Being disputed", v: "$410", w: 33, c: "bg-(--color-warning-default)" },
    { l: "Kept by the app", v: "$218", w: 18, c: "bg-(--gray-600)" },
  ];
  return (
    <Canvas>
      <Label>Charged back</Label>
      <p className="mt-1 text-jumbo-sm text-(--color-text-primary) tabular-nums">$1,240</p>
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-circle">
        {parts.map((p) => (
          <span key={p.l} className={p.c} style={{ width: `${p.w}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[12px] tabular-nums">
        {parts.map((p) => (
          <li key={p.l} className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-circle", p.c)} />
            <span className="flex-1 text-(--color-text-secondary)">{p.l}</span>
            <span className="text-(--color-text-primary)">{p.v}</span>
          </li>
        ))}
      </ul>
    </Canvas>
  );
};

const RatePreview = () => {
  const lines = [
    { c: "var(--red-900)", pts: [3.1, 2.6, 2.9, 2.2, 1.8, 2.0, 1.4] },
    { c: "var(--green-900)", pts: [2.2, 2.8, 2.4, 2.6, 2.1, 1.7, 1.9] },
    { c: "var(--gray-900)", pts: [1.2, 1.5, 1.1, 1.4, 1.0, 1.2, 0.9] },
  ];
  const path = (p: number[]) => p.map((v, i) => `${i ? "L" : "M"}${(i / (p.length - 1)) * 100} ${60 - (v / 3.5) * 55}`).join("");
  return (
    <Canvas>
      <Label>Error rate by week</Label>
      <svg aria-hidden viewBox="0 0 100 60" preserveAspectRatio="none" className="mt-3 h-[110px] w-full">
        {[15, 30, 45].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--color-border-default)" vectorEffect="non-scaling-stroke" />
        ))}
        {lines.map((l) => (
          <path key={l.c} d={path(l.pts)} fill="none" stroke={l.c} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <p className="mt-2 flex gap-3">
        {APPS.map((a) => (
          <AppIcon key={a.key} app={a.key} size={12} />
        ))}
      </p>
    </Canvas>
  );
};

const ByOutletPreview = () => (
  <Canvas>
    <Label>By outlet</Label>
    <ul className="mt-4 space-y-3.5 text-[12px]">
      {[
        { name: "Kitchen", won: 40, open: 25, kept: 12 },
        { name: "Midtown", won: 30, open: 20, kept: 8 },
        { name: "Lakeview", won: 14, open: 10, kept: 6 },
      ].map((o) => (
        <li key={o.name} className="grid grid-cols-[56px_1fr] items-center gap-2">
          <span className="text-(--color-text-primary)">{o.name}</span>
          <span className="flex h-2 gap-0.5">
            <span className="rounded-l-circle bg-(--color-success-default)" style={{ width: `${o.won}%` }} />
            <span className="bg-(--color-warning-default)" style={{ width: `${o.open}%` }} />
            <span className="rounded-r-circle bg-(--gray-600)" style={{ width: `${o.kept}%` }} />
          </span>
        </li>
      ))}
    </ul>
  </Canvas>
);

const DisputesPreview = () => (
  <Canvas className="p-0">
    <ul className="divide-y divide-(--color-border-default) text-[12px]">
      {[
        { app: "doordash", what: "Missing item · $18.40", s: "Won back", c: "bg-(--color-success-lightest) text-(--color-text-success)" },
        { app: "ubereats", what: "Order never arrived · $32.10", s: "Disputed", c: "bg-(--color-warning-lightest) text-(--color-text-warning)" },
        { app: "grubhub", what: "Wrong order · $24.75", s: "Due Oct 3", c: "bg-(--color-neutral-light) text-(--color-text-secondary)" },
      ].map((r) => (
        <li key={r.what} className="flex items-center gap-2 px-3 py-2.5">
          <AppIcon app={r.app} size={14} />
          <span className="min-w-0 flex-1 truncate text-(--color-text-primary)">{r.what}</span>
          <span className={cn("rounded-small px-1.5 py-0.5 text-[10px]", r.c)}>{r.s}</span>
        </li>
      ))}
    </ul>
  </Canvas>
);

export function ChargebacksLaunch({ restaurant }: { restaurant: string }) {
  return (
    <LaunchState
      eyebrow="Chargebacks"
      title="Money the apps take back"
      body={`When an app charges ${restaurant} for an order error, KoreFi disputes it. See what was charged, what was won back and what's still open.`}
      sources={[SOURCES.apps]}
      note={UPLOAD_NOTE}
      features={[
        { title: "Charged back, won back", body: "One set of words for the money: won back, being disputed, or kept by the app.", preview: <OutcomePreview /> },
        { title: "Error rate by week", body: "One line per app on one scale, so a rising app stands out before it costs you.", preview: <RatePreview /> },
        { title: "By outlet", body: "Each outlet's chargebacks split by outcome, to spot the store behind the errors.", preview: <ByOutletPreview /> },
        { title: "Every dispute, in plain words", body: "Each chargeback with its reason, its outcome and the app's deadline. KoreFi files them all.", preview: <DisputesPreview /> },
      ]}
    />
  );
}

// ── Balance Sheet ───────────────────────────────────────────────────────────────────────────

const NetWorthPreview = () => (
  <Canvas>
    <Label>Net worth</Label>
    <p className="mt-2 text-jumbo-md text-(--color-text-primary) tabular-nums">$284k</p>
    <p className="mt-1 text-[11px] text-(--color-text-success) tabular-nums">▲ $41k vs a year ago</p>
    <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-1.5 text-[12px] tabular-nums">
      <dt className="text-(--color-text-secondary)">What you own</dt>
      <dd className="text-right text-(--color-text-primary)">$512k</dd>
      <dt className="text-(--color-text-secondary)">What you owe</dt>
      <dd className="text-right text-(--color-text-primary)">−$228k</dd>
    </dl>
  </Canvas>
);

const SitsPreview = () => (
  <Canvas>
    <Label>Where the money sits</Label>
    <ul className="mt-4 space-y-3 text-[12px]">
      {[
        { l: "Cash in the bank", w: 38, own: true },
        { l: "Equipment", w: 52, own: true },
        { l: "Inventory", w: 10, own: true },
        { l: "Loans", w: 34, own: false },
        { l: "Card balances", w: 12, own: false },
      ].map((r) => (
        <li key={r.l} className="grid grid-cols-[96px_1fr] items-center gap-2">
          <span className="truncate text-(--color-text-primary)">{r.l}</span>
          <span className="h-2 rounded-circle" style={{ width: `${r.w}%`, background: r.own ? STORE_COLOR : "var(--gray-600)" }} />
        </li>
      ))}
    </ul>
  </Canvas>
);

const SheetPreview = () => (
  <Canvas className="p-0">
    <table className="w-full text-[11px] tabular-nums">
      <thead>
        <tr className="border-b border-(--color-border-default) text-(--color-text-secondary)">
          <th className="px-3 py-2 text-left font-normal">Line</th>
          <th className="px-3 py-2 text-right font-normal">Sep 30</th>
          <th className="px-3 py-2 text-right font-normal">A year ago</th>
        </tr>
      </thead>
      <tbody>
        {[
          ["What you own", "$512k", "$468k"],
          ["What you owe", "$228k", "$225k"],
          ["Owner's equity", "$284k", "$243k"],
          ["Net worth", "$284k", "$243k"],
        ].map(([l, a, b], i) => (
          <tr key={l} className={cn("border-b border-(--color-border-default) last:border-0", i === 3 && "font-medium")}>
            <td className="px-3 py-2 text-(--color-text-primary)">{l}</td>
            <td className="px-3 py-2 text-right text-(--color-text-primary)">{a}</td>
            <td className="px-3 py-2 text-right text-(--color-text-secondary)">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Canvas>
);

const HistoryPreview = () => {
  const pts = [42, 44, 41, 47, 52, 50, 55, 58, 54, 60, 63, 66];
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / 11) * 100} ${60 - ((v - 35) / 35) * 55}`).join("");
  return (
    <Canvas>
      <Label>Cash in the bank · 12 months</Label>
      <p className="mt-1 text-subtitle-lg text-(--color-text-primary) tabular-nums">$66.2k</p>
      <svg aria-hidden viewBox="0 0 100 60" preserveAspectRatio="none" className="mt-3 h-[100px] w-full">
        <path d={`${d}L100 60L0 60Z`} fill={STORE_COLOR} opacity="0.12" />
        <path d={d} fill="none" stroke={STORE_COLOR} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </Canvas>
  );
};

export function BalanceLaunch({ restaurant }: { restaurant: string }) {
  return (
    <LaunchState
      eyebrow="Balance Sheet"
      title="What you own, what you owe"
      body={`${restaurant}'s net worth at each month-end, in plain words: cash, equipment and stock against loans and card balances.`}
      soon
      note={SOON_NOTE}
      features={[
        { title: "Net worth, up front", body: "What you own less what you owe, and how it moved against the same day a year earlier.", preview: <NetWorthPreview /> },
        { title: "Where the money sits", body: "Every group of what you own and owe on one scale, so the big ones are obvious.", preview: <SitsPreview /> },
        { title: "The full sheet, by role", body: "Own, owe and equity, each opening to its lines, side by side with a year ago.", preview: <SheetPreview /> },
        { title: "A year of history", body: "Open any line for its last 12 month-ends, to see where it's heading.", preview: <HistoryPreview /> },
      ]}
    />
  );
}
