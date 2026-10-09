import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Brand, DeliveryApp } from "@/lib/org/types";

// Small identity marks used across onboarding: a lettered disc per brand (so brands are easy to
// tell apart in lists), and the delivery apps' own logos.

const BRAND_TINTS = [
  "bg-(--brand-300) text-(--brand-1200)",
  "bg-(--blue-300) text-(--blue-1200)",
  "bg-(--green-300) text-(--green-1200)",
  "bg-(--purple-300) text-(--purple-1200)",
  "bg-(--yellow-300) text-(--yellow-1200)",
];

export function BrandMark({ brand, brands, size = "md" }: { brand: Brand; brands: Brand[]; size?: "sm" | "md" }) {
  const i = Math.max(0, brands.findIndex((b) => b.id === brand.id));
  const letters = (brand.name.trim() || "?")
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  // An uploaded logo replaces the letters. It always sits on white so dark-on-transparent logos
  // stay visible in dark mode.
  if (brand.logo)
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center overflow-hidden rounded-medium border border-(--color-border-default) bg-white", size === "sm" ? "size-6 p-px" : "size-8 p-0.5")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a saved data URL, nothing to optimise */}
        <img src={brand.logo} alt="" className="size-full object-contain" />
      </span>
    );
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-medium font-medium", BRAND_TINTS[i % BRAND_TINTS.length], size === "sm" ? "size-6 text-[11px]" : "size-8 text-menu-sm")}>
      {letters || "?"}
    </span>
  );
}

const APP_LOGO: Partial<Record<DeliveryApp, string>> = { doordash: "/dashboard/doordash.png", ubereats: "/dashboard/ubereats.png", grubhub: "/dashboard/grubhub.png" };

export function AppLogo({ app, size = 20 }: { app: DeliveryApp; size?: number }) {
  const src = APP_LOGO[app];
  if (!src) return <span aria-hidden className="grid place-items-center rounded-small bg-(--color-neutral-light) text-[10px] text-(--color-text-secondary)" style={{ width: size, height: size }}>+</span>;
  return <Image src={src} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-small object-contain" style={{ width: size, height: size }} />;
}
