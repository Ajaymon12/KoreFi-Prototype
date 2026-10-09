"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { LOGO_ACCEPT, processLogo } from "@/lib/org/logo";
import type { Brand } from "@/lib/org/types";

// One upload card per brand. Click the tile or the button to pick a file, or drop an image onto
// the card. The preview always sits on white so any logo shows up, in light or dark mode.

type Props = { brand: Brand; locationCount: number; onChange: (logo: string | undefined) => void };

export function LogoUploadCard({ brand, locationCount, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = brand.name.trim() || "this brand";

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await processLogo(file);
    setBusy(false);
    if (r.ok) onChange(r.dataUrl);
    else setError(r.error);
  };

  return (
    <section
      aria-label={`Logo for ${name}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex flex-col gap-4 rounded-large border p-4 transition-colors sm:flex-row sm:items-center",
        dragging ? "border-(--color-primary-solid) bg-(--brand-100)" : "border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={LOGO_ACCEPT}
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = ""; // let the same file be picked again after a Remove
        }}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={brand.logo ? `Replace logo for ${name}` : `Upload logo for ${name}`}
        className={cn(
          "grid size-20 shrink-0 place-items-center overflow-hidden rounded-large outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)",
          brand.logo
            ? "border border-(--color-border-default) bg-white p-2"
            : "border border-dashed border-(--color-border-darker) bg-(--color-neutral-lightest) text-(--color-text-secondary) hover:bg-(--color-neutral-light)",
        )}
      >
        {brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a saved data URL, nothing to optimise
          <img src={brand.logo} alt={`${name} logo`} className="size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-body-sm">
            <ImagePlus className="size-5" aria-hidden />
            Add
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-subtitle-md text-(--color-text-primary)">{brand.name.trim() || "Untitled brand"}</p>
        <p className="text-body-sm text-(--color-text-secondary)">
          {locationCount} {locationCount === 1 ? "location" : "locations"}
        </p>
        {error ? (
          <p role="alert" className="mt-1.5 text-body-sm text-(--color-text-danger)">
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-body-sm text-(--color-text-tertiary)">{dragging ? "Drop to upload" : "PNG, JPG, SVG or WebP, up to 5 MB. Drop a file here or pick one."}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button type="default" size="small" loading={busy} iconLeft={<Upload />} onClick={() => input.current?.click()}>
          {brand.logo ? "Replace" : "Upload logo"}
        </Button>
        {brand.logo && (
          <Button type="text" size="small" iconLeft={<Trash2 />} onClick={() => onChange(undefined)} aria-label={`Remove logo for ${name}`}>
            Remove
          </Button>
        )}
      </div>
    </section>
  );
}
