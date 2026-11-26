# MVP3: Pinned dashboards and how chat changes them

Plain-language spec. Written so an AI agent or a new developer can read it top to bottom and know what to build or change. Every rule below is how the `astryx-spike` branch behaves on 2026-11-24. Prototype only: no backend, all state lives in memory and resets on refresh.

---

## 1. Terms

| Word | Meaning |
|---|---|
| **Dashboard** | A saved view that an agent builds when it runs. Example: the "Chargebacks" dashboard from the Chargeback recovery agent. |
| **Report** | A fixed page from /mvp2 (P&L Summary, Payouts). A pinned report is also stored as a dashboard, with a `report` field. |
| **Pinned** | `pinned: true`. The dashboard is listed in the sidebar under **Dashboards** and opens full page. |
| **Chat that built it** | The chat thread where the dashboard was made (`Dashboard.thread`). Changes to the dashboard are asked for in this chat. |
| **Card** | One block on a dashboard (Totals, Week by week…). The owner can point at one with "Edit in chat". |
| **Schedule** | A repeat time plus where results go: email, dashboard, or both. |
| **Team pinned** | The KoreFi team pinned the dashboards for the owner (`pinnedBy: "team"`, Masa Kitchen only). |

## 2. The data (one object)

File: `src/lib/mvp3/dashboards.ts`.

```ts
Dashboard = {
  id, title, workflow, agent,
  config: { weeks, apps, widgets, topN, stores },   // what the dashboard shows
  pinned: boolean,                                   // in the sidebar or not
  automation?: { schedule, email, dashboard },       // when it re-runs and where results go
  updated, thread?, report?, pinnedBy?, sample?
}
```

`config` is the only thing chat reshapes. The figures come from `dashData(config)`, the same `chargebacks()` source as the /mvp2 Chargeback report, so the numbers match.

| `config` field | Meaning | Default | Limits |
|---|---|---|---|
| `weeks` | How many recent weeks | 13 | 1 to 13 |
| `apps` | Delivery apps kept. Empty means all. | `[]` | DoorDash, Uber Eats, Grubhub |
| `widgets` | Cards shown, in order | kpis, trend, apps, outlets | kpis, trend, apps, outlets, reasons, recent |
| `topN` | Rows in the outlet card | 5 | 1 to 15 |
| `stores` | Outlets kept. Empty means every outlet of the open restaurant. | `[]` | Only outlets of the open account |

## 3. Pinning

### 3.1 What pinning does
- `pinned: true` adds the dashboard to the sidebar **Dashboards** list, in the order they were built (`Mvp3Sidebar.tsx`, `PinnedRows`).
- Clicking the row opens the dashboard **in its chat, with the dashboard beside it** (`useOpenPinned` → `openDashboard`). If it has no chat, it opens the full page `/mvp3/dashboard?id=<id>`.
- A pinned dashboard shows a small **Pinned** tag. Nothing pinned shows the hint "Pin a dashboard to keep it here."

### 3.2 Three ways to pin or unpin
1. **Pin icon** in the dashboard header (`PinToggle`). Filled orange when on. Click again to unpin. Calls `pinDashboard(id, pinned)` for dashboards or `pinReport(report, pinned)` for reports.
2. **Ask in chat.** Words that pin: `pin`, `sidebar`. Word that unpins: `unpin`. Checked in `customize()`.
3. **Schedule it with dashboard updates.** Any schedule that includes the dashboard sets `pinned: true` automatically (`setAutomation` and `customize` both do this). A dashboard cannot be kept up to date on a schedule without being in the sidebar.

### 3.3 Rules
- **Sample dashboards cannot be pinned or scheduled.** A restaurant with no reports yet sees Taco Pros sample data, labelled. The pin icon is hidden (`!d.sample`).
- **Reports** are pinned with `pinReport`. This creates a dashboard with id `report-<reportId>` the first time.
- **Team pinned (Masa Kitchen):** dashboards start pinned, labelled "pinned by the KoreFi team". The chat home shows `PinnedSummary` cards (headline and one line, taken from the same figures as the dashboard). Report-only: the owner reads results, the KoreFi team makes fixes.
- **Taco Pros:** opens with two dashboards already pinned.
- Every other account: dashboards start **unpinned**.

## 4. How chat changes the dashboard

### 4.1 The flow
1. The owner sends a message in the chat that built the dashboard (`thread.dashboard` is set), or points at a card first.
2. `send()` in `AgentsProvider.tsx` runs scripted flows first (Masa's weeks, documents asked for, out-of-scope questions). Then it checks the dashboard.
3. `customize(text, dashboard, focusedCard)` reads the message. It returns `null` if the message is not about the dashboard, or a result with the new `config`, an optional new title, an optional pin change, an optional schedule and a `changes` list.
4. If the result is not null: the dashboard is saved with the new `config` and `updated` time, and the agent replies with a short confirmation. The canvas beside the chat redraws from the new `config` straight away.
5. If the result is null, the message falls through to normal answers.

Prototype note: `customize()` is a **keyword parser**, not a model. A real build would send the message and the current `config` to a model and get a new `config` back. Keep that same input and output shape.

### 4.2 What the owner can say

| The owner says | What changes | Confirmation shown |
|---|---|---|
| "Only DoorDash" / "DoorDash and Uber Eats" | `apps` = named apps | "Only DoorDash" |
| "Without Grubhub" / "remove Uber" | `apps` = current apps minus the named | "Only DoorDash and Uber Eats" |
| "All apps" | `apps` = `[]` | "All apps" |
| "Only Hyde Park" | `stores` = named outlets | "Only Hyde Park" |
| "Add Old Town" | adds to `stores` (only if already narrowed) | "Only Hyde Park and Old Town" |
| "Without Wisconsin" | removes from `stores` | |
| "All outlets again" | `stores` = `[]` | "All outlets" |
| "Last 4 weeks" / "past month" / "8 weeks" / "this quarter" | `weeks` | "Last 4 weeks" |
| "Top 10 outlets" | `topN`, and adds the outlet card | "Top 10 outlets" |
| "Add why orders get charged back" | adds the Reasons card | "Added why orders get charged back" |
| "Remove the latest chargebacks" | removes that card | "Removed latest chargebacks" |
| "Rename it to Weekly disputes" | `title` | "Renamed to Weekly disputes" |
| "Pin it to my sidebar" / "Unpin it" | `pinned` | "Pinned to your sidebar" |
| "Every Thursday at 8 AM, email me this and update the dashboard" | `automation` and `pinned: true` | "Done. Every Thursday, 8:00 AM" |

Card names the parser knows (`WIDGETS`): Totals, Week by week, By delivery app, Outlets with the most chargebacks, Why orders get charged back, Latest chargebacks.

### 4.3 Schedules
- `parseSchedule()` needs a day name, "daily" or "monthly". "8 AM" is the default time.
- Where results go: the word *email/mail/inbox* turns on email. The word *dashboard/update/refresh* turns on dashboard. If neither is said, both turn on.
- The schedule keeps the same `config`, so the email covers the same apps, outlets and weeks as the dashboard.
- The schedule also appears in the agent's **Triggers** (`setAutomation` updates the workflow).

### 4.4 Pointing at a card ("Edit in chat")
The owner clicks **Edit in chat** on one card. The card becomes a chip on the next message (`CardRef`). With a card chosen, short messages work:
- "Remove this" → removes that card.
- "Move it to the top" / "Move it down" → reorders `widgets`.
- "Show 10" on the outlet card → `topN` = 10.
- Anything the agent cannot do to a card gets a short reply listing what it can do: remove, move, or narrow the whole dashboard.

### 4.5 Reports are different
A pinned **report** (P&L Summary, Payouts) has fixed content. In chat the owner can only:
- **Pin or unpin** it ("pin it", "unpin").
- **Schedule** it ("every Monday at 8 AM, email me this and update it").
- **Hide a card** by pointing at it ("remove this"). Hidden cards are listed in `hiddenCards[report]` and vanish from the report and the sidebar view. "Show all cards again" brings them back.
- It **cannot** change filters, weeks or what is inside a report card. The agent says so.

## 5. Replies the agent gives (wording)

Keep replies short, in plain words, and say what is true now. Patterns used:
- Change: "Now showing last 4 weeks, only DoorDash, all outlets." plus "It's in your sidebar under Dashboards." when pinned.
- Schedule: "Every run I'll email the report to <email> and update the Chargebacks dashboard. It's pinned to your sidebar. You can change this in the agent's Triggers."
- Report pin: "It's under Dashboards in the sidebar and opens full page. Want it on a schedule too?"
- Report unpin: "It's off your sidebar. Ask me to pin it again any time."
- Cannot do: "Changing what's inside a report card isn't something I can do yet."

Follow-up buttons offered after a reply: not pinned → "Pin it to my sidebar". Pinned, no schedule → "Every Thursday at 8 AM, email me this and update the dashboard". Scheduled → "Add the latest chargebacks", "Top 10 outlets".

Rules for the words: no jargon (say "charged back", not "dispute reason code"), no promise of anything the prototype cannot do, and never tell the owner to fix something themselves. The KoreFi team makes fixes.

## 6. Where the code is

| What | File |
|---|---|
| Dashboard type, `customize()`, `parseSchedule()`, `dashData()` | `src/lib/mvp3/dashboards.ts` |
| `send()` (chat → dashboard), `pinDashboard`, `pinReport`, `setAutomation`, seeded dashboards | `src/components/mvp3/AgentsProvider.tsx` |
| Pin icon (`PinToggle`), schedule control, cards, "Edit in chat" | `src/components/mvp3/AgentDashboard.tsx` |
| Sidebar **Dashboards** list and `useOpenPinned` | `src/components/mvp3/Mvp3Sidebar.tsx` |
| Full page dashboard | `src/components/mvp3/DashboardPage.tsx`, route `src/app/(mvp3)/mvp3/dashboard/page.tsx` |
| Home summary for team-pinned accounts | `src/components/mvp3/PinnedSummary.tsx` |
| Scripted Masa replies and opening messages | `src/lib/mvp3/flows.ts`, `teamPinnedThreads()` in `src/lib/mvp3/agents.ts` |

## 7. Edge cases to keep working
- Message mentions no dashboard word and no card: `customize()` returns `null`, normal answer.
- A schedule message wins over other edits in the same message (the `else` branch skips app, outlet and week changes).
- Narrowing outlets to every outlet of the account stores `stores: []`, not a full list.
- Removing the last app leaves "All apps", not an empty dashboard.
- Dashboard missing from the id in the URL: the page says "This dashboard isn't here any more" and links to Agents.
- Masa Kitchen is `limited`: no New chat, so it reshapes dashboards only inside the chats that already exist.
