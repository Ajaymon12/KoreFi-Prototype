"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarClock, Check, FlaskConical, Mail, MessageSquarePlus, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { StatusBadge } from "@/components/dashboard/primitives";
import { Key } from "@/components/mvp2/parts";
import { AppLogo } from "@/components/onboarding/marks";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { STATUS_LABEL, appLabel, type AppKey, type CbStatus } from "@/lib/finance/chargebacks";
import { TRIGGER_CHOICES, isSchedule } from "@/lib/mvp3/workflows";
import { dashData, scopeLabel, shortStore, widgetTitle, type Automation, type CardRef, type Dashboard, type WidgetId } from "@/lib/mvp3/dashboards";
import { REPORTS } from "@/lib/mvp3/agents";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { EmailPreviewButton } from "./EmailPreview";
import * as FX from "@/lib/mvp3/masaFixture";
import { MasaChargebacks } from "./MasaChargebacks";
import { useRouter } from "next/navigation";

// The dashboard an agent built (lib/mvp3/dashboards). Shown in the chat's canvas while it's being shaped, and
// full page from the sidebar once pinned. The header carries Pin and the schedule (when it re-runs, and
// whether it emails the owner and updates this dashboard). Report-only: nothing here asks the owner to fix anything.

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const LOGO: Record<AppKey, "doordash" | "ubereats" | "grubhub"> = { doordash: "doordash", uber: "ubereats", grubhub: "grubhub" };
const TONE: Record<CbStatus, "success" | "warning" | "danger" | "neutral"> = { new: "neutral", won: "success", disputing: "warning", lost: "danger" };
// Calm palette: a soft red tint for money charged back, green only for money won back, grey for ranked lists.
const CHARGED = "var(--red-700)";
const WON = "var(--green-800)";
const BAR = "var(--gray-900)";
const btn = "inline-flex h-8 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5";

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-4 motion-safe:animate-page-in">
      <header className="mb-3">
        <h3 className="text-body-md font-medium text-(--color-text-primary)">{title}</h3>
        {sub && <p className="text-body-sm text-(--color-text-secondary)">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

/** "Ask why" beside an outlet: asks the agent, and its orders and what to fix open beside the answer. */
function AskWhy({ outlet }: { outlet: string }) {
  const { active, ask, send } = useAgents();
  const router = useRouter();
  const name = shortStore(outlet);
  return (
    <button
      type="button"
      onClick={() => {
        const q = `Why is ${name} high?`;
        // In the dashboard's own chat, answer there. From the full page there is no chat open: start one.
        if (active?.dashboard === "dash-chargebacks") return send(q);
        ask(q);
        router.push("/mvp3");
      }}
      title={`Ask why ${name} is high`}
      className="shrink-0 rounded-circle border border-(--color-border-default) px-2 py-0.5 text-body-sm text-(--color-text-clickable) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
    >
      Ask why
    </button>
  );
}

/** A labelled bar row: name, a bar sized against the largest, and the amount. */
function BarRow({ label, sub, value, share, color = BAR, lead }: { label: string; sub?: string; value: string; share: number; color?: string; lead?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1.5">
      <span className="flex min-w-0 items-center gap-2 text-body-md text-(--color-text-primary)">
        {lead}
        <span className="truncate">{label}</span>
        {sub && <span className="shrink-0 text-body-sm text-(--color-text-secondary)">{sub}</span>}
      </span>
      <span className="text-body-md font-medium tabular-nums text-(--color-text-primary)">{value}</span>
      <span className="col-span-2 h-1 overflow-hidden rounded-circle bg-(--color-neutral-lightest)">
        <span className="block h-full rounded-circle" style={{ width: `${Math.max(2, share * 100)}%`, background: color }} />
      </span>
    </li>
  );
}

function Widget({ id, data, topN, askWhy = false }: { id: WidgetId; data: ReturnType<typeof dashData>; topN: number; askWhy?: boolean }) {
  if (id === "kpis") {
    const k = data.kpis;
    const tiles = [
      { label: "Charged back", value: usd(k.charged), sub: `${k.n} orders`, cls: "text-(--color-text-danger)" },
      { label: "Won back", value: usd(k.won), cls: "text-(--color-text-success)" },
      { label: "Being disputed", value: usd(k.open) },
      { label: "Win rate", value: k.winRate === null ? "–" : `${Math.round(k.winRate * 100)}%`, sub: "of decided disputes" },
    ];
    return (
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-border-default) md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-(--color-background-secondary) px-4 py-3">
            <dt className="text-body-sm text-(--color-text-secondary)">{t.label}</dt>
            <dd className={cn("text-subtitle-lg font-medium tabular-nums", t.cls ?? "text-(--color-text-primary)")}>{t.value}</dd>
            {t.sub && <dd className="text-body-sm text-(--color-text-secondary)">{t.sub}</dd>}
          </div>
        ))}
      </dl>
    );
  }
  if (id === "trend") {
    const max = Math.max(1, ...data.weeks.map((w) => w.charged));
    const every = data.weeks.length > 8 ? 2 : 1;
    return (
      <Card title={widgetTitle(id)} sub="Charged back and won back each week">
        <div className="flex h-36 items-end gap-1" role="img" aria-label="Charged back and won back by week">
          {data.weeks.map((w) => (
            <div key={w.label} title={`${w.label}: ${usd(w.charged)} charged back, ${usd(w.won)} won back`} className="relative flex h-full min-w-0 flex-1 items-end">
              <span className="w-full rounded-t-small" style={{ background: CHARGED, height: `${(w.charged / max) * 100}%` }} />
              <span className="absolute inset-x-[22%] bottom-0 rounded-t-small" style={{ background: WON, height: `${(w.won / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {data.weeks.map((w, i) => (
            <span key={w.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-(--color-text-tertiary)">
              {i % every === 0 ? w.label.replace(/^Week of /, "") : ""}
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-body-sm text-(--color-text-secondary)">
          <Key color={CHARGED}>Charged back</Key>
          <Key color={WON}>Won back</Key>
        </div>
      </Card>
    );
  }
  if (id === "apps") {
    const max = Math.max(1, ...data.apps.map((a) => a.amount));
    return (
      <Card title={widgetTitle(id)}>
        <ul>
          {data.apps.map((a) => (
            <BarRow key={a.key} lead={<AppLogo app={LOGO[a.key as AppKey]} size={18} />} label={appLabel(a.key as AppKey)} sub={`${a.n} orders · ${usd(a.wonBack)} won back`} value={usd(a.amount)} share={a.amount / max} />
          ))}
        </ul>
      </Card>
    );
  }
  if (id === "outlets") {
    const max = Math.max(1, ...data.outlets.map((o) => o.amount));
    return (
      <Card title={widgetTitle(id)} sub={`Top ${topN} by amount charged back`}>
        <ul>
          {data.outlets.map((o) => (
            <BarRow key={o.key} label={shortStore(o.key)} sub={`${o.n} orders`} value={usd(o.amount)} share={o.amount / max} lead={askWhy && <AskWhy outlet={o.key} />} />
          ))}
        </ul>
      </Card>
    );
  }
  if (id === "reasons") {
    const max = Math.max(1, ...data.reasons.map((r) => r.amount));
    return (
      <Card title={widgetTitle(id)}>
        <ul>
          {data.reasons.map((r) => (
            <BarRow key={r.key} label={r.key} sub={`${r.n} orders`} value={usd(r.amount)} share={r.amount / max} />
          ))}
        </ul>
      </Card>
    );
  }
  return (
    <Card title={widgetTitle(id)}>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-body-md">
          <thead className="text-body-sm text-(--color-text-secondary)">
            <tr className="border-b border-(--color-border-default)">
              {["Date", "Outlet", "App", "Reason", "Amount", "Status"].map((h) => (
                <th key={h} className={cn("px-4 py-2 font-normal", h === "Amount" && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-border-default)">
            {data.recent.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 whitespace-nowrap text-(--color-text-secondary)">{new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</td>
                <td className="px-4 py-2 text-(--color-text-primary)">{shortStore(c.store)}</td>
                <td className="px-4 py-2 text-(--color-text-primary)">{appLabel(c.app)}</td>
                <td className="px-4 py-2 text-(--color-text-secondary)">{c.reason}</td>
                <td className="px-4 py-2 text-right tabular-nums text-(--color-text-primary)">{usd(c.amount)}</td>
                <td className="px-4 py-2">
                  <StatusBadge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Wraps a card so the owner can point at it: "Edit in chat" shows on hover (always on touch), and the
 *  pointed card keeps an outline while it sits in the composer. Clicking again takes it back out. */
function Pointable({ title, on, onPoint, children }: { title: string; on: boolean; onPoint: () => void; children: React.ReactNode }) {
  return (
    <div className={cn("group/card relative rounded-large transition-shadow", on && "outline-2 outline-offset-2 outline-(--module-strong)")}>
      {children}
      <button
        type="button"
        onClick={onPoint}
        aria-pressed={on}
        aria-label={on ? `Remove ${title} from the chat` : `Edit ${title} in chat`}
        className={cn(
          "absolute top-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 rounded-medium border px-2 text-body-sm font-medium shadow-[0_2px_8px_rgb(0_0_0/0.08)] outline-none transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5",
          on
            ? "border-transparent bg-(--module-tint) text-(--module-strong) opacity-100"
            : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) opacity-0 group-hover/card:opacity-100 hover:bg-(--color-neutral-lightest) [@media(hover:none)]:opacity-100",
        )}
      >
        {on ? <Check aria-hidden /> : <MessageSquarePlus aria-hidden />}
        {on ? "In chat" : "Edit in chat"}
      </button>
    </div>
  );
}

// ───────── Schedule ─────────

/** "Every Thursday, 8:00 AM · email + dashboard", or a prompt to set one. Opens a small editor. */
export function ScheduleControl({ d }: { d: Dashboard }) {
  const { setAutomation } = useAgents();
  const [openEd, setOpenEd] = useState(false);
  const a = d.automation;
  const [draft, setDraft] = useState<Automation>(a ?? { schedule: "Every Thursday, 8:00 AM", email: true, dashboard: true });
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, openEd, () => setOpenEd(false));
  const choices = TRIGGER_CHOICES.filter(isSchedule);
  if (!choices.includes(draft.schedule)) choices.unshift(draft.schedule);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={openEd}
        onClick={() => {
          setDraft(a ?? { schedule: "Every Thursday, 8:00 AM", email: true, dashboard: true });
          setOpenEd((v) => !v);
        }}
        className={cn(btn, a && "border-transparent bg-(--module-tint) text-(--module-strong) hover:bg-(--module-tint)")}
      >
        <CalendarClock aria-hidden />
        {a ? a.schedule : "Schedule"}
      </button>
      {openEd && (
        <div role="dialog" aria-label="Schedule" className="absolute top-full right-0 z-30 mt-1.5 w-72 space-y-3 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-3 shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
          <label className="block space-y-1">
            <span className="text-body-sm text-(--color-text-secondary)">Run the agent</span>
            <select value={draft.schedule} onChange={(e) => setDraft({ ...draft, schedule: e.target.value })} className="w-full rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2 py-1.5 text-body-sm outline-none">
              {choices.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {/* min-w-0: a fieldset otherwise refuses to shrink below its content, so a long email overflowed the popover. */}
          <fieldset className="min-w-0 space-y-1.5">
            <legend className="pb-1 text-body-sm text-(--color-text-secondary)">Then</legend>
            {[
              { k: "email" as const, label: "Email the report", sub: user.email, Icon: Mail },
              { k: "dashboard" as const, label: d.report ? "Refresh this report" : "Update this dashboard", sub: undefined, Icon: Pin },
            ].map(({ k, label, sub, Icon }) => (
              <label key={k} className="flex cursor-pointer items-start gap-2 text-body-sm text-(--color-text-primary)">
                <input type="checkbox" checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} className="mt-0.5 size-4 shrink-0 accent-(--color-primary)" />
                <Icon className="mt-[3px] size-3.5 shrink-0 text-(--color-text-secondary)" aria-hidden />
                <span className="min-w-0 flex-1">
                  {label}
                  {sub && <span className="block break-all text-(--color-text-secondary)">to {sub}</span>}
                  {k === "email" && <EmailPreviewButton workflow={d.workflow} className="mt-0.5" />}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex items-center justify-between gap-2 border-t border-(--color-border-default) pt-3">
            {a ? (
              <button
                type="button"
                onClick={() => {
                  setAutomation(d.id, undefined);
                  setOpenEd(false);
                }}
                className="text-body-sm text-(--color-text-danger) hover:underline"
              >
                Turn off
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={!draft.email && !draft.dashboard}
              onClick={() => {
                setAutomation(d.id, draft);
                setOpenEd(false);
              }}
              className="h-8 rounded-medium bg-(--color-primary) px-3 text-body-sm font-medium text-white disabled:opacity-40"
            >
              Save schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PinButton({ d }: { d: Dashboard }) {
  const { pinDashboard } = useAgents();
  return (
    <button type="button" aria-pressed={d.pinned} onClick={() => pinDashboard(d.id, !d.pinned)} className={btn} title={d.pinned ? "Unpin from sidebar" : "Pin to sidebar"}>
      {d.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
      {d.pinned ? "Unpin" : "Pin to sidebar"}
    </button>
  );
}

/** Masa Kitchen's pinned Chargebacks dashboard shows the prototype's sample week (lib/mvp3/masaFixture). */
const fx = (d: Dashboard) => d.pinnedBy === "team" && d.workflow === "chargebacks" && FX.masaFixture();

// ───────── Sample data ─────────

/** A restaurant with no reports yet sees Taco Pros sample data. Every sample surface says so, plainly. */
export function SampleTag() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-(--color-neutral-lightest) px-2 text-body-sm font-medium text-(--color-text-secondary) [&_svg]:size-3">
      <FlaskConical aria-hidden /> Sample data
    </span>
  );
}

export function SampleBanner({ what = "numbers" }: { what?: string }) {
  return (
    <p className="flex items-start gap-2 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-primary)">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-(--color-text-secondary)" aria-hidden />
      <span>
        This is <b className="font-medium">Taco Pros sample data</b>, not yours. Your own {what} show here once your first reports arrive, usually 2 to 3 days after your apps are connected. Pinning and schedules turn on then.
      </span>
    </p>
  );
}

// ───────── The dashboard ─────────

/** `actions` sit at the end of the header (the canvas's expand and close, or the page's Customise).
 *  `onPoint`: what pointing at a card does beyond attaching it (the full page also opens the chat). */
export function AgentDashboard({ d, actions, padRight = false, onPoint }: { d: Dashboard; actions?: React.ReactNode; padRight?: boolean; onPoint?: (r: CardRef) => void }) {
  const data = useMemo(() => dashData(d.config), [d.config]);
  const { pointed, setPointed } = useAgents();
  const point = (w: WidgetId) => {
    if (pointed?.dash === d.id && pointed.widget === w) return setPointed(null);
    const r: CardRef = { dash: d.id, widget: w, title: widgetTitle(w) };
    if (onPoint) onPoint(r);
    else setPointed(r);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className={cn("flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-(--color-border-default) bg-(--color-background-secondary) py-1 pl-4", padRight ? "pr-2" : "pr-4")}>
        <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{d.title}</h1>
        {d.sample && <SampleTag />}
        {d.pinned && (
          <span className="inline-flex items-center gap-1 text-body-sm text-(--color-text-secondary)">
            <Pin className="size-3" aria-hidden /> Pinned
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!d.sample && <ScheduleControl d={d} />}
          {!d.sample && <PinButton d={d} />}
          {actions}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-(--color-text-secondary)">
            <span className="inline-flex items-center gap-1.5">
              <AgentAvatar agent={d.agent} size={18} />
              Built by Chargeback recovery
            </span>
            <span>·</span>
            <span>{fx(d) ? `${FX.WEEK} · all apps` : scopeLabel(d.config)}</span>
            <span>·</span>
            <span>{d.sample ? "Taco Pros, 34 outlets" : `Updated ${d.updated}`}</span>
          </div>
          {d.sample && <SampleBanner what="chargebacks" />}
          {fx(d) ? (
            <MasaChargebacks />
          ) : d.config.widgets.length === 0 ? (
            <p className="py-16 text-center text-body-md text-(--color-text-secondary)">Nothing on this dashboard. Ask in the chat to add totals, a weekly chart, outlets or reasons.</p>
          ) : (
            d.config.widgets.map((w) =>
              // Sample data can't be changed, so its cards can't be pointed at.
              d.sample ? (
                <Widget key={w} id={w} data={data} topN={d.config.topN} />
              ) : (
                <Pointable key={w} title={widgetTitle(w)} on={pointed?.dash === d.id && pointed.widget === w} onPoint={() => point(w)}>
                  <Widget id={w} data={data} topN={d.config.topN} askWhy />
                </Pointable>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}

/** A pointed-at card as a chip: in the composer (with remove) and on the message it was sent with. */
export function CardChip({ r, onRemove, className }: { r: CardRef; onRemove?: () => void; className?: string }) {
  const { dashboards, setCanvas } = useAgents();
  const d = r.dash ? dashboards.find((x) => x.id === r.dash) : undefined;
  const from = r.report ? REPORTS[r.report].title : d?.title;
  const reopen = () => (r.report ? setCanvas(r.report) : d && setCanvas(`dash:${d.id}`));
  const label = (
    <>
      <span className="grid size-5 shrink-0 place-items-center rounded-small bg-(--module-tint) text-(--module-strong)">
        <MessageSquarePlus className="size-3" aria-hidden />
      </span>
      <span className="truncate font-medium">{r.title}</span>
      {from && <span className="shrink-0 text-(--color-text-secondary)">· {from}</span>}
    </>
  );
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) py-1 pl-1 text-body-sm text-(--color-text-primary)", onRemove ? "pr-1" : "pr-2.5", className)}>
      {onRemove ? (
        <span className="flex min-w-0 items-center gap-1.5">{label}</span>
      ) : (
        <button type="button" onClick={reopen} title="Open it" className="flex min-w-0 items-center gap-1.5 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          {label}
        </button>
      )}
      {onRemove && (
        <button type="button" aria-label={`Remove ${r.title}`} onClick={onRemove} className="grid size-6 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </span>
  );
}

/** The chat card for a dashboard: opens it in the canvas. */
export function DashboardCard({ d }: { d: Dashboard }) {
  const { canvas, setCanvas } = useAgents();
  const on = canvas === `dash:${d.id}`;
  return (
    <button
      type="button"
      onClick={() => setCanvas(on ? null : `dash:${d.id}`)}
      aria-pressed={on}
      className={cn("flex w-full max-w-sm items-center gap-3 rounded-large border bg-(--color-background-secondary) p-2.5 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", on ? "border-(--module-line) bg-(--module-soft)" : "border-(--color-border-default) hover:border-(--color-border-darker)")}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-(--module-tint) text-(--module-strong)">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="currentColor">
          <rect x="1" y="1" width="6" height="8" rx="1.5" />
          <rect x="9" y="1" width="6" height="5" rx="1.5" />
          <rect x="1" y="11" width="6" height="4" rx="1.5" />
          <rect x="9" y="8" width="6" height="7" rx="1.5" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-body-md font-medium text-(--color-text-primary)">
          {d.title}
          {d.pinned && <Pin className="size-3 text-(--color-text-secondary)" aria-label="Pinned" />}
        </span>
        <span className="block truncate text-body-sm text-(--color-text-secondary)">
          {fx(d) ? `${FX.WEEK} · ${FX.FX_OUTLETS.length} outlets · all apps` : <>{d.sample ? "Sample · " : ""}Dashboard · {d.config.widgets.length} {d.config.widgets.length === 1 ? "block" : "blocks"} · {scopeLabel(d.config)}</>}
        </span>
      </span>
      {/* Open: it points across at the sheet it opened. */}
      <span className="inline-flex shrink-0 items-center gap-1 pr-1 text-body-sm text-(--color-text-clickable)">
        {on ? "Viewing" : "Open"}
        {on && <ArrowRight className="size-3.5" aria-hidden />}
      </span>
    </button>
  );
}

/** The chat card confirming a schedule set in the conversation. */
export function AutomationCard({ a, title, runs = "Chargeback recovery", kind = "dashboard" }: { a: Automation; title: string; runs?: string; kind?: "dashboard" | "report" }) {
  const rows = [
    { k: "When", v: a.schedule },
    { k: "Runs", v: runs },
    ...(a.email ? [{ k: "Emails", v: user.email }] : []),
    ...(a.dashboard ? [{ k: "Updates", v: `${title}${kind === "dashboard" ? " dashboard" : ""} (pinned)` }] : []),
  ];
  return (
    <dl className="max-w-sm divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
      <div className="flex items-center gap-2 px-3 py-2 text-body-sm font-medium text-(--color-text-primary)">
        <CalendarClock className="size-3.5 text-(--module-strong)" aria-hidden />
        Automation on
      </div>
      {rows.map((r) => (
        <div key={r.k} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm">
          <dt className="text-(--color-text-secondary)">{r.k}</dt>
          <dd className="truncate text-(--color-text-primary)">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
