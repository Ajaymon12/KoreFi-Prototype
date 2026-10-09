"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StepShell } from "@/components/onboarding/StepShell";
import { FormError } from "@/components/onboarding/parts";
import { AddLocationForm, BulkBar, LeftOutSection, LocationRow, NEW_BRAND, NearbyNote } from "@/components/onboarding/locations";
import { BrandMark } from "@/components/onboarding/marks";
import { advance } from "@/components/onboarding/steps";
import { update, useOnboarding } from "@/lib/org/store";
import { nearbyClusters, suggestName } from "@/lib/org/posImport";
import type { Brand, Location } from "@/lib/org/types";

// Step 3: confirm locations and group them into brands. The POS list arrives with brands guessed
// from store names; the owner fixes names, moves stores between brands, leaves out test or closed
// stores, and adds anything the POS doesn't list. Edits save as they happen.

const uid = () => Math.random().toString(36).slice(2, 9);
const posLabel = { square: "Square", toast: "Toast", clover: "Clover" };

export default function Locations() {
  const router = useRouter();
  const { state } = useOnboarding();
  const { brands, locations } = state;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(locations.length === 0);
  const [tried, setTried] = useState(false);
  const [focusBrand, setFocusBrand] = useState<string | null>(null);

  const clusters = useMemo(() => nearbyClusters(locations), [locations]);
  const included = locations.filter((l) => l.included);
  const unbranded = included.filter((l) => !l.brandId);
  const emptyNames = included.filter((l) => !l.name.trim());
  const unnamedBrands = brands.filter((b) => !b.name.trim() && locations.some((l) => l.brandId === b.id));

  const setLoc = (id: string, patch: Partial<Location>) => update((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const setBrandName = (id: string, name: string) => update((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, name } : b)) }));

  /** Puts `ids` under a brand; NEW_BRAND creates an empty one and focuses its name. */
  const moveTo = (ids: string[], value: string) => {
    let brandId = value;
    if (value === NEW_BRAND) {
      brandId = `b_${uid()}`;
      update((s) => ({ brands: [...s.brands, { id: brandId, name: "" }] }));
      setFocusBrand(brandId);
    }
    update((s) => ({ locations: s.locations.map((l) => (ids.includes(l.id) ? { ...l, brandId } : l)) }));
    setSelected(new Set());
  };

  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? new Set(s).add(id) : new Set([...s].filter((x) => x !== id))));

  // Included stores grouped by brand; left-out stores live in their own section at the bottom.
  const groups: { brand: Brand | null; rows: Location[] }[] = [
    ...brands.map((b) => ({ brand: b, rows: included.filter((l) => l.brandId === b.id) })).filter((g) => g.rows.length || g.brand.id === focusBrand),
    ...(unbranded.length ? [{ brand: null, rows: unbranded }] : []),
  ];
  const leftOut = locations.filter((l) => !l.included);
  const brandCount = groups.filter((g) => g.brand && g.rows.length).length;

  const sources = state.imported.map((p) => posLabel[p]).join(" and ");

  return (
    <StepShell
      step="locations"
      wide
      title="Confirm your locations"
      status={`${included.length} locations · ${brandCount} ${brandCount === 1 ? "brand" : "brands"}${leftOut.length ? ` · ${leftOut.length} left out` : ""}`}
      description={
        locations.length ? (
          <>
            We found {locations.filter((l) => l.posSource !== "manual").length} locations{sources && ` in ${sources}`} and grouped them into brands. Check the names, move anything that’s in the wrong brand, and leave out stores that are closed or used for testing.
          </>
        ) : (
          "Add each location you run. You can connect its POS later from Integrations."
        )
      }
      onContinue={() => {
        setTried(true);
        if (!included.length || unbranded.length || emptyNames.length || unnamedBrands.length) return;
        // Brands left with no stores are dropped.
        update((s) => ({ brands: s.brands.filter((b) => s.locations.some((l) => l.brandId === b.id)) }));
        router.push(advance("locations", state.step));
      }}
    >
      <div className="space-y-6">
        {groups.map(({ brand, rows }) => {
          const cluster = brand && clusters.find((c) => c[0].brandId === brand.id);
          const clusterKey = cluster?.map((l) => l.id).join();
          const showNote = cluster && !dismissed.has(clusterKey!) && cluster.some((l) => l.name !== suggestName(l));
          const live = rows.filter((l) => l.included).length;
          return (
            <section key={brand?.id ?? "none"} aria-label={brand?.name || "No brand yet"} className="overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
              <header className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-3">
                {brand ? (
                  <>
                    <BrandMark brand={brand} brands={brands} />
                    <input
                      aria-label="Brand name"
                      autoFocus={brand.id === focusBrand}
                      placeholder="Brand name"
                      value={brand.name}
                      onChange={(e) => setBrandName(brand.id, e.target.value)}
                      aria-invalid={(tried && !brand.name.trim()) || undefined}
                      className="h-8 min-w-0 flex-1 rounded-medium border border-transparent bg-transparent px-2 -ml-1 text-subtitle-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) hover:border-(--color-border-default) focus-visible:border-(--color-border-input) focus-visible:bg-(--color-background-secondary) aria-invalid:border-(--color-danger-default)"
                    />
                    <span className="shrink-0 text-body-sm text-(--color-text-secondary) tabular-nums">
                      {live} {live === 1 ? "location" : "locations"}
                    </span>
                    {!rows.length && (
                      <button
                        type="button"
                        aria-label="Remove empty brand"
                        onClick={() => update((s) => ({ brands: s.brands.filter((b) => b.id !== brand.id) }))}
                        className="grid size-8 place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light)"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-subtitle-md text-(--color-text-danger)">Needs a brand</p>
                )}
              </header>

              {showNote && (
                <NearbyNote
                  brand={brand!.name || "These"}
                  group={cluster!}
                  onApply={() => {
                    update((s) => ({ locations: s.locations.map((l) => (cluster!.some((c) => c.id === l.id) ? { ...l, name: suggestName(l) } : l)) }));
                    setDismissed((d) => new Set(d).add(clusterKey!));
                  }}
                  onDismiss={() => setDismissed((d) => new Set(d).add(clusterKey!))}
                />
              )}

              {rows.length > 0 ? (
                <ul className="divide-y divide-(--color-border-default)">
                  {rows.map((l) => (
                    <LocationRow
                      key={l.id}
                      loc={l}
                      brands={brands}
                      selected={selected.has(l.id)}
                      onSelect={(v) => toggle(l.id, v)}
                      onChange={(p) => setLoc(l.id, p)}
                      onBrand={(v) => moveTo([l.id], v)}
                      invalid={tried && l.included && !l.brandId}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-body-sm text-(--color-text-secondary)">Move locations here with their Brand menu, or tick several and use “Move to”.</p>
              )}
            </section>
          );
        })}

        <LeftOutSection rows={leftOut} onInclude={(id) => setLoc(id, { included: true })} />

        {adding ? (
          <AddLocationForm
            brands={brands}
            onCancel={locations.length ? () => setAdding(false) : undefined}
            onAdd={(d) => {
              let brandId = d.brandId;
              if (brandId === NEW_BRAND) {
                brandId = `b_${uid()}`;
                update((s) => ({ brands: [...s.brands, { id: brandId, name: d.newBrand.trim() }] }));
              }
              const loc: Location = {
                id: `l_${uid()}`,
                brandId,
                name: d.name.trim(),
                posName: d.name.trim(),
                posSource: "manual",
                address: { street: d.street.trim(), city: d.city.trim(), state: d.state, zip: d.zip },
                neighborhood: d.city.trim(),
                included: true,
                deliveryApps: [],
              };
              update((s) => ({ locations: [...s.locations, loc] }));
              setAdding(false);
            }}
          />
        ) : (
          <Button type="dashed" size="medium" block iconLeft={<Plus />} onClick={() => setAdding(true)}>
            Add a location
          </Button>
        )}

        {tried && (
          <div>
            {!included.length && <FormError>Include at least one location.</FormError>}
            {unbranded.length > 0 && <FormError>Choose a brand for {unbranded.length === 1 ? unbranded[0].name : `${unbranded.length} locations`}, or leave {unbranded.length === 1 ? "it" : "them"} out.</FormError>}
            {emptyNames.length > 0 && <FormError>Every included location needs a short name.</FormError>}
            {unnamedBrands.length > 0 && <FormError>Name every brand.</FormError>}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          brands={brands}
          onMove={(v) => moveTo([...selected], v)}
          onExclude={() => {
            update((s) => ({ locations: s.locations.map((l) => (selected.has(l.id) ? { ...l, included: false } : l)) }));
            setSelected(new Set());
          }}
          onClear={() => setSelected(new Set())}
        />
      )}
    </StepShell>
  );
}
