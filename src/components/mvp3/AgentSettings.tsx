"use client";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { user } from "@/lib/mockData";
import { AGENTS, type AgentId } from "@/lib/mvp3/agents";
import { AgentMark } from "./AgentChat";
import { StatusDot } from "./Mvp3Sidebar";

// MVP 3 / Settings: how each agent reaches the owner. Dots' lesson for restaurants is that a text
// ("3 disputes won, $412 back") beats another dashboard, so each agent picks where and how often it pings.
// Prototype: saved in memory only.

const CHANNELS = ["In app", "SMS", "WhatsApp", "Email"] as const;
type Channel = (typeof CHANNELS)[number];
type Pref = { on: boolean; channels: Channel[]; cadence: string };

const CADENCE = [
  { value: "instant", label: "As soon as something changes" },
  { value: "daily", label: "Daily summary, 8:00 AM" },
  { value: "weekly", label: "Weekly summary, Monday 8:00 AM" },
];

export function AgentSettings() {
  const [prefs, setPrefs] = useState<Record<AgentId, Pref>>({
    finance: { on: true, channels: ["In app", "Email"], cadence: "weekly" },
    operations: { on: true, channels: ["In app", "SMS"], cadence: "instant" },
    growth: { on: true, channels: ["In app"], cadence: "weekly" },
  });
  const [saved, setSaved] = useState(false);
  const dismiss = useCallback(() => setSaved(false), []);
  const patch = (id: AgentId, p: Partial<Pref>) => setPrefs((x) => ({ ...x, [id]: { ...x[id], ...p } }));

  return (
    <>
      <PageHeader title="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] space-y-8 px-4 py-8 sm:px-6">
          <section className="space-y-1">
            <h2 className="text-subtitle-md font-medium text-(--color-text-primary)">Agent updates</h2>
            <p className="text-body-md text-(--color-text-secondary)">Choose where each agent tells you what changed. Agents only report. The KoreFi team handles every dispute and fix.</p>
          </section>

          <ul className="divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default)">
            {AGENTS.map((a) => {
              const p = prefs[a.id];
              return (
                <li key={a.id} className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <AgentMark agent={a.id} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-body-md font-medium text-(--color-text-primary)">
                        {a.name}
                        <StatusDot status={a.status} />
                      </p>
                      <p className="text-body-sm text-(--color-text-secondary)">{a.watches}</p>
                    </div>
                    <Checkbox label="On" checked={p.on} onChange={(e) => patch(a.id, { on: e.target.checked })} />
                  </div>
                  {p.on && (
                    <div className="grid gap-4 pl-10 sm:grid-cols-2">
                      <fieldset className="space-y-2">
                        <legend className="mb-2 text-label-md text-(--color-text-primary)">Send updates to</legend>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {CHANNELS.map((c) => (
                            <Checkbox key={c} label={c} checked={p.channels.includes(c)} onChange={(e) => patch(a.id, { channels: e.target.checked ? [...p.channels, c] : p.channels.filter((x) => x !== c) })} />
                          ))}
                        </div>
                      </fieldset>
                      <Select label="How often" options={CADENCE} value={p.cadence} onChange={(e) => patch(a.id, { cadence: e.target.value })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="space-y-3">
            <h2 className="text-subtitle-md font-medium text-(--color-text-primary)">Where to reach you</h2>
            <dl className="divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default) text-body-md">
              {[
                ["Name", `${user.firstName} ${user.lastName}`],
                ["Email", user.email],
                ["Phone (SMS, WhatsApp)", "(312) 555-0148"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-(--color-text-secondary)">{k}</dt>
                  <dd className="truncate text-(--color-text-primary)">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex justify-end">
            <Button type="primary" size="small" onClick={() => setSaved(true)}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
      <Toast message={saved ? "Settings saved" : null} onDismiss={dismiss} />
    </>
  );
}
