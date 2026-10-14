"use client";
import Image from "next/image";
import { Eye, Info, Send } from "lucide-react";
import { MvpFrame, useTab } from "@/components/mvp/frame";
import { DashCard, CardTitle } from "@/components/dashboard/parts";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";
import { type DashboardData } from "@/lib/sources/dashboard";
import { briefFor, insightsFor, scopeFor, storeRows, type Brief, type Insight } from "@/lib/sources/overview";
import { forPage } from "@/lib/mvp/insights";
import { useOnboarding } from "@/lib/org/store";
import { DEFAULT_PREFS, SECTIONS, TIMES, WEEKDAYS, scheduleLabel, updatePrefs, useBriefPrefs, type BriefPrefs, type BriefSection } from "@/lib/brief/prefs";
import { fmtCents as fmt, locations, user } from "@/lib/mockData";
import { PERIOD } from "@/lib/period";

// MVP / Weekly brief: the same brief Overview shows, as it will land by email and on WhatsApp,
// and how the owner wants it delivered. Nothing is sent from here: KoreFi sets delivery up.

const TABS = [
  { key: "preview", label: "Preview", Icon: Eye },
  { key: "delivery", label: "Delivery", Icon: Send },
] as const;

/** Which report each line of the brief belongs to, so "Include" can hide it. */
const NOTE_SECTION: Record<string, BriefSection> = { "Money in": "payouts", "Paid to you": "payouts", "By store": "payouts", Sales: "profit", "App sales": "profit" };

type Block = { section: BriefSection; label: string; text: string; lines?: string[] };

/** The brief's content as blocks, in the order both previews use. */
function blocks(brief: Brief, insights: Insight[], prefs: BriefPrefs): Block[] {
  const out: Block[] = brief.note.map((n) => ({ section: NOTE_SECTION[n.label] ?? "profit", ...n }));
  const chargeback = forPage(insights, "chargebacks", 1)[0];
  if (chargeback) out.push({ section: "chargebacks", label: "Chargebacks", text: chargeback.title, lines: [chargeback.line] });
  const promo = forPage(insights, "promos", 1)[0];
  if (promo) out.push({ section: "promos", label: "Promos", text: promo.title, lines: [promo.line] });
  return out.filter((b) => prefs.include[b.section]);
}

const EMOJI: Record<BriefSection, string> = { profit: "📈", payouts: "💰", chargebacks: "🛡️", promos: "🏷️" };

function EmailPreview({ brief, items, to }: { brief: Brief; items: Block[]; to: string }) {
  return (
    <div className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
      <div className="space-y-0.5 border-b border-(--color-border-default) bg-(--color-neutral-lightest) px-4 py-3 text-body-sm text-(--color-text-secondary)">
        <p><span className="inline-block w-12">From</span> KoreFi &lt;brief@korefi.com&gt;</p>
        <p><span className="inline-block w-12">To</span> {to || "you"}</p>
        <p className="text-(--color-text-primary)"><span className="inline-block w-12 text-(--color-text-secondary)">Subject</span> {brief.headline}</p>
      </div>
      <div className="mx-auto max-w-[520px] px-6 py-6">
        <Image src={asset("/dashboard/korefi-logo.svg")} alt="KoreFi" width={84} height={20} unoptimized className="[.dark_&]:invert" />
        <p className="mt-5 text-subtitle-xs tracking-wide text-(--color-text-secondary) uppercase">{brief.eyebrow}</p>
        <h2 className="mt-1.5 text-subtitle-lg leading-[1.35] text-(--color-text-primary)">{brief.headline}</h2>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-large bg-linear-to-r from-(--brand-200) to-(--color-background-secondary) px-4 py-3">
          <span className="text-jumbo-md text-(--color-text-primary) tabular-nums">{fmt(brief.amount)}</span>
          <span className="text-body-md text-(--color-text-secondary)">{brief.amountLabel}</span>
          {brief.change && <span className={cn("ml-auto text-body-sm tabular-nums", brief.change.value >= 0 ? "text-(--color-text-success)" : "text-(--color-text-danger)")}>{brief.change.value >= 0 ? "+" : "−"}{Math.abs(brief.change.value * 100).toFixed(1)}% {brief.change.label}</span>}
        </div>
        {brief.flag && <p className="mt-3 inline-flex h-6 items-center rounded-small bg-(--color-warning-lightest) px-2 text-body-sm text-(--color-warning-darkest)">{brief.flag} · KoreFi is on it</p>}
        <dl className="mt-5 divide-y divide-(--color-border-default)">
          {items.map((b) => (
            <div key={b.label} className="py-3">
              <dt className="text-body-sm text-(--color-text-secondary)">{b.label}</dt>
              <dd className="mt-0.5 text-body-lg text-(--color-text-primary)">{b.text}</dd>
              {b.lines && (
                <ul className="mt-1 space-y-0.5 text-body-md text-(--color-text-secondary)">
                  {b.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </dl>
        <p className="mt-5 text-body-md">
          <span className="inline-flex h-9 items-center rounded-medium bg-(--color-text-primary) px-4 text-(--color-background-secondary)">Open your dashboard</span>
        </p>
        <p className="mt-6 text-body-sm text-(--color-text-tertiary)">You get this every week because KoreFi keeps your books for {locations.length} stores. Reply to reach the team.</p>
      </div>
    </div>
  );
}

function WhatsAppPreview({ brief, items, to }: { brief: Brief; items: Block[]; to: string }) {
  const lines = [
    `*${brief.eyebrow}*`,
    `${fmt(brief.amount)} ${brief.amountLabel}${brief.change ? ` (${brief.change.value >= 0 ? "+" : "−"}${Math.abs(brief.change.value * 100).toFixed(1)}% ${brief.change.label})` : ""}`,
    ...(brief.flag ? [`🛡️ ${brief.flag} — KoreFi is on it`] : []),
    ...items.map((b) => `${EMOJI[b.section]} ${b.label}: ${b.text}${b.lines?.length ? ` — ${b.lines.join(" · ")}` : ""}`),
    "Full brief: korefi.app/mvp",
  ];
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-(--gray-1100) bg-(--color-neutral-lightest) shadow-[0_12px_32px_rgb(0_0_0/0.14)]">
      <div className="flex items-center gap-2.5 bg-(--gray-1100) px-4 py-3 text-white">
        <span className="grid size-8 place-items-center rounded-circle bg-white text-[10px] font-semibold text-(--gray-1100)">KF</span>
        <span className="min-w-0">
          <span className="block text-body-md font-medium">KoreFi</span>
          <span className="block truncate text-[11px] opacity-70">to {to || "you"}</span>
        </span>
      </div>
      <div className="space-y-2 px-3 py-4">
        {lines.map((l, i) => (
          <p key={i} className={cn("max-w-[88%] rounded-large rounded-tl-small bg-(--color-background-secondary) px-3 py-2 text-body-md text-(--color-text-primary) shadow-[0_1px_1px_rgb(0_0_0/0.06)]", i === 0 && "font-medium")}>
            {l.replace(/^\*|\*$/g, "")}
          </p>
        ))}
        <p className="pr-1 text-right text-[11px] text-(--color-text-tertiary)">{scheduleLabelShort()}</p>
      </div>
    </div>
  );
}

const scheduleLabelShort = () => new Date(`${PERIOD.end}T08:00:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function BriefView({ data }: { data: DashboardData }) {
  const active = useTab(TABS);
  const { prefs, ready } = useBriefPrefs();
  const { state } = useOnboarding();
  const scope = scopeFor(undefined, locations);
  const rows = storeRows(data, scope);
  const brief = briefFor(data, scope, rows);
  const insights = insightsFor(data, scope, rows);
  const items = blocks(brief, insights, ready ? prefs : DEFAULT_PREFS);
  const phone = prefs.phone || state.account.phone;
  const email = prefs.emailAddress || state.account.email || user.email;
  const set = (change: Partial<BriefPrefs>) => updatePrefs(change);

  return (
    <MvpFrame title="Weekly brief" tabs={TABS} active={active} basePath="/mvp/brief">
      {active === "preview" && (
        <>
          <p className="flex items-start gap-2 rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest) px-4 py-3 text-body-md text-(--color-text-secondary)">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              This is the brief for {PERIOD.range}, as it goes out {scheduleLabel(prefs)}
              {prefs.whatsapp && prefs.email ? " by email and on WhatsApp" : prefs.email ? " by email" : prefs.whatsapp ? " on WhatsApp" : ""}. Change what it covers under Delivery.
            </span>
          </p>
          <div className={cn("grid gap-6", prefs.whatsapp && prefs.email && "xl:grid-cols-[3fr_2fr]")}>
            {prefs.email && (
              <section aria-label="Email preview" className="min-w-0">
                <h2 className="mb-2 text-subtitle-md text-(--color-text-primary)">Email</h2>
                <EmailPreview brief={brief} items={items} to={email} />
              </section>
            )}
            {prefs.whatsapp && (
              <section aria-label="WhatsApp preview" className="min-w-0">
                <h2 className="mb-2 text-subtitle-md text-(--color-text-primary)">WhatsApp</h2>
                <WhatsAppPreview brief={brief} items={items} to={phone} />
              </section>
            )}
            {!prefs.whatsapp && !prefs.email && <p className="rounded-large border border-(--color-border-default) px-5 py-8 text-center text-body-md text-(--color-text-secondary)">Both channels are off. Turn one on under Delivery to see the brief.</p>}
          </div>
        </>
      )}

      {active === "delivery" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <DashCard>
            <CardTitle title="Where it goes" />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">KoreFi sends the brief {scheduleLabel(prefs)}, {PERIOD.timezoneNote}.</p>
            <div className="mt-5 space-y-5">
              <div className="space-y-3">
                <Checkbox label="WhatsApp" checked={prefs.whatsapp} onChange={(e) => set({ whatsapp: e.target.checked })} />
                <TextField label="WhatsApp number" value={prefs.phone} placeholder={state.account.phone || "+1 (312) 555-0100"} disabled={!prefs.whatsapp} onChange={(e) => set({ phone: e.target.value })} hint={!prefs.phone && state.account.phone ? `Using ${state.account.phone} from your account` : undefined} />
              </div>
              <div className="space-y-3">
                <Checkbox label="Email" checked={prefs.email} onChange={(e) => set({ email: e.target.checked })} />
                <TextField label="Email address" type="email" value={prefs.emailAddress} placeholder={state.account.email || user.email} disabled={!prefs.email} onChange={(e) => set({ emailAddress: e.target.value })} hint={!prefs.emailAddress ? `Using ${state.account.email || user.email} from your account` : undefined} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Day" value={prefs.day} options={WEEKDAYS} onChange={(e) => set({ day: e.target.value as BriefPrefs["day"] })} />
                <Select label="Time" value={prefs.time} options={TIMES.map((t) => ({ value: t, label: new Date(`2026-01-05T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }))} onChange={(e) => set({ time: e.target.value })} />
              </div>
            </div>
          </DashCard>
          <DashCard>
            <CardTitle title="What it covers" />
            <p className="mt-1 text-body-sm text-(--color-text-secondary)">Each section is one line in the brief, with the detail on its report.</p>
            <ul className="mt-5 space-y-3">
              {SECTIONS.map((s) => (
                <li key={s.key}>
                  <Checkbox
                    checked={prefs.include[s.key]}
                    onChange={(e) => set({ include: { ...prefs.include, [s.key]: e.target.checked } })}
                    label={
                      <span>
                        <span className="block">{s.label}</span>
                        <span className="block text-body-sm text-(--color-text-secondary)">{s.hint}</span>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-start gap-2 text-body-sm text-(--color-text-secondary)">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Saved as you go. KoreFi&apos;s team sets delivery up from these; changes apply from the next brief.
            </p>
          </DashCard>
        </div>
      )}
    </MvpFrame>
  );
}
