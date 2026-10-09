import type { SourceId } from "@/lib/sources/types";

// How an owner's business is shaped: one org (the owner's group) → brands (concepts) → locations
// (branches). Locations come from the POS during onboarding; brands are suggested from their names.

export type PosId = "square" | "toast" | "clover";
export type DeliveryApp = "doordash" | "ubereats" | "grubhub" | "other";

export type Address = { street: string; city: string; state: string; zip: string };

/** `logo` is a small data URL (see src/lib/org/logo.ts), so it lives with the rest of the saved setup. */
export type Brand = { id: string; name: string; logo?: string };

export type Location = {
  id: string;
  brandId: string | null;
  /** Short name the owner recognises, e.g. "Midtown · 5th Ave". Shown with the brand everywhere. */
  name: string;
  /** Name as the POS has it, kept so the owner can match rows to their POS. */
  posName: string;
  posSource: PosId | "manual";
  address: Address;
  neighborhood: string;
  lat?: number;
  lng?: number;
  included: boolean;
  /** Set when the import thinks this is a training/test store. */
  looksLikeTest?: boolean;
  deliveryApps: DeliveryApp[];
};

export type SizeBand = "1" | "2-5" | "6-15" | "16+";
export type JobTitle = "Owner" | "Operator" | "Partner" | "General manager";

export type Account = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  title: JobTitle | "";
  /** The password itself is never kept, even in the mock. */
  hasPassword: boolean;
  viaGoogle: boolean;
};

/** `sameAsRestaurant`: name the workspace after the restaurant(s) instead of typing a group name
 * (see orgName in ./name.ts). Absent on setups saved before the option existed. */
export type Org = { name: string; sameAsRestaurant?: boolean; sizeBand: SizeBand | ""; types: string[] };

export type StepKey = "account" | "profile" | "business" | "pos" | "locations" | "logos" | "delivery" | "accounting" | "review" | "ready";

/** What the TopBar switcher is scoped to. */
export type Scope = { kind: "all" } | { kind: "brand"; id: string } | { kind: "location"; id: string };

export type OnboardingState = {
  account: Account;
  org: Org;
  brands: Brand[];
  locations: Location[];
  /** Sources the owner connected during onboarding (POS, accounting, bank). */
  connected: SourceId[];
  /** POS systems whose locations have already been pulled in. */
  imported: PosId[];
  skipped: ("logos" | "delivery" | "accounting")[];
  /** Furthest step reached, for resume and for the step rail. */
  step: StepKey;
  completed: boolean;
  scope: Scope;
};
