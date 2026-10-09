"use client";
import { usePathname } from "next/navigation";
import { getActiveModule } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Tags its subtree with the active module so `--module-*` tokens (module-themes.css) resolve. */
export function ModuleScope({ className, children }: { className?: string; children: React.ReactNode }) {
  const active = getActiveModule(usePathname());
  return (
    <div data-module={active?.id ?? "home"} className={cn(className)}>
      {children}
    </div>
  );
}
