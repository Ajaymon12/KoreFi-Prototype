"use client";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageTabs, type PageTab } from "@/components/shell/PageTabs";

// Every MVP report has the same frame: header (title + scope/period/freshness actions), the
// page's views as tabs, then a scrolling body. Views live in `?tab=` (see PageTabs), read in the
// browser so the pages stay static for the GitHub Pages export.

export type Tab<K extends string = string> = PageTab & { key: K };

/** The current `?tab=`, or the first tab when it is missing or unknown. */
export function useTab<K extends string>(tabs: readonly Tab<K>[]): K {
  const tab = useSearchParams().get("tab");
  return tabs.find((t) => t.key === tab)?.key ?? tabs[0].key;
}

type Props<K extends string> = {
  title: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: readonly Tab<K>[];
  active?: K;
  basePath: string;
  children: React.ReactNode;
};

export function MvpFrame<K extends string>({ title, actions, tabs, active, basePath, children }: Props<K>) {
  return (
    <>
      <PageHeader title={title} actions={actions} />
      {tabs && active && <PageTabs tabs={[...tabs]} active={active} basePath={basePath} />}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
    </>
  );
}

/** The latest sync across the connected sources a page reads from. */
export const latestSync = (connections: { connected: boolean; status: string; lastSyncedAt: string; group?: string }[], group?: string) =>
  connections
    .filter((c) => c.connected && c.status !== "error" && (!group || c.group === group))
    .map((c) => c.lastSyncedAt)
    .sort()
    .at(-1) ?? "";
