"use client";
import Image from "next/image";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";
import { InStoreMark } from "@/components/ui/InStoreMark";
import { SquareMark } from "@/components/ui/SquareMark";
import type { LaunchSource } from "../LaunchState";

// Pieces every page's launch state (LaunchState) shares: the sample canvas the previews sit on, the
// channel marks, and the "Waiting on" rows for each kind of report.

export const APPS = [
  { key: "doordash", name: "DoorDash", color: "var(--red-900)" },
  { key: "ubereats", name: "Uber Eats", color: "var(--green-900)" },
  { key: "grubhub", name: "Grubhub", color: "var(--gray-900)" },
] as const;
export const STORE_COLOR = "var(--brand-900)";

export const AppIcon = ({ app, size = 16 }: { app: string; size?: number }) => (
  <Image src={asset(`/dashboard/${app}.png`)} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-[3px] object-cover" style={{ width: size, height: size }} />
);
export const StoreIcon = ({ size = 16 }: { size?: number }) => <InStoreMark size={size} />;

/** Every preview sits on the same canvas: a "Sample" tag and a card that bleeds off the bottom. */
export const Canvas = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className="relative h-full px-5 pt-8">
    <span className="absolute top-2.5 right-3 text-[10px] tracking-wide text-(--color-text-tertiary) uppercase">Sample</span>
    <div className={cn("h-full rounded-t-medium border border-b-0 border-(--color-border-default) bg-(--color-background-secondary) p-4 shadow-[0_4px_16px_rgb(0_0_0/0.06)]", className)}>{children}</div>
  </div>
);
/** Small grey label at the top of a preview card. */
export const Label = ({ children }: { children: React.ReactNode }) => <p className="text-[11px] text-(--color-text-secondary)">{children}</p>;

const AppStack = () => (
  <span className="flex gap-1">
    {APPS.map((a) => (
      <AppIcon key={a.key} app={a.key} size={18} />
    ))}
  </span>
);

/** QuickBooks has no logo in the app yet: a green tile with its initials. */
const BooksIcon = () => (
  <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-[4px] bg-(--color-success-darkest) text-[9px] font-semibold text-white">
    QB
  </span>
);

export const SOURCES = {
  pos: { icon: <SquareMark size={18} />, name: "Square", status: "First report" },
  apps: { icon: <AppStack />, name: "Delivery apps", status: "First reports" },
  books: { icon: <BooksIcon />, name: "QuickBooks Online", status: "First sync" },
} satisfies Record<string, LaunchSource>;

export const UPLOAD_NOTE = "Your KoreFi team uploads these each week. This page fills in the week the first ones land.";
