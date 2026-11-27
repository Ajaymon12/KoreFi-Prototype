"use client";
import Link from "next/link";
import { CalendarClock, ChevronRight, FileText, LayoutDashboard } from "lucide-react";
import { REPORTS, payoutCheck, weeklyPnl } from "@/lib/mvp3/agents";
import { dashData, scopeLabel, type Dashboard } from "@/lib/mvp3/dashboards";
import { useAgents } from "./AgentsProvider";
import { useOpenPinned } from "./Mvp3Sidebar";

// The chat home's summary of the pinned dashboards, for a restaurant whose dashboards the KoreFi team pinned
// (Masa Kitchen, Account.teamPinned). Shown before any chat is started: each card gives the dashboard's headline
// from its latest update, and opens it in its chat with the dashboard beside it. Report-only.

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The headline and one line under it, from the same figures the dashboard shows. */
function summary(d: Dashboard): { headline: string; sub: string } {
  if (d.report === "payouts") {
    const r = payoutCheck();
    return { headline: r.title, sub: `${r.stats?.[0]?.value ?? ""} matched last week` };
  }
  if (d.report === "pnl") {
    const r = weeklyPnl();
    return { headline: r.title, sub: r.stats?.map((s) => `${s.label} ${s.value}`).slice(0, 2).join(" · ") ?? "" };
  }
  if (d.report) return { headline: REPORTS[d.report].title, sub: REPORTS[d.report].sub };
  const k = dashData(d.config).kpis;
  return { headline: `${usd(k.won)} won back`, sub: `${usd(k.open)} still being disputed · ${scopeLabel(d.config)}` };
}

export function PinnedSummary() {
  const { dashboards } = useAgents();
  const openPinned = useOpenPinned();
  const pinned = dashboards.filter((d) => d.pinned);
  if (!pinned.length) return null;
  const byTeam = pinned.every((d) => d.pinnedBy === "team");
  return (
    <section aria-labelledby="pinned-h" className="space-y-2.5">
      <h2 id="pinned-h" className="text-body-sm text-(--color-text-secondary)">
        {byTeam ? "Your dashboards, pinned by the KoreFi team" : "Your dashboards"}
      </h2>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {pinned.map((d) => {
          const s = summary(d);
          const Icon = d.report ? FileText : LayoutDashboard;
          return (
            <li key={d.id}>
              <Link
                href={`/dashboard?id=${d.id}`}
                onClick={(e) => openPinned(d.id) && e.preventDefault()}
                className="group flex h-full flex-col gap-2 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-4 text-left outline-none transition-[border-color,box-shadow] hover:border-(--color-border-darker) hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
              >
                <span className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
                  <Icon aria-hidden className="size-4" />
                  <span className="min-w-0 flex-1 truncate font-medium text-(--color-text-primary)">{d.title}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-(--color-text-tertiary) group-hover:text-(--color-text-secondary)" />
                </span>
                <span className="text-subtitle-md font-medium text-(--color-text-primary)">{s.headline}</span>
                <span className="line-clamp-2 text-body-sm text-(--color-text-secondary)">{s.sub}</span>
                <span className="mt-auto flex items-center gap-1 pt-1 text-body-sm text-(--color-text-tertiary)">
                  <CalendarClock aria-hidden className="size-3.5" />
                  Updated {d.updated}
                  {d.automation && <> · {d.automation.schedule}</>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
