# KoreFi MVP3 — Masa Kitchen: filters

This file covers the filters on Masa Kitchen's dashboards: what they filter, how the logic works, what the UI looks like and where the chat sets them. It is a companion to `masa-kitchen-mvp3-context.md`, which has the product rules, the sample-week data (§5) and the scripted chat (§6).

Source: the `astryx-spike` branch of the KoreFi repo, as of 2026-11-23.


Masa's dashboards use filters at three levels:

1. **Outlet filters** (which outlets a dashboard covers), copied from Asana's filters.
2. **Period filter** (which weeks).
3. **Transactions-only filters** (Search, Status).

A chat message can also set the outlet filter or the status filter.

## 1. Outlet filter: data model

Source: `src/lib/finance/outletFilter.ts`.

```ts
type Field = "state" | "city" | "outlet";
type Op    = "is" | "isNot";
type Rule  = { id: string; field: Field; op: Op; values: string[] };   // empty values = rule does nothing
type OutletFilter = { quick: string[]; rules: Rule[] };                // NO_FILTER = { quick: [], rules: [] }
type OutletStats  = Map<Store, { sales: number; appShare: number }>;   // per outlet, for the chosen weeks
```

**Logic:**

- **Every quick filter and every rule must hold (AND).** Inside one rule, the values are OR'd: "State is Illinois, Indiana" matches either.
- A rule passes when it has no values, or when `values.includes(outlet[field]) === (op === "is")`.
- **Active count** = quick filters switched on + rules that have at least one value picked. The button then reads "Filters: n".
- **Pill ⇄ panel sync:** each toolbar pill edits *its field's first "is" rule*:
  - `pillRule(filter, field)` finds that rule;
  - `setPill(filter, field, values)` creates it on the first pick and deletes it when cleared.
  - Because both edit the same rule, the panel and the pills never disagree.
- **Options are narrowed by the other filters.** A menu lists the values the *other* rules leave, with a count for each, plus anything already picked (`optionsFor(field, scope, skipRule)`).

**Quick filters** (one-click toggles in the panel):

| Key | Label | Test |
|---|---|---|
| `chicago` | Chicago | city = Chicago |
| `suburbs` | Chicago suburbs | state = IL and city ≠ Chicago |
| `outside` | Outside Illinois | state ≠ IL |
| `top10` | Top 10 by sales | fewer than 10 outlets have more sales in the period |
| `delivery` | Delivery over 35% | app share of sales > 35% |

**Field labels and search placeholders:** State ("Find a state"), City ("Find a city"), Outlet ("Find an outlet"). Operators read "is" and "is not".

**Display values:**

- State codes show as full names (IL → Illinois).
- Outlet IDs show as their names.
- An outlet option carries a sub-line ("Chicago, IL") and its sales for the period, right-aligned.
- City and state options show "N outlets".

## 2. Outlet filter: UI

Source: `src/components/mvp2/OutletFilters.tsx`.

**The universe** is the set of outlets a report can show at all:

- `<OutletUniverse stores={account.stores} initial?>` wraps a dashboard so the filters list only the open restaurant's outlets. (Masa has all 34.)
- `initial` opens the dashboard already filtered, for example to the outlets a chat reply named.

**The hook:**

```ts
const scope = useOutletFilter(range);   // range = [firstWeek, lastWeek]
// → { filter, setFilter, stats, stores /* outlets left */, universe, filtered /* active>0 */, subset }
```

**Toolbar pieces:**

- **Filter button.** Reads "Filter" when nothing is set, or "Filters: n" with an × that clears everything. Clicking it opens the panel, about 560px wide:
  - Header: "Filters" with a "Clear" link.
  - "Quick filters": toggle chips, with a check mark when on.
  - "All filters": one row per rule: `[field ▾] [is / is not ▾] [value tokens… ] ×`. Changing the field empties the values. With no rules it shows "No filters yet. Add one to narrow the outlets by state, city or name."
  - "+ Add filter ▾": choose State, City or Outlet.
  - Footer: "Showing 12 of 34 outlets · Illinois 9, Wisconsin 2".
- **Field pills.**
  - Unused: grey, icon + label + ▾ (State uses `MapPin`, City `Building2`, Outlet `Store`).
  - In use: **brand orange** fill, naming the pick ("Illinois", "Chicago +2"), with an × to clear it.
  - The menu opens as "Find a …" search with a checkbox list. A click applies immediately. Enter picks the first match. Empty search reads `No outlets match "…"`.
- **Count**: "12 of 34 outlets" at the right end of the bar, shown only while filtered.
- **Empty state** (`NoOutlets`): a dashed box with the filter icon, "No outlets match these filters", "Remove a filter, or clear them to see all 34 outlets." and a "Clear filters" button.
- **Phone**: `OutletFilterSheet` is a bottom sheet in the style of Asana iOS:
  - root view: quick-filter chips, then rows for State, City, Outlet and Date range, each showing its pick or "All";
  - each row opens its own searchable list;
  - pinned button: "Show results · N of M outlets".
  - A custom date range is desktop-only: "A custom range is set from a computer."

**Styling:**

- Chips are `h-8 rounded-medium border text-menu-sm`.
- On state: `border-(--brand-700) bg-(--brand-300) text-(--color-text-clickable)`.
- Off state: `border-(--color-border-default) bg-(--color-background-secondary)`.
- Menus: `rounded-large border`, with the one allowed soft shadow.
- Keyboard focus: `outline-2 outline-(--color-focus-primary)`.

## 3. Period filter

Source: `src/components/finance/DateRangeFilter.tsx`.

- One chip with a calendar icon.
- The menu has presets on the left, which apply and close on click. A custom range sits on the right: start and end fields over a two-month calendar, applied with **Apply**.
- **Reports arrive by the week**, so a custom range rounds out to the whole weeks it touches. The menu says which weeks before you apply.
- Masa's preset list (`PERIODS` in `MasaChargebacks.tsx`) puts **"Last week"** first, which is the default and the sample week Nov 1–7. The shared presets follow: "Last 4 weeks", "Last 13 weeks", "<year> so far", "<previous year>".

## 4. What each Masa dashboard shows in its filter row

| Dashboard | Filter row | What the filter changes |
|---|---|---|
| **Chargebacks → Overview** | `Filter` panel · `Outlet` pill · period chip · count on the right | **Every section**: headline cards, biggest problems, outlet ranking, reason grid, outlet tabs and By app. All are recounted from the 33 charges of the outlets left. With all 7 charged outlets in view, By app uses the fixed `BY_APP` totals; otherwise `byApp(names)`. |
| **Chargebacks → Transactions** | Search ("Search orders, notes…", 217px) · `Outlet` pill (no panel) · `Status` chip · period chip · count | Rows. Search matches order ID, outlet, reason, note, app and category. On "Last week" the rows are the 33 fixture orders; any other period falls back to the mock reports. **Download** exports the rows as currently filtered to `.xlsx`. |
| **Payouts** | `Filter` panel · `Outlet` pill · count (no period chip, fixed to Nov 1–7) | **Nothing.** The app payout figures cover every outlet. While filtered, a note appears: "These figures cover every outlet." |

**Status values in Transactions** (the `FilterChip` with "Any" + these options):

- Won
- Won (Partial)
- Declined
- Disputed (Awaiting Decision)
- Not Disputed
- Not Disputed (Window Missed)

These follow the ops team's sheet. "In-Window" is measured against the last day of the last closed week. DoorDash allows 14 days, Uber Eats and Grubhub 30; Grubhub has no fixed window.

**Edge states on Overview:**

- No outlets left → `NoOutlets`.
- Outlets left but none had chargebacks → a grey note: "No chargebacks this week at Niles, Hyde Park." Only 7 of the 34 outlets are in the fixture week, so most single-outlet picks land here.

## 5. Filters set from the chat

- **Status, from the scripted replies:**
  - "What is still to dispute?" sets the dashboard view to `todo`, and Transactions sets Status = **Not Disputed** (the 9 orders, $112).
  - "What was denied?" sets the view to `denied`, and Transactions sets Status = **Declined**.
  - A new view from chat overrides whatever the owner had picked. Picking by hand afterwards still works.
- **Outlets, from free-text questions.** Source: `lib/mvp3/outletScope.ts`.
  - `findOutlets(text)` searches only the restaurant's outlets, in this order: outlet names (longest first, so "Oak Park" the outlet beats Oak Park the city, and "Chicago & Halsted" beats Chicago; "&" can be typed as "and"), then cities, then state names.
  - `findOutletLoose` is the fallback: a name's first word on its own, at least 4 letters and unique, so "Why is Damen high?" finds Damen & Chicago.
  - A question naming outlets is answered for those outlets only. The title gets a prefix ("Hyde Park: …") and the report opens pre-filtered through `OutletUniverse initial`.
  - Labels read "Hyde Park", "Hyde Park and Old Town" or "5 outlets".
- **Dashboard scope, from chat edits.** Source: `lib/mvp3/dashboards.ts`, `DashConfig.stores`; an empty list means all outlets.
  - Phrasings: "only Hyde Park", "add Old Town", "without Wisconsin", "all outlets again".
  - Remove words: remove, hide, drop, without, exclude, except, take out, no more, get rid.
  - Add words: add, also, include, plus.
  - A schedule keeps the scope, so the email covers the same outlets.
  - Scope sentence format: "last 13 weeks, all apps, Hyde Park only".
- **Order of handling for Masa:** Masa's scripted replies (§6 of the main context file) are checked first. Only questions that don't match a script go through outlet scoping.

## 6. The 34 outlets the filters list

| State | Cities and outlets |
|---|---|
| **Illinois (26)** | **Chicago (12):** 71st & Western, 79th & Cicero, 87th & Stoney, Chicago & Halsted, Damen & Chicago, Edgewater, Hyde Park, Montrose & N Elston, Old Town, Pulaski & Belmont, Rogers Park, Taylor & Ogden. **Oak Park (2):** North & Narragansett, Oak Park. **One each:** Carol Stream, Elburn, Franklin Park, Glen Ellyn, Green Oaks, Gurnee, Huntley, Joliet, Naperville, Niles, Tinley Park, Waukegan |
| **Indiana (3)** | Dyer, Merrillville, Valparaiso |
| **Ohio (1)** | Marysville |
| **Wisconsin (4)** | Brown Deer, Mequon, Milwaukee (Capitol Dr & Hwy 43, Marquette) |

Only 7 outlets appear in Masa's chargeback week: Damen, Oak Park, Montrose, Halsted, Gurnee, Niles and Hyde Park. All 7 are in Illinois.

## 7. Known gaps to fix in a fresh build

1. **The Overview period chip changes nothing.** The fixture is a single week, and the sections are counted only from the outlets left. Either drop the chip on Masa's Overview or add more fixture weeks.
2. **Transactions on any period other than "Last week" shows mock report data**, not Masa data.
3. **Status wording is split.** The Overview and chat say "Still to dispute" and "Denied"; the Transactions filter says "Not Disputed" and "Declined". Pick one set. The owner-facing plain-English set is recommended.
4. **"Top 10 by sales" and "Delivery over 35%" are computed from the mock reports**, not from the fixture's outlet sales.
5. **Payouts shows an outlet filter that filters nothing.** Hide it, or split the payout figures by outlet.
