# The P&L table: structure and behaviour, as a reusable pattern

Plain-language spec for building the same kind of table on other pages (payouts, chargebacks, labor, any "lines down the side, columns across the top" report). Read it top to bottom. §1 to §9 are the pattern and apply to any report. §10 says how the P&L fills it in, and §11 is a checklist for a new table.

Reference code: `src/components/finance/PnlTable.tsx` (the table), `CostPopover.tsx` (cell editor), `ReconHover.tsx` (cell check), `PnlStory.tsx` (figures and types). For the page around it see `docs/mvp2-pnl-context.md`. State on 2026-11-24, branch `astryx-spike`. Prototype: all data is mocked.

---

## 1. What kind of table this is

A **line-by-column report**:
- **Rows are lines** (Sales, Fees, Profit). Each line is one measure.
- **Columns are the things being compared** (channels, outlets, weeks). The last column is the combined total.
- The owner **reads** it. The only edit is a cost estimate (§7). Nothing else in the table is an action.
- It is dense on purpose: a grid with a line between every row and column, one-line rows, like a CRM records table (Attio).

Use this pattern when one number depends on a few others (a total built from parts) and the owner wants to see the parts. Do not use it for a list of records (orders, chargebacks). Use a normal data table for that.

## 2. Anatomy

```
┌──────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ ☰ Line  Expand all   │ Column A │ Column B │ Column C │ All      │  ← header row (sticky top)
├──────────────────────┴──────────┴──────────┴──────────┴──────────┤
│ Reported · From the uploaded reports                              │  ← section row
├──────────────────────┬──────────┬──────────┬──────────┬──────────┤
│ Orders               │    55    │    40    │    12    │   107    │  ← plain line
│ ▸ Sales              │ $5,000   │ $3,000   │ $1,000   │ $9,000   │  ← strong line (grey row), has parts
│ Card fees            │   —      │   —      │   —      │   −$150  │  ← line that does not apply: dash
│ Net after fees       │ …        │ …        │ …        │ [green]  │  ← strong line, tinted cell in All
├──────────────────────┴──────────┴──────────┴──────────┴──────────┤
│ ▸ Prime cost                                                      │  ← group that opens
│ Profit after prime cost                            [green or red] │
└───────────────────────────────────────────────────────────────────┘
```

Parts of the table:

| Part | What it is |
|---|---|
| **Line column** | The first column. Names stay pinned on the left while figures scroll sideways. |
| **Header row** | Grey. One cell per column: icon and name. Hover names the column's source. |
| **Group header row** | Optional second header above the first (§6, compare mode). |
| **Section row** | A thin full-width row that says what the lines below are and where they come from. |
| **Line** | One row. Name, ⓘ tip, optional chevron, then one figure per column. |
| **Part** | A child row under a line, indented on a tree guide. |
| **Strong row** | A row with a faint grey background and bold text, for subtotals. |
| **Tinted cell** | A coloured cell in the last column for the bottom-line figure: green, or red at a loss. |

## 3. Data shape

The table takes already-worked-out figures. It does no maths on the page except sums of parts.

```ts
type Col = { sales, orders, cardFees, commission, ... }   // every figure for one column
type Totals = { cols: Record<ColumnKey, Col>, all: Col }  // the columns, plus the combined column

type Line = {
  key: string,            // also the key into REPORT_FIELDS (the source columns)
  label: string,
  sub?: string,           // what it means, in one sentence (the ⓘ text)
  get: (c: Col) => number,
  cost?: boolean,         // shows as a minus
  only?: "apps" | "instore",   // columns it applies to; others show a dash
  parts?: Part[],         // child rows
};
type Part = { label, get, cost?, back?, only? };   // back = money coming back (shows + in green)
```

Rules:
1. **Define lines as data** (`SALES`, `SELLING`), then render them with one function (`lineRows`). Never hand-write a row.
2. **A line with parts must equal its parts.** The ⓘ formula is generated from the parts (`formulaOf`), so the screen and the maths cannot disagree. Sales = Gross sales − Discounts − Refunds + Service charges.
3. **Parts that are costs read minus, parts that add read plus.** For a cost line the sign flips: a "back" part (money won back) reads plus.
4. **Every share is a share of that column's sales.** Not of the grand total.

## 4. Rows: kinds and how they look

| Kind | Look | Used for |
|---|---|---|
| Plain line | 44px, normal text | Most lines |
| Plain line, grey figures | grey text | Counts (Orders) |
| **Strong line** | grey row (`gray-200`), name and sales bold | Sales, Net after fees, Profit |
| Part (child) | 32px, small, grey name, indented 48px, tree guide | Detail of a line |
| Section row | 44px, spans all columns, text sticks to the left (`sticky left-3`) so it stays readable while scrolling sideways | "Reported" |
| Group row | A line that opens into several lines and is a section row when open | "Prime cost" |
| "Once" line | One merged empty cell across the channel columns, a figure only in the last column | Staff, Profit when they only make sense in total |

Sizes: row 44px, part 32px, header 42px, group header 34px, figure column 170px (140px when comparing), pinned Line column 280px when comparing, table minimum width 920px.

Grid: `border-separate border-spacing-0`. The table draws the top and left line, each cell draws its right and bottom line (`gray-400`). Row hover is `gray-200`.

### 4.1 Tree guide for parts
A 1px `gray-600` line drops from the parent's chevron through every part. The last part's line stops at the middle of its row, with a 16px tick into the name. This keeps the line unbroken across row borders.

### 4.2 Cells
- A figure is **whole dollars**, `tabular-nums`, right-aligned, never wrapped.
- A cost reads `−$1,234`. A negative cost (more came back than went out) reads `+$1,234` in green.
- A "money back" part reads `+$1,234` in green.
- **A line that does not apply to a column shows a grey `—`.** A part that does not apply leaves its cell empty. Do not show `$0` for something that cannot happen.
- Estimates carry `≈` only in cards. In the table below Net after fees the estimates stay bare (no `≈`, no "typical" tag), because owners know food and staff are their own numbers.
- The bottom-line figure is bold and coloured by sign: green positive, red negative.

## 5. Behaviour

### 5.1 Open and close
- A line with parts shows a **chevron** (rotates 90° when open). Click toggles that line.
- State is a `Set<string>` of open line keys.
- The header's **Expand all / Collapse all** link opens or closes every line that can open. It reads "Collapse all" only when every openable line is open.
- A line left with a single part does not open (nothing to add). Hide the chevron.

### 5.2 Search
- `query` narrows the lines. A line shows if its name **or one of its parts** matches.
- A search **opens** the lines whose parts match, so the match is visible.
- If nothing matches the table shows one row: `No lines match "x".` Section rows hide too.
- Search never changes the figures, only which rows show.

### 5.3 Two views of the same figures
A `ViewContext` holds `"amount"` or `"percent"`. Every `Amount` reads it.
- **Amount**: dollars.
- **Percent**: share of that column's sales, whole %, under 0.5% reads "<1%". Sales reads 100%. Signs stay the same.
- The section row adds "· % of each column's sales" in percent view.
- The toggle is an icon-only segmented control (`$` and `%`) in the filter bar.

### 5.4 Pinned header and names
- `sticky` makes the header rows stick to the top of the nearest scroll box. The page must give the table **one scroll box for both axes** (`overflow-auto`), or sticky will not work.
- `scrolled: { x, y }` comes from the scroll box. When `x` is true, a soft shadow shows off the pinned names' right edge. When `y` is true, a soft shadow shows under the header.
- The pinned Line cell needs a solid background (`bg-secondary`, and `gray-200` on hover) or figures show through it.
- The first header cell must be `z-[3]!` or scrolled headers paint over it.

### 5.4a Page frame and table width

The table is **full bleed**: it fills the content area from the sidebar's right edge to the panel's right edge. No max-width, no centring, no side padding on the table itself.

```
┌ Sidebar ┬───────────────────────────────────────────────────────┐
│         │ PageHeader (title, right-side note)                   │  ← fixed, outside the scroll box
│         ├───────────────────────────────────────────────────────┤
│         │ ╔ ONE SCROLL BOX  overflow-auto contain-paint ═══════╗ │
│         │ ║  [Search] | [filters] [date]      [Compare][$ %]  ║ │  ← filter bar: px-4, sticky left-0, z-[4]
│         │ ║  [ card ][ card ][ card ]                         ║ │  ← cards: px-4, sticky left-0, bottom line
│         │ ║ ┌────────────────────────────────────────────────┐║ │
│         │ ║ │ TABLE  w-full min-w-[920px]  edge to edge      │║ │  ← no padding: its grid touches both edges
│         │ ║ └────────────────────────────────────────────────┘║ │
│         │ ╚═══════════════════════════════════════════════════╝ │
└─────────┴───────────────────────────────────────────────────────┘
```

Rules:
1. **One scroll box** wraps the filter bar, cards and table: `min-h-0 flex-1 overflow-auto contain-paint`. The page header sits above it and does not scroll.
2. **`contain-paint` is required.** Without it a wide table widens the whole page and the page scrolls sideways.
3. **Table width:** `w-full min-w-[920px]`. Wider than 920px it stretches to fill the panel, and each figure column stays 170px (140px when comparing), so the extra space goes to the Line column. Narrower than 920px it keeps 920px and scrolls sideways inside the box.
4. **Everything above the table is `sticky left-0`** (filter bar, cards, "no outlets" message). When the table scrolls sideways they stay put and the table slides under them.
5. **Only the table is edge to edge.** Everything else on the page keeps `px-4`.
6. The filter bar stays on one line. Outlet count, Compare, breakdown and view toggle sit at the right end (`ml-auto`); the labels collapse to icons on narrow windows.
7. The table is `hidden md:block`. Phones get the one-column-at-a-time list in its own `px-4` block, and the filter bar becomes a single "All outlets · Last 4 weeks · Change" line.
8. The panel itself comes from the layout (`(mvp3)/mvp3/layout.tsx`): a bordered, rounded panel holding the sidebar and the page. The table never sets its own outer border beyond the top and left grid line.

To reuse on another page: copy this frame, not just the table component. The table alone will not stick, scroll or size correctly.

### 5.5 Phones
The table does not fit a phone. Do not shrink it. Show **one column at a time** (tabs: All, then each channel) as a list of lines with the figure and its share on the right (`PnlMobile`, `MobileChannel`). The same data object feeds both.

## 6. Compare mode (columns become groups)

Same table, columns swapped: one **group per outlet**, each group holding that outlet's apps and a total, then an "All outlets" group.

- A second header row above the column row holds the group names (Store icon, name, chevron).
- **Groups start closed**: each shows only its Total column. A chevron opens that group's app columns. A switch (and "Show all platforms" in the header corner) opens all at once. State is a `Set<string>` of open groups, keyed by outlet id plus `"all"`.
- A Total column has a heavier right border (`gray-700`) to close its group.
- Lines that only make sense for one column type drop out (in-store lines, when every column is a delivery app). A line left with one part stops opening.
- Lines that were "once" now show in every column, because each column carries its share (staff split by sales).
- Header wording: the closing column reads "Total" (or "Outlet total" and "All delivery apps" when the wording must be clearer, `clearTotals`).
- The group name stays visible beside the pinned Line column while any of its columns is in view (`sticky left-[292px]`).

## 7. Cell editing (the one owner action)

Cost lines that the reports do not contain (food, staff) are estimates the owner sets. This is a deliberate exception to "report only".

- The cost row shows a **pencil** next to its name. Hover shows the saved setting.
- Click opens a popover (`CostPopover`), portalled and `fixed` so the scroll box cannot clip it. It flips above the button when there is no room below. Width 340px.
- The popover has **two linked fields**: `% of sales` and `$ a month`. Typing in one updates the other from the chosen outlets' average monthly sales. Whichever was typed last is what is saved.
- A warning shows only when the cost passes half of sales.
- **Enter** saves, **Escape** or a click outside cancels (`useDismiss`).
- While editing, the row has a 2px amber bar on its left edge (`inset shadow`) and the table behind it updates live from the draft.
- The editor is built from a `CostEdit` object the page owns: `draft`, `start(key)`, `change(setting)`, `save()`, `cancel()`, plus labels (`scopeLabel`: "all 34 stores", "Hyde Park only").
- Saved per outlet, with an "all" fallback. Prototype: in memory.

If you add another editable line, give it a key in `COSTS`, reuse `CostPopover`, and add one row of `figureRow` with `end: <CostPopover … />`. Do not build a second editor.

## 8. Hover and help

### 8.1 ⓘ line tip (`InfoTip`)
Hover or keyboard focus on the small ⓘ beside a line's name opens a 288px tip:
1. The line name.
2. One sentence on what it means (`sub`).
3. **Where it comes from**: the report column per channel (`REPORT_FIELDS[key]`), one per line.
4. **How it's worked out**: a grey box with the formula, wrapping between terms, never inside one.

Rules: portalled to `document.body`, with an arrow pointing back at the icon, flips above near the bottom of the screen, closes on any scroll, `role="tooltip"`, `aria-describedby` while open. The name cell truncates and the sticky column would clip an in-cell tip, which is why it is portalled.

Keep the sentence about the line plain: "What each app keeps for taking the order." No formulas in the sentence. Formulas go in the grey box.

### 8.2 Column header hover
Names the source, in one phrase. "Point of sale: in-store and website sales from Square". "Third-party delivery: this app's payout report".

### 8.3 Cell check (`ReconHover`)
A figure can carry a **check against a second source**. In the P&L, each app's Sales figure is checked against the POS.
- Status chip beside the figure: red alert when something is missing in the app, amber when only the POS is short, green tick when all orders match.
- Hover or focus opens a 360px card. It stays open while the pointer moves into it (150ms grace). The figure stays shaded while open and a small triangle points at it.
- The card gives one line per kind of difference (count and amount). **View all** opens a drawer beside the table with every order, grouped by kind, with kind tiles that filter the list.
- Report only. Nothing in the card is an action.

Use this whenever the same number comes from two places.

## 9. Words and signs

- Line names say what happened, in plain words: "Chargebacks, after money back", "Your app promos", "Net after fees". Not accounting terms.
- A line that is a subtotal says so with **after**: "Net after fees", "Profit after prime cost".
- Never show a figure the reports do not contain as if it were reported. Estimates sit under their own group ("Prime cost") and only the owner's setting feeds them.
- Dash means "does not apply". Zero means "applies and is zero".
- Tell the owner nothing to do. KoreFi's team does the fixing. (Only exception: the cost pencil.)

## 10. How the P&L fills the pattern

| Pattern slot | P&L value |
|---|---|
| Columns | In store & website, DoorDash, Uber Eats, Grubhub, All |
| Section rows | "Reported" (from the uploaded reports), then "Prime cost" when open |
| Lines | Orders · Sales (4 parts) · Card fees · App commission (2 parts) · Your app promos (2 parts) · Chargebacks after money back (2 parts) · Net after fees · Prime cost (Food, Staff) · Profit after prime cost |
| `only` rules | Card fees and Sales discounts, refunds, service charges: in store only. Commission, promos, chargebacks: apps only |
| Strong rows | Sales, Net after fees, Profit |
| Tinted cell | Net after fees (green) and Profit (green, or red at a loss), in All only |
| "Once" lines | Staff and Profit, because staff is shared and splitting it makes every app look loss-making |
| Editable lines | Food and Staff |
| Cell check | Sales in each app column and in All, POS against the app's report |
| Group mode | Compare outlets |

Full formulas: `docs/mvp2-pnl-context.md` §3 and §5.

## 11. Checklist for a new table

1. Name the columns and the combined column. Say where each column's figures come from (one phrase each).
2. List the lines as data. For each: `key`, `label`, one-sentence `sub`, `get`, `cost`, `only`, `parts`.
3. Decide which lines are strong rows, which are section groups, which are "once" lines.
4. Decide which lines do not apply to which columns and mark them with `only` (they will show a dash).
5. Add the line keys to `REPORT_FIELDS` so the ⓘ can say where each figure comes from.
6. Decide the bottom-line cell and its tint rule.
7. Say whether any line is an owner estimate. If it is, use `CostPopover` and a `CostEdit`. If not, no pencil anywhere.
8. Say whether any figure is checked against a second source. If so, use `ReconHover`.
9. Wire the page: one scroll box, `scrolled` from it, `sticky`, `query` from the search box, `view` from the toggle.
10. Add the phone view. One column at a time from the same data.
11. Check: every parent equals the sum of its parts, the % view reads against the right column's sales, search opens matching parts, Expand all and Collapse all flip correctly, and a line that does not apply shows a dash and not zero.

## 12. Known quirks

- `PnlStory.tsx` and `PnlTable.tsx` import each other. Read `CHANNELS` inside the component, not at the top of the file, or it is not ready at load.
- Hiding the last app or part must not leave an empty column. A line with one part loses its chevron (`shape()` in `PnlGrid`).
- `isOpen` requires `l.parts`. A search never opens a line that has none.
- Compare mode drops the in-store lines. If you add a line, set `only` or it will show a meaningless dash in every delivery column.
