"use client";
import { cn } from "@/lib/utils";
import { useTheme } from "./useTheme";

/** The app's outer frame: scopes the Foundation tokens to the resolved light/dark theme. */
export function ThemeShell({ className, children }: { className?: string; children: React.ReactNode }) {
  const { resolved } = useTheme();
  return (
    <div className={cn(resolved, className)} style={{ colorScheme: resolved }}>
      {children}
    </div>
  );
}
