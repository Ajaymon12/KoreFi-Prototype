"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Pencil, Plus, Search, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { Toast } from "@/components/ui/Toast";
import { BRAND, BRAND_LOGO, OUTLETS, STATE_NAME, type StateCode } from "@/lib/finance/outlets";
import { BrandMark } from "@/components/onboarding/marks";
import { resumeHref, update, useOnboarding } from "@/lib/org/store";
import { effectiveScope } from "@/lib/org/scope";
import type { Brand, Location, Scope } from "@/lib/org/types";
import { AddOutletDialog, type AddMode } from "./AddOutletDialog";
import { EditOutletDialog, type EditMode } from "./EditOutletDialog";
import { AddRestaurantFlow, type FlowMode } from "./AddRestaurantFlow";

// Top-bar scope picker: what the owner is looking at. One panel, two plain steps:
//   1. Restaurant: "All restaurants" (only when there are several) or one restaurant;
//   2. Branch: appears once a restaurant is chosen: "All branches" or a single store.
// So someone with two restaurants of three branches each sees 2 + 3 rows, never a nine-row tree.
// It also holds up at 60+ branches: a search box (across every restaurant) appears once there are
// more than a handful, long branch lists split into sticky city groups, the list scrolls inside the
// panel, and "Add restaurant" / "Add branches" sit in a footer that never scrolls away. Adding opens
// AddRestaurantFlow (Google Maps lookup); typing an address by hand is its fallback.
// Picking a restaurant keeps the panel open so the branch can be chosen next; a branch closes it.

const uid = () => Math.random().toString(36).slice(2, 9);
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type RowProps = { selected: boolean; onClick: () => void; main: string; sub?: string; lead?: React.ReactNode; onEdit?: () => void; editLabel?: string };

/** One choice. Restaurants and branches also get a pencil to rename them: it appears on hover or
 * keyboard focus (always, on touch screens) and sits beside the radio, not inside it. */
function Row({ selected, onClick, main, sub, lead, onEdit, editLabel }: RowProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onClick}
        className={cn("flex w-full items-center gap-2.5 rounded-medium px-2.5 py-1.5 text-left outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)", selected && "bg-(--color-neutral-lightest)", onEdit && "pr-16")}
      >
        {lead}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-body-md text-(--color-text-primary)", selected && "font-medium")}>{main}</span>
          {sub && <span className="block truncate text-body-sm text-(--color-text-secondary)">{sub}</span>}
        </span>
        {selected && <Check className="size-4 shrink-0 text-(--color-text-primary)" aria-hidden />}
      </button>
      {onEdit && (
        <button
          type="button"
          aria-label={editLabel}
          title={editLabel}
          onClick={onEdit}
          className={cn(
            "absolute top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-medium text-(--color-text-secondary) opacity-0 outline-none transition-opacity hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            selected ? "right-9" : "right-2",
          )}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

const Section = ({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) => (
  <section className="px-1 py-1.5 [&+&]:mt-1 [&+&]:border-t [&+&]:border-(--color-border-default) [&+&]:pt-2.5">
    <h3 className="flex items-center gap-2 px-2.5 pb-1 text-subtitle-xs tracking-wide text-(--color-text-tertiary) uppercase">
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {aside && <span className="shrink-0 tabular-nums normal-case">{aside}</span>}
    </h3>
    {children}
  </section>
);

/** Sticky sub-heading inside a long branch list, e.g. "Brooklyn  12". */
const CityHeader = ({ city, n }: { city: string; n: number }) => (
  <div className="sticky top-0 z-10 flex items-center gap-2 bg-(--color-background-secondary) px-2.5 pt-2 pb-1 text-body-sm text-(--color-text-tertiary)">
    <span className="min-w-0 flex-1 truncate">{city}</span>
    <span className="tabular-nums">{n}</span>
  </div>
);

const FooterAdd = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-medium px-2 text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)">
    <Plus className="size-3.5 shrink-0 text-(--color-text-secondary)" aria-hidden />
    <span className="truncate">{children}</span>
  </button>
);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Lists longer than this get a search box and city groups. */
const LONG = 8;

export function LocationSwitcher() {
  const { ready, state } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<FlowMode | null>(null);
  const [manual, setManual] = useState<AddMode | null>(null);
  const [editing, setEditing] = useState<EditMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  useDismiss(ref, open, close);

  const live = state.locations.filter((l) => l.included);
  const restaurants = state.brands.filter((b) => live.some((l) => l.brandId === b.id));
  const hasOrg = ready && state.completed && live.length > 0;
  const scope = effectiveScope(state.scope, live, restaurants.map((b) => b.id));

  const branch = scope.kind === "location" ? live.find((l) => l.id === scope.id) : undefined;
  const activeId = scope.kind === "brand" ? scope.id : branch?.brandId ?? null;
  const active = restaurants.find((b) => b.id === activeId);
  const branches = active ? live.filter((l) => l.brandId === active.id) : [];
  const searchable = live.length > LONG || restaurants.length > 4;

  // Keep the current branch in view when a long list opens.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("[aria-checked=true]")?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const label = !active ? "All restaurants" : branch ? `${active.name} · ${branch.name}` : branches.length > 1 ? `${active.name} · All branches` : active.name;
  const pick = (s: Scope, keepOpen = false) => {
    update({ scope: s });
    if (!keepOpen) close();
  };

  // Up/Down walk every choice in the panel (search box included); Enter in the box takes the first hit.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>("input[type=search], [role=radio]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items[e.key === "ArrowDown" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0)];
    if (!n) return;
    e.preventDefault();
    n.focus();
  };

  const q = norm(query);
  const brandOf = (l: Location) => restaurants.find((b) => b.id === l.brandId);
  const hitBrands = q ? restaurants.filter((b) => norm(b.name).includes(q)) : [];
  const hitBranches = q ? live.filter((l) => norm(`${l.name} ${l.address.street} ${l.address.city} ${l.address.zip} ${l.neighborhood}`).includes(q)) : [];

  const branchRow = (l: Location, b: Brand, withBrand = false) => (
    <Row
      key={l.id}
      selected={scope.kind === "location" && scope.id === l.id}
      onClick={() => pick({ kind: "location", id: l.id })}
      main={l.name}
      sub={withBrand ? `${b.name} · ${l.address.street}` : l.address.street}
      lead={withBrand ? <BrandMark brand={b} brands={state.brands} size="sm" /> : undefined}
      editLabel={`Rename ${l.name}`}
      onEdit={() => {
        close();
        setEditing({ kind: "branch", brand: b, location: l, others: live.filter((x) => x.brandId === b.id && x.id !== l.id).map((x) => x.name) });
      }}
    />
  );

  // City groups (biggest first) once a restaurant has more branches than fit at a glance.
  const byCity = [...branches.reduce((m, l) => m.set(l.address.city, [...(m.get(l.address.city) ?? []), l]), new Map<string, Location[]>())].sort((a, b) => b[1].length - a[1].length);
  const grouped = branches.length > LONG && byCity.length > 1;

  if (!hasOrg) return <DemoSwitcher setupHref={resumeHref(state)} />;

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
          className="flex h-7 max-w-[48vw] items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) pr-2 pl-1.5 text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-light) sm:max-w-[320px]"
        >
          {active ? <BrandMark brand={active} brands={state.brands} size="sm" /> : <Store className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-(--color-text-secondary)" />
        </button>

        {open && (
          <div
            ref={panel}
            role="dialog"
            aria-label="Choose restaurant and branch"
            onKeyDown={onKeyDown}
            className="absolute top-full right-0 z-50 mt-1.5 flex max-h-[min(640px,80vh)] w-[min(380px,calc(100vw-16px))] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_12px_32px_rgb(0_0_0/0.14)]"
          >
            {searchable && (
              <div className="border-b border-(--color-border-default) p-1.5">
                <label className="relative block">
                  <span className="sr-only">Search restaurants and branches</span>
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--color-text-tertiary)" aria-hidden />
                  <input
                    type="search"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const b = hitBrands[0];
                      const l = hitBranches[0];
                      if (b) pick({ kind: "brand", id: b.id });
                      else if (l) pick({ kind: "location", id: l.id });
                    }}
                    placeholder={`Search ${live.length} branches`}
                    className="h-9 w-full rounded-medium bg-transparent pr-2 pl-8 text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) [&::-webkit-search-cancel-button]:hidden"
                  />
                </label>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {q ? (
                <>
                  {hitBrands.length > 0 && (
                    <Section title="Restaurants">
                      <div role="radiogroup" aria-label="Restaurants">
                        {hitBrands.map((b) => (
                          <Row key={b.id} selected={activeId === b.id && scope.kind === "brand"} onClick={() => pick({ kind: "brand", id: b.id })} main={b.name} sub={count(live.filter((l) => l.brandId === b.id).length, "branch", "branches")} lead={<BrandMark brand={b} brands={state.brands} />} />
                        ))}
                      </div>
                    </Section>
                  )}
                  {hitBranches.length > 0 && (
                    <Section title="Branches" aside={hitBranches.length}>
                      <div role="radiogroup" aria-label="Branches">
                        {hitBranches.map((l) => branchRow(l, brandOf(l)!, true))}
                      </div>
                    </Section>
                  )}
                  {!hitBrands.length && !hitBranches.length && <p className="px-3 py-6 text-center text-body-md text-(--color-text-secondary)">No restaurant or branch matches “{query.trim()}”.</p>}
                </>
              ) : (
                <>
                  <Section title="Restaurant">
                    <div role="radiogroup" aria-label="Restaurant">
                      {restaurants.length > 1 && (
                        <Row
                          selected={scope.kind === "all"}
                          onClick={() => pick({ kind: "all" })}
                          main="All restaurants"
                          sub={`${count(restaurants.length, "restaurant", "restaurants")} · ${count(live.length, "branch", "branches")}`}
                          lead={<Store className="size-8 shrink-0 rounded-medium bg-(--color-neutral-light) p-2 text-(--color-text-secondary)" aria-hidden />}
                        />
                      )}
                      {restaurants.map((b) => (
                        <Row
                          key={b.id}
                          selected={activeId === b.id}
                          onClick={() => pick({ kind: "brand", id: b.id }, true)}
                          main={b.name}
                          sub={count(live.filter((l) => l.brandId === b.id).length, "branch", "branches")}
                          lead={<BrandMark brand={b} brands={state.brands} />}
                          editLabel={`Rename ${b.name}`}
                          onEdit={() => {
                            close();
                            setEditing({ kind: "restaurant", brand: b, others: restaurants.filter((r) => r.id !== b.id).map((r) => r.name) });
                          }}
                        />
                      ))}
                    </div>
                  </Section>

                  {active && (
                    <Section title={`Branch · ${active.name}`} aside={branches.length > 1 ? branches.length : undefined}>
                      <div role="radiogroup" aria-label={`Branch of ${active.name}`}>
                        {branches.length > 1 && <Row selected={scope.kind === "brand"} onClick={() => pick({ kind: "brand", id: active.id })} main="All branches" sub={grouped ? `${count(branches.length, "branch", "branches")} in ${count(byCity.length, "city", "cities")}` : count(branches.length, "branch", "branches")} />}
                        {grouped
                          ? byCity.map(([city, rows]) => (
                              <div key={city}>
                                <CityHeader city={city} n={rows.length} />
                                {rows.map((l) => branchRow(l, active))}
                              </div>
                            ))
                          : branches.map((l) => branchRow(l, active))}
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>

            {/* Adding lives in a fixed footer so it's reachable however long the list gets. */}
            <div className="flex gap-1 border-t border-(--color-border-default) p-1.5">
              <FooterAdd
                onClick={() => {
                  close();
                  setAdding({ kind: "restaurant" });
                }}
              >
                Add restaurant
              </FooterAdd>
              {active && (
                <>
                  <span className="my-1.5 w-px bg-(--color-border-default)" aria-hidden />
                  <FooterAdd
                    onClick={() => {
                      close();
                      setAdding({ kind: "branches", brand: active });
                    }}
                  >
                    Add branches
                  </FooterAdd>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {adding && (
        <AddRestaurantFlow
          mode={adding}
          brands={state.brands}
          existing={live.map((l) => ({ brandId: l.brandId, placeId: l.placeId, street: l.address.street, zip: l.address.zip }))}
          onClose={() => setAdding(null)}
          onManual={() => {
            setManual(adding.kind === "branches" ? { kind: "branch", brand: adding.brand } : { kind: "restaurant" });
            setAdding(null);
          }}
          onSubmit={({ brand, isNew, stores }) => {
            const locs: Location[] = stores.map(({ place: p, name }) => ({ id: `l_${uid()}`, brandId: brand.id, name, posName: `${p.name} – ${name}`, posSource: "manual", address: p.address, neighborhood: p.neighborhood, lat: p.lat, lng: p.lng, placeId: p.placeId, included: true, deliveryApps: [] }));
            update((s) => ({ brands: isNew ? [...s.brands, { ...brand, awaitingReports: true }] : s.brands, locations: [...s.locations, ...locs], scope: { kind: "brand", id: brand.id } }));
            setAdding(null);
            setToast(isNew ? `Added ${brand.name} with ${count(locs.length, "branch", "branches")}` : `Added ${count(locs.length, "branch", "branches")} to ${brand.name}`);
          }}
        />
      )}
      {manual && (
        <AddOutletDialog
          mode={manual}
          siblings={manual.kind === "branch" ? live.filter((l) => l.brandId === manual.brand.id) : []}
          onClose={() => setManual(null)}
          onDone={(s, message) => {
            update({ scope: s });
            setManual(null);
            setToast(message);
          }}
        />
      )}
      {editing && (
        <EditOutletDialog
          mode={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setToast(message);
          }}
        />
      )}
      <Toast message={toast} onDismiss={dismissToast} />
    </>
  );
}

/** Before setup is finished there's no real org yet, so the dashboard runs on the sample restaurant.
 * The picker still opens (same panel as the real one) so the top bar doesn't feel broken, but it says
 * plainly that this is sample data and points to setup, where the owner's own restaurants come from. */
const SAMPLE = { id: "sample", name: BRAND, logo: BRAND_LOGO };

function DemoSwitcher({ setupHref }: { setupHref: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  // The sample is the restaurant the reports' mock data follows (lib/finance/outlets): Taco Pros, by state.
  const brand = BRAND;
  const states = (Object.keys(STATE_NAME) as StateCode[]).map((st) => ({ st, list: OUTLETS.filter((o) => o.state === st) }));
  const pick = (l: string | null) => {
    setPicked(l);
    close();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 max-w-[48vw] items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) pr-2 pl-1.5 text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-light) sm:max-w-[320px]"
      >
        <BrandMark brand={SAMPLE} brands={[SAMPLE]} size="sm" />
        <span className="min-w-0 flex-1 truncate text-left">{picked ? `${brand} · ${picked}` : `${brand} · All branches`}</span>
        <ChevronDown className="size-3.5 shrink-0 text-(--color-text-secondary)" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose branch"
          className="absolute top-full right-0 z-50 mt-1.5 flex w-[min(340px,calc(100vw-16px))] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_12px_32px_rgb(0_0_0/0.14)]"
        >
          <p className="border-b border-(--color-border-default) px-4 py-3 text-body-sm text-(--color-text-secondary)">
            You’re looking at a <span className="font-medium text-(--color-text-primary)">sample restaurant</span>. Finish setup to see your own restaurants and branches here.
          </p>
          <div className="p-1.5">
            <div role="radiogroup" aria-label="Sample branches" className="max-h-[min(420px,60vh)] overflow-y-auto">
              <Section title={`${brand} · Sample`}>
                <Row selected={picked === null} onClick={() => pick(null)} main="All branches" sub={`${count(OUTLETS.length, "branch", "branches")} in ${count(states.length, "state", "states")}`} />
              </Section>
              {states.map(({ st, list }) => (
                <Section key={st} title={STATE_NAME[st]}>
                  {list.map((o) => (
                    <Row key={o.store} selected={picked === o.name} onClick={() => pick(o.name)} main={o.name} sub={`${o.street}, ${o.city}`} />
                  ))}
                </Section>
              ))}
            </div>
          </div>
          <div className="border-t border-(--color-border-default) p-1.5">
            <Link
              href={setupHref}
              onClick={close}
              className="flex h-8 items-center justify-center gap-1.5 rounded-medium px-2 text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)"
            >
              <Plus className="size-3.5 shrink-0 text-(--color-text-secondary)" aria-hidden />
              Add your restaurant
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
