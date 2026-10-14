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
| `/mvp/chargebacks` | open · resolved · breakdown | Error charges with KoreFi's automatic dispute pipeline (`disputeStage`: found → filed → waiting on the app → won/lost) |
| `/mvp/promos` | summary · campaigns · apps | Promo and ad spend vs the sales it brought, return per $1 (`lib/sources/promos.ts`, new `Promo` fixtures) |
| `/mvp/brief` | preview · delivery | The brief rendered as email and WhatsApp, and delivery preferences (`lib/brief/prefs.ts`, localStorage; nothing is sent) |

Every page uses `components/mvp/frame.tsx` (`MvpFrame`, `useTab`) and carries up to three insights for
that page (`MvpInsights` list or `InsightBanner`, the three-column card after Mercury's Transactions
banner; insights are tagged with `page` in `lib/sources/overview.ts`, links rewritten by `lib/mvp/insights.ts`).

**Profit is the design reference for the other reports.** Charts first, after Mercury's Books overview
(`components/mvp/charts.tsx`: `BigStat`, `Sparkline`, `InOutBars`, `ShareBars`, `Fact`, `Column`, `Panel`):
Summary = three columns (Sales · Costs · Profit); By channel / By store = a stacked "$100" bar or
store-vs-store bars, then one card per channel/store with its trend and figures; Statement = period
picker, three headline numbers, the expandable statement with a Change column, and a drawer with the
line's monthly trend. The headline series is always brand orange; supporting data is neutral grey or a
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
Finance / Delivery Apps / Growth Coworker, avatar + collapsible, Mercury's nested-link rail with an accent
bar on the current page; items marked `soon` are listed but not links), with Integrations and Settings
pinned at the bottom. Under `lg` the same list is in the top-bar drawer (`NavDrawer`, shared with the
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
