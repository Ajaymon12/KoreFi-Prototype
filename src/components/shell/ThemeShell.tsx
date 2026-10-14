"use client";
import { cn } from "@/lib/utils";
import { useTheme } from "./useTheme";

export type Product = "owner" | "ops";

/** The app's outer frame: scopes the Foundation tokens to the resolved light/dark theme and,
 *  for the Ops product, swaps the accent (see app/ops-theme.css). */
export function ThemeShell({ className, product = "owner", children }: { className?: string; product?: Product; children: React.ReactNode }) {
  const { resolved } = useTheme();
  return (
    <div data-product={product} className={cn(resolved, className)} style={{ colorScheme: resolved }}>
      {children}
    </div>
  );
}
