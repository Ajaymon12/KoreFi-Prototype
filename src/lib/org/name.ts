import type { OnboardingState } from "./types";

/** What the owner's workspace is called. Typed by hand, or — when "Same as my restaurant's name"
 * is on — taken from the restaurants themselves: "Casa Alvarez", or "Casa Alvarez + 1 more".
 * Empty until there's something to show (the restaurants aren't known until the POS is connected). */
export function orgName(s: Pick<OnboardingState, "org" | "brands" | "locations">): string {
  if (!s.org.sameAsRestaurant) return s.org.name.trim();
  const names = s.brands.filter((b) => b.name.trim() && s.locations.some((l) => l.included && l.brandId === b.id)).map((b) => b.name.trim());
  if (!names.length) return "";
  return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
}
