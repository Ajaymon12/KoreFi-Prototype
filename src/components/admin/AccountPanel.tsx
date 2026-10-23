"use client";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, Copy, Mail, MapPinned, PenLine, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { CountTabs } from "@/components/ui/CountTabs";
import { DetailList, DrawerSection, Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { StatusBadge } from "@/components/dashboard/primitives";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { BrandMark } from "@/components/onboarding/marks";
import { AddRestaurantFlow, type FlowMode, type Noun } from "@/components/shell/AddRestaurantFlow";
import { AddOutletDialog, type AddMode } from "@/components/shell/AddOutletDialog";
import { DATA_META, NOW, OUTLET_META, STATUS_META, STEPS, ago, type Account, type AccountRestaurant, type AdminOutlet } from "@/lib/admin/accounts";
import { provider, type ProviderId } from "@/lib/admin/data";
import { addOutlets, inviteLink, removeOutlet } from "@/lib/admin/store";
import type { Location } from "@/lib/org/types";
import { ProviderLogo } from "./ProviderLogo";

// Account details for ops (user workspace → Account and Outlets; the header card and tabs are for drawer use). A header card (who, status, four numbers) over two tabs:
//   Overview — invitation, onboarding (one line once it's done), connections, account details;
//   Outlets — every restaurant and its outlets, with sync status. Ops can add outlets (search Google
//   Maps, same flow owners use, or type an address) and remove one (inline confirm, then Undo).

export type ToastMsg = { message: string; action?: { label: string; onClick: () => void } };

const OUTLET: Noun = { one: "outlet", many: "outlets" };
/** Dialogs open outside the (translated) drawer but inside the ops theme, so they stay indigo. */
const dialogHost = () => document.querySelector<HTMLElement>("[data-product]") ?? document.body;
const DELIVERY: ProviderId[] = ["doordash", "ubereats", "grubhub"];
const uid = () => Math.random().toString(36).slice(2, 9);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

type Tab = "overview" | "outlets";

/** `bare`: just the tab's content, for the user workspace's Account and Outlets pages (the workspace bar
 * already shows who this is and the numbers). */
export function AccountPanel({ a, tab, onTab, onToast, bare = false }: { a: Account; tab: Tab; onTab?: (t: Tab) => void; onToast: (t: ToastMsg) => void; bare?: boolean }) {
  if (bare) return tab === "overview" ? <Overview a={a} onToast={onToast} /> : <Outlets a={a} onToast={onToast} />;
  const st = STATUS_META[a.status];
  const listed = a.restaurants.reduce((n, r) => n + r.outlets.length, 0);
  const sources = (a.pos ? 1 : 0) + a.delivery.length;

  return (
    <>
      {/* Header card: who this is, then the four numbers ops checks first. */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-circle bg-(--color-brand-lightest) text-subtitle-md text-(--color-primary)">
            {initials(a.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-subtitle-lg text-(--color-text-primary)">{a.name}</h3>
              <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            </div>
            <p className="truncate text-body-sm text-(--color-text-secondary)">
              {a.role} · {a.email}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-4 divide-x divide-(--color-border-default) rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest)/60">
          {[
            { k: "Outlets", v: listed || a.outlets, hint: listed ? undefined : "expected" },
            { k: "Sources", v: sources },
            { k: "Chargebacks", v: a.openChargebacks, hint: "open" },
            { k: "Last active", v: ago(a.lastActive) },
          ].map((x) => (
            <div key={x.k} className="min-w-0 px-3 py-2.5">
              <dt className="truncate text-body-sm text-(--color-text-secondary)">{x.k}</dt>
              <dd className="mt-0.5 truncate text-subtitle-md text-(--color-text-primary) tabular-nums">
                {x.v}
                {x.hint && <span className="ml-1 text-body-sm text-(--color-text-tertiary)">{x.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Tabs stay pinned while the content under them scrolls. */}
      <div className="sticky top-0 z-10 bg-(--color-background-secondary) py-0!">
        <CountTabs<Tab>
          label="Account sections"
          value={tab}
          onChange={(t) => onTab?.(t)}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "outlets", label: "Outlets", count: listed },
          ]}
        />
      </div>

      {tab === "overview" ? <Overview a={a} onToast={onToast} /> : <Outlets a={a} onToast={onToast} />}
    </>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────────────────────

function Overview({ a, onToast }: { a: Account; onToast: (t: ToastMsg) => void }) {
  const dt = DATA_META[a.data];
  const idx = STEPS.findIndex((s) => s.id === a.step);
  const steps: TimelineStep[] = STEPS.filter((s) => s.id !== "done").map((s, i) => ({
    label: s.label,
    state: i < idx ? "done" : i === idx ? "current" : "upcoming",
    date: i === idx && a.status === "stalled" ? "Stuck here: no activity for over a week" : undefined,
  }));
  const conns: { id: ProviderId; on: boolean; kind: string }[] = [
    ...(a.pos ? [{ id: a.pos, on: true, kind: "POS" }] : []),
    ...DELIVERY.map((id) => ({ id, on: a.delivery.includes(id), kind: "Delivery" })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {a.status === "invited" && (
        <div className="rounded-large border border-(--color-border-default) bg-(--color-neutral-lightest)/60 p-3.5">
          <p className="text-body-md font-medium text-(--color-text-primary)">Invitation pending</p>
          <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{a.name.split(" ")[0]} hasn&rsquo;t accepted yet. The link expires 7 days after it was sent.</p>
          <div className="mt-3 flex gap-2">
            <Button size="small" iconLeft={<Mail aria-hidden />} onClick={() => onToast({ message: `Invitation resent to ${a.email}` })}>
              Resend invite
            </Button>
            <Button
              size="small"
              iconLeft={<Copy aria-hidden />}
              onClick={() => {
                void navigator.clipboard?.writeText(inviteLink(a)).catch(() => {});
                onToast({ message: "Invite link copied" });
              }}
            >
              Copy link
            </Button>
          </div>
        </div>
      )}

      <DrawerSection title="Onboarding">
        {a.step === "done" ? (
          <p className="flex items-center gap-2 px-4 text-body-md text-(--color-text-primary)">
            <CircleCheck className="size-4 text-(--color-text-success)" aria-hidden />
            Complete
            <span className="text-(--color-text-secondary)">· joined {fmtDate(a.joined)}</span>
          </p>
        ) : (
          <Timeline steps={steps} />
        )}
      </DrawerSection>

      <DrawerSection title="Connections">
        <ul className="mx-4 divide-y divide-(--color-border-default) rounded-large border border-(--color-border-default)">
          {!a.pos && (
            <li className="flex items-center gap-2.5 px-3 py-2 text-body-md text-(--color-text-secondary)">
              <span className="grid size-5 place-items-center rounded-small border border-dashed border-(--color-border-darker) text-[10px]">POS</span>
              No POS connected
            </li>
          )}
          {conns.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-body-md">
              <span className={cn(!c.on && "opacity-40 grayscale")}>
                <ProviderLogo id={c.id} size={18} />
              </span>
              <span className={cn("flex-1", c.on ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>{provider(c.id)?.name}</span>
              <span className="text-body-sm text-(--color-text-tertiary)">{c.kind}</span>
              <span className={cn("w-[92px] text-right text-body-sm", c.on ? "text-(--color-text-success)" : "text-(--color-text-tertiary)")}>{c.on ? "Connected" : "Not connected"}</span>
            </li>
          ))}
        </ul>
      </DrawerSection>

      <DetailList
        title="Account"
        rows={[
          { label: "Data", value: <StatusBadge tone={dt.tone}>{dt.label}</StatusBadge> },
          { label: "Joined", value: fmtDate(a.joined) },
          { label: "Last active", value: a.lastActive ? fmtDateTime(a.lastActive) : "Never signed in" },
          { label: "Open chargebacks", value: a.openChargebacks },
        ]}
      />
    </div>
  );
}

// ── Outlets ───────────────────────────────────────────────────────────────────────────────────

/** AddOutletDialog speaks the owner's Location; these are the only fields it reads. */
const asLocation = (o: AdminOutlet, rid: string): Location => ({ id: o.id, brandId: rid, name: o.name, posName: o.name, posSource: "manual", address: o.address, neighborhood: o.neighborhood, included: true, deliveryApps: [] });

function Outlets({ a, onToast }: { a: Account; onToast: (t: ToastMsg) => void }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<FlowMode | null>(null);
  const [manual, setManual] = useState<AddMode | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));
  const pickMode = (m: FlowMode) => {
    setMenu(false);
    setAdding(m);
  };

  const all = a.restaurants.flatMap((r) => r.outlets);
  const f = norm(q);
  const groups = useMemo(
    () => a.restaurants.map((r) => ({ r, rows: f ? r.outlets.filter((o) => norm(`${o.name} ${o.address.street} ${o.address.city} ${o.address.zip}`).includes(f)) : r.outlets })).filter((g) => !f || g.rows.length),
    [a.restaurants, f],
  );
  const counts = all.reduce((m, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {} as Record<string, number>);
  const one = a.restaurants.length === 1 ? a.restaurants[0] : null;

  const save = (r: Omit<AccountRestaurant, "outlets">, isNew: boolean, outlets: AdminOutlet[]) => {
    addOutlets(a.id, r, outlets);
    onToast({ message: isNew ? `Added ${r.name} with ${plural(outlets.length, "outlet")}` : `Added ${plural(outlets.length, "outlet")} to ${r.name}` });
  };
  const remove = (o: AdminOutlet, r: AccountRestaurant) => {
    const undo = removeOutlet(a.id, o.id);
    setConfirm(null);
    onToast({ message: `Removed ${o.name} from ${r.name}`, action: { label: "Undo", onClick: undo } });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar; with no outlets yet the empty state below carries the actions instead. */}
      <div className={cn("flex items-center gap-2", all.length === 0 && "hidden")}>
        {all.length > 5 ? (
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search outlets</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-(--color-text-tertiary)" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${all.length} outlets`}
              className="h-8 w-full rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest)/60 pr-2 pl-8 text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus-visible:border-(--color-focus-primary) focus-visible:bg-(--color-background-secondary)"
            />
          </label>
        ) : (
          <p className="flex-1 text-body-sm text-(--color-text-secondary)">
            {(Object.keys(OUTLET_META) as (keyof typeof OUTLET_META)[])
              .filter((k) => counts[k])
              .map((k) => `${counts[k]} ${OUTLET_META[k].label.toLowerCase()}`)
              .join(" · ")}
          </p>
        )}
        <div ref={menuRef} className="relative">
          <Button type="primary" size="small" iconLeft={<Plus aria-hidden />} onClick={() => (one ? setAdding({ kind: "branches", brand: one }) : setMenu((m) => !m))} aria-haspopup={one ? undefined : "menu"} aria-expanded={one ? undefined : menu}>
            Add outlets
          </Button>
          {menu && (
            <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-56 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-[0_12px_32px_rgb(0_0_0/0.14)]">
              <p className="px-2.5 pt-1 pb-1.5 text-body-sm text-(--color-text-tertiary)">Add outlets to</p>
              {a.restaurants.map((r) => (
                <button key={r.id} role="menuitem" type="button" onClick={() => pickMode({ kind: "branches", brand: r })} className="flex w-full items-center gap-2.5 rounded-medium px-2.5 py-1.5 text-left text-body-md hover:bg-(--color-neutral-lightest)">
                  <BrandMark brand={r} brands={a.restaurants} size="sm" />
                  <span className="truncate">{r.name}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-(--color-border-default)" />
              <button role="menuitem" type="button" onClick={() => pickMode({ kind: "restaurant" })} className="flex w-full items-center gap-2.5 rounded-medium px-2.5 py-1.5 text-left text-body-md hover:bg-(--color-neutral-lightest)">
                <Plus className="size-4 text-(--color-text-secondary)" aria-hidden />A new restaurant
              </button>
            </div>
          )}
        </div>
      </div>

      {all.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-(--color-border-darker) px-6 py-8 text-center">
          <MapPinned className="size-6 text-(--color-text-tertiary)" aria-hidden />
          <p className="text-body-md font-medium text-(--color-text-primary)">No outlets yet</p>
          <p className="max-w-[300px] text-body-sm text-(--color-text-secondary)">
            {a.outlets > 0 ? `${a.name.split(" ")[0]} said they have ${plural(a.outlets, "outlet")}. ` : ""}Find them on Google Maps, or type an address.
          </p>
          <div className="mt-1 flex gap-2">
            <Button type="primary" size="small" onClick={() => setAdding(one ? { kind: "branches", brand: one } : { kind: "restaurant" })}>
              Find on Google Maps
            </Button>
            <Button size="small" iconLeft={<PenLine aria-hidden />} onClick={() => setManual(one ? { kind: "branch", brand: one } : { kind: "restaurant" })}>
              Enter by hand
            </Button>
          </div>
        </div>
      )}

      {f && !groups.length && <p className="py-6 text-center text-body-md text-(--color-text-secondary)">No outlets match “{q.trim()}”.</p>}

      {all.length > 0 &&
        groups.map(({ r, rows }) => (
          <section key={r.id}>
            <header className="mb-1.5 flex items-center gap-2.5">
              <BrandMark brand={r} brands={a.restaurants} size="sm" />
              <h4 className="min-w-0 flex-1 truncate text-body-md font-medium text-(--color-text-primary)">{r.name}</h4>
              <span className="text-body-sm text-(--color-text-tertiary) tabular-nums">{r.outlets.length}</span>
              {!one && (
                <Button type="text" size="tiny" iconLeft={<Plus aria-hidden />} aria-label={`Add outlets to ${r.name}`} onClick={() => setAdding({ kind: "branches", brand: r })}>
                  Add
                </Button>
              )}
            </header>
            <ul className="divide-y divide-(--color-border-default) overflow-hidden rounded-large border border-(--color-border-default)">
              {rows.length === 0 && <li className="px-3 py-3 text-body-sm text-(--color-text-secondary)">No outlets in this restaurant yet.</li>}
              {rows.map((o) =>
                confirm === o.id ? (
                  <li key={o.id} className="bg-(--color-danger-lightest) px-3 py-2.5">
                    <p className="text-body-md text-(--color-text-primary)">
                      Remove <b className="font-medium">{o.name}</b>?
                    </p>
                    <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">KoreFi stops importing its data. Reports already imported stay.</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="tiny" onClick={() => setConfirm(null)}>
                        Cancel
                      </Button>
                      <Button type="danger" size="tiny" autoFocus onClick={() => remove(o, r)}>
                        Remove outlet
                      </Button>
                    </div>
                  </li>
                ) : (
                  <li key={o.id} className="group flex items-center gap-3 px-3 py-2 hover:bg-(--color-neutral-lightest)/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-md text-(--color-text-primary)">{o.name}</p>
                      <p className="truncate text-body-sm text-(--color-text-secondary)">
                        {o.address.street}, {o.address.city} {o.address.zip}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-body-sm text-(--color-text-secondary)" title={o.status === "setting_up" ? `Added ${fmtDate(o.added)} · waiting for its first data` : undefined}>
                      <span aria-hidden className={cn("size-1.5 rounded-circle", OUTLET_META[o.status].dot)} />
                      {OUTLET_META[o.status].label}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${o.name}`}
                      title="Remove outlet"
                      onClick={() => setConfirm(o.id)}
                      className="grid size-7 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) opacity-0 outline-none transition-opacity group-hover:opacity-100 hover:bg-(--color-danger-lightest) hover:text-(--color-text-danger) focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [@media(hover:none)]:opacity-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}

      {all.length > 0 && (
        <p className="text-body-sm text-(--color-text-secondary)">
          Not on Google Maps?{" "}
          <button type="button" onClick={() => setManual(one ? { kind: "branch", brand: one } : { kind: "restaurant" })} className="text-(--color-text-clickable) underline-offset-2 hover:underline">
            Enter an outlet by hand
          </button>
        </p>
      )}

      {/* Portalled: the drawer is translated, which would trap these fixed dialogs inside it. */}
      {adding &&
        createPortal(
          <AddRestaurantFlow
            mode={adding}
            noun={OUTLET}
            brands={a.restaurants}
            existing={a.restaurants.flatMap((r) => r.outlets.map((o) => ({ brandId: r.id, placeId: o.placeId, street: o.address.street, zip: o.address.zip })))}
            onClose={() => setAdding(null)}
            onManual={() => {
              setManual(adding.kind === "branches" ? { kind: "branch", brand: adding.brand } : { kind: "restaurant" });
              setAdding(null);
            }}
            onSubmit={({ brand, isNew, stores }) => {
              const added = NOW.toISOString().slice(0, 10);
              save({ id: brand.id, name: brand.name, logo: brand.logo }, isNew, stores.map(({ place: p, name }) => ({ id: `o_${uid()}`, name, address: p.address, neighborhood: p.neighborhood, lat: p.lat, lng: p.lng, placeId: p.placeId, status: "setting_up", added })));
              setAdding(null);
            }}
          />,
          dialogHost(),
        )}
      {manual &&
        createPortal(
          <AddOutletDialog
            mode={manual}
            noun={OUTLET}
            siblings={manual.kind === "branch" ? (a.restaurants.find((r) => r.id === manual.brand.id)?.outlets ?? []).map((o) => asLocation(o, manual.brand.id)) : []}
            commit={(brand, isNew, loc) => save({ id: brand.id, name: brand.name, logo: brand.logo }, isNew, [{ id: `o_${uid()}`, name: loc.name, address: loc.address, neighborhood: loc.neighborhood, status: "setting_up", added: NOW.toISOString().slice(0, 10) }])}
            onClose={() => setManual(null)}
            onDone={() => setManual(null)}
          />,
          dialogHost(),
        )}
    </div>
  );
}
