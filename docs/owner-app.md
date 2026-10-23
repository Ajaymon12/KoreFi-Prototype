# KoreFi Owner app (customer dashboard)

The product restaurant owners and managers use: a **report-only** dashboard for a restaurant tax-credit
and back-office SaaS. Owners see results; KoreFi's backend/ops team does every fix. Companion doc:
[ops-app.md](ops-app.md).

Status: **prototype on mock data**, no backend. Statically exportable for GitHub Pages.

## Principles
- **Report-only**: no owner CTAs to fix things on dashboards. Ops does the work (uploads, chargeback filing,
  tax-credit tasks); owners see status and outcomes.
- Delivery (3PD) data is **uploaded by KoreFi's ops team**, not connected by owners. Integrations lists only
  POS, accounting and bank; 3PD is connected manually by KoreFi. `DataSources.tsx` shows freshness and
  timezone only.
- Page structure follows Mercury-style patterns (tables, detail drawers, flat sections).
- Brand: orange KoreFi palette, from the Figma "Master File" tokens (see Theme below).

## Routes (`src/app`)
Public / auth: `/` (redirects to `/get-started`), `/get-started`, `/get-started/profile`, `/login` (mock),
`/onboarding/*`, `/design/{avatars,buttons}` (design reference pages).

### MVP (`src/app/(mvp)/mvp/`) — the owner dashboard going forward
Founders narrowed the owner dashboard to five reports plus a weekly brief. Nav is `MVP_NAV` /
`MVP_FOOTER` in `src/lib/nav.ts`; `OWNER_HOME` (`/mvp/overview`) is where login, onboarding "Go to
dashboard" and the not-found page send owners.

| Page | Tabs (`?tab=`) | What it shows |
|---|---|---|
| `/mvp/overview` | – | Four headline numbers, the weekly brief, top insights, where app money went, each store |
| `/mvp/profit` | summary · channel · store · statement | **POS connected**: the books' P&L (in-store, website, apps, then food/labour/running costs). **No POS**: a delivery-only P&L from the apps' payout, promo and chargeback reports. `dataMode()` in `lib/sources/dashboard.ts` picks |
| `/mvp/payouts` | week · reconciliation · history | Each app's payout vs the Mercury deposit; gaps are "KoreFi is reviewing"; weekly history estimated from daily sales |
| `/mvp/chargebacks` | summary · open · resolved | Error charges with KoreFi's automatic dispute pipeline (`disputeStage`: found → filed → waiting on the app → won/lost). Summary: charged back / won back / what went wrong + where every $100 went; Open: being disputed + where they are (next deadline, stages, app windows) + table; Resolved: won / lost / win rate + charged-vs-won trend + table |
| `/mvp/promos` | summary · campaigns · apps | Promo and ad spend vs the sales it brought, return per $1 (`lib/sources/promos.ts`, new `Promo` fixtures) |
| `/mvp/brief` | preview · delivery | The brief rendered as email and WhatsApp, and delivery preferences (`lib/brief/prefs.ts`, localStorage; nothing is sent) |

Every page uses `components/mvp/frame.tsx` (`MvpFrame`, `useTab`) and carries up to three insights for
that page (insights are tagged with `page` in `lib/sources/overview.ts`, links rewritten by `lib/mvp/insights.ts`).
Both `MvpInsights` (under a report) and `InsightBanner` (top of a page) render the same **AI card**: a
flat warm tint (`--brand-200`) with an orange hairline, no shadow. **Closed by default it is one line**
(~50px): "✦ KoreFi AI", the bottom-line sentence in KoreFi's voice with bold numbers, a dot per kind of
finding and "3 findings ⌄"; opening it is remembered (localStorage `kf-ai-card-open`). Open, each finding is
an accordion row that expands in place (Xero) to its arithmetic, a source chip (Perplexity / Rox), "best
guess" / "could be wrong if", "Open report" and 👍 👎 (Linktree / Basedash), with "Updated …" and "AI can
make mistakes" at the foot.

**Details dock beside the page, they don't slide over it** (Mercury Books' Invoices). The MVP layout wraps
the page in `DockArea` (`components/ui/Dock.tsx`); any `DetailDrawer` inside it portals into a slot on the
right and the page splits, list still usable (click another row to swap, the open row stays highlighted via
`DataTable`'s `onRowClick` / `selectedKey`). Toolbar: ↑ ↓ (or K / J) step through the list, expand gives the
panel the full width, ✕ or Escape closes. One panel at a time. Under `lg` it covers the page instead.
Outside the MVP `DetailDrawer` keeps its overlay.

**Tables are `ReportTable`** (`components/ui/ReportTable.tsx`, Figma KoreFi 1431:28101 + Mercury Transactions).
No box: a table runs edge to edge across the page (it cancels the page's 16px gutter), so give it its own
row, never a grid cell. Title, toolbar band (search, `FilterChip` filters, actions) with a hairline under it,
grey header with sortable columns, rows with an
optional grey second line, `AppName` for app logos, "View ›" when rows open the docked detail, and a
"Showing 1–10 of N …" footer with pages (10 per page). The old `DataTable` stays for the module app only.

**Profit is the design reference for the other reports.** Charts first, after Mercury's Books overview
(`components/mvp/charts.tsx`: `BigStat`, `Sparkline`, `InOutBars`, `ShareBars`, `Fact`, `Column`, `Panel`):
Summary = three columns (Sales · Costs · Profit); By channel / By store = a stacked "$100" bar or
store-vs-store bars, then an edge-to-edge `ReportTable` (one row per channel/store, app logos via
`AppName`, a `MiniTrend` of the last weeks, sortable figures); Statement = three headline columns, then
a `TableFrame` (period picker + Export in its toolbar) around `<StatementTable flush />`, and a drawer
with the line's monthly trend. The headline series is always brand orange; supporting data is neutral grey or a
soft red. Books mode lives in `profit/Books.tsx`, delivery-only mode in `profit/AppsOnly.tsx`.

### Phasing out (`src/app/(app)/`)
The module app below still builds and is reachable by URL, but nothing links to it from the MVP. To be
deleted once the MVP is signed off: `home/*`, `finance/*` (keep `components/finance/*` and
`lib/finance/books.ts`, the MVP Profit page uses them), `operations/*` (keep `components/dashboard/Chargeback*`),
`growth/*`, `ai/*` (Sous). Nav defined in `src/lib/nav.ts` (`NAV_MODULES`):

| Module | Pages |
|---|---|
| Home | `/home` |
| Finance | `/finance/overview`, `pnl`, `balance-summary`, `payout`, `reconciliation`, `books`, `tax` |
| Operations | `/operations/overview`, `sales`, `orders`, `order-quality`, `wait-and-downtime`, `fees-and-commissions`, `refunds-and-adjustments`, `chargeback`, `platform-comparison` |
| Growth | `/growth/overview`, `delivery-growth`, `pricing`, `catering` |
| Other | `/ai` (Sous), `/integrations`, `/settings` (these two are shared with the MVP) |

Each page is a `*View.tsx` client component beside its `page.tsx` (e.g. `operations/chargeback/ChargebackView.tsx`).

## Shell
**MVP** (`src/app/(mvp)/mvp/layout.tsx`): `ThemeShell` > `TopBar` (restaurant picker, no Sous) > a bordered
panel with the single `MvpSidebar` and `<main>`. The sidebar reads "Workspace", then Overview and Weekly
brief, then the reports grouped under the cowork that produces them (`MVP_GROUPS` in `lib/nav.ts`:
Finance / Delivery Apps / Growth Coworker; items marked `soon` are listed but not links), with
Integrations and Settings pinned at the bottom. Interactions follow Mercury's web nav (Mobbin): the
groups (listed under one "Coworkers" heading as Finance / Delivery Apps / Growth, with line icons like
every other row) are an accordion (only one open, animated, the current page's group opens on
navigation); a group's icon turns into a chevron on hover and toggles it, the name links to its first report; nested
links sit on a rail with a sliding brand accent on the current page and a grey one that follows the
pointer; the sidebar folds to an icon column (button or `[`, stored in localStorage `kf-mvp-sidebar`)
where hovering a cowork opens a flyout of its reports. Under `lg` the same list is in the top-bar drawer (`NavDrawer`, shared with the
module app's `MobileNav`). No icon rail, no sub sidebar.

**Module app** (`src/app/(app)/layout.tsx`): `ThemeShell` > `TopBar` > `ModuleScope` containing `IconRail` +
a bordered panel with `Sidebar` and `<main>`. Components in `src/components/shell/` (TopBar, IconRail,
Sidebar, MvpSidebar, NavDrawer, ProfileMenu with theme switcher, LocationSwitcher, PageHeader, PageTabs,
MobileNav; `navItem.ts` holds the shared row style). Modules (Finance, Operations, Growth) are told apart
by illustration, not colour; `src/app/module-themes.css` maps `[data-module]` to the same brand palette.
Dashboard widgets live in `src/components/dashboard/`.

## Onboarding (`/onboarding/*`)
Flow: Org > Brand > Location, POS-first import, delivery, accounting, review, ready. Mercury-style cards and
a step rail (`components/onboarding/`, `OnboardingChrome` layout). State in `src/lib/org/store.ts`
(`useOnboarding`); POS import in `src/lib/org/posImport`. `/login` resumes unfinished onboarding via `resumeHref`.

## Theme
- Generated tokens: `src/app/foundation.css` (from Figma via `design-system/build.py`, **do not edit**).
  Light on `.light`, dark on `.dark`; components use `--color-*` semantic tokens and the `--brand-*` scale.
- `ThemeShell` applies the resolved class to the shell div (not `<html>`); light/dark/system lives in
  `components/shell/useTheme.ts` (localStorage `korefi-theme`; first paint is light).
- Chart colours: `src/app/chart-tokens.css`.
- The Ops app reuses these tokens with an indigo `--brand-*` override (see ops-app.md).

## Data (all mock)
- `src/lib/sources/*`: `catalog`, `connections`, `fixtures`, `ledger` (e.g. `chargebackRows`), `ops`,
  `overview`, `dashboard`, `adapters`, `client`, `format`, `types`.
- `src/lib/org/*`: org/brand/location store and types. Also `lib/mockData`, `lib/metrics`, `lib/period`.
- Not connected to the Ops app's data (`src/lib/admin/*`). Planned: one shared store so Ops uploads,
  chargeback status and tasks show up in the owner views.

## Chargebacks
Owners see a read-only dispute list, trend and win rate (MVP `ChargebacksView.tsx`; older
`operations/chargeback/ChargebackView.tsx`). Disputes are **filed automatically by KoreFi**; it is not
self-serve. The MVP shows the automation as a stage per charge (`disputeStage` in `lib/sources/dashboard.ts`).

## Auth
`/login` is a mock: any email/password; stores the email in localStorage `kf-session`. `@karboncard.com`
goes to the Ops app. The owner app has no route guard yet (planned `RoleGuard`, shared with Ops).

## Gotchas
- This Next.js (16.3.x) differs from older versions; read `node_modules/next/dist/docs/` first (AGENTS.md).
- Static export (`GITHUB_PAGES=true`) means no middleware/server redirects; guards are client-side.
- Pages using `useSearchParams` need a `<Suspense>` boundary.
