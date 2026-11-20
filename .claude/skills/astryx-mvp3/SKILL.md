---
name: astryx-mvp3
description: Use Meta's Astryx design system components (@astryxdesign/core) inside KoreFi MVP3 without breaking the Foundation design system. Use when adding or replacing a dropdown menu, dialog, command palette, table, tabs, tooltip, popover, skeleton, empty state or stepper in src/components/mvp3, or when asked whether Astryx has a component for something.
---

# Astryx in MVP3

Background and the decision record: `docs/mvp3-astryx-components.md`. Read it first if you have not.

## Rules

1. **Astryx is the default component library for MVP3**, including `Button`, `TextField`, `Select`, `Toast`, `Dialog`, `Table` and the rest. Migrate existing `src/components/ui/*` and hand-built MVP3 controls to Astryx as you touch them. Foundation tokens (`src/app/foundation.css`) stay the source of colour, radius and type via the theme bridge.
2. **Exception: app shell.** Do not use `AppShell`, `SideNav` or `TopNav`. `Mvp3Sidebar` and the MVP3 layout stay ours. Chart packages are canary-only, so use them only after confirming the version is pinned and stable enough.
3. **Scope it.** Astryx CSS and `<Theme>` load only under the `(mvp3)` route group. Do not touch MVP1 or MVP2 layouts (they keep `components/ui/*`, so do not delete those files).
4. **Theme bridge required.** Never ship a raw `theme-neutral` Astryx component. Map Astryx tokens to Foundation aliases (`--color-*`, radius, type) in one theme file first, then use components. Brand primary is the orange from the Master File, and the AA rule still applies (no white text on `--color-primary`).
5. **Style overrides** go through `className` with our Tailwind alias utilities (`rounded-medium`, `text-body-sm`, `bg-(--color-background-secondary)`). No palette colours, no `font-semibold`, no `rounded-full` (use `rounded-circle`).
6. **Report-only owner UI** still applies. Do not add owner CTAs because a component makes it easy.
7. Astryx is beta (0.7.x). Pin exact versions, and wrap each Astryx component in a small MVP3 file (e.g. `mvp3/Menu.tsx`) so a future API change touches one place.

## Workflow

1. **Check the need.** Look for an Astryx component first. If a call site uses a `components/ui` or hand-built control that Astryx covers, migrate it.
2. **Ask the CLI, do not guess props.** Astryx's API differs from what you remember.
   ```bash
   npx @astryxdesign/cli component --list
   npx @astryxdesign/cli component DropdownMenu
   npx @astryxdesign/cli docs tokens
   npx @astryxdesign/cli build "<what you are building>"
   ```
   Use the scoped name `@astryxdesign/cli`. The unscoped `astryx` is a different npm package.
3. **Check setup state.** If `@astryxdesign/core` is not in `package.json`, the spike has not been done. Stop and tell the user. Setup steps are in the doc. Do not run `astryx init` without reviewing the diff, because it edits `AGENTS.md` / `CLAUDE.md`.
4. **Wrap, then use.** Create the thin wrapper, import from `@astryxdesign/core/<Component>`, and replace one call site first.
5. **Verify.** `npx tsc --noEmit`, `npm run lint`, then load the affected `/mvp3` route in light and dark mode. Say plainly if you could not check visually.

## Component map

| Need | Use |
|---|---|
| Dropdown / more / context menu | `DropdownMenu`, `MoreMenu`, `ContextMenu` |
| Dialog, confirm, side sheet | `Dialog`, `AlertDialog`, `Drawer` |
| Search palette | `CommandPalette`, `PowerSearch` |
| Data table, pagination | `Table`, `Pagination` |
| Tabs, segmented filter | `TabList`, `SegmentedControl` |
| Loading, empty, progress | `Skeleton`, `Spinner`, `EmptyState`, `ProgressBar` |
| Tour, hints | `Stepper`, `Popover`, `HoverCard`, `Tooltip` |
| Status | `Badge`, `StatusDot`, `Banner`, `Indicator` |
| Split panes | `Resizable`, `ScrollableArea` |
| Chat rendering | `Chat`, `Markdown`, `Citation` (evaluate against AgentChat first) |
| Actions and forms | `Button`, `IconButton`, `TextInput`, `Selector`, `Switch`, `CheckboxInput`, `Field` |
| Notifications | `Toast` |
| Not allowed (shell) | `AppShell`, `SideNav`, `TopNav` |

## Gotchas

- Tailwind setup: the `@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;` line must come **before** `@import "tailwindcss"`. After it, the cascade silently inverts.
- React 19+ only. `@stylexjs/stylex` is a peer dependency.
- Next.js: Astryx components that use hooks need a `'use client'` boundary. Check with the CLI docs before importing into a server component.
- `docs/mvp3-design-system-audit.md` lists the open gaps (11px text, tray grey, brand tint, shadow/scrim/z-index tokens). If Astryx covers one, raise it with the user instead of silently introducing a second token source.
