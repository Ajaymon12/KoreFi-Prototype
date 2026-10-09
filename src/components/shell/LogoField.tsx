"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LOGO_ACCEPT, processLogo } from "@/lib/org/logo";

// Compact logo picker for the add / rename dialogs: a tile you click to choose a file, with the
// accepted formats underneath and a Remove button once there's a logo. The preview sits on white
// so any logo shows up in light or dark mode. (Setup uses the bigger LogoUploadCard.)

export function LogoField({ value, onChange }: { value?: string; onChange: (logo: string | undefined) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <input
        ref={file}
        type="file"
        accept={LOGO_ACCEPT}
        hidden
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = ""; // lets the same file be chosen again after Remove
          if (!picked) return;
          const r = await processLogo(picked);
          if (r.ok) {
            onChange(r.dataUrl);
            setError(null);
          } else setError(r.error);
        }}
      />
      <button
        type="button"
        onClick={() => file.current?.click()}
        aria-label={value ? "Replace logo" : "Upload logo"}
        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-large border border-dashed border-(--color-border-darker) bg-(--color-neutral-lightest) p-1 text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&:has(img)]:border-solid [&:has(img)]:bg-white"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
          <img src={value} alt="Logo preview" className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-5" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-label-sm text-(--color-text-secondary)">Logo (optional)</p>
        {error ? (
          <p role="alert" className="text-body-sm text-(--color-text-danger)">
            {error}
          </p>
        ) : (
          <p className="text-body-sm text-(--color-text-tertiary)">PNG, JPG, SVG or WebP, up to 5 MB</p>
        )}
      </div>
      {value && (
        <Button type="text" size="small" iconLeft={<Trash2 />} onClick={() => onChange(undefined)} aria-label="Remove logo">
          Remove
        </Button>
      )}
    </div>
  );
}
