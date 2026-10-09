"use client";
import { useRef, useState } from "react";
import { LogoField } from "./LogoField";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { update } from "@/lib/org/store";
import type { Brand, Location, Scope } from "@/lib/org/types";

// Adds a restaurant (a brand with its first branch) or a branch to an existing restaurant, from the
// location picker in the top bar. Everything is typed by hand here: stores that come from a POS are
// imported during setup. The picker then jumps to what was just added.

export type AddMode = { kind: "restaurant" } | { kind: "branch"; brand: Brand };

const uid = () => Math.random().toString(36).slice(2, 9);

type Props = { mode: AddMode; siblings: Location[]; onClose: () => void; onDone: (scope: Scope, message: string) => void };

export function AddOutletDialog({ mode, siblings, onClose, onDone }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, true, onClose);
  const first = siblings[0];
  const [f, setF] = useState({ restaurant: "", name: "", street: "", city: first?.address.city ?? "", state: first?.address.state ?? "", zip: "" });
  const [logo, setLogo] = useState<string | undefined>();
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "state" ? e.target.value.toUpperCase().slice(0, 2) : k === "zip" ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value });

  const isRestaurant = mode.kind === "restaurant";
  const err = {
    restaurant: isRestaurant && !f.restaurant.trim() && "Enter the restaurant’s name",
    name: !f.name.trim() && "Give this branch a short name",
    street: !f.street.trim() && "Enter the street address",
    city: !f.city.trim() && "Enter the city",
    state: !/^[A-Z]{2}$/.test(f.state) && "2 letters",
    zip: f.zip.length !== 5 && "5 digits",
  };
  const show = (k: keyof typeof err) => (tried && err[k]) || undefined;
  // Two stores in one ZIP are the ones people mix up, so ask for a name that tells them apart.
  const sameZip = !isRestaurant && f.zip.length === 5 ? siblings.find((l) => l.address.zip === f.zip) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const brand: Brand = mode.kind === "restaurant" ? { id: `b_${uid()}`, name: f.restaurant.trim(), ...(logo ? { logo } : {}) } : mode.brand;
    const loc: Location = {
      id: `l_${uid()}`,
      brandId: brand.id,
      name: f.name.trim(),
      posName: f.name.trim(),
      posSource: "manual",
      address: { street: f.street.trim(), city: f.city.trim(), state: f.state, zip: f.zip },
      neighborhood: f.city.trim(),
      included: true,
      deliveryApps: [],
    };
    update((s) => ({ brands: mode.kind === "restaurant" ? [...s.brands, brand] : s.brands, locations: [...s.locations, loc] }));
    if (mode.kind === "restaurant") onDone({ kind: "brand", id: brand.id }, `Added ${brand.name}`);
    else onDone({ kind: "location", id: loc.id }, `Added ${loc.name} to ${brand.name}`);
  };

  const title = mode.kind === "restaurant" ? "Add a restaurant" : `Add a branch to ${mode.brand.name}`;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/30 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="my-auto w-full max-w-[480px] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6 shadow-[0_16px_48px_rgb(0_0_0/0.18)]">
        <h2 className="text-subtitle-lg text-(--color-text-primary)">{title}</h2>
        <p className="mt-1 text-body-md text-(--color-text-secondary)">
          {isRestaurant ? "A restaurant is a brand with its own name and logo, like Casa Alvarez. Add its first branch now; more can be added from the menu." : "A branch is one of its stores. Its sales appear once its POS is connected."}
        </p>

        <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-4">
          {isRestaurant && (
            <>
              <TextField label="Restaurant name" placeholder="e.g. Bean & Bloom" value={f.restaurant} onChange={set("restaurant")} error={show("restaurant")} autoFocus />
              <LogoField value={logo} onChange={setLogo} />
            </>
          )}

          <TextField label={isRestaurant ? "First branch name" : "Branch name"} placeholder="e.g. Midtown · 5th Ave" value={f.name} onChange={set("name")} error={show("name")} hint="What your team calls this store." autoFocus={!isRestaurant} />
          <TextField label="Street address" autoComplete="address-line1" value={f.street} onChange={set("street")} error={show("street")} />
          <div className="grid grid-cols-[1fr_72px_96px] gap-3">
            <TextField label="City" autoComplete="address-level2" value={f.city} onChange={set("city")} error={show("city")} />
            <TextField label="State" autoComplete="address-level1" placeholder="NY" value={f.state} onChange={set("state")} error={show("state")} />
            <TextField label="ZIP" inputMode="numeric" autoComplete="postal-code" value={f.zip} onChange={set("zip")} error={show("zip")} />
          </div>
          {sameZip && (
            <p className="rounded-medium bg-(--color-warning-lightest) p-3 text-body-sm text-(--color-text-primary)">
              You already have <b className="font-medium">{sameZip.name}</b> in this ZIP. Give this branch a name that tells them apart, like “Midtown · Lex Ave”.
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="outline" size="small" onClick={onClose}>
              Cancel
            </Button>
            <Button type="primary" size="small" htmlType="submit">
              {isRestaurant ? "Add restaurant" : "Add branch"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
