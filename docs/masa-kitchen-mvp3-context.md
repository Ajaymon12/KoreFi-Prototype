# KoreFi MVP3 — Masa Kitchen: context for a new project

This file holds everything needed to rebuild or continue the **Masa Kitchen** demo from KoreFi's MVP3 prototype in a fresh project. Drop it into the new repo, for example as `CONTEXT.md`, and point `CLAUDE.md` at it.

Source: the `astryx-spike` branch of the KoreFi repo, as of 2026-11-23. Every figure below is copied from `src/lib/mvp3/masaFixture.ts`.

---

## 1. What KoreFi is

- KoreFi is a **done-for-you finance and ops service for multi-outlet restaurants**. It reads the restaurant's delivery-app reports (DoorDash, Uber Eats, Grubhub) and its POS (Toast in the MVP3 copy).
- **The KoreFi ops team does every fix**: it files disputes, chases unpaid orders and uploads reports. The owner only reads results.
- **MVP3** presents KoreFi as a set of always-on **agents** (Finance, Operations, Growth) inside a chat, modelled on ChatGPT "Dots". Agents run on a schedule, email a short summary, and keep a dashboard up to date. The owner can ask follow-up questions in chat.
- The build is a **frontend-only prototype**: no backend, all data mocked, all state in memory. A refresh resets everything except the account picked, which is kept in localStorage.

## 2. Who Masa Kitchen is in the demo

Masa Kitchen is one of four demo accounts in MVP3. Each account shows a different customer stage:

| Account | Stage | Purpose |
|---|---|---|
| Taco Pros | active, 34 outlets, 2 years of data | full product, owner can do everything |
| Saffron Grill | 6 outlets, 6 months of data, agents off | "nothing turned on yet"; agents ask for missing documents |
| **Masa Kitchen** | **active, 2 years of data, locked-down workspace** | **customer demo and leadership flows 1–2** |
| Little Pho | brand new, no reports | first-login onboarding |

The Masa Kitchen account config:

```ts
{ id: "masa", name: "Masa Kitchen", stores: STORES, stage: "active", home: true,
  limited: true, teamPinned: true, history: "34 outlets · 2 years of reports",
  has: ["DoorDash", "Uber Eats", "Grubhub", "POS"],
  hasLabel: "Toast sales and delivery-app reports, last 2 years" }
```

- **`limited`** means a locked-down workspace:
  - no New chat (sidebar or Search chats);
  - no Integrations (the link is hidden and the route redirects to Home);
  - no New agent or Duplicate agent;
  - Settings shows the email only.
- **`teamPinned`**: the KoreFi team set up its dashboards, labelled `pinnedBy: "team"`. The Activity log shows "Pinned the X dashboard" by the KoreFi team.
- **Landing**: always opens on **Home** (`/mvp3/home`). There is no empty chat home; with no chat open, `/mvp3` redirects to Home.
- **Live agents**: only **Chargeback recovery** (Operations agent) and **Payout reconciliation** (Finance agent).
- **Recent chats** start with exactly two threads: **Chargebacks** (id `cb`, Thu 8:00 AM) and **Payouts** (id `payout`, Fri 8:00 AM).
- **Dashboards** start unpinned. The sidebar hint reads "Pin a dashboard to keep it here."
- Questions outside the connected data (labor, food cost, profit, margin) always get one fixed reply:
  > **I can't see that yet.** Labor needs your payroll report, and food cost needs stock counts and supplier bills. The KoreFi team can set either up with you.

## 3. Product rules (non-negotiable)

1. **Report only.**
   - Owner screens never show fix or approve buttons, and never use imperative copy like "Reconnect", "Fix", "Approve" or "Needs your attention".
   - Use neutral status and links into detail.
   - The only owner actions are:
     - asking in chat;
     - downloading;
     - sending a sheet to a manager;
     - answering one Yes/No order question (payout flow).
2. **Disputes are filed by the KoreFi team**, never self-serve.
3. **The figures must agree everywhere.** The email, the chat, the dashboard and the PDF/Excel attachment all show identical numbers. Don't add a number that isn't in the fixture.
4. **Scripted copy is verbatim** (leadership spec, 2026-11-20). Don't reword the replies in §6.
5. **The order list stays in the app.** It never goes into the email or its attachments, which keep totals by outlet only.
6. **Data sources**:
   - The POS covers "In store & website" (Toast in the copy). The 3PD apps are DoorDash, Uber Eats and Grubhub.
   - Group and label by **POS vs 3PD**.
   - Payouts are a **2-way check** (Toast ⇄ app reports and payouts). Bank deposits are **not** checked: the bank isn't connected.
7. **Plain-English copy.** Write "Still to dispute", "Won", "Denied", "Awaiting decision". Avoid jargon such as "reason code" or "dispute stage".
8. **Colour for meaning only.** Red means over the limit and green means won back. Outlet rankings use neutral greys, darkest first.

## 4. The demo journey

**Customer demo (starts in an email):**

1. Open `/inbox`, a generic Gmail-like webmail with a "Mail" mark and no real brand. KoreFi's Thursday chargebacks email sits unread at the top, with filler supplier and staff mail below it.
2. Open the email. The CTA is **Open in KoreFi**.
3. The CTA sets `sessionStorage["korefi.mvp3.account"] = "masa"` and goes to `/mvp3?dash=dash-chargebacks`.
4. The app opens the **Chargebacks** chat with the dashboard beside it, then strips the param. (Don't use `?chat=`: it forces Taco Pros.)

**Leadership flow 1 — chargeback week.** Agents → Chargeback recovery → "See the email" → Open in KoreFi → chat with three prompts (see §6).

**Leadership flow 2 — payout week.** Payouts email (Fri, Nov 13) → chat → dashboard → the one order that needs the owner.

**Chat layout:**

- An open chat has an h-14 header: back to Home, agent mark, title, Activity, agent menu.
- The chat is a resizable rounded card on the left (width saved under `mvp3.chatWidth`).
- The dashboard fills the right side of the same panel.
- A reply's `view` switches the dashboard's view.
- Follow-up chips show only on the newest agent message.

## 5. The data: sample week Nov 1–7 (Sun–Sat)

### 5.1 Chargebacks

- Week `Nov 1–7` · outlet limit **1%** of app sales · usual week **$325**.
- **Charged back: $397** on 33 orders (+$72 vs usual).
- Status in $:

  | Won | Awaiting decision | Denied | Still to dispute |
  |---|---|---|---|
  | **$216** | **$41** | **$28** (2 orders) | **$112** (9 orders) |

- Disputed = $285, won share = 76%.

**By outlet** (sales are delivery-app sales):

| Outlet (short) | Full outlet name | App sales | Charged | Rate | Orders w/ errors | Usual | Won back |
|---|---|---|---|---|---|---|---|
| Damen | Damen & Chicago | $11,540 | $150 | **1.3% (over limit)** | 14 | 8 | $85 |
| Oak Park | Oak Park | $10,220 | $92 | 0.9% | 7 | 6 | $50 |
| Montrose | Montrose & N Elston | $9,710 | $68 | 0.7% | 5 | 5 | $38 |
| Halsted | Chicago & Halsted | $9,170 | $55 | 0.6% | 4 | 5 | $28 |
| Gurnee | Gurnee | $8,000 | $32 | 0.4% | 3 | 3 | $15 |
| Niles | Niles | $7,400 | $0 | 0% | 0 | 1 | $0 |
| Hyde Park | Hyde Park | $6,900 | $0 | 0% | 0 | 1 | $0 |
| **Total** | | **$62,940** | **$397** | | **33** | | **$216** |

**By app:**

| App | Orders | Charged | Won |
|---|---|---|---|
| DoorDash | 20 | $248 | $139 |
| Uber Eats | 10 | $112 | $62 |
| Grubhub | 3 | $37 | $15 |

**What went wrong:**

| Missing item | Wrong item | Food quality | Never arrived |
|---|---|---|---|
| 15 | 8 | 6 | 4 |

**Damen's story:**

- "6 of them were on Wednesday and Thursday, its usual worst days. 8 were missing items. Chips & Queso was left out 3 times, which is new (2 complaints in all of October)."
- Source: "From the app adjustment reports, matched to Damen's Toast orders".
- Fixes for the manager's sheet:
  - **Wednesday and Thursday**: 6 of 14 errors were on these two days. Add a second bag check on those shifts.
  - **Missing items: 8 of 14**: Count items into the bag against the ticket before sealing.
  - **Chips & Queso left out 3 times**: New this week. Check where sides are packed.

**Status explanations:**

- **$112 is not filed yet.** "The KoreFi team reviews each dispute before filing. All of these are inside the apps' deadlines: 14 days from the order on DoorDash, 30 days on Uber Eats and Grubhub. You'll see the result in next Thursday's review."
- **$28 was denied.** "Both were food-quality claims. The apps rarely refund those without a photo from the customer. $41 more is awaiting the apps' decision."

**All 33 charges** (outlet · day · app · item · reason · amount · status):

```
Damen    Sun Nov 1  DD  Burrito bowl      Missing item   12.50  Won
Damen    Mon Nov 2  UE  Chips & Queso     Missing item    6.50  Won
Damen    Tue Nov 3  DD  Steak taco plate  Wrong item     14.00  Won
Damen    Tue Nov 3  UE  Horchata          Missing item    4.50  Won
Damen    Wed Nov 4  DD  Chips & Queso     Missing item    6.50  Won
Damen    Wed Nov 4  DD  Burrito bowl      Missing item   12.50  Won
Damen    Wed Nov 4  UE  Quesadilla        Wrong item     11.00  Awaiting decision
Damen    Thu Nov 5  DD  Family taco pack  Missing item   24.00  Won
Damen    Thu Nov 5  DD  Chips & Queso     Missing item    6.50  Still to dispute
Damen    Thu Nov 5  GH  Carnitas bowl     Food quality   13.50  Denied
Damen    Fri Nov 6  DD  Steak taco plate  Wrong item     14.00  Still to dispute
Damen    Fri Nov 6  UE  Burrito bowl      Food quality   12.50  Still to dispute
Damen    Sat Nov 7  DD  Horchata          Missing item    4.50  Won
Damen    Sat Nov 7  DD  Carnitas bowl     Food quality    7.50  Still to dispute
Oak Park Mon Nov 2  DD  Burrito bowl      Missing item   12.50  Won
Oak Park Tue Nov 3  DD  Chips & Queso     Missing item    6.50  Won
Oak Park Wed Nov 4  DD  Steak taco plate  Wrong item     14.00  Won
Oak Park Thu Nov 5  UE  Quesadilla        Wrong item     17.00  Won
Oak Park Fri Nov 6  UE  Horchata          Missing item    5.00  Still to dispute
Oak Park Sat Nov 7  DD  Family taco pack  Never arrived  15.50  Still to dispute
Oak Park Sat Nov 7  UE  Family taco pack  Food quality   21.50  Awaiting decision
Montrose Sun Nov 1  UE  Burrito bowl      Missing item   12.50  Won
Montrose Tue Nov 3  DD  Steak taco plate  Wrong item     14.00  Won
Montrose Wed Nov 4  DD  Chips & Queso     Missing item    7.00  Won
Montrose Thu Nov 5  UE  Horchata          Missing item    4.50  Won
Montrose Fri Nov 6  DD  Family taco pack  Never arrived  30.00  Still to dispute
Halsted  Mon Nov 2  DD  Quesadilla        Wrong item     11.00  Won
Halsted  Wed Nov 4  UE  Burrito bowl      Food quality   17.00  Won
Halsted  Thu Nov 5  DD  Carnitas bowl     Food quality   14.50  Denied
Halsted  Sat Nov 7  DD  Burrito bowl      Never arrived  12.50  Still to dispute
Gurnee   Tue Nov 3  GH  Steak taco plate  Wrong item     15.00  Won
Gurnee   Fri Nov 6  DD  Chips & Queso     Missing item    8.50  Still to dispute
Gurnee   Sat Nov 7  GH  Burrito bowl      Never arrived   8.50  Awaiting decision
```

Order IDs in the Transactions table are made up per app, as `DD-XXXX`, `UE-XXXX` and `GH-XXXX`.

### 5.2 Payouts (complete week, emailed Fri, Nov 13)

- **Paid: $45,580** on $62,940 of app sales. The apps kept **27.6%** overall. Paid $1,960 more than last week.
- Commission limit is 30%.

| App | Orders | Paid on | Sales | Commission | Promos | Ads | Chargebacks | Paid | vs last week | Kept |
|---|---|---|---|---|---|---|---|---|---|---|
| DoorDash | 1,322 | Thu, Nov 12 | $34,400 | $7,568 (22%) | $960 | $0 | $109 | $25,763 | +$640 | 25% |
| Uber Eats | 804 | Mon, Nov 9 | $20,900 | $5,643 (27%) | $790 | $580 | $50 | $13,837 | +$1,120 | **34%** |
| Grubhub | 294 | Wed, Nov 11 | $7,640 | $1,528 (20%) | $110 | $0 | $22 | $5,980 | +$200 | 22% |

- Toast delivery orders: **2,420**. Matched: **2,416**. **4 didn't match, $119.55 in all.**

| Order | Outlet | Day | App | Amount | Status |
|---|---|---|---|---|---|
| DD 4BGF | Damen | Sat, Nov 7 | DoorDash | $31.40 | Claimed |
| DD 26Y7 | Montrose | Fri, Nov 6 | DoorDash | $27.85 | Claimed |
| DD HS8V | Halsted | Tue, Nov 3 | DoorDash | $36.20 | Claimed |
| UE 9QX4 | Oak Park | Sat, Nov 7 | Uber Eats | $24.10 | **Needs you** |

- **UE 9QX4 is the "1 order needs you" Yes/No card.**
  - The same card appears in the email, the chat and the dashboard's unmatched list.
  - Answering it in one place updates the others, through a small shared store outside React context (`lib/mvp3/orderAnswer.ts`, `useSyncExternalStore`).

> **Known inconsistency to fix:** the Payouts chat opening says "2,417 of 2,420 orders matched", but the fixture and the email say **2,416**. Use 2,416.

## 6. Scripted chat (verbatim)

### Chargebacks thread (Operations agent · "Chargeback recovery" · Thu 8:00 AM)

**Opening:**

> Your chargebacks for Nov 1–7 cost you $397, $72 more than a usual week. Damen is the one to look at.

- Work log:
  - Read the DoorDash, Uber Eats and Grubhub adjustment reports for Nov 1–7
  - Matched each charge to its order and outlet
  - Compared each outlet with its usual week
  - Checked which disputes were won, denied or not filed yet
- Chips: "Why is Damen high?" · "What is still to dispute?" · "Send Damen's sheet to its manager"

| Owner asks | Agent replies (title / line / source) | Chips | Side effect |
|---|---|---|---|
| Why is Damen high? | **Damen had 14 orders with errors, up from its usual 8.** 6 were on Wednesday and Thursday, and 8 were missing items. Chips & Queso was left out 3 times, which is new. · *From the app adjustment reports, matched to Damen's Toast orders* | Send Damen's sheet to its manager · Which items at Damen? | opens Damen's outlet panel |
| Which items at Damen? | **Burrito bowl and Chips & Queso came up most at Damen, 3 times each.** Steak taco plate, Horchata and Carnitas bowl came up twice each, and Quesadilla and Family taco pack once. · *From Damen's 14 charges this week* | Send Damen's sheet… · What is still to dispute? | — |
| Send Damen's sheet to its manager | **Here's the one-page sheet for Damen.** It has what to fix and every order, with no amounts. | What is still to dispute? | sheet preview opens automatically |
| What is still to dispute? | **$112 on 9 orders isn't filed yet.** All are inside the apps' deadlines: 14 days on DoorDash, 30 days on Uber Eats and Grubhub. You'll see the result in next Thursday's review. · *From the KoreFi team's filing log* | Why is Damen high? · What was denied? · Send Damen's sheet… | dashboard view → `todo` |
| What was denied? | **$28 on 2 orders was denied.** Both were food-quality claims, which the apps rarely refund without a photo from the customer. $41 more is waiting on the apps' decision. · *From each app's dispute decisions* | What is still to dispute? · Why is Damen high? | dashboard view → `denied` |

(The Damen items reply is generated from the 14 Damen charges. Check the counts against the list in §5.1 if you re-derive it.)

### Payouts thread (Finance agent · "Payout reconciliation" · Fri 8:00 AM)

**Opening:**

> Payouts for Nov 1–7 are in. 2,416 of 2,420 orders matched, and 4 issues are worth a look.

- Carries the UE 9QX4 Yes/No card and a card titled "Payouts" with the line "Nov 1–7 · 7 outlets · all apps".
- Work log:
  - Read the DoorDash, Uber Eats and Grubhub payout reports for Nov 1–7
  - Matched every Toast delivery order to its payout by order ID
  - Checked each app's commission against your plan
  - Checked each payout arrived on its usual day
- Chips: "Which orders weren't paid?" · "Why did Uber Eats keep 34%?" · "Did every payout arrive?"

| Owner asks | Agent replies | Chips | Side effect |
|---|---|---|---|
| Which orders weren't paid? | **4 orders in Toast weren't paid: $119.55.** 3 are on DoorDash and 1 on Uber Eats. We've claimed 3, and 1 needs your answer. · *Toast orders matched to each app's payout by order ID* | Why did Uber Eats keep 34%? · Send the unpaid orders to Priya | view → `unmatched` |
| Why did Uber Eats keep 34%? | **Uber Eats kept 34%, mostly promos and ads.** Commission was 27%, as per your plan. Promos took $790 and ads $580. It still paid you $1,120 more than last week, because orders were up. · *From the Uber Eats payout report of Mon, Nov 9* | Which orders weren't paid? | view → `uber` |
| Did every payout arrive? | **All 3 payouts arrived on their usual day.** Uber Eats on Monday, Grubhub on Wednesday, DoorDash on Thursday. I can't confirm the deposits reached your bank, because the bank isn't connected. · *From each app's payout report* | Which orders weren't paid? | — |
| Send the unpaid orders to Priya | **Sent the 4 unpaid orders to Priya.** She has the order IDs, the amounts and which ones KoreFi has claimed. · *From the unmatched orders list* | Did every payout arrive? | — |

Matching is regex-based and forgiving. For example, "why.*damen", "denied|declined|lost" and "which orders" all match. Either thread falls back to the other thread's script.

## 7. The two emails

**Chargebacks — Thu, Nov 12, 8:00 AM** (short, read on a phone, no tiles):

- Subject: `Masa Kitchen chargebacks, Nov 1–7: $397 charged, $216 won back`
- Body:
  > Chargebacks cost you **$397** for Nov 1–7, $72 more than your usual $325. We've won back **$216** so far and are filing disputes for the other $112.
  >
  > **Damen: $150, 1.3% of app sales** (your limit is 1%). 14 orders with errors, up from its usual 8.
  >
  > All other outlets are under 1%.
- Button: **Open in KoreFi** · "Full review attached (PDF)" · signed "Sent by your Chargeback recovery agent".
- Quiet-week variant: "Chargebacks for Nov 1–7 were **$290**, below your usual $325. No outlet is over your 1% limit. Nothing is needed from you."

**Payouts — Fri, Nov 13, 8:00 AM:**

- Subject: `Masa Kitchen payouts, Nov 1–7: 4 of 2,420 orders didn't match`
- Body:
  > For Nov 1–7, 2,416 of 2,420 delivery orders matched between Toast and the apps. 4 orders ($119.55) didn't, and we're following up with the apps.
- Table:

  | App | Orders | Not matched |
  |---|---|---|
  | DoorDash | 1,322 | 3 · $95.45 |
  | Uber Eats | 804 | 1 · $24.10 |
  | Grubhub | 294 | All matched |

- Closing: "Nothing is needed from you." · Button: **Open in KoreFi** · "Details attached (Excel)".
- Clean-week variant: "all 2,420 orders matched".

## 8. Dashboards

**Chargebacks** (`dash-chargebacks`, thread `cb`, "Every Thursday, 8:00 AM · email + dashboard"):

- **Overview tab**, laid out like the "Eggholic" chargeback review. Sections in order:
  1. **Headline cards**: what the week cost, where it came from, what came back.
  2. **Biggest problems**: each problem opens its outlet or has an "Ask why" button that asks the agent.
  3. **Chargebacks by outlet**, ranked by $, in neutral greys.
  4. **What went wrong**: a reason × outlet heat grid; darker means a bigger share of that outlet's orders.
  5. **One outlet at a time**: outlet tabs showing orders per day (Sun–Sat), items with their most common reason, and the reason split.
  6. **By app.**
- Every section follows the **outlet filter** ("N of M outlets") and is counted from the 33 charges.
- **Transactions tab**:
  - one filter row: Search, Outlet, Status, period;
  - columns: Order ID (pinned) · In-Window · Error Date · Chargeback · Recovered · Status · Category · Subcategory · Note;
  - a row opens a detail drawer;
  - Download exports the filtered rows to Excel;
  - the "Not Disputed" filter shows the 9 orders ($112).
- Chat views: `todo` and `denied`.

**Damen outlet panel:**

- Opens beside the chat and shows what to fix, then every order.
- "Send to manager" opens a **one-page sheet**: Damen only, the fixes, every order, **no amounts**.

**Payouts** (`report-payouts`, thread `payout`):

- The complete week as the email reports it.
- Per-app rows: orders, paid on, sales, commission, promos, ads, chargebacks, paid, change vs last week, 4-week trend.
- An unmatched list containing the Yes/No card.
- Chat views: `unmatched` and `uber`.

**Home** (`/mvp3/home`) is fixed: it can't be customised, pinned or scheduled. It shows:

- pulse tiles;
- live agent cards (latest run, lead figure, 13-week sparkline);
- "Needs a look" flags, which each ask a question in chat;
- "Your dashboards".

**Agent overview** (`/mvp3/agent?id=chargebacks|payouts`):

- header with Edit and Run;
- one setup line: when it runs, what it reads, where results go;
- totals;
- Runs tab: newest first; a run opens its chat;
- Activity tab: what the KoreFi team did each week.

## 9. Design system and stack (as built)

- **Next.js 16.3 (App Router), React 19.2, Tailwind v4, TypeScript.**
  - Next 16 has breaking changes from older versions. Read `node_modules/next/dist/docs/` before writing routing code.
- **Light theme by default.** Font: Google Sans Flex. **Orange** brand primary.
- **Tokens**:
  - come from the Figma "Foundation" file (`zqwFPtFZLOTynCD1hbvAxy`), compiled to `foundation.css`;
  - alias vars `--color-*`, radius `rounded-small|medium|large|xlarge|circle`;
  - type utilities `text-<style>`, e.g. `text-subtitle-md`, `text-body-md`, `text-body-sm`.
- **Type scale for chat and dashboards**:
  - answer headline: `text-subtitle-md` medium (16px);
  - block title: `text-body-md` medium (14px);
  - body: `text-body-md`;
  - labels and lines under figures: `text-body-sm`.
- **Layout**:
  - every block is the same grey-tray card around a white panel, tables included;
  - panels pad `px-6 py-6`;
  - elevation uses 1px borders, not shadows.
- **Buttons**: one `Button` component with `type` (primary, default, secondary, outline, dashed, link, text, danger, warning) and `size` (tiny 26, small 34, medium 38, large 42, xlarge 50 px). Specced in the Figma "Design System – Master File" (`tvX0AUyr9MTicoUXE7Peil`, ❖ Button page).
- **Icons**: `lucide-react`. Agent faces come from the `bot-avatars` package (Finance clover, Operations hexagon, Growth flower).
- **Astryx** (`@astryxdesign/core` 0.7.16, neutral theme) supplies Button, Badge, TabList, Table and Dialog in MVP3. A bridge stylesheet maps its colours onto Foundation tokens.
- **App frame**: global TopBar (account switcher shows the restaurant name only) → slim dark icon rail → bordered panel holding the sidebar and content.
- **Figma file**: the KoreFi file is `9nrRMpdh5VU9aHnFyc1T2a`. The agent editor frame is node `1663:10749`.

## 10. File map in the source repo

| Concern | File |
|---|---|
| Accounts and flags | `src/lib/mvp3/accounts.ts` |
| All Masa numbers | `src/lib/mvp3/masaFixture.ts` |
| Scripted replies, out-of-scope reply, documents flow | `src/lib/mvp3/flows.ts` |
| Opening messages, seeded threads, agent folders | `src/lib/mvp3/agents.ts` (`fixtureChargebacks`, `fixturePayouts`, `teamPinnedThreads`, `FOLDERS`) |
| Emails | `src/lib/mvp3/emails.ts` |
| Yes/No order answer store | `src/lib/mvp3/orderAnswer.ts` |
| Chat state, seeding, routing questions to scripts | `src/components/mvp3/AgentsProvider.tsx` (`seedFor`, `seedDashboards`) |
| Chat UI | `src/components/mvp3/AgentChat.tsx` |
| Chargebacks dashboard | `MasaChargebacks.tsx`, `chargebackOverview.tsx`, `ChargebackTransactions.tsx`, `masaParts.tsx` |
| Payouts dashboard | `MasaPayouts.tsx` |
| Outlet panel and manager sheet | `OutletDive.tsx` |
| Email render | `EmailPreview.tsx` (`EmailBody`) |
| Demo inbox | `src/app/(mvp3)/inbox/page.tsx`, `DemoInbox.tsx` |
| Home / agent overview | `AgentHome.tsx`, `AgentOverview.tsx` |
| Routes | `src/app/(mvp3)/mvp3/{page,home,agents,agent,dashboard,settings,integrations}` |

## 11. What to leave out of a Masa-only project

These are not part of Masa Kitchen:

- Taco Pros' history chats and labor-leakage flow
- Saffron Grill's auto-ordering flow (Devon order draft)
- Little Pho's onboarding and welcome chat
- the Taco Pros payout editor
- the older `/mvp` and `/mvp2` routes

The Masa dashboards reuse a few `/mvp2` parts that are worth porting:

- the outlet filter (`OutletFilters`, "N of M outlets")
- the table styling
- the order detail drawer

- **Filters:** see `masa-kitchen-mvp3-filters.md`.
