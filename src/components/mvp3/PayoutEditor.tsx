"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import * as FX from "@/lib/mvp3/masaFixture";
import type { Channel, PayoutSettings, Workflow } from "@/lib/mvp3/workflows";
import { useAgents } from "./AgentsProvider";
import { useAccount } from "./AccountSwitcher";
import { AgentAvatar } from "./AgentAvatar";
import { focusRing } from "@/components/mvp3/styles";

// Payout reconciliation's edit page (leadership flow 4, 2026-11-20). Two parts, plain controls, not a form builder:
//  A. Settings the owner can change: who gets it (and how), when, and the limit for what the apps keep.
//  B. Instructions: the agent's default prompt, as editable text.
// A preview on the right shows the message the chosen person gets, and follows every change (35% drops the Uber Eats
// flag). Save and Cancel only: no Publish, Test, typed inputs or stages. The other agents keep the WorkflowEditor.
// The preview uses the sample payout week (lib/mvp3/masaFixture), the same figures as Masa Kitchen's email.

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES = ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "12:00 PM", "3:00 PM", "6:00 PM"];
const PEOPLE = [
  { key: "owner", label: "Owner (Jane)", name: "Jane" },
  { key: "finance", label: "Finance manager (Priya)", name: "Priya" },
  { key: "managers", label: "Outlet managers", name: "Damen's manager" },
] as const;
type Person = (typeof PEOPLE)[number]["key"];

export const DEFAULT_INSTRUCTIONS: PayoutSettings["instructions"] = [
  {
    title: "Purpose",
    body: "Checks that every delivery order in your POS was paid by the app, at your plan rate. Flags orders that were missing or paid short, so the KoreFi team can claim them. This is a 2-way check (POS against the apps' reports), so it does not confirm bank deposits.",
  },
  {
    title: "Load the week",
    body: ["Use the order week (Mon–Sun) as the unit, not the payout date.", "Read the delivery orders from your POS (Toast or Square).", "Read each app's report and payout as it arrives: DoorDash Monday, Uber Eats Wednesday, Grubhub daily."].join("\n"),
  },
  {
    title: "Match orders",
    body: ["Match each order by ID.", "Flag orders in the POS but missing from the app's payout.", "Flag orders paid by the app but not rung up in the POS.", "Flag orders paid less than the POS shows."].join("\n"),
  },
  {
    title: "Check fees",
    body: ["Check commission against your plan rate for each app.", "Work out what each app kept (commission, promos, ads, chargebacks) as a share of sales, and flag any app or outlet over your limit.", "Check each payout arrived on its usual day."].join("\n"),
  },
  {
    title: "Don't flag",
    body: ["App sales higher than POS sales because of promos (for example BOGO counted at full price).", "Sales tax the app collects and remits.", "Cancelled or refunded orders that both sides show.", "A Grubhub payout on a 2-week schedule: show it as pending, not unpaid."].join("\n"),
  },
  {
    title: "Report",
    body: ["Email the owner once, when the week is complete (Friday 8 AM).", "Alert sooner only if a payout is missing or far below normal.", "Ask the owner to confirm only orders KoreFi can't verify.", "Carry unpaid orders into later weeks until they're paid."].join("\n"),
  },
];

export const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  people: { owner: { on: true, how: "email" }, finance: { on: true, how: "email" }, managers: { on: false, how: "email" } },
  day: "Friday",
  time: "8:00 AM",
  limit: 30,
  instructions: DEFAULT_INSTRUCTIONS,
};

const field = cn("h-9 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-md text-(--color-text-primary)", focusRing);

export function PayoutEditor({ base }: { base: Workflow }) {
  const router = useRouter();
  const { saveWorkflow } = useAgents();
  const { account } = useAccount();
  const saved = base.payoutSettings ?? DEFAULT_PAYOUT_SETTINGS;
  const [s, setS] = useState<PayoutSettings>(saved);
  const [viewing, setViewing] = useState<Person>("owner");
  const [toast, setToast] = useState<string | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const setPerson = (k: Person, patch: Partial<{ on: boolean; how: Channel }>) => setS((x) => ({ ...x, people: { ...x.people, [k]: { ...x.people[k], ...patch } } }));
  const setSection = (i: number, body: string) => setS((x) => ({ ...x, instructions: x.instructions.map((sec, j) => (j === i ? { ...sec, body } : sec)) }));
  const shown = s.people[viewing].on ? viewing : (PEOPLE.find((p) => s.people[p.key].on)?.key ?? null);

  const save = () => {
    saveWorkflow({ ...base, payoutSettings: s, triggers: [`Every ${s.day}, ${s.time}`, ...base.triggers.filter((t) => !/^Every /.test(t))] });
    setToast("Saved. Applies from the next report.");
  };

  return (
    <section aria-label="Edit Payout reconciliation" className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-(--color-background-secondary)">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--color-border-default) px-3 sm:px-4">
        <IconButton variant="ghost" size="sm" label="Back" tooltip="Back" icon={<ArrowLeft className="size-4" />} onClick={() => router.back()} />
        {base.agent && <AgentAvatar agent={base.agent} size={24} />}
        <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{base.title}</h1>
        <Badge variant={base.state === "live" ? "success" : "neutral"} label={base.state === "live" ? "Live" : "Not live"} />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" label="Cancel" onClick={() => router.back()} />
          <Button size="sm" variant="primary" label="Save" isDisabled={!dirty} onClick={save} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ── A and B: what the owner can change ── */}
        <div className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto flex max-w-[720px] flex-col gap-8 px-6 py-6">
            <section aria-labelledby="h-settings" className="space-y-4">
              <h2 id="h-settings" className="text-subtitle-md font-medium text-(--color-text-primary)">
                Settings
              </h2>
              <div className="divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-background-primary)">
                <Row label="Who gets it">
                  <ul className="space-y-2">
                    {PEOPLE.map((p) => (
                      <li key={p.key} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <label className="flex min-w-[200px] items-center gap-2 text-body-md">
                          <input type="checkbox" checked={s.people[p.key].on} onChange={(e) => setPerson(p.key, { on: e.target.checked })} className="size-4 accent-(--color-primary)" />
                          {p.label}
                        </label>
                        {s.people[p.key].on && (
                          <span role="radiogroup" aria-label={`How ${p.label} gets it`} className="inline-flex rounded-medium border border-(--color-border-default) p-0.5">
                            {(["email", "whatsapp"] as Channel[]).map((c) => (
                              <button
                                key={c}
                                type="button"
                                role="radio"
                                aria-checked={s.people[p.key].how === c}
                                onClick={() => setPerson(p.key, { how: c })}
                                className={cn("inline-flex h-7 items-center gap-1.5 rounded-small px-2.5 text-body-sm", s.people[p.key].how === c ? "bg-(--color-neutral-light) font-medium text-(--color-text-primary)" : "text-(--color-text-secondary)", focusRing)}
                              >
                                {c === "email" ? <Mail className="size-3.5" aria-hidden /> : <MessageCircle className="size-3.5" aria-hidden />}
                                {c === "email" ? "Email" : "WhatsApp"}
                              </button>
                            ))}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Row>
                <Row label="When">
                  <div className="flex flex-wrap items-center gap-2 text-body-md">
                    Every
                    <select aria-label="Day" value={s.day} onChange={(e) => setS((x) => ({ ...x, day: e.target.value }))} className={field}>
                      {DAYS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                    at
                    <select aria-label="Time" value={s.time} onChange={(e) => setS((x) => ({ ...x, time: e.target.value }))} className={field}>
                      {TIMES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </Row>
                <Row label="Flag when the apps keep more than">
                  <label className="flex items-center gap-2 text-body-md">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={s.limit}
                      onChange={(e) => setS((x) => ({ ...x, limit: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                      className={cn(field, "w-20 text-right tabular-nums")}
                      aria-label="Limit, percent of sales"
                    />
                    % of sales
                  </label>
                </Row>
              </div>
            </section>

            <section aria-labelledby="h-instructions" className="space-y-4">
              <div>
                <h2 id="h-instructions" className="text-subtitle-md font-medium text-(--color-text-primary)">
                  Instructions
                </h2>
                <p className="mt-1 text-body-sm text-(--color-text-secondary)">What the agent follows on every run. Edit any line.</p>
              </div>
              <div className="space-y-4 rounded-large border border-(--color-border-default) bg-(--color-background-primary) p-5">
                {s.instructions.map((sec, i) => (
                  <label key={sec.title} className="block">
                    <span className="text-body-md font-semibold text-(--color-text-primary)">{sec.title}</span>
                    <textarea
                      value={i === 0 ? sec.body : sec.body.split("\n").map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n")}
                      onChange={(e) => setSection(i, i === 0 ? e.target.value : e.target.value.split("\n").map((l) => l.replace(/^-\s?/, "")).join("\n"))}
                      rows={1}
                      className="mt-1 block w-full resize-none field-sizing-content rounded-small px-1.5 py-1 text-body-md leading-6 text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus:bg-(--color-neutral-lightest)"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* ── the preview: what the chosen person gets ── */}
        <aside aria-label="Preview" className="shrink-0 border-t border-(--color-border-default) bg-(--color-neutral-lightest) lg:w-[min(46%,520px)] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="mr-1 text-body-sm font-medium text-(--color-text-secondary)">Preview for</p>
              {PEOPLE.filter((p) => s.people[p.key].on).map((p) => (
                <button key={p.key} type="button" aria-pressed={shown === p.key} onClick={() => setViewing(p.key)} className={cn("h-7 rounded-circle border px-3 text-body-sm", shown === p.key ? "border-(--color-text-primary) bg-(--color-background-secondary) font-medium" : "border-(--color-border-default) text-(--color-text-secondary)", focusRing)}>
                  {p.label}
                </button>
              ))}
            </div>
            {shown ? <Preview who={shown} how={s.people[shown].how} s={s} restaurant={account.name} /> : <p className="text-body-md text-(--color-text-secondary)">No one gets it. Tick someone under Who gets it.</p>}
          </div>
        </aside>
      </div>
      <Toast message={toast} onDismiss={dismiss} />
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-start">
      <p className="pt-1.5 text-body-md font-medium text-(--color-text-primary)">{label}</p>
      <div className="min-w-0 pt-1">{children}</div>
    </div>
  );
}

/** The message one person gets, from the sample payout week. The Uber Eats flag shows only while 34% is over the limit. */
function Preview({ who, how, s, restaurant }: { who: Person; how: Channel; s: PayoutSettings; restaurant: string }) {
  const ue = FX.PAY[1];
  const flag = FX.kept(ue) > s.limit;
  const person = PEOPLE.find((p) => p.key === who)!;
  const when = `${s.day.slice(0, 3)}, ${s.time}`;
  const outlet = who === "managers";
  const damen = FX.UNMATCHED.find((u) => u.outlet === "Damen")!;
  const lead = outlet
    ? `Here are Damen's delivery payouts for ${FX.WEEK}. 1 order in Toast (${FX.usd2(damen.amount)}) wasn't paid, and KoreFi has claimed it.`
    : `All three apps have paid for ${FX.WEEK}. You received ${FX.usd0(FX.PAID)} on ${FX.usd0(FX.PAY_SALES)} of sales, ${FX.usd0(FX.PAID_UP)} more than last week. ${FX.ORDERS.unpaid} orders in Toast (${FX.usd2(FX.UNPAID)}) were not paid. We've claimed 3, and 1 needs your answer.`;
  const look = `Uber Eats kept ${FX.kept(ue)}%, over your ${s.limit}% limit. Promos and ads took ${FX.usd0(ue.promos + ue.ads)}.`;
  const subject = outlet ? `Damen payouts, ${FX.WEEK}: 1 order not paid` : `${restaurant} payouts, ${FX.WEEK}: ${FX.usd0(FX.PAID)} paid · ${FX.ORDERS.unpaid} orders not paid`;
  const cells = useMemo(
    () => [
      { label: "Paid to you", value: FX.usd0(FX.PAID), sub: `▲ ${FX.usd0(FX.PAID_UP)} vs last week` },
      { label: "Kept by the apps", value: FX.KEPT_ALL, sub: `your limit is ${s.limit}%` },
      { label: "Not paid yet", value: FX.usd2(FX.UNPAID), sub: `${FX.ORDERS.unpaid} orders` },
    ],
    [s.limit],
  );

  if (how === "whatsapp")
    return (
      <div className="rounded-large bg-[#e7ddd3] p-4">
        <p className="mb-2 text-center text-body-sm text-[#54656f]">WhatsApp · {when}</p>
        <div className="ml-auto max-w-[88%] space-y-2 rounded-large rounded-tr-small bg-white px-3 py-2 text-body-md text-[#111b21] shadow-sm">
          <p>Hi {person.name.replace("'s manager", "")}, {lead}</p>
          {!outlet && flag && <p>⚠️ {look}</p>}
          <p className="text-[#027eb5] underline">Open in KoreFi</p>
        </div>
      </div>
    );

  return (
    <article className="overflow-hidden rounded-large border border-(--color-border-default) bg-white text-(--color-text-primary) shadow-sm">
      <header className="space-y-0.5 border-b border-(--color-border-default) px-4 py-3">
        <h3 className="text-body-md font-semibold">{subject}</h3>
        <p className="text-body-sm text-(--color-text-secondary)">
          KoreFi &lt;reports@korefi.com&gt; to {person.name} · {when}
        </p>
      </header>
      <div className="space-y-3 px-4 py-4 text-body-md">
        <p>
          Hi {outlet ? "Damen team" : person.name},
          <br />
          {lead}
        </p>
        {!outlet && (
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-border-default)">
            {cells.map((c) => (
              <div key={c.label} className="min-w-0 bg-white px-2.5 py-2">
                <dt className="truncate text-body-sm text-(--color-text-secondary)">{c.label}</dt>
                <dd className="text-subtitle-md font-medium tabular-nums">{c.value}</dd>
                <dd className="truncate text-body-sm text-(--color-text-secondary)">{c.sub}</dd>
              </div>
            ))}
          </dl>
        )}
        {!outlet && flag && (
          <section aria-label="Needs a look" className="space-y-1">
            <h4 className="font-semibold">Needs a look</h4>
            <p>{look}</p>
          </section>
        )}
        {!outlet && !flag && <p className="text-(--color-text-secondary)">No app kept more than your {s.limit}% limit.</p>}
        <p>
          <span className="inline-flex h-8 items-center rounded-medium bg-(--color-primary) px-3 text-body-sm font-medium text-white">Open in KoreFi</span>
          <span className="ml-2 text-body-sm text-(--color-text-secondary)">· Excel attached</span>
        </p>
      </div>
    </article>
  );
}
