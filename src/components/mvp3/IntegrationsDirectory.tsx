"use client";
import { usePath } from "@/lib/mvp3/usePath";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, ChevronRight, Clock, Lock, Search, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/shell/PageHeader";
import { CountTabs } from "@/components/ui/CountTabs";
import { Toast } from "@/components/ui/Toast";
import { FreshnessStamp } from "@/components/dashboard/primitives";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { ConnectDialog } from "@/components/integrations/ConnectDialog";
import { CATALOG } from "@/lib/sources/catalog";
import type { SourceConnection, SourceGroup, SourceId } from "@/lib/sources/types";
import { update, useOnboarding } from "@/lib/org/store";
import { user } from "@/lib/mockData";
import { FOLDERS } from "@/lib/mvp3/agents";
import { AgentAvatar } from "./AgentAvatar";
import { useAgents } from "./AgentsProvider";
import { BrandMark } from "./BrandMark";
import { AppCard, EmailCard, GUIDE, emailsFor, useOnboarding as useFirstVisit, type App } from "./Onboarding";
import { dialogSurface, scrim } from "@/components/mvp3/styles";

// MVP 3 / Integrations, after ChatGPT's Apps directory and its "Connecting to Figma" flow (Mobbin):
//  list   — title, search, category pills (Featured first: QuickBooks and the POS systems), two-column rows;
//  detail — ?app=quickbooks: breadcrumb, logo, name, description, Information table;
//  connect— Connect → the page button turns to "Loading" while a consent dialog opens ("Use QuickBooks in KoreFi":
//           gradient header with both logos, Connect ↗ / Not now, a toggle and three short disclosures) →
//           Connect ↗ opens the provider's authorize window (account, which locations, read-only permissions,
//           Authorize / Cancel) → back on the page a green "QuickBooks is now connected" toast drops in at the top
//           and the button becomes a settings gear (Disconnect lives there). Chats start from the chat, not here.
// Delivery apps (DoorDash, Uber Eats, Grubhub) are listed too, but they have no sign-in: Connect opens the same steps as
// the welcome chat (copy the KoreFi email → add it as a user in the merchant portal → "I've added it"), then the app shows
// "KoreFi is verifying" until the team confirms access. A new sign-up sees what it did in the welcome chat; "Log in"
// keeps the seeded account where all three are connected.
// Sign-in is simulated; connections live in this page's state (and the onboarding store for disconnects).

type Live = { connected: boolean; status: SourceConnection["status"]; lastSyncedAt: string; pending?: boolean };
type Item = SourceConnection & Live;
type Tab = "featured" | "all" | "connected" | SourceGroup;
type Step = "consent" | "authorize" | "finishing" | "add" | null;

/** The delivery apps lead (the agents need them first), then QuickBooks and the POS systems. */
const ORDER: SourceId[] = ["doordash", "ubereats", "grubhub", "quickbooks", "square", "toast", "clover", "xero", "zoho", "mercury"];
const FEATURED = new Set<SourceId>(["doordash", "ubereats", "grubhub", "quickbooks", "square"]);
const isApp = (id: SourceId): id is App => id === "doordash" || id === "ubereats" || id === "grubhub";
const TABS: { id: Tab; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "all", label: "All" },
  { id: "marketplace", label: "Delivery apps" },
  { id: "pos", label: "POS" },
  { id: "accounting", label: "Accounting" },
  { id: "bank", label: "Bank" },
  { id: "connected", label: "Connected" },
];
const CATEGORY: Record<SourceGroup, string> = { pos: "Point of sale", accounting: "Accounting", marketplace: "Delivery app", bank: "Bank" };
/** Where each provider's sign-in lives, for the authorize window's address bar. */
const AUTH_HOST: Partial<Record<SourceId, string>> = {
  quickbooks: "appcenter.intuit.com/connect/oauth2",
  square: "squareup.com/oauth2/authorize",
  toast: "pos.toasttab.com/oauth/authorize",
  clover: "www.clover.com/oauth/authorize",
  xero: "login.xero.com/identity/connect/authorize",
  zoho: "accounts.zoho.com/oauth/v2/auth",
  mercury: "app.mercury.com/oauth/authorize",
};
const OUTLETS = 34;

const info = (c: SourceConnection) => CATALOG[c.id] ?? { blurb: "", reads: [] as string[] };
/** The name an agent's skill uses for this source (skills list access as "POS", "Payroll", …). */
const accessKey = (c: SourceConnection) => (c.group === "pos" ? "POS" : c.group === "accounting" ? "Inventory and supplier bills" : c.name);
const skillsUsing = (c: SourceConnection) => FOLDERS.flatMap((f) => f.skills.filter((s) => s.access.includes(accessKey(c))).map((s) => ({ ...s, agent: f.agent })));

function KoreFiMark({ size = 48 }: { size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-large bg-(--color-primary) font-medium text-(--color-text-inverse-primary)" style={{ width: size, height: size, fontSize: size * 0.46 }}>
      K
    </span>
  );
}

function StatusLine({ c }: { c: Item }) {
  if (c.pending)
    return (
      <span className="inline-flex items-center gap-1.5 text-body-sm whitespace-nowrap text-(--color-text-secondary)">
        <Clock className="size-3.5" aria-hidden />
        KoreFi is verifying
      </span>
    );
  if (!c.connected) return null;
  const s = c.status === "error" ? { dot: "bg-(--color-danger-default)", text: "Needs attention", tone: "text-(--color-text-danger)" } : c.status === "syncing" ? { dot: "bg-(--color-info-default)", text: "Syncing", tone: "text-(--color-text-secondary)" } : { dot: "bg-(--color-success-default)", text: "Connected", tone: "text-(--color-text-success)" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-body-sm whitespace-nowrap", s.tone)}>
      <span className={cn("size-1.5 rounded-circle", s.dot)} />
      {s.text}
    </span>
  );
}

export function IntegrationsDirectory({ connections }: { connections: SourceConnection[] }) {
  const router = useRouter();
  const path = usePath();
  const appId = useSearchParams().get("app");
  const shown = useMemo(() => [...connections].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)), [connections]);
  const onboarding = useFirstVisit();
  // A new sign-up's delivery apps start where the welcome chat left them; everything else is the seeded account.
  const [live, setLive] = useState<Record<string, Live>>(() =>
    Object.fromEntries(
      shown.map((c) => [
        c.id,
        onboarding.isNew && isApp(c.id) ? { connected: false, status: "healthy", lastSyncedAt: "", pending: onboarding.apps[c.id] === "verifying" } : { connected: c.connected, status: c.status, lastSyncedAt: c.lastSyncedAt },
      ]),
    ),
  );
  const [step, setStep] = useState<Step>(null);
  const [leaving, setLeaving] = useState<SourceId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const { ready, state } = useOnboarding();

  const items = useMemo<Item[]>(
    () =>
      shown.map((c) => {
        const l = live[c.id];
        // Connected during onboarding, and not touched on this page since.
        const fromOnboarding = ready && !l.connected && !l.lastSyncedAt && state.connected.includes(c.id);
        return { ...c, ...l, ...(fromOnboarding ? { connected: true, status: "syncing" as const } : {}) };
      }),
    [shown, live, ready, state.connected],
  );
  const selected = appId ? items.find((c) => c.id === appId) : undefined;

  // Authorize → a beat of "Loading" on the page → connected, with the toast up top.
  const finish = (c: Item) => {
    setStep("finishing");
    setTimeout(() => {
      setLive((l) => ({ ...l, [c.id]: { connected: true, status: "syncing", lastSyncedAt: new Date().toISOString() } }));
      setStep(null);
      setToast(`${c.name} is now connected`);
    }, 900);
  };
  /** A delivery app: the owner says they added the KoreFi user; the team verifies it. */
  const addedUser = (c: Item) => {
    if (!isApp(c.id)) return;
    setLive((l) => ({ ...l, [c.id]: { connected: false, status: "healthy", lastSyncedAt: "", pending: true } }));
    onboarding.setApp(c.id, "verifying");
    setStep(null);
    setToast(`Thanks. KoreFi is verifying ${c.name} access`);
  };
  const disconnect = (c: Item) => {
    setLive((l) => ({ ...l, [c.id]: { connected: false, status: "healthy", lastSyncedAt: "" } }));
    if (isApp(c.id)) onboarding.setApp(c.id, "todo");
    update((s) => ({ connected: s.connected.filter((x) => x !== c.id) }));
    setLeaving(null);
    setToast(`${c.name} is disconnected`);
  };

  // Same top bar as every other /mvp3 page (Home, Agents, Settings); the page's own heading sits below it.
  return (
    <>
    <PageHeader title="Integrations" />
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {selected ? (
        <Detail c={selected} busy={step !== null && step !== "add"} onBack={() => router.push(path)} onConnect={() => setStep(isApp(selected.id) ? "add" : "consent")} onDisconnect={() => setLeaving(selected.id)} />
      ) : (
        <Directory items={items} onOpen={(id) => router.push(`${path}?app=${id}`)} />
      )}

      {selected && step === "add" && isApp(selected.id) && <AddUser c={selected} app={selected.id} restaurant={onboarding.profile.restaurant || "Prairie Taco Co."} onClose={() => setStep(null)} onAdded={() => addedUser(selected)} />}
      {selected && step === "consent" && <Consent c={selected} onClose={() => setStep(null)} onContinue={() => setStep("authorize")} />}
      {selected && step === "authorize" && <Authorize c={selected} onCancel={() => setStep(null)} onAuthorize={() => finish(selected)} />}
      {selected && leaving === selected.id && <ConnectDialog source={selected} mode="disconnect" onClose={() => setLeaving(null)} onDisconnect={() => disconnect(selected)} />}

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
    </>
  );
}

// ───────── List ─────────

function Directory({ items, onOpen }: { items: Item[]; onOpen: (id: SourceId) => void }) {
  const [tab, setTab] = useState<Tab>("featured");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = items
    .filter((c) => (query ? true : tab === "featured" ? FEATURED.has(c.id) : tab === "all" ? true : tab === "connected" ? c.connected : c.group === tab))
    .filter((c) => !query || `${c.name} ${info(c).blurb} ${CATEGORY[c.group]}`.toLowerCase().includes(query));

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-md text-(--color-text-secondary)">Connect your delivery apps, POS and books so your agents can read them. KoreFi only reads, never changes anything.</p>
        <label className="flex h-[34px] w-full items-center gap-2 rounded-medium border border-(--color-border-input) bg-(--color-background-secondary) px-3 text-(--color-text-secondary) focus-within:border-(--color-focus-primary) sm:w-64">
          <Search className="size-4 shrink-0" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations" aria-label="Search integrations" className="min-w-0 flex-1 bg-transparent text-field-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)" />
        </label>
      </div>

      <div className="mt-6">
        <CountTabs
          label="Categories"
          tabs={TABS.map((t) => ({ key: t.id, label: t.label, count: t.id === "connected" ? items.filter((c) => c.connected).length : undefined }))}
          value={tab}
          onChange={(k) => (setTab(k), setQ(""))}
        />
      </div>

      {list.length ? (
        <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onOpen(c.id)} className="group flex w-full items-center gap-3.5 rounded-large px-2 py-3 text-left outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                <BrandMark id={c.id} name={c.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{c.name}</span>
                  <span className="block truncate text-body-sm text-(--color-text-secondary)">{info(c).blurb}</span>
                </span>
                <StatusLine c={c} />
                <ChevronRight className="size-4 shrink-0 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-16 text-center text-body-md text-(--color-text-secondary)">{query ? `No integrations match “${q.trim()}”` : "Nothing connected yet."}</p>
      )}
    </div>
  );
}

// ───────── Detail ─────────

function Detail({ c, busy, onBack, onConnect, onDisconnect }: { c: Item; busy: boolean; onBack: () => void; onConnect: () => void; onDisconnect: () => void }) {
  const router = useRouter();
  const { getWorkflow } = useAgents();
  const skills = skillsUsing(c).map((s) => ({ ...s, state: getWorkflow(s.id)?.state ?? s.state }));
  const { blurb, reads } = info(c);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pt-4 pb-14 sm:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-body-md">
        <button type="button" onClick={onBack} className="rounded-small text-(--color-text-secondary) outline-none hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          Integrations
        </button>
        <ChevronRight className="size-3.5 text-(--color-text-tertiary)" aria-hidden />
        <span className="text-(--color-text-primary)">{c.name}</span>
      </nav>

      <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <BrandMark id={c.id} name={c.name} size={64} />
          <h2 className="mt-4 text-page-title font-medium text-(--color-text-primary)">{c.name}</h2>
          <p className="mt-1 text-body-lg text-(--color-text-secondary)">{blurb}</p>
        </div>
        <div className="flex items-center gap-2">
          {busy ? (
            <Button type="primary" size="small" loading>
              Connecting
            </Button>
          ) : c.connected ? (
            <>
              <div ref={menuRef} className="relative">
                <Button size="small" icon={<Settings aria-hidden />} aria-label={`${c.name} settings`} title="Settings" aria-expanded={menu} onClick={() => setMenu((m) => !m)} />
                {menu && (
                  <div role="menu" className="absolute top-10 right-0 z-30 w-56 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in">
                    <p className="px-2.5 pt-1 pb-2 text-body-sm text-(--color-text-secondary)">
                      <StatusLine c={c} />
                      {c.lastSyncedAt && (
                        <>
                          {" · "}
                          <FreshnessStamp at={c.lastSyncedAt} />
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        onDisconnect();
                      }}
                      className="w-full rounded-medium px-2.5 py-2 text-left text-body-md text-(--color-text-danger) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : c.pending ? (
            <span className="inline-flex h-[34px] items-center gap-1.5 rounded-medium bg-(--color-neutral-lightest) px-3 text-body-md text-(--color-text-secondary)">
              <Clock className="size-4" aria-hidden />
              KoreFi is verifying
            </span>
          ) : (
            <Button type="primary" size="small" onClick={onConnect}>
              Connect
            </Button>
          )}
        </div>
      </header>

      {c.status === "error" && c.detail && <p className="mt-4 rounded-large bg-(--color-danger-lightest) px-4 py-3 text-body-md text-(--color-text-danger)">{c.detail}</p>}

      <p className="mt-8 max-w-[68ch] text-body-md leading-relaxed text-(--color-text-secondary)">{c.group === "marketplace" ? (c.pending ? `You added the KoreFi Reports user in ${c.name}. KoreFi is accepting the invite and checking it can see every store, which usually takes about 1 business day. Your agents will message you when the first reports are in.` : `KoreFi reads ${c.name} through a reports-only user you add in its merchant portal. It can't change orders, menus or payouts, and you can remove it from ${c.name} at any time.`) : null}{c.group === "marketplace" ? null : c.connected ? `Your agents read ${c.name} alongside your delivery-app reports.` : `Connect ${c.name} and your agents read it alongside your delivery-app reports.`}{c.group === "marketplace" ? "" : ` KoreFi only reads: it never edits, posts or deletes anything in ${c.name}, and you can disconnect at any time.`}</p>

      <section className="mt-10">
        <h2 className="text-subtitle-md font-medium text-(--color-text-primary)">Information</h2>
        <dl className="mt-3 divide-y divide-(--color-border-default) overflow-hidden rounded-large border border-(--color-border-default) text-body-md">
          {(
            [
              ["Category", CATEGORY[c.group]],
              ["Access", c.group === "marketplace" ? "Read-only user, “KoreFi Reports”" : "Read-only"],
              ["Reads", reads.join(", ")],
              ["Status", c.pending ? "KoreFi is verifying, about 1 business day" : c.connected ? (c.status === "error" ? "Needs attention" : c.status === "syncing" ? "Syncing" : "Connected") : "Not connected"],
              ...(c.connected && c.lastSyncedAt ? [["Last updated", <FreshnessStamp key="t" at={c.lastSyncedAt} />]] : []),
            ] as [string, React.ReactNode][]
          ).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[160px_1fr] gap-4 px-4 py-3">
              <dt className="text-(--color-text-secondary)">{k}</dt>
              <dd className="text-(--color-text-primary)">{v}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[160px_1fr] gap-4 px-4 py-3">
            <dt className="text-(--color-text-secondary)">Used by</dt>
            <dd>
              {skills.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <li key={s.id}>
                      {(
                        <button type="button" onClick={() => router.push(`/agent?id=${s.id}`)} className="inline-flex items-center gap-1.5 rounded-circle border border-(--color-border-default) py-0.5 pr-2.5 pl-0.5 text-body-sm text-(--color-text-primary) outline-none hover:border-(--color-primary) hover:bg-(--color-primary)/8 hover:text-(--color-text-clickable) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                          <AgentAvatar agent={s.agent} size={20} />
                          {s.name}
                          {s.state !== "live" && <span className="text-(--color-text-tertiary)">· {s.state === "idle" ? "not running" : "learning"}</span>}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-(--color-text-secondary)">No agent yet</span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

// ───────── Delivery apps: add the KoreFi user ─────────

/** The welcome chat's steps in a dialog: the email to add, the app's portal and steps, then "I've added it". */
function AddUser({ c, app, restaurant, onClose, onAdded }: { c: Item; app: App; restaurant: string; onClose: () => void; onAdded: () => void }) {
  const emails = useMemo(() => emailsFor(restaurant), [restaurant]);
  const [email, setEmail] = useState(emails[0]);
  const [stuck, setStuck] = useState(false);
  return (
    <Overlay onClose={onClose} label={`Add KoreFi to ${c.name}`}>
      <div className={cn(dialogSurface, "space-y-3 p-5")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-subtitle-lg font-medium text-(--color-text-primary)">Add KoreFi to {c.name}</h2>
            <p className="mt-1 text-body-md text-(--color-text-secondary)">Add this email as a user in {c.name}. It&apos;s a KoreFi inbox that can only read reports.</p>
          </div>
          <Button type="text" size="small" icon={<X aria-hidden />} aria-label="Close" onClick={onClose} />
        </div>
        <EmailCard emails={emails} email={email} onUse={setEmail} />
        <AppCard app={app} state="todo" onAdded={onAdded} onStuck={() => setStuck(true)} />
        {stuck && (
          <p className="rounded-large bg-(--color-neutral-lightest) px-4 py-3 text-body-md text-(--color-text-secondary)">
            That&apos;s common for franchise operators and accountants. Ask whoever owns the {GUIDE[app].name} account to add {email}, or ask {GUIDE[app].name} merchant support to add it as an admin on all your stores.
          </p>
        )}
      </div>
    </Overlay>
  );
}

// ───────── Connect flow ─────────

/** Scrim + Esc/outside-click for the two connect steps. */
function Overlay({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, true, onClose);
  return (
    <div className={cn(scrim, "z-[60] grid place-items-center overflow-y-auto p-4 motion-safe:animate-page-in")}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-[460px]">
        {children}
      </div>
    </div>
  );
}

/** Step 1, "Use X in KoreFi": the consent card. */
function Consent({ c, onClose, onContinue }: { c: Item; onClose: () => void; onContinue: () => void }) {
  const [memory, setMemory] = useState(false);
  const { reads } = info(c);
  return (
    <Overlay onClose={onClose} label={`Use ${c.name} in KoreFi`}>
      <div className={cn(dialogSurface, "overflow-hidden")}>
        <div className="relative border-b border-(--color-border-default) bg-(--color-background-primary) px-6 pt-8 pb-6 text-center">
          <Button type="text" size="small" icon={<X aria-hidden />} aria-label="Close" onClick={onClose} className="absolute top-3 right-3" />
          <div className="flex items-center justify-center gap-3">
            <BrandMark id={c.id} name={c.name} size={48} />
            <span aria-hidden className="h-6 w-px bg-(--color-border-darker)" />
            <KoreFiMark />
          </div>
          <h2 className="mt-5 text-subtitle-lg font-medium text-(--color-text-primary)">Use {c.name} in KoreFi</h2>
          <p className="mt-1 text-body-md text-(--color-text-secondary)">{info(c).blurb}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button type="primary" size="small" iconRight={<ArrowUpRight aria-hidden />} onClick={onContinue}>
              Connect {c.name}
            </Button>
            <Button size="small" onClick={onClose}>
              Not now
            </Button>
          </div>
        </div>

        <div className="space-y-3.5 px-6 py-5 text-body-sm leading-relaxed text-(--color-text-secondary)">
          <div className="flex items-start gap-4">
            <p>
              <span className="font-medium text-(--color-text-primary)">Use past chats.</span> Let your agents look back at earlier chats when they read {c.name}, for more helpful answers.
            </p>
            <button type="button" role="switch" aria-checked={memory} aria-label="Use past chats" onClick={() => setMemory((m) => !m)} className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-circle outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)", memory ? "bg-(--color-primary)" : "bg-(--color-border-darker)")}>
              <span className={cn("absolute top-0.5 size-4 rounded-circle bg-(--color-background-secondary) shadow-sm transition-[left]", memory ? "left-[18px]" : "left-0.5")} />
            </button>
          </div>
          <p>
            <span className="font-medium text-(--color-text-primary)">You’re in control.</span> KoreFi only reads from {c.name}. It never edits, posts or deletes anything, and you can disconnect at any time.
          </p>
          <p>
            <span className="font-medium text-(--color-text-primary)">Only your team sees it.</span> Numbers from {c.name} stay in your KoreFi workspace. They are never shared with other restaurants or used to train models.
          </p>
          <p>
            <span className="font-medium text-(--color-text-primary)">Data shared with this integration.</span> By connecting, you let KoreFi read: {reads.join(", ").toLowerCase()}{c.group === "pos" ? `, for all ${OUTLETS} outlets unless you pick fewer on the next screen` : ""}.
          </p>
        </div>
      </div>
    </Overlay>
  );
}

/** Step 2: the provider's own authorize window (simulated), as GitHub's "Install & Authorize" page in the flow. */
function Authorize({ c, onCancel, onAuthorize }: { c: Item; onCancel: () => void; onAuthorize: () => void }) {
  const [scope, setScope] = useState<"all" | "some">("all");
  const { reads } = info(c);
  const unit = c.group === "pos" ? "locations" : c.group === "accounting" ? "companies" : "accounts";
  return (
    <Overlay onClose={onCancel} label={`Authorize KoreFi on ${c.name}`}>
      <div className="overflow-hidden rounded-large border border-(--color-border-default) bg-white text-[#1f2328] shadow-[0_24px_64px_-12px_rgb(0_0_0/0.35)]">
        {/* the sign-in window's address bar */}
        <div className="flex items-center gap-2 border-b border-black/10 bg-[#f6f8fa] px-3 py-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-circle bg-[#ff5f57]" />
            <span className="size-2.5 rounded-circle bg-[#febc2e]" />
            <span className="size-2.5 rounded-circle bg-[#28c840]" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-small bg-white px-2 py-1 text-[11px] text-[#59636e]">
            <Lock className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{AUTH_HOST[c.id]}?client_id=korefi</span>
          </span>
        </div>

        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center justify-center gap-3">
            <BrandMark id={c.id} name={c.name} size={44} />
            <span aria-hidden className="flex gap-1">
              <span className="size-1 rounded-circle bg-black/25" />
              <span className="size-1 rounded-circle bg-black/25" />
              <span className="size-1 rounded-circle bg-black/25" />
            </span>
            <KoreFiMark size={44} />
          </div>
          <h2 className="mt-4 text-center text-[17px] font-medium">
            Authorize <span className="text-[#0969da]">KoreFi</span>
          </h2>
          <p className="mt-0.5 text-center text-[13px] text-[#59636e]">wants to read your {c.name} data</p>

          <div className="mt-5 rounded-medium border border-black/10 text-[13px]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-2.5">
              <span>
                Signed in as <span className="font-medium">{user.email}</span>
              </span>
              <span className="grid size-6 place-items-center rounded-circle bg-[#1f2328] text-[10px] font-medium text-white">{user.firstName.charAt(0)}</span>
            </div>
            <fieldset className="space-y-2.5 border-b border-black/10 px-3 py-3">
              <legend className="sr-only">Which {unit}</legend>
              <p className="text-[#59636e]">For these {unit}:</p>
              {(
                [
                  ["all", `All ${unit}`, c.group === "pos" ? `Prairie Taco Co. · all ${OUTLETS} outlets, including ones you add later.` : "Everything this sign-in can see, now and later."],
                  ["some", `Only select ${unit}`, "Pick at least one. You can change this later."],
                ] as const
              ).map(([v, t, d]) => (
                <label key={v} className="flex cursor-pointer items-start gap-2">
                  <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} className="mt-0.5 accent-[#0969da]" />
                  <span>
                    <span className="block font-medium">{t}</span>
                    <span className="block text-[12px] text-[#59636e]">{d}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="space-y-1.5 px-3 py-3">
              <p className="text-[#59636e]">With these permissions:</p>
              {reads.map((r) => (
                <p key={r} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#1a7f37]" aria-hidden />
                  <span>
                    <span className="font-medium">Read</span> access to {r.toLowerCase()}
                  </span>
                </p>
              ))}
              <p className="flex items-start gap-2 text-[#59636e]">
                <X className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                No write access. KoreFi can’t change anything.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button type="button" onClick={onAuthorize} className="h-8 rounded-medium bg-[#1f883d] px-4 text-[13px] font-medium text-white outline-none hover:bg-[#1a7f37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0969da]">
              Authorize
            </button>
            <button type="button" onClick={onCancel} className="text-[13px] text-[#0969da] hover:underline">
              Cancel
            </button>
          </div>
          <p className="mt-3 text-[11px] text-[#59636e]">
            Next: you’ll be sent back to <span className="font-medium text-[#1f2328]">app.korefi.com/mvp3/integrations</span>
          </p>
        </div>
      </div>
    </Overlay>
  );
}
