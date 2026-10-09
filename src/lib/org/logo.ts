// Turns an uploaded logo file into a small data URL that can be saved with the rest of the setup
// (there's no backend yet, so it lives in the same local storage entry as the brands).
// Raster images are shrunk so the longest side is at most MAX_SIDE and kept as PNG (transparent
// backgrounds survive); SVGs are kept as-is because they're already tiny and stay sharp.

export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const LOGO_ACCEPT = LOGO_TYPES.join(",");
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const SVG_MAX_BYTES = 200 * 1024;
const MAX_SIDE = 256;

export type LogoResult = { ok: true; dataUrl: string } | { ok: false; error: string };

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });

export async function processLogo(file: File): Promise<LogoResult> {
  if (!LOGO_TYPES.includes(file.type)) return { ok: false, error: "Use a PNG, JPG, SVG or WebP image." };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, error: "That file is over 5 MB. Try a smaller image." };

  try {
    const original = await readAsDataUrl(file);
    if (file.type === "image/svg+xml") {
      if (file.size > SVG_MAX_BYTES) return { ok: false, error: "That SVG is too large. Export a simpler version or use a PNG." };
      await loadImage(original); // make sure it actually renders
      return { ok: true, dataUrl: original };
    }

    const img = await loadImage(original);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: true, dataUrl: original };
    ctx.drawImage(img, 0, 0, w, h);
    return { ok: true, dataUrl: canvas.toDataURL("image/png") };
  } catch {
    return { ok: false, error: "We couldn’t read that image. Try a different file." };
  }
}
