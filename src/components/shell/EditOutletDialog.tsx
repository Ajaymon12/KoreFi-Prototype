"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { update } from "@/lib/org/store";
import type { Brand, Location } from "@/lib/org/types";
import { LogoField } from "./LogoField";

// Renames a restaurant (and swaps or removes its logo), or renames one branch. Opened from the
// pencil on a row in the location picker. Names have to be unique among their siblings so two
// rows in the picker are never indistinguishable.

export type EditMode = { kind: "restaurant"; brand: Brand; others: string[] } | { kind: "branch"; brand: Brand; location: Location; others: string[] };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function EditOutletDialog({ mode, onClose, onDone }: { mode: EditMode; onClose: () => void; onDone: (message: string) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, true, onClose);
  const isRestaurant = mode.kind === "restaurant";
  const original = isRestaurant ? mode.brand.name : mode.location.name;
  const [name, setName] = useState(original);
  const [logo, setLogo] = useState(isRestaurant ? mode.brand.logo : undefined);
  const [tried, setTried] = useState(false);

  const error = !name.trim()
    ? isRestaurant
      ? "Enter the restaurant’s name"
      : "Enter a name for this branch"
    : mode.others.some((o) => same(o, name))
      ? isRestaurant
        ? "You already have a restaurant with this name"
        : `${mode.brand.name} already has a branch with this name`
      : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (error) return;
    const next = name.trim();
    if (mode.kind === "restaurant") {
      update((s) => ({ brands: s.brands.map((b) => (b.id === mode.brand.id ? { ...b, name: next, logo } : b)) }));
      onDone(next === original ? "Saved" : `Renamed to ${next}`);
    } else {
      update((s) => ({ locations: s.locations.map((l) => (l.id === mode.location.id ? { ...l, name: next } : l)) }));
      onDone(next === original ? "Saved" : `Renamed to ${next}`);
    }
  };

  const title = isRestaurant ? "Rename restaurant" : "Rename branch";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/30 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="my-auto w-full max-w-[440px] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6 shadow-[0_16px_48px_rgb(0_0_0/0.18)]">
        <h2 className="text-subtitle-lg text-(--color-text-primary)">{title}</h2>
        <p className="mt-1 text-body-md text-(--color-text-secondary)">
          {isRestaurant
            ? "The new name shows everywhere this restaurant appears. Your reports and history stay as they are."
            : `${mode.brand.name} · ${mode.location.address.street}. The address and history stay as they are.`}
        </p>

        <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <TextField
            label={isRestaurant ? "Restaurant name" : "Branch name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={tried ? error : undefined}
            hint={isRestaurant ? undefined : "What your team calls this store, like “Midtown · 5th Ave”."}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          {isRestaurant && <LogoField value={logo} onChange={setLogo} />}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="outline" size="small" onClick={onClose}>
              Cancel
            </Button>
            <Button type="primary" size="small" htmlType="submit">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
