// MVP 3 class strings for the patterns the DS ❖ Button (components/ui/Button) doesn't cover. Every labelled
// action uses <Button> (or buttonVariants on a Link); these are for the ghost icon-only control, pill chips and
// the bare focus ring on custom rows. All values are Foundation alias tokens (src/app/foundation.css).

export const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

/** Ghost icon-only button (close, back, more). Add a size (size-6 / size-7 / size-8) and always an aria-label. */
export const iconButton = `grid place-items-center rounded-medium text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) ${focusRing}`;

/** Pill chip for suggestions, follow-ups and quick links. Hover is brand orange like every CTA. Add padding (px-3 py-1.5) and layout as needed. */
export const pill = `rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) text-body-sm text-(--color-text-primary) transition-colors hover:border-(--color-primary) hover:bg-(--color-primary)/8 hover:text-(--color-text-clickable) disabled:opacity-50 ${focusRing}`;

// Dialog spec UI-DIALOG-002 (docs/specs/modal-dimensional-drawing.html): SC scrim 40 %, R1 = 20 (xlarge),
// B = 0, shadow Y 24 · BL 64 · SP 0. Every centred dialog uses these two; stacking (z-*) stays per dialog.
export const scrim = "fixed inset-0 bg-black/40";
export const dialogSurface = "rounded-xlarge bg-(--color-background-secondary) shadow-[0_24px_64px_rgb(0_0_0/0.28)]";
