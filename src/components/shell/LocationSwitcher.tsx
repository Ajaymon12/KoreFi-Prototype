"use client";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { Toast } from "@/components/ui/Toast";
import { locations as demoLocations } from "@/lib/mockData";
import { BrandMark } from "@/components/onboarding/marks";
import { update, useOnboarding } from "@/lib/org/store";
import type { Location, Scope } from "@/lib/org/types";
import { AddOutletDialog, type AddMode } from "./AddOutletDialog";
import { EditOutletDialog, type EditMode } from "./EditOutletDialog";

// Top-bar scope picker: what the owner is looking at. One panel, two plain steps:
//   1. Restaurant: "All restaurants" (only when there are several) or one restaurant;
//   2. Branch: appears once a restaurant is chosen: "All branches" or a single store.
// So someone with two restaurants of three branches each sees 2 + 3 rows, never a nine-row tree,
// and each list has its own "Add" at the bottom. Picking a restaurant keeps the panel open so the
// branch can be chosen next; picking a branch (or "All branches") closes it.

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The scope as the picker shows it: stale ids fall back to "all", and an owner with a single
 * restaurant is always "inside" it (there's nothing to choose at the restaurant level). */
function effectiveScope(scope: Scope, live: Location[], restaurantIds: string[]): Scope {
  const valid: Scope =
    scope.kind === "location" ? (live.some((l) => l.id === scope.id) ? scope : { kind: "all" }) : scope.kind === "brand" ? (restaurantIds.includes(scope.id) ? scope : { kind: "all" }) : scope;
  return valid.kind === "all" && restaurantIds.length === 1 ? { kind: "brand", id: restaurantIds[0] } : valid;
}

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

const AddRow = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="flex h-9 w-full items-center gap-2.5 rounded-medium px-2.5 text-left text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)">
    <span className="grid size-6 shrink-0 place-items-center rounded-circle border border-dashed border-(--color-border-darker) text-(--color-text-secondary)">
      <Plus className="size-3.5" aria-hidden />
    </span>
    <span className="min-w-0 truncate">{children}</span>
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="px-1 py-1.5 first:pt-0.5 [&+&]:mt-1 [&+&]:border-t [&+&]:border-(--color-border-default) [&+&]:pt-2.5">
    <h3 className="truncate px-2.5 pb-1 text-subtitle-xs tracking-wide text-(--color-text-tertiary) uppercase">{title}</h3>
    {children}
  </section>
);

export function LocationSwitcher() {
  const { ready, state } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [editing, setEditing] = useState<EditMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
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

  const label = !active ? "All restaurants" : branch ? `${active.name} · ${branch.name}` : branches.length > 1 ? `${active.name} · All branches` : active.name;
  const pick = (s: Scope, keepOpen = false) => {
    update({ scope: s });
    if (!keepOpen) setOpen(false);
  };

  if (!hasOrg) return <DemoSwitcher />;

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-7 max-w-[48vw] items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) pr-2 pl-1.5 text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-light) sm:max-w-[320px]"
        >
          {active ? <BrandMark brand={active} brands={state.brands} size="sm" /> : <Store className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-(--color-text-secondary)" />
        </button>

        {open && (
          <div role="dialog" aria-label="Choose restaurant and branch" className="absolute top-full right-0 z-50 mt-1.5 max-h-[75vh] w-[min(340px,calc(100vw-16px))] overflow-y-auto rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.14)]">
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
                      setOpen(false);
                      setEditing({ kind: "restaurant", brand: b, others: restaurants.filter((r) => r.id !== b.id).map((r) => r.name) });
                    }}
                  />
                ))}
              </div>
              <AddRow
                onClick={() => {
                  setOpen(false);
                  setAdding({ kind: "restaurant" });
                }}
              >
                Add a restaurant
              </AddRow>
            </Section>

            {active && (
              <Section title={`Branch · ${active.name}`}>
                <div role="radiogroup" aria-label={`Branch of ${active.name}`}>
                  {branches.length > 1 && <Row selected={scope.kind === "brand"} onClick={() => pick({ kind: "brand", id: active.id })} main="All branches" sub={count(branches.length, "branch", "branches")} />}
                  {branches.map((l) => (
                    <Row
                      key={l.id}
                      selected={scope.kind === "location" && scope.id === l.id}
                      onClick={() => pick({ kind: "location", id: l.id })}
                      main={l.name}
                      sub={l.address.street}
                      editLabel={`Rename ${l.name}`}
                      onEdit={() => {
                        setOpen(false);
                        setEditing({ kind: "branch", brand: active, location: l, others: branches.filter((x) => x.id !== l.id).map((x) => x.name) });
                      }}
                    />
                  ))}
                </div>
                <AddRow
                  onClick={() => {
                    setOpen(false);
                    setAdding({ kind: "branch", brand: active });
                  }}
                >
                  Add a branch to {active.name}
                </AddRow>
              </Section>
            )}
          </div>
        )}
      </div>

      {adding && (
        <AddOutletDialog
          mode={adding}
          siblings={adding.kind === "branch" ? live.filter((l) => l.brandId === adding.brand.id) : []}
          onClose={() => setAdding(null)}
          onDone={(s, message) => {
            update({ scope: s });
            setAdding(null);
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

/** Before setup is finished there's no real org yet; show the demo store as a plain label. */
function DemoSwitcher() {
  return (
    <button className="flex h-7 max-w-[44vw] items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) px-2 text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-light) sm:max-w-none">
      <span className="min-w-0 flex-1 truncate text-left">{demoLocations[0]}</span>
      <ChevronDown className="size-3.5 shrink-0 text-(--color-text-secondary)" />
    </button>
  );
}
