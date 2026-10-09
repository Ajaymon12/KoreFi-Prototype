"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, ChevronRight, CircleDollarSign, Landmark, ListTree, Lock, Mail, PiggyBank, Receipt, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sum } from "@/lib/sources/dashboard";
import type { StoreRow } from "@/lib/sources/overview";
import type { SourceId } from "@/lib/sources/types";
import { FoodCostSlider, ReportCard, useOverview } from "./OverviewState";

// "Revenue & payout": the flow from what you sold to what you keep, in the neutral flow-chart
// style of the Revenue flow design. Total revenue splits into in-store (Non-3PD, locked until
// it's split by store) and the delivery apps (3PD); each app opens to what it took, what it paid
// you and, after food cost, what you keep. Dashed connectors, grey boxes with an icon tile, white
// rows for the apps. $ / % switches every figure to a share of total revenue. Phones get the
// same tree as an indented list. "Your stores" sits below on the same food-cost assumption.

const m0 = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const ct = (n: number) => `${Math.round(n * 100)}¢`;
const pct = (a: number, b: number) => (b && a / b > 0 && a / b < 0.005 ? "under 1%" : `${Math.round((a / (b || 1)) * 100)}%`);

const LOGOS: Partial<Record<SourceId, string>> = { doordash: "/dashboard/doordash.png", ubereats: "/dashboard/ubereats.png", grubhub: "/dashboard/grubhub.png" };
export const STORE_DOTS = ["var(--blue-900)", "var(--brand-900)", "var(--green-900)", "var(--amber-800)"];

/** A marketplace that's connected but sent no payout for the period (e.g. Grubhub not syncing). */
export type MissingApp = { source: SourceId; name: string; status: string };

type Node = {
  id: string;
  label: string;
  value: number | null;
  /** box: grey card with an icon tile · row: slim white row (apps and the steps under them) · lock: purple dashed note */
  look: "box" | "row" | "lock";
  icon?: LucideIcon;
  logo?: string;
  sub?: string;
  note?: React.ReactNode;
  kids?: Node[];
};

function buildTree(rows: StoreRow[], food: number, missing: MissingApp[], posConnected: boolean) {
  const f = food / 100;
  // Apps summed across the stores in view; the per-store split lives in "Your stores".
  const apps = Object.values(
    rows.flatMap((r) => r.channels).reduce<Record<string, { source: SourceId; name: string; gross: number; fees: number; net: number }>>((m, c) => {
      const a = (m[c.source] ??= { source: c.source, name: c.name, gross: 0, fees: 0, net: 0 });
      a.gross += c.gross;
      a.fees += c.fees;
      a.net += c.net;
      return m;
    }, {}),
  ).sort((a, b) => b.gross - a.gross);
  const total = sum(apps.map((a) => a.gross));

  const appNodes: Node[] = apps.map((a) => ({
    id: a.source, label: a.name, value: a.gross, look: "row", logo: LOGOS[a.source],
    // The four steps from this app's sales to what you keep, top to bottom.
    kids: [
      { id: `${a.source}:fees`, label: "App fees", value: -a.fees, look: "row", icon: Receipt, sub: `${pct(a.fees, a.gross)} of sales` },
      { id: `${a.source}:paid`, label: "Paid to you", value: a.net, look: "row", icon: Landmark, sub: `${ct(a.net / a.gross)} of every $1` },
      { id: `${a.source}:food`, label: "Food cost", value: -a.gross * f, look: "row", icon: ChefHat, sub: `${food}% of sales` },
      { id: `${a.source}:keep`, label: "You keep", value: a.net - a.gross * f, look: "row", icon: PiggyBank, sub: "before staff, rent" },
    ],
  }));
  const missingNodes: Node[] = missing.map((m) => ({ id: m.source, label: m.name, value: null, look: "row", logo: LOGOS[m.source], sub: m.status === "error" ? "Not syncing" : "No payout yet" }));

  const nonApp: Node = posConnected
    ? { id: "non3pd", label: "Non-3PD", value: null, look: "lock", icon: Lock, note: "In-store sales are in Square, not split by store yet" }
    : {
        id: "non3pd", label: "Non-3PD", value: null, look: "lock", icon: Lock, note: "Enable POS integration for full revenue insights",
        kids: [{ id: "contact", label: "", value: null, look: "lock", icon: Mail, note: <>Contact your POC or send an email to <u className="font-medium">service@korefi.ai</u></> }],
      };
  const apps3pd: Node = { id: "3pd", label: "3PD", value: total, look: "box", icon: Truck, kids: [...appNodes, ...missingNodes] };
  const root: Node = { id: "root", label: "Total revenue", value: total, look: "box", icon: CircleDollarSign, kids: [nonApp, apps3pd] };
  return { root, defaults: ["root", "3pd", ...(posConnected ? [] : ["non3pd"])] };
}

const H = { box: 64, row: 46, lock: 64 } as const;
const W = { box: 200, row: 240, lock: 230 } as const;

type Show = "$" | "%";
const shown = (n: Node, show: Show, total: number) =>
  n.value == null ? null : show === "%" ? `${n.value < 0 ? "−" : ""}${pct(Math.abs(n.value), total)}` : n.id.endsWith(":keep") ? `≈ ${m0(n.value)}` : m0(n.value);

const IconTile = ({ icon: Icon, lock }: { icon: LucideIcon; lock?: boolean }) => (
  <span
    className={cn(
      "grid size-9 shrink-0 place-items-center rounded-medium border",
      lock ? "rounded-circle border-dashed border-(--purple-600) text-(--purple-1100)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-secondary)",
    )}
  >
    <Icon className="size-4" />
  </span>
);

function NodeBody({ n, show, total, open }: { n: Node; show: Show; total: number; open: boolean }) {
  const can = !!n.kids?.length;
  const v = shown(n, show, total);
  if (n.look === "lock")
    return (
      <>
        <IconTile icon={n.icon!} lock />
        <span className="min-w-0 text-body-sm leading-[1.4] text-(--purple-1100)">
          {n.label && <span className="block text-(--color-text-secondary)">{n.label}</span>}
          <span className="line-clamp-2">{n.note}</span>
        </span>
      </>
    );
  if (n.look === "box")
    return (
      <>
        <IconTile icon={n.icon!} />
        <span className="min-w-0">
          <span className="block truncate text-body-sm text-(--color-text-secondary)">{n.label}</span>
          <span className="block text-subtitle-lg text-(--color-text-primary) tabular-nums">{v}</span>
        </span>
      </>
    );
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {n.logo ? <img src={n.logo} alt="" className="size-5 shrink-0 rounded-small" /> : n.icon && <n.icon className="size-4 shrink-0 text-(--color-text-secondary)" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md text-(--color-text-primary)">{n.label}</span>
        {n.sub && <span className={cn("block truncate text-body-sm", v == null ? "text-(--color-text-danger)" : "text-(--color-text-tertiary)")}>{n.sub}</span>}
      </span>
      <span className="text-subtitle-sm whitespace-nowrap text-(--color-text-primary) tabular-nums">{v ?? "—"}</span>
      {can && <ChevronRight aria-hidden className={cn("size-4 shrink-0 text-(--color-text-tertiary) transition-transform", open && "rotate-90")} />}
    </>
  );
}

// The end of each app's flow, what you keep, is the one box with a colour: a green border.
const isKeep = (n: Node) => n.id.endsWith(":keep");

const nodeCls = (n: Node) =>
  cn(
    "absolute flex items-center gap-3 rounded-large border text-left",
    n.look === "box" && "border-(--color-border-default) bg-(--color-neutral-lightest) px-3",
    n.look === "row" && "gap-2.5 border-(--color-border-default) bg-(--color-background-secondary) px-3",
    isKeep(n) && "border-(--color-success-default)",
    n.look === "lock" && "border-dashed border-(--purple-600) bg-(--purple-100) px-3",
  );

function Tree({ root, open, onToggle, show }: { root: Node; open: Set<string>; onToggle: (id: string) => void; show: Show }) {
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(1000);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  // Leaves stack top to bottom; an open parent sits centred on its children.
  const laid: { n: Node; d: number; y: number }[] = [];
  let leafY = 0;
  const lay = (n: Node, d: number): number => {
    let mid: number;
    if (n.kids && open.has(n.id)) {
      const ms = n.kids.map((k) => lay(k, d + 1));
      mid = (ms[0] + ms[ms.length - 1]) / 2;
    } else {
      mid = leafY + H[n.look] / 2;
      leafY += H[n.look] + (n.look === "row" ? 8 : 28);
    }
    laid.push({ n, d, y: mid - H[n.look] / 2 });
    return mid;
  };
  lay(root, 0);
  const maxD = Math.max(...laid.map((l) => l.d));
  // Columns shrink (to 80%) before the tree scrolls sideways; gaps take whatever room is left.
  const want = Array.from({ length: maxD + 1 }, (_, d) => Math.max(...laid.filter((l) => l.d === d).map((l) => W[l.n.look])));
  const fit = Math.min(1, Math.max(0.8, (avail - 48 * maxD) / sum(want)));
  const colW = want.map((w) => Math.floor(w * fit));
  const G = Math.max(48, Math.min(120, Math.floor((avail - sum(colW)) / Math.max(maxD, 1))));
  const colX = colW.map((_, d) => sum(colW.slice(0, d)) + d * G);
  const Wt = colX[maxD] + colW[maxD];
  const Ht = Math.max(...laid.map((l) => l.y + H[l.n.look]));
  const at = new Map(laid.map((l) => [l.n.id, l]));

  const edges = laid
    .filter((l) => l.n.kids && open.has(l.n.id))
    .flatMap(({ n, d, y }) =>
      n.kids!.map((k) => {
        const c = at.get(k.id)!;
        const x1 = colX[d] + colW[d], y1 = y + H[n.look] / 2, x2 = colX[c.d], y2 = c.y + H[k.look] / 2, mx = (x1 + x2) / 2;
        return (
          <g key={k.id} fill="none" stroke="var(--gray-800)" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
            <path d={`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 2} ${y2}`} strokeDasharray="4 4" />
            <path d={`M${x2 - 8} ${y2 - 4} L${x2 - 2} ${y2} L${x2 - 8} ${y2 + 4}`} />
          </g>
        );
      }),
    );

  const total = Math.abs(root.value ?? 0) || 1;
  return (
    <div ref={box} className="hidden overflow-x-auto py-6 md:block">
      <div className="relative mx-auto" style={{ width: Wt, height: Ht }}>
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={Wt} height={Ht} viewBox={`0 0 ${Wt} ${Ht}`} aria-hidden>
          {edges}
        </svg>
        {laid.map(({ n, d, y }) => {
          const can = !!n.kids?.length, isOpen = can && open.has(n.id);
          const style = { left: colX[d], top: y, width: colW[d], height: H[n.look] };
          return can ? (
            <button
              key={n.id}
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggle(n.id)}
              className={cn(nodeCls(n), "outline-none transition-colors hover:border-(--color-border-darker) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)")}
              style={style}
            >
              <NodeBody n={n} show={show} total={total} open={isOpen} />
            </button>
          ) : (
            <div key={n.id} className={nodeCls(n)} style={style}>
              <NodeBody n={n} show={show} total={total} open={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function List({ n, d, open, onToggle, show, total }: { n: Node; d: number; open: Set<string>; onToggle: (id: string) => void; show: Show; total: number }) {
  const can = !!n.kids?.length, isOpen = can && open.has(n.id);
  const v = shown(n, show, total);
  const Icon = n.icon;
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {can && <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-(--color-text-tertiary) transition-transform", isOpen && "rotate-90")} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {n.logo ? <img src={n.logo} alt="" className="size-4 rounded-small" /> : Icon && <Icon className="size-4 shrink-0 text-(--color-text-secondary)" />}
        <span className="truncate">{n.look === "lock" ? n.note : n.label}</span>
      </span>
      {n.look !== "lock" && <b className="font-semibold whitespace-nowrap tabular-nums">{v ?? "—"}</b>}
    </>
  );
  const cls = cn(
    "flex w-full items-center justify-between gap-2.5 rounded-medium border py-2.5 pr-3 text-left text-body-md",
    n.look === "lock" ? "border-dashed border-(--purple-600) bg-(--purple-100) text-(--purple-1100)" : n.look === "box" ? "border-transparent bg-(--color-neutral-lightest)" : isKeep(n) ? "border-(--color-success-default) bg-(--color-background-secondary)" : "border-(--color-border-default) bg-(--color-background-secondary)",
  );
  return (
    <>
      {can ? (
        <button type="button" aria-expanded={isOpen} onClick={() => onToggle(n.id)} className={cls} style={{ paddingLeft: 12 + d * 16 }}>
          {inner}
        </button>
      ) : (
        <div className={cls} style={{ paddingLeft: 12 + d * 16 }}>
          {inner}
        </div>
      )}
      {isOpen && n.kids!.map((k) => <List key={k.id} n={k} d={d + 1} open={open} onToggle={onToggle} show={show} total={total} />)}
    </>
  );
}

function ShowAs({ show, setShow }: { show: Show; setShow: (s: Show) => void }) {
  return (
    <span className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
      Show as
      <span role="group" aria-label="Show as" className="flex rounded-medium bg-(--color-neutral-lightest) p-0.5">
        {(["$", "%"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={show === s}
            onClick={() => setShow(s)}
            className={cn(
              "grid h-7 w-8 place-items-center rounded-small text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
              show === s ? "bg-(--color-background-secondary) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
            )}
          >
            {s}
          </button>
        ))}
      </span>
    </span>
  );
}

export function FollowYourMoney({ rows, period, missing = [], posConnected = true }: { rows: StoreRow[]; period: string; missing?: MissingApp[]; posConnected?: boolean }) {
  const { food } = useOverview();
  const [show, setShow] = useState<Show>("$");
  const { root, defaults } = useMemo(() => buildTree(rows, food, missing, posConnected), [rows, food, missing, posConnected]);
  const [open, setOpen] = useState(() => new Set(defaults));
  const scopeKey = rows.map((r) => r.store).join("|");
  const [key, setKey] = useState(scopeKey);
  if (key !== scopeKey) {
    setKey(scopeKey);
    setOpen(new Set(defaults));
  }

  const parents = useMemo(() => {
    const m = new Map<string, Node>();
    const walk = (n: Node) => n.kids?.forEach((k) => (m.set(k.id, n), walk(k)));
    walk(root);
    return m;
  }, [root]);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: Node) => n.kids?.length && (ids.push(n.id), n.kids.forEach(walk));
    walk(root);
    return ids;
  }, [root]);
  const everything = allIds.every((id) => open.has(id));

  const toggle = (id: string) => {
    const next = new Set(open);
    const find = (n: Node): Node | undefined => (n.id === id ? n : n.kids?.map(find).find(Boolean));
    const node = find(root);
    if (!node) return;
    const drop = (n: Node) => (next.delete(n.id), n.kids?.forEach(drop));
    if (next.has(id)) drop(node);
    else {
      // One app open at a time, so the tree stays readable.
      const p = parents.get(id);
      if (p?.id === "3pd") p.kids!.filter((s) => s.id !== id).forEach(drop);
      next.add(id);
    }
    setOpen(next);
  };

  const sold = root.value ?? 0;
  const paid = sum(rows.map((r) => r.net));
  const keep = paid - sold * (food / 100);
  const biggest = [...rows].sort((a, b) => b.gross - a.gross)[0];
  const topApp = root.kids?.find((k) => k.id === "3pd")?.kids?.[0];
  const say = [
    <>You sold <b>{m0(sold)}</b> on the delivery apps. <b>{m0(paid)}</b> reached you, {ct(paid / sold)} of every $1.</>,
    rows.length > 1 ? (
      <><b>{biggest.store}</b> sells the most: {m0(biggest.gross)}, {pct(biggest.gross, sold)} of app sales.</>
    ) : (
      <><b>{topApp?.label}</b> is your bigger app: {m0(topApp?.value ?? 0)}, {pct(topApp?.value ?? 0, sold)} of app sales.</>
    ),
    <>After food cost ({food}%) you keep about <b>{m0(keep)}</b>, before staff and rent.</>,
  ];

  const fig = (v: number, keepSign = false) => (show === "%" ? pct(v, sold) : `${keepSign ? "≈ " : ""}${m0(v)}`);
  const tiles: { label: string; value: string; sub: React.ReactNode }[] = [
    { label: "Total revenue", value: fig(sold), sub: "delivery apps" },
    { label: "Paid to you", value: fig(paid), sub: `${ct(paid / sold)} of every $1` },
    { label: "You keep, before staff and rent", value: fig(keep, true), sub: <FoodCostSlider /> },
  ];

  return (
    <ReportCard
      title="Revenue & payout"
      caption={`Flow from sales to what you keep · ${period}`}
      right={<ShowAs show={show} setShow={setShow} />}
      say={say}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="grid gap-0.5 rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest) px-4 py-3">
            <small className="text-body-sm text-(--color-text-secondary)">{t.label}</small>
            <b className="text-subtitle-lg font-semibold text-(--color-text-primary) tabular-nums">{t.value}</b>
            <span className="text-body-sm text-(--color-text-tertiary)">{t.sub}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm text-(--color-text-secondary)">Revenue flow · click a box to open the next step</p>
        <button
          type="button"
          aria-pressed={everything}
          onClick={() => setOpen(new Set(everything ? defaults : allIds))}
          className="flex h-7 items-center gap-1.5 rounded-small px-1.5 text-body-sm text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
        >
          <ListTree className="size-3.5" />
          {everything ? "Back to summary" : "Show every step"}
        </button>
      </div>
      <Tree root={root} open={open} onToggle={toggle} show={show} />
      <div className="mt-3 grid gap-1 md:hidden">
        <List n={root} d={0} open={open} onToggle={toggle} show={show} total={Math.abs(sold) || 1} />
      </div>
      <p className="mt-2 border-t border-(--color-border-default) pt-3 text-body-sm text-(--color-text-tertiary)">
        App sales come from each app&apos;s own payout report. Food cost is an estimate ({food}% of the menu price) until your recipe costs are in your POS; move the slider to match your kitchen.
      </p>
    </ReportCard>
  );
}

const delta = (v: number) => (
  <span className={cn("inline-flex items-center gap-1 font-medium", Math.abs(v) < 0.005 ? "text-(--color-text-secondary)" : v > 0 ? "text-(--color-text-success)" : "text-(--color-text-danger)")}>
    {Math.abs(v) < 0.005 ? "Same" : `${v > 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(1)}%`}
  </span>
);

export function YourStores({ rows }: { rows: StoreRow[] }) {
  const { food } = useOverview();
  const router = useRouter();
  const f = food / 100;
  const keepOf = (r: StoreRow) => (r.gross ? (r.net - r.gross * f) / r.gross : 0);
  const share = (r: StoreRow, s: SourceId) => (r.gross ? sum(r.channels.filter((c) => c.source === s).map((c) => c.gross)) / r.gross : 0);
  const byGrowth = [...rows].sort((a, b) => b.change - a.change);
  const byKeep = [...rows].sort((a, b) => keepOf(b) - keepOf(a));
  const say = [
    <><b>{byGrowth[0].store}</b> grew the most on the apps ({delta(byGrowth[0].change)} vs the period before).</>,
    <><b>{byKeep[0].store}</b> keeps the most of every $1: about <b>{ct(keepOf(byKeep[0]))}</b> after fees and food cost.</>,
    ...(rows.some((r) => r.lostToDowntime) ? [<>Pauses on the apps cost about <b>{m0(sum(rows.map((r) => r.lostToDowntime)))}</b> in missed sales.</>] : []),
  ];
  const open = (store: string) => router.push(`/home/overview?store=${encodeURIComponent(store)}`);
  const th = "pb-2.5 pl-3 text-right text-body-sm font-normal whitespace-nowrap text-(--color-text-secondary) first:pl-0 first:text-left";
  const td = "py-3 pl-3 text-right whitespace-nowrap first:pl-0 first:text-left";
  return (
    <ReportCard title="Your stores" caption="Delivery apps · click a store to open it" say={say}>
      <div className="overflow-x-auto">
        <table className="w-full text-body-md tabular-nums">
          <thead>
            <tr className="border-b border-(--color-border-default)">
              {["Store", "Sold", "DoorDash · Uber Eats", "Paid to you", "Paid of $1", "You keep of $1", "Lost to downtime", "vs period before", ""].map((h) => (
                <th key={h || "go"} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.store} onClick={() => open(r.store)} className="group cursor-pointer hover:bg-(--color-neutral-lightest)">
                <td className={cn(td, "font-semibold")}>
                  <a
                    href={`/home/overview?store=${encodeURIComponent(r.store)}`}
                    onClick={(e) => (e.preventDefault(), open(r.store))}
                    className="inline-flex items-center gap-2 outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                  >
                    <span className="size-2.5 rounded-small" style={{ background: STORE_DOTS[i % STORE_DOTS.length] }} />
                    {r.store}
                  </a>
                </td>
                <td className={td}>{m0(r.gross)}</td>
                <td className={td}>
                  <span className="ml-auto flex h-2 w-22.5 gap-0.5 overflow-hidden rounded-circle">
                    <i className="block" style={{ flex: share(r, "doordash"), background: "var(--color-primary)" }} />
                    <i className="block" style={{ flex: share(r, "ubereats"), background: "var(--color-neutral-light)" }} />
                  </span>
                  <small className="mt-0.5 block text-body-sm text-(--color-text-tertiary)">
                    {Math.round(share(r, "doordash") * 100)}% · {Math.round(share(r, "ubereats") * 100)}%
                  </small>
                </td>
                <td className={td}>{m0(r.net)}</td>
                <td className={td}>{r.gross ? ct(r.net / r.gross) : "–"}</td>
                <td className={cn(td, "font-semibold")}>{r.gross ? ct(keepOf(r)) : "–"}</td>
                <td className={td}>
                  {r.lostToDowntime ? (
                    <span className="text-(--color-text-danger)">
                      {m0(r.lostToDowntime)} <span className="text-body-sm text-(--color-text-tertiary)">· {r.downtimeMinutes} min</span>
                    </span>
                  ) : (
                    <span className="text-(--color-text-secondary)">None</span>
                  )}
                </td>
                <td className={td}>{delta(r.change)}</td>
                <td className={cn(td, "w-8")}>
                  <ChevronRight aria-hidden className="ml-auto size-4 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-text-primary)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-body-sm text-(--color-text-tertiary)">&quot;Paid of $1&quot; is what the apps paid you. &quot;You keep of $1&quot; also takes off food cost ({food}%).</p>
    </ReportCard>
  );
}
