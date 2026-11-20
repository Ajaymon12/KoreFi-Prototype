# MVP3 design system audit

2026-11-18 · Scope: `src/components/mvp3`, `src/app/(mvp3)`, `src/lib/mvp3` (54 files, ~9.5k lines) · Checked against `design-system/FOUNDATION.md` and `src/components/ui/Button.tsx`.

## Verdict

MVP3 mostly follows the Foundation. There are **900+ alias-token references, 323 type-scale utilities and 191 radius-token utilities**, and no Tailwind palette colours (`bg-orange-500`) or raw sizes (`text-sm`). Where it drifted was **components**: primary buttons, secondary buttons, icon buttons and chips were rebuilt by hand in each file. That caused a contrast failure and one real token bug. Both are fixed in this refactor.

## Fixed in this refactor

| # | Issue | Why it mattered | Fix |
|---|---|---|---|
| 1 | `--color-danger-darker` / `--color-warning-darker` used in 3 files | **These tokens don't exist.** The hard-coded fallback hex always applied, so dark mode never changed it | Changed to `--color-danger-darkest` / `--color-warning-darkest` (AgentChat, EmailPreview, MasaChargebacks) |
| 2 | 5 hand-built primary buttons using `bg-(--color-primary) text-white` | Brand/Primary behind white text is 3.0:1, which fails AA. The DS forbids this pairing | Now `<Button type="primary">` (AgentsPage "New agent", AgentOverview "Run now", OutletDive "Send to manager", AgentDashboard "Save schedule", EmailPreview CTA). ActivityLog avatar now uses `--color-primary-solid` |
| 3 | 3 copies of a local `const btn = "…"` secondary button | Three slightly different heights (32/36px) and icon sizes | `buttonVariants({ type: "default", size: "small" })` (AgentOverview, OutletDive, AgentDashboard) |
| 4 | Ghost icon button copied 10× (close, back, more, remove) | Copy-paste drift | Shared `iconButton` in new `mvp3/styles.ts` |
| 5 | `focus` ring constant defined 3× and pill-chip styles 4× | Duplication | Shared `focusRing` and `pill` in `mvp3/styles.ts` |
| 6 | `text-white` on `--gray-1200` and `--color-primary-solid` | In dark mode `--gray-1200` is #ededed, so this became **white on light grey** | `bg-(--color-text-primary) text-(--color-text-inverse-primary)` (BrandMark, WorkflowEditor) |
| 7 | `font-semibold` ×3 | The type scale only has 400/500 | `font-medium` |
| 8 | `rounded-full`, `bg-(--gray-200)`, `--brand-900` | Raw values where an exact token exists | `rounded-circle`, `--color-neutral-lightest`, `--color-primary` |

16 files changed plus `styles.ts`. `tsc` and `eslint` pass, and all 8 `/mvp3` routes return 200. **Not checked visually.** Expected visual changes: the converted buttons now use the DS sizes (34px, 14px regular label instead of 12px medium), primary buttons are a darker orange (`#bd4b00`), and danger dots and borders follow dark mode.

## CTA hover is brand orange (2026-11-19)

Every call-to-action turns brand orange on hover, so a clickable action always reads the same way.

| Control | Rest | Hover | Pressed |
|---|---|---|---|
| `Button type="primary"` | `--color-primary-solid` fill (#bd4b00) | `--color-primary` fill (#f76808) | `--brand-1200` (unchanged) |
| `Button type="default"` / `"outline"` / `"dashed"` | Neutral border, Text/Primary label | Border `--color-primary`, fill `--color-primary`/8 %, label `--color-text-clickable` | Same as hover, but the fill is 15 % |
| `pill` chip (`mvp3/styles.ts`) | Neutral border | Same as Default hover | — |
| Hand-built MVP3 action buttons | Neutral border | Same as Default hover | — |

- **Hand-built action buttons changed:** AgentsPage (card action, "Show all"), ActivityLog ("Show more"), AgentDashboard (pill link, card hover action), AgentChat (Pin), IntegrationsDirectory (agent chip) and WorkflowEditor ("Add step" dashed drop zone).
- **Contrast:** the label on the orange tint is Text/Clickable, which is 4.9:1 in light mode and 7.8:1 in dark mode, so it passes AA. Icons inside these buttons use `currentColor` and turn orange with the label.
- **Unchanged, because they aren't CTAs:** `text` (ghost) buttons, `iconButton`, `link` (already orange), `secondary`, `danger`, `warning`, plus filter toggles, select triggers, list rows and menu items. These keep the neutral grey hover.
- **Known gap:** white text on the Primary hover fill (#f76808) is 3.0:1. That passes for large text and UI components but not for body text at AA. It is shown only while the pointer is over the button, as in the Figma Master File.
- **New hand-built buttons** should use `<Button>` or `buttonVariants`. If that isn't possible, copy the hover classes from `pill`.

## Still open (needs a decision, not a find-and-replace)

**A. Gaps in the design system itself.** These need a new Foundation token or a change in Figma:
- **11px text, used 15×** (badges, counts, timestamps). The smallest style is Body/Small at 12px. Also 9px ×2, 10px ×2, and hero numbers at 28px/34px (between Jumbo/Small 26 and Jumbo/Medium 36). Either add a *Caption* style or move these to 12px.
- **Grey tray background `--gray-300`, used 4×** (AgentHome, MasaPayouts, MasaChargebacks, AgentChat split). No alias exists. Suggest adding *Background/Tertiary*.
- **Selected-state brand tints `--brand-100/200/400`** (Onboarding, WorkflowEditor). Suggest adding *Brand/Subtle*.
- **Chat bubble radii 18/24/28px** (AgentChat, Onboarding). These fall between Large (12) and XLarge (20).
- **Agent hues are hard-coded hex** in `lib/mvp3/agents.ts`, and Finance's `#6C74E6` is repeated in `AgentAvatar.tsx`. Suggest `--agent-*` tokens.
- **No shadow, scrim or z-index tokens.** There are 19 different `shadow-[…]` values and 4 backdrop opacities (`bg-black/30`, `/40`, `/60`, plus a 45% spotlight).
- **The DS `Button` itself uses Tailwind `text-sm`/`text-base`**, not `text-button-*`.

**B. Component consolidation, worth doing next:**
- **Dialogs:** `Modal.tsx` exists, but ChatSearch, IntegrationsDirectory (connect sheet) and Onboarding (video and tour) build their own overlays. They use different z-index values (50/60/70/80/90) and scrim opacities. Move them onto `Modal` (it needs an `align="top"` option for search).
- **Dropdown menus:** built 4× by hand (AgentChat agent menu, AgentsPage card menu, IntegrationsDirectory, Mvp3Sidebar). Extract one `Menu` + `MenuItem`.
- **Card shells:** AgentDashboard `Card`, masaParts `TableCard` and mvp2 `Tray`/`Section` overlap.
- **85 raw `<button>`s remain.** Most are legitimate (list rows, inline links, tabs). Only the action buttons above belonged to `Button`.

**C. Intentional, so leave alone:** third-party brand logos (QuickBooks, Xero, Google and others in BrandMark and Onboarding), and the GitHub-styled OAuth mock in IntegrationsDirectory (lines ~460–545), which imitates an external consent page on purpose.

## Dimensional check (enesozturk/dimensional-drawing method)

2026-11-18. Checked against the [dimensional-drawing](https://github.com/enesozturk/dimensional-drawing) skill's measuring rules: every dimension is a variable that holds across instances, derived values close their formulas, and nested corners follow `R2 = R1 − B − S6`. Static survey of class strings. These were not rendered and measured in Playwright.

| Variable | Expected | Found in MVP3 | Status |
|---|---|---|---|
| **R2 nested corner** (menus: R1 12, B 1, S6 6 → R2 = 5) | inner ≈ 4 (`rounded-small`) | items use `rounded-medium` (8) in AgentsPage, AgentChat, AccountSwitcher and IntegrationsDirectory menus; trays (R1 12, S6 6 → 6) hold 8px rows in AgentHome and MasaPayouts | ✗ off by 2–3px, so the corners aren't concentric |
| **S1 card padding** | one value per card type | p-2.5 ×3, p-3 ×2, p-3.5 ×2, p-4 ×2, p-5, p-6, px-3.5 py-3 | ✗ 7 values for the same "bordered card" |
| **H3 control height** | DS sizes 26 / 34 / 38 / 42 | h-7 (28) ×4, h-8 (32) ×3, h-9 (36) ×5, h-[34px] ×2, h-6 | ✗ only h-[34px] matches a DS size |
| **R1 dialog** | XLarge 20 (FOUNDATION: modals) | Modal `rounded-large` 12; ChatSearch and tour video `rounded-xlarge` 20; connect sheet radius set by its child | ✗ 2 of 4 |
| **Dialog V1 / scrim / z** | one value each | V1 16px ×3 and 12vh top ×1; scrim 30/40/60%; z 50/60/70/90 | ✗ |
| **MH max height** | `100vh − 2·V1` | Modal `min(88vh, 860px)`, ChatSearch 70vh, others unset | ✗ |
| **Z2 / I1 close button** (centred icon offset `(Z2−I1)÷2`) | (32−16)÷2 = 8 | size-8 + size-4 in every dialog and panel header | ✓ |
| **I1 icon size** | 16 / 12 | size-4 ×64, size-3 ×38, size-5 ×6 | ✓ |
| **T1 touch target** (24px min, WCAG 2.5.8) | ≥ 24 | icon buttons 24–32px; one 12px remove button | ~ |
| **S3 card gap** | consistent | gap-3 ×5, gap-2 ×3, gap-1.5 ×3 | ~ acceptable spread |

### Applied 2026-11-18 (spec: [docs/specs/modal-dimensional-drawing.html](specs/modal-dimensional-drawing.html), UI-DIALOG-002)

- **Dialogs:** Modal, ChatSearch, the IntegrationsDirectory connect sheets and the Onboarding video now share `scrim` (40 %) and `dialogSurface` (R1 20, B 0, shadow 24/64/0) from `mvp3/styles.ts`. Modal's close inset is 12 (`R2 = 20 − 0 − 12 = 8` = close radius), and its max height is `min(100dvh − 2·V1, 860)`. z-index is unchanged.
- **Nested corners:** 4 menus and 2 trays went from `p-1.5` to `p-1`, so 8px rows sit concentric in 12px containers.
- **DashboardPage:** its hand-built `btnCls` is now `buttonVariants` small.
- Left as is: the toolbar controls at 36px (`h-9`) are one consistent size (search, filter tabs, inputs), and the compact cards at `p-2.5` are one consistent variant.
