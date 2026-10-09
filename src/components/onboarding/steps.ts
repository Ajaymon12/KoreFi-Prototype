import { Building2, ImagePlus, Landmark, MapPin, MonitorSmartphone, Truck, type LucideIcon } from "lucide-react";
import { STEP_HREF, STEP_ORDER, reach } from "@/lib/org/store";
import type { StepKey } from "@/lib/org/types";

/** The six steps in the setup wizard's left rail. */
export const SETUP_STEPS: { key: StepKey; label: string; Icon: LucideIcon }[] = [
  { key: "business", label: "Your business", Icon: Building2 },
  { key: "pos", label: "Point of sale", Icon: MonitorSmartphone },
  { key: "locations", label: "Locations", Icon: MapPin },
  { key: "logos", label: "Brand logos", Icon: ImagePlus },
  { key: "delivery", label: "Delivery apps", Icon: Truck },
  { key: "accounting", label: "Accounting & bank", Icon: Landmark },
];

export const nextStep = (key: StepKey) => STEP_ORDER[STEP_ORDER.indexOf(key) + 1];
export const prevStep = (key: StepKey) => STEP_ORDER[STEP_ORDER.indexOf(key) - 1];

/** Bookmarks the next step and returns where to go. Once the owner has seen Review, an edited
 * step goes straight back there instead of walking through the rest again. */
export function advance(from: StepKey, reached: StepKey) {
  if (STEP_ORDER.indexOf(reached) >= STEP_ORDER.indexOf("review")) return STEP_HREF.review;
  const to = nextStep(from);
  reach(to);
  return STEP_HREF[to];
}
