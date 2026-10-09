"use client";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getActiveModule } from "@/lib/nav";

// CuHomeTopBar (Figma 337:22224): page title row at the top of every page inside the shell.
// Inside a cowork module the title is prefixed by the module, tinted in its accent.
export function PageHeader({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) {
  const active = getActiveModule(usePathname());
  const { Icon } = active ?? {};
  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-(--color-border-default) bg-(--color-background-secondary) py-2 pr-4 pl-3">
      <h1 className="flex min-w-0 max-w-full shrink-0 items-center gap-1.5 pl-1 text-body-md text-(--color-text-primary)">
        {active?.persona && Icon && (
          <>
            <span className="flex shrink-0 items-center gap-1.5 text-(--module-strong)">
              <Icon className="size-3.5" />
              {active.label}
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-(--color-text-secondary)" />
          </>
        )}
        <span className="truncate font-medium">{title}</span>
      </h1>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end sm:gap-3">{actions}</div>}
    </div>
  );
}
