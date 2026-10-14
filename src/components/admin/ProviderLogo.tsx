import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/onboarding/marks";
import type { ProviderId } from "@/lib/admin/data";

/** Provider mark: real logos for the 3PD apps, a small tile for the POS systems. */
export function ProviderLogo({ id, size = 18 }: { id: ProviderId; size?: number }) {
  if (id === "doordash" || id === "ubereats" || id === "grubhub") return <AppLogo app={id} size={size} />;
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-small text-[10px] font-medium text-white", id === "toast" ? "bg-[#ff4c00]" : "bg-(--gray-1200)")} style={{ width: size, height: size }}>
      {id === "toast" ? "T" : "■"}
    </span>
  );
}
