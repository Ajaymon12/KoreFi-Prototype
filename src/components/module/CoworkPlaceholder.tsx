"use client";
import { usePathname } from "next/navigation";
import { getActiveModule } from "@/lib/nav";
import { Illustration } from "./Illustration";

/** Empty state for pages that aren't built yet; fronted by the active cowork's illustration. */
export function CoworkPlaceholder({ title }: { title: string }) {
  const persona = getActiveModule(usePathname())?.persona;
  if (!persona) {
    return <div className="grid flex-1 place-items-center text-body-md text-(--color-text-secondary)">Coming soon.</div>;
  }
  return (
    <div className="grid flex-1 place-items-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Illustration kind={persona.illustration} className="h-44 w-56" title={persona.role} />
        <div className="space-y-1">
          <h2 className="text-subtitle-md text-(--color-text-primary)">{title} is on its way</h2>
          <p className="text-body-md text-(--color-text-secondary)">
            Your {persona.role.replace(" cowork", "")} cowork is setting this page up. {persona.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
