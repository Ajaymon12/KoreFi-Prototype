import { BRAND, BRAND_LOGO, STORES, type Store } from "@/lib/finance/outlets";

// The restaurants a /mvp3 viewer can switch between (top-bar switcher), one per stage of a KoreFi customer:
//  - Taco Pros: the full demo chain, 34 outlets and years of reports (every /mvp2 report follows it).
//  - Saffron Grill: on KoreFi for 6 months, 6 outlets. Its agents read the same reports, cut to its outlets.
//  - Little Pho: signed up today. No reports have arrived, so there are no chats and every agent is learning.
// Prototype: Saffron Grill borrows six Taco Pros outlets so its figures still come from the report data.

export type AccountStage = "active" | "new";

export type Account = {
  id: string;
  name: string;
  logo?: string;
  stores: readonly Store[];
  stage: AccountStage;
  /** How much history KoreFi holds, shown in the switcher. */
  history: string;
};

export const ACCOUNTS: Account[] = [
  { id: "tacopros", name: BRAND, logo: BRAND_LOGO, stores: STORES, stage: "active", history: "34 outlets · 2 years of reports" },
  { id: "saffron", name: "Saffron Grill", stores: STORES.slice(0, 6), stage: "active", history: "6 outlets · 6 months of reports" },
  { id: "littlepho", name: "Little Pho", stores: [], stage: "new", history: "Joined today · no reports yet" },
];

export const DEFAULT_ACCOUNT = ACCOUNTS[0];
