"use client";
import { useId, useState } from "react";
import { ChevronDown, EyeOff, MapPin, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select, SelectControl } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { formatAddress, suggestName } from "@/lib/org/posImport";
import type { Brand, Location } from "@/lib/org/types";

// Pieces of the Locations step: one card per brand with its locations as editable rows, a note
// when stores of a brand sit close together, a bulk "Move to brand" bar, and a manual-add form.

export const NEW_BRAND = "__new__";
const POS_LABEL: Record<Location["posSource"], string> = { square: "Square", toast: "Toast", clover: "Clover", manual: "Added by you" };

type RowProps = {
  loc: Location;
  brands: Brand[];
  selected: boolean;
  onSelect: (v: boolean) => void;
  onChange: (patch: Partial<Location>) => void;
  onBrand: (value: string) => void;
  invalid?: boolean;
};

/** One store: tick to select, editable short name over its address and POS name, brand menu,
 * and a quiet "leave out" action (left-out stores move to their own section). */
export function LocationRow({ loc, brands, selected, onSelect, onChange, onBrand, invalid }: RowProps) {
  const nameId = useId();
  return (
    <li className={cn("group grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 px-4 py-3.5 sm:grid-cols-[20px_minmax(0,1fr)_176px_auto]", selected && "bg-(--brand-100)")}>
      <Checkbox checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${loc.name}`} className="mt-2.5" />
      <div className="min-w-0">
        <label htmlFor={nameId} className="sr-only">
          Short name for {loc.posName}
        </label>
        <input
          id={nameId}
          value={loc.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-invalid={!loc.name.trim() || undefined}
          className="-ml-2 h-9 w-full rounded-medium border border-transparent bg-transparent px-2 text-subtitle-sm text-(--color-text-primary) outline-none hover:border-(--color-border-default) focus-visible:border-(--color-border-input) focus-visible:bg-(--color-background-secondary) aria-invalid:border-(--color-danger-default)"
        />
        <p className="flex items-start gap-1.5 text-body-sm text-(--color-text-secondary)">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">
            {formatAddress(loc)}
            <span className="block text-(--color-text-tertiary)">
              {loc.neighborhood} · {POS_LABEL[loc.posSource]}
              {loc.posSource !== "manual" && ` “${loc.posName}”`}
            </span>
          </span>
        </p>
      </div>
      <div className="col-start-2 sm:col-start-3 sm:row-start-1">
        <SelectControl
          aria-label={`Brand for ${loc.name}`}
          aria-invalid={invalid || undefined}
          value={loc.brandId ?? ""}
          placeholder="Choose brand"
          onChange={(e) => onBrand(e.target.value)}
          options={[...brands.map((b) => ({ value: b.id, label: b.name || "Untitled brand" })), { value: NEW_BRAND, label: "+ New brand…" }]}
          className="h-9"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange({ included: false })}
        aria-label={`Leave out ${loc.name}`}
        title="Leave out (closed or test store)"
        className="col-start-3 row-start-1 grid size-9 place-items-center rounded-medium text-(--color-text-tertiary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) sm:col-start-4"
      >
        <EyeOff className="size-4" aria-hidden />
      </button>
    </li>
  );
}

/** Stores the owner left out (closed, test or training stores), collapsed at the bottom. */
export function LeftOutSection({ rows, onInclude }: { rows: Location[]; onInclude: (id: string) => void }) {
  const [open, setOpen] = useState(rows.some((l) => l.looksLikeTest));
  if (!rows.length) return null;
  return (
    <section className="rounded-large border border-(--color-border-default) bg-(--color-background-primary)">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
        <EyeOff className="size-4 text-(--color-text-tertiary)" aria-hidden />
        <span className="text-subtitle-sm text-(--color-text-primary)">Left out</span>
        <span className="text-body-sm text-(--color-text-secondary) tabular-nums">{rows.length}</span>
        <span className="ml-auto text-body-sm text-(--color-text-secondary)">Not tracked in KoreFi</span>
        <ChevronDown className={cn("size-4 text-(--color-text-secondary) transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="divide-y divide-(--color-border-default) border-t border-(--color-border-default)">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md text-(--color-text-secondary)">{l.name}</p>
                <p className="truncate text-body-sm text-(--color-text-tertiary)">
                  {l.address.street}
                  {l.looksLikeTest && " · Looks like a test or training store"}
                </p>
              </div>
              <Button type="default" size="tiny" onClick={() => onInclude(l.id)}>
                Include
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "3 Casa Alvarez stores are within a mile of each other" — offers names that tell them apart. */
export function NearbyNote({ brand, group, onApply, onDismiss }: { brand: string; group: Location[]; onApply: () => void; onDismiss: () => void }) {
  return (
    <div className="flex gap-3 border-b border-(--color-border-default) bg-(--color-warning-lightest) px-5 py-4">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-(--color-warning-dark)" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body-md text-(--color-text-primary)">
          <b className="font-medium">
            {group.length} {brand} stores
          </b>{" "}
          are within a mile of each other. Give each a name your team will recognise at a glance.
        </p>
        <ul className="mt-2 space-y-1 text-body-sm text-(--color-text-secondary)">
          {group.map((l) => (
            <li key={l.id}>
              {l.name} → <span className="text-(--color-text-primary)">{suggestName(l)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Button type="default" size="tiny" onClick={onApply}>
            Use these names
          </Button>
          <Button type="text" size="tiny" onClick={onDismiss}>
            Keep mine
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Sticky bar shown while rows are ticked: move them all to one brand, or leave them out. */
export function BulkBar({ count, brands, onMove, onExclude, onClear }: { count: number; brands: Brand[]; onMove: (value: string) => void; onExclude: () => void; onClear: () => void }) {
  return (
    <div className="sticky bottom-20 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-large bg-(--gray-1200) py-2.5 pr-2.5 pl-4 text-body-md text-(--color-text-inverse-primary) shadow-[0_8px_24px_rgb(0_0_0/0.2)]">
      <span className="tabular-nums">{count} selected</span>
      <span className="h-4 w-px bg-white/20" />
      <label className="flex items-center gap-2">
        Move to
        <select
          value=""
          onChange={(e) => onMove(e.target.value)}
          className="h-8 rounded-medium border border-white/20 bg-transparent px-2 text-body-md text-(--color-text-inverse-primary) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&>option]:text-(--color-text-primary)"
        >
          <option value="" disabled>
            Choose brand
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name || "Untitled brand"}
            </option>
          ))}
          <option value={NEW_BRAND}>+ New brand…</option>
        </select>
      </label>
      <button type="button" onClick={onExclude} className="h-8 rounded-medium px-2.5 hover:bg-white/10">
        Leave out
      </button>
      <button type="button" aria-label="Clear selection" onClick={onClear} className="ml-auto grid size-8 place-items-center rounded-medium hover:bg-white/10">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

type Draft = { brandId: string; newBrand: string; name: string; street: string; city: string; state: string; zip: string };

/** Manual add, for a POS we don't support yet or a store the POS doesn't list. */
export function AddLocationForm({ brands, onAdd, onCancel }: { brands: Brand[]; onAdd: (d: Draft) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>({ brandId: brands[0]?.id ?? NEW_BRAND, newBrand: "", name: "", street: "", city: "", state: "", zip: "" });
  const [tried, setTried] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: k === "state" ? e.target.value.toUpperCase().slice(0, 2) : k === "zip" ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value });
  const err = {
    newBrand: d.brandId === NEW_BRAND && !d.newBrand.trim() && "Name the brand",
    name: !d.name.trim() && "Give it a short name",
    street: !d.street.trim() && "Enter the street address",
    city: !d.city.trim() && "Enter the city",
    state: !/^[A-Z]{2}$/.test(d.state) && "2 letters",
    zip: d.zip.length !== 5 && "5 digits",
  };
  const e = (k: keyof typeof err) => (tried && err[k]) || undefined;

  return (
    <div className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-5">
      <p className="text-subtitle-sm text-(--color-text-primary)">Add a location</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select label="Brand" value={d.brandId} onChange={set("brandId")} options={[...brands.map((b) => ({ value: b.id, label: b.name || "Untitled brand" })), { value: NEW_BRAND, label: "+ New brand" }]} />
        {d.brandId === NEW_BRAND ? <TextField label="New brand name" placeholder="e.g. Bean & Bloom" value={d.newBrand} onChange={set("newBrand")} error={e("newBrand")} /> : <span className="hidden sm:block" />}
        <TextField label="Short name" placeholder="e.g. Midtown · 5th Ave" value={d.name} onChange={set("name")} error={e("name")} containerClassName="sm:col-span-2" hint="What your team calls this store." />
        <TextField label="Street address" autoComplete="address-line1" value={d.street} onChange={set("street")} error={e("street")} containerClassName="sm:col-span-2" />
        <TextField label="City" autoComplete="address-level2" value={d.city} onChange={set("city")} error={e("city")} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="State" autoComplete="address-level1" placeholder="NY" value={d.state} onChange={set("state")} error={e("state")} />
          <TextField label="ZIP" inputMode="numeric" autoComplete="postal-code" value={d.zip} onChange={set("zip")} error={e("zip")} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && (
          <Button type="text" size="small" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="default"
          size="small"
          iconLeft={<Plus />}
          onClick={() => {
            setTried(true);
            if (Object.values(err).some(Boolean)) return;
            onAdd(d);
          }}
        >
          Add location
        </Button>
      </div>
    </div>
  );
}
