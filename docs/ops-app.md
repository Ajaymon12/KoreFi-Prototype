# KoreFi Ops app (`/admin`)

Internal product for the KoreFi ops team. Ops does the work that owners only see the results of:
uploads 3PD/POS exports, files chargebacks, resolves tax-credit tasks. Companion doc: [owner-app.md](owner-app.md).

Status: **prototype on mock data**, no backend. "Built" exists in code; "Planned" is agreed direction only.

## Who and how
- Users: KoreFi staff, any email ending `@karboncard.com` (`isAdminEmail` in `src/lib/admin/session.ts`).
- Mock login at `/login` (any password). Session = email in localStorage key `kf-session`.
  Admin emails land on `/admin`; everyone else goes to the Owner app.
- **Gating is client-side only** (`src/app/admin/layout.tsx` redirects to `/login` if not admin). No
  middleware, on purpose: `next.config.ts` supports a static export for GitHub Pages
  (`GITHUB_PAGES=true`), which can't run middleware. Real enforcement needs the backend.
- The Owner app has no guard yet (an admin or anonymous visitor can open `/home/...`).

## Look and feel (decided)
Same brand and UI as the Owner app, **different accent**: indigo instead of orange, plus a persistent
"Ops" badge and an indigo rule across the top, so staff always know which product they're in.
- `ThemeShell` (`src/components/shell/ThemeShell.tsx`) takes `product="owner" | "ops"` and sets
  `data-product` on the frame. The admin layout uses `product="ops"`.
- `src/app/ops-theme.css` overrides only the `--brand-*` scale for `[data-product="ops"].light` and
  `.dark`. The `--color-primary`, `--color-text-clickable` and `--color-focus-primary` aliases derive from
  it. **Never edit `src/app/foundation.css`** (generated from Figma by `design-system/build.py`).
- Light/dark/system toggle is in the Ops header (shares the saved `korefi-theme`).
- Design reference: Figma file `9nrRMpdh5VU9aHnFyc1T2a`, node `1431:28101` (Ops "File uploads": global bar,
  200px "Workspace" sidebar, filter bar, table with sortable headers, pager). Earlier Ops uploads
  designs: Figma Master File section `1398:7073`.

## Screens (built)
Sidebar: Dashboard, Users, Data ingestion > File uploads, plus a "Customer view" link to `/home/overview`.
The frame is in `src/app/admin/layout.tsx` (a hand-copied frame, not shared with `(app)/layout.tsx`).

| Route | Component | What it does |
|---|---|---|
| `/admin` | `components/admin/OverviewView.tsx` | Dashboard: KPI cards (customers, active this week, still onboarding, open chargebacks); "Needs attention" queues that deep-link into filtered lists; onboarding funnel; recent uploads; connected sources per provider |
| `/admin/users` | `components/admin/UsersView.tsx` | All customer accounts: search, Status + Data filters, sortable columns, 12/page pager, Export CSV, detail drawer (onboarding timeline, sources, data freshness, chargebacks). Reads `?status=` and `?data=`; needs the Suspense wrapper in `app/admin/users/page.tsx` for static export |
| `/admin/uploads` | `components/admin/UploadsView.tsx` | Upload history, "Upload report" dialog (user, restaurant, 3PD/POS, provider, file), extraction, "Needs mapping" outlet-mapping dialog, details drawer. Providers: DoorDash, Uber Eats, Grubhub, Square, Toast. Demo panel triggers states. No pager yet |

Shared admin pieces: `FilterSelect.tsx`, `Pager.tsx`, `ProviderLogo.tsx` (in `components/admin/`);
`DetailDrawer`/`Timeline`/`DetailList` in `components/ui/DetailDrawer.tsx`; `StatusBadge` in
`components/dashboard/primitives.tsx`; `PageHeader` in `components/shell/PageHeader.tsx`.

## Data (all mock)
- `src/lib/admin/accounts.ts`: 25 customer accounts (`ACCOUNTS`), onboarding `STEPS`, status/data
  metadata, `NOW` (fixed "today" = 2026-10-12 so server and client agree). The first five match the Figma customers.
- `src/lib/admin/data.ts`: `PROVIDERS`, `RESTAURANTS`, `USERS` (3, feed the upload form's user picker; ids
  `priya`, `arjun`, `sana` also exist in `ACCOUNTS`), upload types, `SEED_HISTORY`, `UPLOAD_STATUS`.
- `src/lib/admin/mock.ts`: fake file reading and checks (nothing is really parsed).
- The admin data is **not connected** to the Owner app's data (`src/lib/sources/*`, `src/lib/org/*`).

## Planned
- Phase 1 leftovers: shared `AppFrame` extracted from both layouts, reusable `RoleGuard` (also guarding the
  owner app), `src/lib/admin/nav.ts`, a `Role` type.
- Customers: Organizations tab (org > brand > location), "View as customer" with a visible banner, audit log.
- **Chargebacks** queue (New / Filed / Won / Lost); the owner view stays read-only and reflects status.
- **Tasks / tax-credit** queue feeding the Owner `home/tasks`.
- Later: onboarding pipeline board, data coverage matrix, reconciliation checks, weekly-notes authoring,
  support inbox, ops team roles, one shared store linking Ops actions to Owner dashboards.
- Pager on File uploads (Figma shows one).

## Gotchas
- This Next.js (16.3.x) differs from older versions; read `node_modules/next/dist/docs/` before coding (see AGENTS.md).
- `useSearchParams` on a statically rendered page must sit inside `<Suspense>` or the build fails.
- `DetailDrawer` is `fixed top-[46px]`, sized for the Owner shell; in Ops it overlaps the header by a few px (harmless).
- Seed dates are naive local ISO strings so formatting matches on server and client.
