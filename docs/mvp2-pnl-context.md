# KoreFi MVP2 — P&L Summary: context for a new project

This file holds everything needed to rebuild the **MVP2 P&L Summary** page (`/mvp2/pnl`) in a fresh project:

- how the page is built;
- the **table structure**;
- **Compare outlets**;
- the **data generators** in full, so every figure can be reproduced exactly;
- a set of **reference figures** to check a rebuild against.

Source: the `astryx-spike` branch of the KoreFi repo, as of 2026-11-24. The formulas and constants below are copied from the code. The reference figures in §9 were produced by running the real generators.

---

## 1. What the page is

- KoreFi reads the reports its ops team uploads each week:
  - **POS** (Square in MVP2) covers **In store & website**;
  - **3PD** apps: **DoorDash, Uber Eats, Grubhub**.
- Those reports only contain **sales, card fees, app commission, app promos and chargebacks (after money won back)**.
- **Food and staff never arrive.** The P&L estimates them from the owner's **cost settings**. Typical figures stand in until the owner sets their own: 30% food, 30% staff.
- **Channels stop at contribution.** Each channel shows Net after fees and its food. Staff is shared, so in the channel view it comes off **once, in All**, and only All shows profit.
  - Why: splitting fixed costs across channels by sales made every delivery app look loss-making (about −7%), when each app actually contributed about 45¢ per $1.
  - **Don't add per-channel profit back** in the channel view.
- Every % is a **share of that column's sales**.
- **Owner editing of cost settings is a deliberate exception** to KoreFi's report-only rule. The page has no other owner actions.

Route: `src/app/(mvp2)/mvp2/pnl/page.tsx` renders `<LaunchGate page="pnl"><PnlSummary /></LaunchGate>`. LaunchGate shows an empty state for restaurants whose reports haven't arrived yet.

## 2. Page layout, top to bottom

`src/components/finance/PnlSummary.tsx`. The page title is "P&L Summary"; MVP3 reuses the component as "Daily P&L".

1. **PageHeader** with the title.
2. **One scroll box for both axes** (`overflow-auto contain-paint`), so the table's header rows can stick to its top.
3. **Filter bar.** It is sticky to the left and stays one line. Left to right:
   - **Search** (260px, placeholder "Search..."). It narrows the *table's lines* and opens lines whose parts match.
   - A vertical divider.
   - **Outlet filters**: the Filter panel plus State, City and Outlet pills, Asana-style. All outlets by default. Details are in `masa-kitchen-mvp3-filters.md` §1–2; it's the same component.
   - **Date** (`DateRangeFilter`). Default **Last 4 weeks**. Presets: Last 4 weeks · Last 13 weeks · 2026 so far · 2025. A custom range rounds out to whole weeks.
   - Pushed to the right end:
     - the "N of M outlets" count (only on very wide screens, 2xl);
     - the **Compare outlets** switch;
     - the **Platform breakdown** switch (only while comparing);
     - the **View toggle**: `$` amounts or `%` share of sales, as an icon-only segmented control.
4. **Cards**: three cards on a grey tray. They are **hidden while comparing outlets**. With no outlets left, `NoOutlets` shows instead.
5. **The table** (desktop). Phones get `PnlMobile`, which shows one channel or outlet at a time.

**Phones:**

- The filter bar is replaced by one line: "All outlets · Last 4 weeks" with a "Change" link.
- Two round floating buttons sit at the bottom right: **Filters** (with a count badge) and **View options**. Each opens a bottom sheet.
- The View sheet holds:
  - "Break down by": By channel / By outlet;
  - "Show figures as": $ or %;
  - while by outlet, a "Platform breakdown" switch ("DoorDash, Uber Eats and Grubhub for every outlet").

### 2.1 The three cards

Shared with `/mvp`; they live in `PnlCards` in `PnlStory.tsx`. Each card has a title, a line saying what it covers, one headline figure, and one visual.

**1. Profit after prime cost**, with an **Estimate** tag.

- Sub-line: "After food and staff, using typical costs", or "using your costs" once the owner has set theirs.
- Headline: `≈ {margin%}`, then the sub-line `≈ $profit of $sales sold`. The figure turns red at a loss.
- Comparison: the margin change in pts against the same number of weeks just before (`vs Aug 6 – Sep 2`).
- Visual:
  - More than one outlet: **"Lowest profit, share of sales"**: the 4 weakest outlets as bars. A bar is red when the outlet is under the business margin, grey otherwise.
  - One outlet: a **SpendBar** splitting every $100 of sales into Fees & promos (red-600), Food (amber-700), Staff (blue-600) and Profit after prime cost (green-700).

**2. Paid to you**

- Sub-line: "After card fees, commission and promos".
- Headline: `moneyIn / sales` to 1 decimal, then `$moneyIn of $sales sold`.
- Visual: **"Fees taken from each $1 sold"**, one bar per channel showing cents per $1 (`(sales − moneyIn) / sales`). The most expensive channel's bar is red if over 10¢; the rest are grey.

**3. Sales**

- Sub-line: "Before any fees".
- Headline: `$sales`, then the % change against the span before.
- Line under it: `N orders · N outlets`.
- Visual: a Mercury-style weekly line with a soft fill, the previous span as a faint dashed line, and a hover tooltip.
  - With fewer than 4 weeks selected, the line shows the 8 weeks up to the range's end.

## 3. Table structure (channel view)

`src/components/finance/PnlTable.tsx`, shared with `/mvp`'s P&L tab.

**Columns:**

```
| Line (pinned left) | In store & website | DoorDash | Uber Eats | Grubhub | All |
```

- **Header row**: grey (`gray-200`), 42px tall. Each column has an app logo and name. Hovering a header names its source:
  - POS: "Point of sale: in-store and website sales from Square".
  - App: "Third-party delivery: this app's payout report".
- **Line column header**: a ListTree icon, "Line", and an **Expand all / Collapse all** link.
- **Figure columns**: 170px, right-aligned. The table's minimum width is 920px.

**Grid style:** dense CRM-style grid (like Attio).

- Rows are 44px (`h-11`); child rows are 32px (`h-8`).
- Every row and column has a 1px `gray-400` line.
- Row hover is `gray-200`.
- Line names stay pinned on the left while the figures scroll sideways. A soft shadow appears off the pinned edge once scrolled sideways, and under the header once scrolled down.

**Rows, in order:**

| # | Row | Kind | Formula / source | Applies to |
|---|---|---|---|---|
| — | **Reported** · "From the uploaded reports" | section row | — | — |
| 1 | Orders | plain, grey text | count of order or payment rows | all |
| 2 | **Sales** (expandable) | grey **strong row**, bold | In store: POS. Apps: each app's report | all |
| 2a | ↳ Gross sales | child | grossSales | all |
| 2b | ↳ Discounts and comps | child, cost | discounts | in store only |
| 2c | ↳ Refunds | child, cost | refunds | in store only |
| 2d | ↳ Service charges | child | serviceCharges (always 0 in the mock) | in store only |
| 3 | Card fees | cost | cardFees | in store only |
| 4 | App commission (expandable) | cost | commission (includes the processing fee) | apps only |
| 4a | ↳ Commission | child, cost | commission − processingFee | apps |
| 4b | ↳ Processing fee | child, cost | processingFee | apps |
| 5 | Your app promos (expandable) | cost | promos (includes ads) | apps only |
| 5a | ↳ Discounts you funded | child, cost | promos − ads | apps |
| 5b | ↳ Ads and marketing fees | child, cost | ads | apps |
| 6 | Chargebacks, after money back (expandable) | cost | chargebacks − moneyBack | apps only |
| 6a | ↳ Charged for errors | child, cost | chargebacks | apps |
| 6b | ↳ Won back | child, green `+` | moneyBack | apps |
| 7 | **Net after fees** | strong row; in All a **green cell** | sales − cardFees − commission − promos − chargebacksNet | all |
| 8 | **Prime cost** (expandable) | collapsed: one row of food + staff; open: becomes a section row | Food & drink + Staff | — |
| 8a | ↳ Food & drink · pencil | child | each store's food setting, split across channels by sales share | all |
| 8b | ↳ Staff · pencil | child, **All only** (the channel cells are one merged empty cell) | each store's staff setting | All |
| 9 | **Profit after prime cost** | strong row, All only; green or red text; All cell tinted green, or red at a loss | Net after fees − Food & drink − Staff | All |

**Cell rendering** (the `Amount` component):

- Whole dollars, rounded.
- Costs read `−$1,234`. A negative cost reads `+$…` in green.
- Money back reads `+$…` in green.
- In `%` view each cell shows `pct0(n / column sales)`, with the same signs.
  - `pct0`: rounds to a whole %; anything under 0.5% shows "<1%".
  - Sales shows "100%".
- A line that doesn't apply to a column shows a grey **—**. A child part that doesn't apply leaves its cell empty.

**Line tooltips** (ⓘ, Xero-style, portalled, 288px wide):

- The line name, then one sentence on what it means.
- "Where it comes from": the report columns per channel (`REPORT_FIELDS`, see §6.4).
- "How it's worked out": the formula, e.g. `Chargebacks, after money back = Charged for errors − Won back`.

**Sales reconciliation check (POS ⇄ 3PD):**

- Each app's Sales cell, and All's, carries the check (`ReconHover`). An alert icon shows when orders differ.
- Hovering opens a card with one line per kind of mismatch:
  - **Missing in 3PD** (red): "In Square, but missing from {app}'s report. KoreFi is claiming them."
  - **Missing in POS** (amber): "{app} paid for these, but they never reached Square. Already in your sales."
  - When every order matches: "Matches your Square: N of N {app} orders".
- **View all** opens a drawer with every mismatched order (id, date, outlet, amount), filterable by kind.

**Cost pencil** (`CostPopover`):

- Two linked fields: **% of sales ⇄ $ a month**. Typing in either updates the other, using the chosen stores' average monthly sales.
- The table previews the change live while typing.
- Whichever field was typed last is what's saved.
- A warning shows only when the cost passes half of sales.
- Enter saves; Escape or a click outside cancels.
- Food can only be set as a %.

**Search:**

- A line shows when its name or any of its parts matches. A match on a part opens that line.
- With no matches, one row reads `No lines match "…"`.

**Footer** (on `/mvp`): "Sales down to Net after fees: from reports uploaded by KoreFi, last on Oct 6, 2026 (Square Sales summary, DoorDash Payout, Uber Eats Payout, Grubhub Transaction + Adjustment). Food and staff: estimates from typical restaurant costs."

## 4. Compare outlets

Turned on with the **Compare outlets** switch: a chip with a Store icon, the label and a small toggle; the toggle is brand-coloured when on.

**What changes:**

- The cards are hidden.
- The table switches to **one column group per outlet, delivery apps only**. In-store lines drop out: Card fees, and the Sales parts Discounts, Refunds and Service charges.
- A line left with only one part stops being expandable. In practice, Sales loses its children here.

**Column structure:**

```
              | ▣ Carol Stream ›            | ▣ 71st & Western ›          | … | ▣ All outlets ›        |
Line (280px)  | [DD] [UE] [GH] **Total**    | [DD] [UE] [GH] **Total**    | … | [DD] [UE] [GH] | Total |
```

- **Two header rows**:
  1. Outlet names: 34px tall, `scope="colgroup"`, with a Store icon, the name and a **chevron** that opens or closes that outlet's platform columns. The name stays visible beside the pinned Line column (`sticky left-[292px]`) while any of its group is in view.
  2. The column row: 42px, sticky at `top-[34px]`.
- Columns are **140px** each. The pinned Line column is **280px**.
- **Platform breakdown starts closed**: each outlet shows only its **Total** column.
  - Each outlet's chevron opens just that outlet's DoorDash, Uber Eats and Grubhub columns.
  - The **Platform breakdown** switch (the three app logos, the label and a toggle) opens every group at once.
  - State is a `Set<string>` of open groups, keyed by outlet ID plus `"all"`.
- Each outlet's **Total** column has a heavier right border (`gray-700`) to close the group.
- The **All outlets** group comes last: the three app columns for all selected outlets (when opened), then the final **Total** column (`appsOnly(t)`: every selected outlet's apps).

**Figures per column:**

- **App column** = `appCol(t, key)`: that app's report for that outlet, carrying a **share of the outlet's staff by sales**:

  ```
  staff = outlet staff × (app sales / outlet total sales)
  profit = contribution − staff
  ```

- **Outlet Total** = `appsOnly(outletTotals)`: the three apps' reports and food summed, carrying the apps' combined share of staff.
- **Staff and Profit appear in every column** here, unlike the channel view, because each app carries its share.
- Tooltip text in compare mode:
  - Prime cost: "Food & drink and staff."
  - Profit: "Before loans and tax. Each outlet's staff is split by sales, and its delivery apps carry their share."
- Each Sales cell carries that outlet and app's POS ⇄ 3PD check. A Total carries all three apps' checks.

**Computation:** `usePnl().byOutlet()` runs `totals([store], a, b, settings)` and `reconcile(app, [store], weeks)` for each selected store. It only runs while comparing.

**Phones:** "By outlet" in the View sheet does the same through `PnlMobile`.

## 5. Calculation pipeline

Source: `PnlStory.tsx`, `totals()` and `usePnl()`.

```ts
type Col = ChannelReport & { chargebacksNet; moneyIn; food; contribution };
finish(r, food):
  chargebacksNet = r.chargebacks − r.moneyBack
  moneyIn        = r.sales − r.cardFees − r.commission − r.promos − chargebacksNet   // "Net after fees"
  contribution   = moneyIn − food

totals(stores, fromWeek, toWeek, settingsFor):
  for each store:
    sum reportWeek(store, week) per channel over the weeks
    storeSales = sum of its 4 channels' sales
    storeFood  = cost(set.food,  storeSales, weeks)    // split to channels by each channel's sales share
    staff     += cost(set.staff, storeSales, weeks)    // kept for All only
  cols[ch] = finish(sum over stores, food[ch])
  all      = finish(sum of all channels, sum of food); all.staff = staff; all.profit = all.contribution − staff
  weekly[i] = total sales of week i (for the Sales line)

cost(setting, sales, weeks) = setting.mode === "pct" ? sales × value / 100
                                                     : value × (weeks / (52/12))   // $ a month, pro rata
```

- **Comparison span** (`prev`): the same number of weeks just before the range. There is none when the range starts at the first week.
  - Labels use the form `Sep 3 – Sep 30` and `vs Aug 6 – Sep 2`.
- **Cost settings** (`lib/finance/costSettings.ts`):
  - saved in localStorage key `kf-cost-settings` as `{ [scope]: { food: {mode, value}, staff: {mode, value} } }`;
  - a scope is `"all"` or a store's full name;
  - lookup order: the store's own → `all` → `TYPICAL` = `{ food: 30% , staff: 30% }`.
- **Where an edit saves:**
  - With a subset of outlets selected, it saves to each of those stores.
  - With all outlets, it saves to `"all"`, which applies to stores without their own settings.
- **Reset link**: "Use all-stores costs" (subset) or "Back to typical" (all).

## 6. The data generators (copy these exactly)

All mock data is **deterministic**: the same inputs always give the same numbers.

The chain is `outlets.ts` (who and where, plus size factors) → `books.ts` (monthly accounting by account) → `pnlWeek` (weekly) → `reports.ts` (what each provider's report says) → `totals()`.

### 6.1 Calendar

- **Latest closed month**: `LATEST = { year: 2026, month: 8 }`, which is Sep 2026 (months are 0-based).
- **Week n** of a year runs from day `7n+1` to day `7n+7` of that year, in UTC.
  - Labels look like "Jan 1–7" or "Jan 29–Feb 4".
- `closedWeeks(2026)` = `floor((Oct 1 − Jan 1) / 7 days)` = **39**. The year 2025 has **52**.
- `WEEKS` = every week of 2025, then 2026 weeks 0–38: **91 weeks** in all.
  - `LAST` = index 90 = **Sep 24–30, 2026**.
- Default range is **Last 4 weeks**: Sep 3–9 to Sep 24–30. The comparison span is Aug 6–12 to Aug 27–Sep 2.

### 6.2 Outlets (`lib/finance/outlets.ts`)

- Brand: **Taco Pros**. Each store's full name is `"Taco Pros – {name}"`.
- Factors:
  - `share`: the outlet's size against a typical month;
  - `apps`: how much it leans on delivery;
  - `labor` and `food`: cost pressure.

| name | state | city | street | zip | share | apps | labor | food |
|---|---|---|---|---|---|---|---|---|
| Carol Stream | IL | Carol Stream | 772 W Army Trail Rd | 60188 | 0.31 | 0.92 | 0.98 | 1.01 |
| 71st & Western | IL | Chicago | 7108 S Western Ave | 60636 | 0.36 | 1.12 | 1.03 | 0.99 |
| 79th & Cicero | IL | Chicago | 7959 S Cicero Ave | 60652 | 0.38 | 1.05 | 1.01 | 1.02 |
| 87th & Stoney | IL | Chicago | 1515 E 87th St | 60619 | 0.33 | 1.15 | 1.04 | 1.03 |
| Chicago & Halsted | IL | Chicago | 833 W Chicago Ave, Floor 1 | 60642 | 0.42 | 1.32 | 1.08 | 0.98 |
| Damen & Chicago | IL | Chicago | 1959 W Chicago Ave | 60622 | 0.37 | 1.25 | 1.06 | 1 |
| Edgewater | IL | Chicago | 5310 N Broadway | 60640 | 0.35 | 1.22 | 1.05 | 1.01 |
| Hyde Park | IL | Chicago | 1400 E 47th St | 60653 | 0.39 | 1.28 | 1.04 | 0.99 |
| Montrose & N Elston | IL | Chicago | 4126 W Montrose Ave | 60641 | 0.34 | 1.1 | 1.02 | 1.02 |
| Old Town | IL | Chicago | 1435 N Wells St | 60610 | 0.41 | 1.3 | 1.09 | 0.97 |
| Pulaski & Belmont | IL | Chicago | 3029 N Pulaski Rd | 60641 | 0.36 | 1.08 | 1.01 | 1.04 |
| Rogers Park | IL | Chicago | 2321 W Howard St | 60645 | 0.32 | 1.18 | 1.03 | 1.05 |
| Taylor & Ogden | IL | Chicago | 2200 W Taylor St | 60612 | 0.4 | 1.26 | 1.05 | 1 |
| Elburn | IL | Elburn | 782 N Main St | 60119 | 0.24 | 0.72 | 0.95 | 1.03 |
| Franklin Park | IL | Franklin Park | 2830 Mannheim Rd | 60131 | 0.3 | 0.95 | 0.99 | 1.02 |
| Glen Ellyn | IL | Glen Ellyn | 850 Roosevelt Rd | 60137 | 0.33 | 0.9 | 0.97 | 0.99 |
| Green Oaks | IL | Green Oaks | 14010 W Rockland Rd | 60048 | 0.27 | 0.82 | 0.96 | 1.01 |
| Gurnee | IL | Gurnee | 6681 Grand Ave | 60031 | 0.32 | 0.88 | 0.97 | 1 |
| Huntley | IL | Huntley | 12902 IL-47 | 60142 | 0.26 | 0.78 | 0.95 | 1.04 |
| Joliet | IL | Joliet | 2565 Plainfield Rd | 60435 | 0.34 | 0.94 | 0.98 | 1.02 |
| Naperville | IL | Naperville | 2860 Showplace Dr #114 | 60564 | 0.37 | 0.98 | 1 | 0.98 |
| Niles | IL | Niles | 7870 N Milwaukee Ave | 60714 | 0.33 | 1.02 | 1 | 1.01 |
| North & Narragansett | IL | Oak Park | 6427 North Ave | 60302 | 0.31 | 1.06 | 1.01 | 1.02 |
| Oak Park | IL | Oak Park | 2 Chicago Ave | 60302 | 0.35 | 1.04 | 1.02 | 0.99 |
| Tinley Park | IL | Tinley Park | 15943 S Harlem Ave, Unit B | 60477 | 0.33 | 0.9 | 0.98 | 1.01 |
| Waukegan | IL | Waukegan | 4055 Northpoint Blvd #104 | 60085 | 0.29 | 0.86 | 0.97 | 1.03 |
| Dyer | IN | Dyer | 1078-80 Joliet St | 46311 | 0.27 | 0.8 | 0.93 | 1.02 |
| Merrillville | IN | Merrillville | 8160 Mississippi St | 46410 | 0.3 | 0.85 | 0.94 | 1.01 |
| Valparaiso | IN | Valparaiso | 2005 Morthland Dr | 46383 | 0.26 | 0.76 | 0.92 | 1.03 |
| Marysville | OH | Marysville | 15710 US Highway 36 | 43040 | 0.22 | 0.7 | 0.92 | 1.06 |
| Brown Deer | WI | Brown Deer | 9051 N Green Bay Rd | 53209 | 0.27 | 0.88 | 0.94 | 1.02 |
| Mequon | WI | Mequon | 10942 N Port Washington Rd | 53092 | 0.25 | 0.8 | 0.95 | 1 |
| Capitol Dr & Hwy 43 | WI | Milwaukee | 242 E Capitol Dr | 53212 | 0.3 | 1.08 | 0.97 | 1.02 |
| Marquette | WI | Milwaukee | 1400 W Wells St | 53233 | 0.33 | 1.2 | 0.98 | 1 |

**Row order matters:** it is the default order of outlet columns in Compare outlets and in the filter lists.

### 6.3 Monthly books (`lib/finance/books.ts`)

```ts
// base = a typical month for the whole group, before store, season and year factors
ACCOUNTS (revenue): dine-in 74000 · doordash 21000 · uber 14500 · grubhub 6000 · catering 5500
         (cogs):    food 27800 · beverage 5200 · packaging 3300
         (labor):   wages 33500 · payroll-tax 6400
         (opex):    commissions 0 (computed) · rent 11500 · utilities 3400 · marketing 2600 · repairs 1900 · other-opex 3100
YEAR_SALES = { 2024: 0.86, 2025: 0.93, 2026: 1 };   YEAR_COST = { 2024: 0.88, 2025: 0.95, 2026: 1 };
MARKETPLACES = ["doordash","uber","grubhub"];        COMMISSION_RATE = 0.235;

wobble(seed) = sin(seed × 12.9898) × 0.5 + sin(seed × 4.1414) × 0.5          // in [-1, 1]
hash(s)      = [...s].reduce((a, c) => a × 31 + charCode(c), 7) % 1000          // books.ts uses % 1000
season(m)    = 1 + 0.07 × sin(((m − 2) / 12) × 2π)

monthAmount(acc, store, year, month):
  noise = 1 + 0.025 × wobble(hash(acc.id + store) + month × 3 + year)
  sales = o.share × season(month) × YEAR_SALES[year] × noise
  commissions → round(Σ marketplaces' monthAmount × 0.235)
  revenue     → round(acc.base × sales × (marketplace ? o.apps : 1))
  cogs        → round(base × share × (0.5 + 0.5·season) × YEAR_SALES × o.food × (food ? 1.04 : 1) × noise)
  labor       → round(base × share × o.labor × YEAR_COST × noise × (0.7 + 0.3·season))
  opex        → round(base × share × YEAR_COST × noise × (0.97 + 0.03·season))

pnlWeek(stores, year, week):          // the week's share of its start month
  month = month of the week's first day; dim = days in that month
  per account and store: monthAmount(acc, s, year, month) ×
      (7 / dim) × (1 + (isSales ? 0.07 : 0.03) × wobble(week×7 + year + (isSales ? 0 : 3) + (hash(acc.id + s) % 11)))
  // isSales = revenue accounts or "commissions"; results are NOT rounded here
```

> **Gotcha:** the `hash` in `books.ts` is `% 1000` applied only at the end. Intermediate values grow large, so this relies on JS double maths. Port it exactly (use the same `reduce`) or the figures will drift.

### 6.4 Weekly reports per channel (`lib/finance/reports.ts`)

```ts
ChannelKey = "instore" | "doordash" | "uber" | "grubhub"
ChannelReport = { orders, sales, grossSales, discounts, refunds, serviceCharges, cardFees,
                  commission /*incl processingFee*/, processingFee, promos /*incl ads*/, ads, chargebacks, moneyBack }

hash(s) = [...s].reduce((a, c) => a × 31 + charCode(c), 7) % 997      // NB: % 997 here
wobble  = same formula as books
APP_RATES  [commission, promos, chargebacks]: doordash [0.23, 0.022, 0.011] · uber [0.27, 0.012, 0.009] · grubhub [0.20, 0.006, 0.007]
PROCESSING: doordash 0.03 · uber 0 · grubhub 0.0305
CARD_FEE = 0.026
TICKET (avg order $): instore 11.5 · doordash 24.5 · uber 26 · grubhub 28

reportWeek(store, year, week):          // cached per store|year|week
  p = pnlWeek([store], year, week)
  seed(k) = hash(k + store) + week×7 + year
  n(k, spread) = 1 + spread × wobble(seed(k))

  app(key):  sales = p[key]
    chargebacks   = sales × cb × n(key+"cb", 0.6)
    promos        = max(0, sales × pr × (0.4 + 1.2 × wobble(seed(key+"p"))))
    orders        = round(sales / TICKET[key] × n(key+"o", 0.05))
    commission    = sales × c × n(key+"c", 0.02)
    processingFee = sales × PROCESSING[key]
    ads           = promos × (0.3 + 0.1 × wobble(seed(key+"ad")))
    moneyBack     = chargebacks × (0.55 + 0.15 × wobble(seed(key+"mb")))
    grossSales = sales; discounts = refunds = serviceCharges = cardFees = 0

  instore:  sales = p["dine-in"] + p.catering
    discounts  = sales × 0.05 × n("disc", 0.15)
    refunds    = sales × 0.0013 × n("ref", 0.8)
    grossSales = sales + discounts + refunds
    cardFees   = sales × 0.026 × n("card", 0.04)
    orders     = round(sales / 11.5 × n("o", 0.05))
    commission = processingFee = promos = ads = chargebacks = moneyBack = serviceCharges = 0
```

**Report columns behind each line** (`REPORT_FIELDS`, shown in the ⓘ):

| Line | Square (in store) | DoorDash | Uber Eats | Grubhub |
|---|---|---|---|---|
| Orders | count of Payment rows | count of Order rows | count of Order rows | count of Order rows |
| Sales | Net Sales + Service Charges + Partial Refunds | Subtotal | Sales (excl. tax) | Subtotal |
| Card fees | Fees | — | — | — |
| Commission | — | Commission + Payment processing fee | Marketplace fee | Commission + Processing fee |
| Promos | — | Customer discounts (funded by you) + Marketing fees | Promotions on items + Ad spend | Restaurant-funded promotions |
| Chargebacks | — | Error charges + Adjustments | Order error adjustments | Adjustments |
| Net after fees | Sales + Fees | Net total − Subtotal tax passed to merchant | Total payout − Tax remitted by Uber | Net deposit − Tax passed to merchant |

- Reports were last uploaded **Oct 6, 2026**. Every source is weekly, uploaded by hand.
- `REPORT_THROUGH` = Sep 27, 2026 for every source.

### 6.5 POS ⇄ 3PD reconciliation (`lib/finance/reconcile.ts`)

```ts
reconcile(app, stores, weeks) → { report, pos, matched, matchedOrders, posOnly:{orders,amount}, appOnly, waiting, through, orders: Mismatch[] }
TICKET: doordash 31 · uber 29 · grubhub 34
hash(s) = [...s].reduce((a, c) => (a × 31 + charCode(c)) % 1_000_003, 7)      // modded every step
rand(seed) = (hash(seed) % 10000) / 10000

through = min(REPORT_THROUGH.instore, REPORT_THROUGH[app]); cutoff = through + 1 day
per store × week:  sales = reportWeek(...)[app].sales; seed = `${store}${app}${year}-${w}`
  waiting: days of the week after the cutoff that Square covers → sales × late/7 (orders = amount / TICKET)
  posOnly (Missing in 3PD): if rand(seed+"posOnly") ≤ 0.35 → 1 or 2 orders (1 + hash(seed+kind+"n") % 2)
  appOnly (Missing in POS): if rand(seed+"appOnly") ≤ 0.12 → 1 or 2 orders
    each order: amount = TICKET × (0.7 + 0.6 × rand(k+"$")), rounded to cents
                at = week start + (hash(k+"d") % 7) days + (11 + hash(k+"h") % 11) hours + (hash(k+"m") % 60) minutes
                skipped if at ≥ cutoff
                ids: DoorDash 8 hex · Uber 5 hex · Grubhub 9 digits; Square 4 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789
                code(seed, len, chars): h = hash(seed)+1; repeat len: h = (h × 48271) % 2147483647; take chars[h % len(chars)]
matched = report − appOnly.amount − waiting.amount;  matchedOrders = round(matched / TICKET)
```

## 7. Formatting

- **Money**: `usd(n)` = `−$1,234`, whole dollars, using a true minus sign (−).
- **Per-$1 fees**: cents, e.g. `25¢`.
- **Shares**: `pct0`, whole % or "<1%".
- **Paid to you**: 1 decimal.
- **Margin change**: in pts, 1 decimal.
- All figures use `tabular-nums`.

**Channel colours** (`CHANNELS`):

| Channel | Colour token |
|---|---|
| In store & website | `--brand-900` |
| DoorDash | `--red-900` |
| Uber Eats | `--green-900` |
| Grubhub | `--gray-900` |

App logos live at `/dashboard/{doordash|ubereats|grubhub}.png`.

## 8. Design system (as built)

- Next.js 16 (App Router), React 19, Tailwind v4, lucide-react icons. Light theme by default. Orange brand.
- Tokens come from the Figma "Foundation" file:
  - colours: `--color-*` and `--gray-200…900`;
  - radius: `rounded-small|medium|large|circle`;
  - type: `text-body-md`, `text-body-sm`, `text-subtitle-*`, `text-menu-sm`.
- **Chips** (filters, Compare): `h-8 rounded-medium border text-menu-sm`.
- **Cards**: white `rounded-medium p-5` on a `gray-300` tray with `p-1.5` padding.
- **Table**: `border-separate border-spacing-0`, `gray-400` grid lines. The All column's Net after fees and Profit cells are tinted `green-200` (`red-200` at a loss).
- **Figma**: KoreFi file `9nrRMpdh5VU9aHnFyc1T2a`.
  - P&L Summary frame: `1514:18163`, updated to `1544:8366`.
  - Platform breakdown chip: `287:11686`.

## 9. Reference figures

Use these to confirm a rebuild matches. Conditions: all 34 outlets, **Last 4 weeks (Sep 3 – Sep 30, 2026)**, typical costs (30% food, 30% staff), nothing saved in localStorage. The figures are produced by the real generators.

| Line | In store & website | DoorDash | Uber Eats | Grubhub | All |
|---|---|---|---|---|---|
| Orders | 70,634 | 8,935 | 5,879 | 2,264 | 87,712 |
| **Sales** | 813,115 | 219,141 | 152,655 | 63,374 | **1,248,285** |
| ↳ Gross sales | 854,891 | 219,141 | 152,655 | 63,374 | 1,290,062 |
| ↳ Discounts and comps | 40,754 | | | | 40,754 |
| ↳ Refunds | 1,022 | | | | 1,022 |
| Card fees | 21,167 | — | — | — | 21,167 |
| App commission | — | 50,469 | 41,235 | 12,682 | 104,386 |
| ↳ Commission | | 43,895 | 41,235 | 10,749 | 95,879 |
| ↳ Processing fee | | 6,574 | 0 | 1,933 | 8,507 |
| Your app promos | — | 2,542 | 887 | 190 | 3,620 |
| ↳ Discounts you funded | | 1,743 | 628 | 137 | 2,508 |
| ↳ Ads and marketing fees | | 799 | 260 | 54 | 1,112 |
| Chargebacks, after money back | — | 1,053 | 602 | 202 | 1,857 |
| ↳ Charged for errors | | 2,379 | 1,338 | 446 | 4,164 |
| ↳ Won back | | +1,327 | +736 | +244 | +2,307 |
| **Net after fees** | 791,947 | 165,077 | 109,931 | 50,300 | **1,117,255** |
| Food & drink | 243,934 | 65,742 | 45,797 | 19,012 | 374,486 |
| Staff | | | | | 374,486 |
| **Profit after prime cost** | | | | | **368,284** |

**Cards for the same view:**

- **Profit after prime cost**: ≈ 30% (29.5%), ≈ $368,284 of $1,248,285 sold.
  - The span before (Aug 6 – Sep 2) had $1,253,691 in sales and $369,875 in profit, also 29.5%, so the change is 0.0 pts.
  - With typical costs, the margin is always Paid to you − 60%.
- **Paid to you**: 89.5%.
  - Fees per $1: In store 3¢ (2.6) · DoorDash 25¢ · **Uber Eats 28¢** (red, the most expensive) · Grubhub 21¢.
- **Sales**: $1,248,285, about −0.4% vs before (shows as 0% after rounding). 87,712 orders · 34 outlets.
  - Weekly sales: 315,356 · 307,194 · 318,772 · 306,962.
- **POS ⇄ 3PD check** (Last 4 weeks, all outlets):

  | App | Matched orders | Missing in 3PD | Missing in POS | Waiting |
  |---|---|---|---|---|
  | DoorDash | 7,048 | 76 · $2,288.87 | 21 · $643.48 | 0 |
  | Uber Eats | 5,242 | 80 · $2,377.41 | 23 · $646.12 | 0 |
  | Grubhub | 1,846 | 59 · $1,953.78 | 19 · $621.88 | 0 |

**Compare outlets, Last 4 weeks, each outlet's Total (apps only):**

| Outlet | DoorDash sales | Uber Eats sales | Grubhub sales | Apps sales | Net after fees | Profit after prime cost |
|---|---|---|---|---|---|---|
| Carol Stream | 5,662 | 3,860 | 1,541 | 11,063 | 8,254 | 1,616 |
| 71st & Western | 7,903 | 5,573 | 2,278 | 15,753 | 11,796 | 2,344 |
| 79th & Cicero | 7,829 | 5,389 | 2,246 | 15,464 | 11,544 | 2,266 |
| 87th & Stoney | 7,447 | 5,126 | 2,136 | 14,709 | 10,981 | 2,155 |
| Chicago & Halsted | 10,548 | 7,472 | 3,117 | 21,137 | 15,798 | 3,116 |
| Damen & Chicago | 9,107 | 6,177 | 2,573 | 17,858 | 13,395 | 2,680 |
| Edgewater | 8,221 | 5,813 | 2,400 | 16,434 | 12,260 | 2,399 |
| Hyde Park | 9,612 | 6,796 | 2,806 | 19,213 | 14,333 | 2,805 |
| Montrose & N Elston | 7,383 | 5,071 | 2,152 | 14,605 | 10,902 | 2,139 |
| Old Town | 10,274 | 7,119 | 2,984 | 20,377 | 15,215 | 2,989 |
| Pulaski & Belmont | 7,397 | 5,240 | 2,186 | 14,822 | 11,078 | 2,185 |
| Rogers Park | 7,435 | 5,148 | 2,042 | 14,625 | 10,927 | 2,152 |
| Taylor & Ogden | 9,878 | 6,966 | 2,847 | 19,691 | 14,745 | 2,930 |
| Elburn | 3,384 | 2,311 | 979 | 6,674 | 4,997 | 992 |
| Franklin Park | 5,592 | 3,849 | 1,604 | 11,045 | 8,245 | 1,619 |
| Glen Ellyn | 5,618 | 4,016 | 1,692 | 11,326 | 8,488 | 1,693 |
| Green Oaks | 4,187 | 2,994 | 1,261 | 8,443 | 6,327 | 1,262 |
| Gurnee | 5,515 | 3,766 | 1,595 | 10,876 | 8,142 | 1,617 |
| Huntley | 3,950 | 2,736 | 1,136 | 7,822 | 5,827 | 1,134 |
| Joliet | 6,259 | 4,274 | 1,811 | 12,344 | 9,241 | 1,835 |
| Naperville | 6,858 | 4,904 | 2,066 | 13,828 | 10,363 | 2,066 |
| Niles | 6,603 | 4,552 | 1,882 | 13,037 | 9,752 | 1,929 |
| North & Narragansett | 6,435 | 4,482 | 1,807 | 12,724 | 9,520 | 1,885 |
| Oak Park | 7,017 | 4,861 | 2,038 | 13,916 | 10,391 | 2,041 |
| Tinley Park | 5,848 | 4,049 | 1,606 | 11,503 | 8,594 | 1,692 |
| Waukegan | 4,807 | 3,331 | 1,396 | 9,535 | 7,120 | 1,399 |
| Dyer | 4,229 | 2,906 | 1,235 | 8,371 | 6,259 | 1,237 |
| Merrillville | 5,062 | 3,451 | 1,378 | 9,891 | 7,380 | 1,445 |
| Valparaiso | 3,737 | 2,672 | 1,126 | 7,535 | 5,647 | 1,126 |
| Marysville | 2,913 | 2,082 | 878 | 5,873 | 4,401 | 878 |
| Brown Deer | 4,494 | 3,213 | 1,354 | 9,061 | 6,790 | 1,354 |
| Mequon | 3,916 | 2,675 | 1,133 | 7,724 | 5,783 | 1,148 |
| Capitol Dr & Hwy 43 | 6,395 | 4,392 | 1,864 | 12,652 | 9,444 | 1,853 |
| Marquette | 7,624 | 5,390 | 2,225 | 15,240 | 11,369 | 2,225 |

The All outlets **Total** column equals the three app columns of the channel table summed:

- Sales $435,170
- Net after fees $325,308
- Profit = 325,308 − apps' food (130,551) − apps' share of staff (374,486 × 435,170 / 1,248,285 ≈ 130,551) ≈ **$64,206**

## 10. File map in the source repo

| Concern | File |
|---|---|
| Page | `src/app/(mvp2)/mvp2/pnl/page.tsx`, `src/components/finance/PnlSummary.tsx` |
| Figures (`usePnl`, `totals`, `appCol`, `appsOnly`, `CHANNELS`, `WEEKS`, `PRESETS`), cards | `src/components/finance/PnlStory.tsx` |
| Table (channel and outlet comparison) | `src/components/finance/PnlTable.tsx` |
| Phone list | `src/components/finance/PnlMobile.tsx` |
| Cost editor | `src/components/finance/CostPopover.tsx`, `src/lib/finance/costSettings.ts` |
| POS ⇄ 3PD hover and drawer | `src/components/finance/ReconHover.tsx`, `src/lib/finance/reconcile.ts` |
| Date filter | `src/components/finance/DateRangeFilter.tsx` |
| Outlet filters | `src/components/mvp2/OutletFilters.tsx`, `src/lib/finance/outletFilter.ts` |
| Data | `src/lib/finance/outlets.ts`, `books.ts`, `reports.ts` |
| Formatting helpers | `src/components/finance/parts.tsx` (`usd`, `pct`) |
