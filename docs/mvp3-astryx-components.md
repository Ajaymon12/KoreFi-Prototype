# Using Astryx components in MVP3

2026-11-19 · Source: [github.com/meta/astryx](https://github.com/meta/astryx) (MIT, public, ~30k stars) · `@astryxdesign/core` 0.7.x, **beta**.

## Can we use it?

**Yes, for everything except the app shell.** It installs cleanly into this stack. MVP3 already has its own design system, so Astryx must be bridged onto our Foundation tokens.

| Check | Result |
|---|---|
| React 19 | Required `>=19`. We run 19.2.8. ✅ |
| Next.js | Documented setup: three CSS imports plus a `<Theme>` provider. No build plugin, no PostCSS or Babel change. ✅ |
| Tailwind 4 | Documented "Next.js + Tailwind" setup. Needs one `@layer` line placed **above** the Tailwind import, or the cascade silently inverts. ⚠️ |
| Styling lock-in | StyleX is internal. Consumers override with `className` (Tailwind works). `@stylexjs/stylex` is still a peer dependency. ✅ |
| Theming | A theme is a set of CSS custom property overrides, so we can point it at our Foundation tokens. ✅ |
| Maturity | Beta. `@astryxdesign/charts` and `vega` are canary-only. Expect API churn. ⚠️ |
| Overlap | `src/components/ui/` has Button, Select, TextField, Toast, BottomSheet, Checkbox and more. `src/app/foundation.css` holds the alias tokens (`--color-*`, `text-body-sm`, `rounded-medium`). Two systems means two looks unless bridged. ⚠️ |

## Recommendation

1. **Keep** our Foundation tokens and the brand orange. They match the Figma Master File.
2. **Take from Astryx** every component except the app shell, replacing our `components/ui` equivalents in MVP3 (see Decision below).
3. **Bridge the theme first.** Write one Astryx theme file that maps Astryx tokens to `--color-*` / radius / type aliases. Without it, Astryx renders in its neutral theme and looks foreign next to our screens.
4. **Spike before committing.** Add the packages on a branch, render one component (`DropdownMenu`), check dark mode and the bundle-size diff, then decide.

## Where it helps (open items from `docs/mvp3-design-system-audit.md`)

| MVP3 need | Astryx component | Replaces |
|---|---|---|
| Dropdown menu (built 4× by hand: AgentChat, AgentsPage, IntegrationsDirectory, Mvp3Sidebar) | `DropdownMenu`, `MoreMenu`, `ContextMenu` | the 4 hand-built menus |
| Dialogs with different z-index and scrim (ChatSearch, IntegrationsDirectory, Onboarding) | `Dialog`, `AlertDialog`, `Drawer`, `Overlay`, `Layer` | custom overlays (50/60/70/80/90) |
| Chat search | `CommandPalette`, `PowerSearch` | ChatSearch.tsx |
| Agent chat surface | `Chat`, `Markdown`, `Citation` | parts of AgentChat.tsx. Evaluate carefully, ours has agent avatars and drafts. |
| Report tables, payouts, chargebacks | `Table`, `Pagination`, `Timestamp`, `MetadataList` | ReportTable, MasaPayouts, MasaChargebacks |
| Tabs, filters | `TabList`, `SegmentedControl`, `Token`, `Tokenizer` | CountTabs, pill chips |
| Loading and empty | `Skeleton`, `Spinner`, `EmptyState`, `ProgressBar` | `kf-shimmer`, ad-hoc empties |
| Onboarding tour | `Stepper`, `Popover`, `HoverCard`, `Tooltip` | Onboarding tour code |
| Resizable canvas | `Resizable`, `ScrollableArea` | AgentChat split |
| Status | `Badge`, `StatusDot`, `Banner`, `Indicator` | hand-made badges (the 11px text gap) |

Page-level templates (`astryx template dashboard`, `settings`) are content-only layouts. Treat them as reference, not drop-ins, since MVP3 owns its sidebar and shell.

## Decision (2026-11-19)

Use Astryx for **all** MVP3 components **except the app shell**. That means `Button`, `IconButton`, `TextInput`, `Selector`, `Toast` and the rest replace our `components/ui/*` equivalents inside MVP3, as call sites are touched.

- **Excluded:** `AppShell`, `SideNav`, `TopNav`. MVP3 keeps `Mvp3Sidebar` and its layout.
- **Charts:** `@astryxdesign/charts` is canary-only. Allowed, but pin the exact version and keep `chart-tokens.css` colours until verified.
- **Do not delete** `src/components/ui/*`. MVP1 and MVP2 still use them.
- **Tokens stay ours.** The theme bridge maps Astryx to Foundation tokens, so brand orange and the AA rule (no white on `--color-primary`) still hold. The `Button` migration changes visuals, so check sizes and the primary colour.
- Any `rounded-full` / palette colour / `font-semibold` habits from Astryx examples. Our scale only has 400/500.

## Setup (spike branch only)

```bash
npm install @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
npm install -D @astryxdesign/cli
```

`src/app/globals.css`: put the layer line **first**, before Tailwind.

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
@import 'tailwindcss/utilities.css' layer(utilities);
```

Then a client `Providers` wrapper with `<Theme theme={neutralTheme}>`. Scope it to the `(mvp3)` route group so MVP1 and MVP2 are untouched.

Do **not** run `npx @astryxdesign/cli init` blindly. It writes into `AGENTS.md` / `CLAUDE.md`, and AGENTS.md here is managed by `next dev`. Run it, review the diff, and keep only what is needed.

Verify against the live docs before relying on this page: `npx @astryxdesign/cli docs theme`, `docs tokens`, `component <Name>`.

## Open questions

- Does the Astryx neutral theme's dark mode follow our `.dark` / `prefers-color-scheme` switch, or its own?
- Bundle-size cost of `@stylexjs/stylex` plus the pre-built `astryx.css` (all 150 components' CSS ships).
- Is a React 19.2.8 / Next 16.3 combination exercised by their tests? Their docs say React 19+, nothing more specific.
- Whether the audit's missing tokens (Caption 11px, Background/Tertiary, Brand/Subtle, shadow/scrim/z-index) are better added to Foundation or taken from Astryx's token set.

The skill that applies this guidance is at `.claude/skills/astryx-mvp3/SKILL.md`.
