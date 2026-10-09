"use client";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { FreshnessStamp } from "@/components/dashboard/primitives";
import { CATALOG } from "@/lib/sources/catalog";
import { type SourceConnection, type SourceGroup, type SourceId } from "@/lib/sources/types";
import { update, useOnboarding } from "@/lib/org/store";
import { ConnectDialog } from "./ConnectDialog";
import { SourceLogo } from "./SourceLogo";

// Integrations page, laid out like Tally's "Discover integrations" (Mobbin reference): a plain,
// borderless three-column grid of logo / name + tag / one-line description / text-link action.
// What is already connected sits in its own grid above. The connect flow keeps the WRITER-style
// "Connecting to X" dialog and an Otter-style toast. Sign-in is simulated. Sources connected during
// onboarding show as connected here; dashboards still read src/lib/sources/connections.ts.

type Flow = { id: SourceId; mode: "connect" | "disconnect" } | null;
type Live = { connected: boolean; status: SourceConnection["status"]; lastSyncedAt: string };
type Item = SourceConnection & Live;

const TAG: Record<SourceGroup, string> = { pos: "POS", accounting: "Accounting", marketplace: "Delivery app", bank: "Bank" };

const linkBtn = "rounded-small text-body-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)";

function Tile({ c, onConnect, onDisconnect }: { c: Item; onConnect: () => void; onDisconnect: () => void }) {
  const status = c.status === "error" ? { dot: "bg-(--color-danger-default)", text: "Needs attention", tone: "text-(--color-text-danger)" } : c.status === "syncing" ? { dot: "bg-(--color-info-default)", text: "Syncing", tone: "text-(--color-text-secondary)" } : { dot: "bg-(--color-success-default)", text: "Connected", tone: "text-(--color-text-success)" };
  return (
    <li className="flex flex-col">
      <SourceLogo id={c.id} name={c.name} />
      <p className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-subtitle-md text-(--color-text-primary)">{c.name}</span>
        <span className="inline-flex h-5 items-center rounded-small bg-(--color-neutral-light) px-1.5 text-body-sm text-(--color-text-secondary)">{TAG[c.group]}</span>
      </p>
      <p className="mt-1 text-body-md text-(--color-text-secondary)">{CATALOG[c.id]?.blurb}</p>
      {c.connected ? (
        <>
          <p className={cn("mt-3 flex items-center gap-1.5 text-body-sm", status.tone)}>
            <span className={cn("size-2 rounded-circle", status.dot)} />
            {status.text}
            {c.status !== "error" && c.lastSyncedAt && (
              <span className="text-(--color-text-secondary)">
                {" · "}
                <FreshnessStamp at={c.lastSyncedAt} />
              </span>
            )}
          </p>
          {c.status === "error" && c.detail && <p className="mt-1 text-body-sm text-(--color-text-danger)">{c.detail}</p>}
          <button type="button" onClick={onDisconnect} className={cn(linkBtn, "mt-2 w-fit text-(--color-text-secondary) hover:text-(--color-text-primary)")}>
            Disconnect
          </button>
        </>
      ) : (
        <button type="button" onClick={onConnect} aria-label={`Connect ${c.name}`} className={cn(linkBtn, "mt-4 w-fit text-(--color-text-clickable) hover:underline")}>
          Connect
        </button>
      )}
    </li>
  );
}

export function IntegrationsClient({ connections }: { connections: SourceConnection[] }) {
  const [live, setLive] = useState<Record<string, Live>>(() => Object.fromEntries(connections.map((c) => [c.id, { connected: c.connected, status: c.status, lastSyncedAt: c.lastSyncedAt }])));
  const [flow, setFlow] = useState<Flow>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const { ready, state } = useOnboarding();

  const items = useMemo<Item[]>(
    () =>
      connections.map((c) => {
        const l = live[c.id];
        // Connected during onboarding, and not touched on this page since.
        const fromOnboarding = ready && !l.connected && !l.lastSyncedAt && state.connected.includes(c.id);
        return { ...c, ...l, ...(fromOnboarding ? { connected: true, status: "syncing" as const } : {}) };
      }),
    [connections, live, ready, state.connected],
  );
  const byId = (id: string) => items.find((c) => c.id === id)!;
  const connected = items.filter((c) => c.connected);
  const available = items.filter((c) => !c.connected);

  const connect = (id: SourceId) => {
    setLive((l) => ({ ...l, [id]: { connected: true, status: "syncing", lastSyncedAt: new Date().toISOString() } }));
    setToast(`Connected ${byId(id).name}. Your first sync has started.`);
    setFlow(null);
  };

  const disconnect = (id: SourceId) => {
    setLive((l) => ({ ...l, [id]: { connected: false, status: "healthy", lastSyncedAt: "" } }));
    update((s) => ({ connected: s.connected.filter((x) => x !== id) }));
    setToast(`Disconnected ${byId(id).name}.`);
    setFlow(null);
  };

  const open = flow ? byId(flow.id) : null;
  const grid = "grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3";
  const tile = (c: Item) => <Tile key={c.id} c={c} onConnect={() => setFlow({ id: c.id, mode: "connect" })} onDisconnect={() => setFlow({ id: c.id, mode: "disconnect" })} />;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 pb-10">
      {connected.length > 0 && (
        <section aria-labelledby="int-connected" className="space-y-6">
          <h2 id="int-connected" className="flex items-center gap-2 text-subtitle-lg text-(--color-text-primary)">
            Connected
            <span className="text-body-md tabular-nums text-(--color-text-secondary)">{connected.length}</span>
          </h2>
          <ul className={grid}>{connected.map(tile)}</ul>
        </section>
      )}

      <section aria-labelledby="int-discover" className="space-y-6">
        <div className="max-w-xl space-y-2">
          <h2 id="int-discover" className="text-subtitle-lg text-(--color-text-primary)">Discover integrations</h2>
          <p className="text-body-md text-(--color-text-secondary)">
            Connect the tools you already use and KoreFi fills in your dashboards. KoreFi only reads from them and never changes anything. Delivery apps like DoorDash, Uber Eats and Grubhub are connected for you by the KoreFi team.
          </p>
        </div>
        {available.length > 0 ? <ul className={grid}>{available.map(tile)}</ul> : <p className="text-body-md text-(--color-text-secondary)">Everything is connected.</p>}
      </section>

      {open && flow && <ConnectDialog key={`${flow.id}-${flow.mode}`} source={open} mode={flow.mode} onClose={() => setFlow(null)} onConnected={() => connect(flow.id)} onDisconnect={() => disconnect(flow.id)} />}

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}

