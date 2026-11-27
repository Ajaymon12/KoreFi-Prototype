import { BRAND, BRAND_LOGO, STORES, type Store } from "@/lib/finance/outlets";

// The restaurants a /mvp3 viewer can switch between (top-bar switcher), one per stage of a KoreFi customer:
//  - Taco Pros: the full demo chain, 34 outlets and years of reports (every /mvp2 report follows it).
//  - Saffron Grill: 6 outlets with 6 months of reports in, but nothing turned on yet: no chats, and every
//    agent is "Not live" until the owner runs it. Its agents read the same reports, cut to its outlets.
//  - Little Pho: the first-time user. Selecting it (and every refresh) opens straight on the welcome chat in
//    components/mvp3/Onboarding, where the agents connect the delivery apps with the owner (no sign-up screen).
//    No reports have arrived, so there are no chats and every agent is learning; questions are answered on
//    Taco Pros sample data, labelled as such.
//  - Masa Kitchen: the same use case as Taco Pros (same 34 outlets, reports, Home, pinned dashboards and agents),
//    but a locked-down workspace: no New chat, no creating or duplicating agents, and Settings
//    shows only the email. See `limited`. Its dashboards are pinned by the KoreFi team (`teamPinned`), and like Taco Pros
//    it always lands on Home.
// Prototype: Saffron Grill borrows six Taco Pros outlets so its figures still come from the report data.

export type AccountStage = "active" | "new";

export type Account = {
  id: string;
  name: string;
  logo?: string;
  stores: readonly Store[];
  stage: AccountStage;
  /** All the reports are in, but no agent has been turned on: no chats, no run history, every agent Not live. */
  agentsOff?: boolean;
  /** Gets the Home page (live agent summary, components/mvp3/AgentHome). Taco Pros only for now. */
  home?: boolean;
  /** Locked-down workspace: no New chat, no new or duplicated agents, Settings shows email only. */
  limited?: boolean;
  /** The KoreFi team pinned its dashboards: labelled so, each dashboard's chat opens on a summary with suggestions,
   *  and the empty chat (/mvp3) summarises them. It still lands on Home. */
  teamPinned?: boolean;
  /** How much history KoreFi holds, shown in the switcher. */
  history: string;
  /** The data sources KoreFi has for this restaurant (agent `access` names). An agent reading anything else asks the
   *  owner for it on Run instead of running (lib/mvp3/flows). */
  has?: string[];
  /** The agent page's "Has" line. */
  hasLabel?: string;
};
const DATA = ["DoorDash", "Uber Eats", "Grubhub", "POS"];

export const ACCOUNTS: Account[] = [
  { id: "tacopros", name: BRAND, logo: BRAND_LOGO, stores: STORES, stage: "active", home: true, history: "34 outlets · 2 years of reports", has: DATA, hasLabel: "Toast sales and delivery-app reports, last 2 years" },
  { id: "saffron", name: "Saffron Grill", stores: STORES.slice(0, 6), stage: "active", agentsOff: true, history: "6 outlets · 6 months of reports", has: DATA, hasLabel: "Toast sales, last 6 months" },
  { id: "masa", name: "Masa Kitchen", stores: STORES, stage: "active", home: true, limited: true, teamPinned: true, history: "34 outlets · 2 years of reports", has: DATA, hasLabel: "Toast sales and delivery-app reports, last 2 years" },
  { id: "littlepho", name: "Little Pho", stores: STORES, stage: "new", history: "Joined today · no reports yet" },
];

/** A refresh opens as the first-time user, on the welcome chat, so a demo starts from the beginning. */
export const DEFAULT_ACCOUNT = ACCOUNTS.find((a) => a.stage === "new")!;
export const DATA_ACCOUNT = ACCOUNTS[0];
