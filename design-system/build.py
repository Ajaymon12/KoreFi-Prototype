"""Generate the KoreFi Foundation tokens from the Figma "Foundation" file exports.

Source: Figma file zqwFPtFZLOTynCD1hbvAxy (Foundation v1.0, 2026-10-01).
  base-colors.txt   ⚙️ Base Color collection: name|light hex|dark hex   (16 scales × 12 steps)
  alias-colors.txt  ⚙️ Alias Color collection: name|base token|Figma code syntax|description

Outputs (do not edit by hand — edit the .txt exports or this script, then run `python3 design-system/build.py`):
  src/app/foundation.css      CSS custom properties + Tailwind theme (text styles, radius, font)
  design-system/FOUNDATION.md human-readable reference
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "src/app/foundation.css"
DOC = ROOT / "FOUNDATION.md"

# ---------- data ----------
base = []  # (scale, step, light, dark)
for line in (ROOT / "base-colors.txt").read_text().split():
    name, light, dark = line.split("|")
    scale, step = name.split("/")
    base.append((scale, int(step), f"#{light}", f"#{dark}"))
BASE = {f"{s}/{n}": (l, d) for s, n, l, d in base}
SCALES = list(dict.fromkeys(s for s, *_ in base))

# The four Brand accent tokens all share `var(--color-primary)` as their code syntax in Figma;
# only Brand/Primary keeps that name here, the lighter steps get unique names.
BRAND_RENAME = {
    "Brand/Lightest": "--color-brand-lightest",
    "Brand/Light": "--color-brand-light",
    "Brand/Primary Light": "--color-brand-primary-light",
}
alias = []  # (figma name, base ref, css var, description)
for line in (ROOT / "alias-colors.txt").read_text().strip().splitlines():
    name, ref, syntax, desc = line.split("|", 3)
    css = BRAND_RENAME.get(name, syntax.removeprefix("var(").removesuffix(")"))
    alias.append((name, ref, css, desc))

# ✏️ text styles: name, size px, line-height (ratio), letter-spacing (em), weight
TEXT = [
    ("Jumbo/Large", "jumbo-lg", 46, 1.0, -0.04, 400),
    ("Jumbo/Medium", "jumbo-md", 36, 1.0, -0.03, 400),
    ("Jumbo/Small", "jumbo-sm", 26, 1.0, -0.03, 400),
    ("Page Title/Medium", "page-title", 26, 1.2, -0.02, 400),
    ("Subtitle/Large", "subtitle-lg", 18, 1.2, -0.01, 400),
    ("Subtitle/Medium", "subtitle-md", 16, 1.2, -0.01, 400),
    ("Subtitle/Small", "subtitle-sm", 14, 1.2, -0.01, 400),
    ("Subtitle/Extra Small", "subtitle-xs", 12, 1.4, 0, 400),
    ("Body/Large", "body-lg", 16, 1.5, 0, 400),
    ("Body/Medium", "body-md", 14, 1.5, 0, 400),
    ("Body/Small", "body-sm", 12, 1.3, 0.02, 400),
    ("Body Bold/Large", "body-lg", 16, 1.5, 0, 500),
    ("Body Bold/Medium", "body-md", 14, 1.5, 0, 500),
    ("Body Bold/Small", "body-sm", 12, 1.3, 0.02, 500),
    ("Button Text/Medium", "button-md", 14, 1.2, 0, 400),
    ("Button Text/Small", "button-sm", 13, 1.2, 0.01, 400),
    ("Button Text/Extra Small", "button-xs", 12, 1.2, 0.01, 400),
    ("Field Text/Medium", "field-md", 14, 1.5, 0, 400),
    ("Field Text/Small", "field-sm", 13, 1.5, 0.01, 400),
    ("Form Label/Medium", "label-md", 14, 1.4, 0, 400),
    ("Form Label/Small", "label-sm", 12, 1.4, 0, 400),
    ("Menu Text/Medium", "menu-md", 14, 1.3, 0, 400),
    ("Menu Text/Small", "menu-sm", 13, 1.3, 0, 400),
]
# Button Text Underline/* = Button Text/* + underline (not separate utilities).

SPACING = [
    ("Space0", 0, "No space. Flush layouts and resets."),
    ("Space2", 2, "Hairline gaps: icon to badge, very tight inline items."),
    ("Space4", 4, "Tight gaps: icon to label, chip and tag internals."),
    ("Space6", 6, "Compact control padding and dense lists."),
    ("Space8", 8, "Default gap between related inline items; small component padding."),
    ("Space12", 12, "Gap inside buttons and form fields; list item spacing."),
    ("Space16", 16, "Default component padding: cards, inputs, menus."),
    ("Space20", 20, "Gap between related groups inside a section."),
    ("Space24", 24, "Card and modal padding; gap between form rows."),
    ("Space32", 32, "Spacing between blocks inside a page section."),
    ("Space52", 52, "Spacing between major page sections."),
    ("Space84", 84, "Page margins and hero spacing."),
]

RADIUS = [
    ("None", "none", 0, "Square corners: tables, full-bleed sections, dividers."),
    ("Small", "small", 4, "Small elements: checkboxes, tags, badges, tooltips."),
    ("Medium", "medium", 8, "Default for buttons, inputs, dropdowns and menus."),
    ("Large", "large", 12, "Cards, panels and popovers."),
    ("XLarge", "xlarge", 20, "Modals, sheets and large containers."),
    ("Circle", "circle", 1000, "Fully rounded: avatars, pills and circular icon buttons."),
]


# ---------- helpers ----------
def var(ref):  # "brand/900" -> --brand-900
    return "--" + ref.replace("/", "-")


def lum(h):
    c = [int(h[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def resolved(ref, mode):
    return BASE[ref][0 if mode == "light" else 1]


# ---------- CSS ----------
css = [
    "/* GENERATED by design-system/build.py from the Figma Foundation file — do not edit. */",
    "",
    "/* ⚙️ Base Color — light mode (default, and any `.light` subtree) */",
    ":root,\n.light {",
    *(f"  {var(f'{s}/{n}')}: {l};" for s, n, l, _ in base),
    "  color-scheme: light;",
    "}",
    "",
    "/* ⚙️ Base Color — dark mode */",
    ".dark {",
    *(f"  {var(f'{s}/{n}')}: {d};" for s, n, _, d in base),
    "  color-scheme: dark;",
    "}",
    "",
    "/* ⚙️ Alias Color — semantic tokens. Declared on every theme scope so they re-resolve",
    "   against that scope's base colours (a nested `.light` inside `.dark` works). */",
    ":root,\n.light,\n.dark {",
    *(f"  {c}: var({var(r)}); /* {n} */" for n, r, c, _ in alias),
    "}",
    "",
    "@theme {",
    '  --font-sans: "Google Sans Flex", var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;',
    "",
    "  /* ⚙️ Border Radius → rounded-none | rounded-small | rounded-medium | rounded-large | rounded-xlarge | rounded-circle */",
    *(f"  --radius-{k}: {px}px;" for _, k, px, _ in RADIUS if k != "none"),
    "",
    "  /* ✏️ Text styles → text-<name>; pair with font-medium for the Body Bold styles */",
]
seen = set()
for _, key, size, lh, ls, _ in TEXT:
    if key in seen:
        continue
    seen.add(key)
    css += [
        f"  --text-{key}: {size}px;",
        f"  --text-{key}--line-height: {lh:g};",
        f"  --text-{key}--letter-spacing: {ls:g}em;",
    ]
css += ["}", ""]
APP.write_text("\n".join(css))

# ---------- Markdown ----------
md = []
w = md.append
w("# KoreFi Foundation")
w("")
w("> Generated by `design-system/build.py` from the Figma **Foundation** file "
  "([zqwFPtFZLOTynCD1hbvAxy](https://www.figma.com/design/zqwFPtFZLOTynCD1hbvAxy/Foundation)), v1.0 · 2026-10-01. "
  "Edit the Figma file, re-export, and re-run the script rather than editing this page.")
w("")
w("The Foundation is the single source of truth for colour, type, spacing and shape in the KoreFi product. "
  "Components (for example the ❖ Button in the *Design System – Master File*) are built only from these tokens.")
w("")
w("## Contents")
w("")
for s in ["Using tokens in code", "Typography", "Spacing", "Border radius", "Alias colours (semantic tokens)",
          "Base colours", "Grid", "Changelog"]:
    w(f"- [{s}](#{s.lower().replace(' ', '-').replace('(', '').replace(')', '')})")
w("")

w("## Using tokens in code")
w("")
w("All tokens live in [`src/app/foundation.css`](../src/app/foundation.css), imported by `globals.css`.")
w("")
w("| Need | Use | Example |")
w("|---|---|---|")
w("| A semantic colour | the alias CSS variable | `bg-(--color-background-secondary)`, `text-(--color-text-secondary)` |")
w("| A raw scale step (rare: illustrations, charts) | the base variable | `bg-(--blue-900)` |")
w("| A text style | `text-<style>` utility (+ `font-medium` for Bold) | `text-body-md`, `text-page-title`, `text-body-sm font-medium` |")
w("| Corner radius | `rounded-<token>` | `rounded-medium` (buttons/inputs), `rounded-large` (cards) |")
w("| Spacing | Tailwind's 4px scale (table below) | `gap-2` = Space8, `p-6` = Space24 |")
w("")
w("**Rules**")
w("")
w("- Use **alias** tokens in UI. Base colours are for data-viz and illustration only.")
w("- Never hard-code hex values or Tailwind palette colours (`bg-orange-500`) in product UI.")
w("- Theme is chosen by class: `.light` (default) or `.dark` on any ancestor. Tokens re-resolve inside nested scopes, "
  "so a `.light` panel can sit inside a `.dark` page.")
w("- The base font is **Google Sans Flex** (⚙️ Typography → Font family/Base Font), loaded globally in `src/app/layout.tsx`.")
w("")

w("## Typography")
w("")
w("Font family: **Google Sans Flex**. Regular = 400, Medium (\"Bold\" styles) = 500.")
w("")
w("| Figma style | Utility | Size | Line height | Letter spacing | Weight |")
w("|---|---|---|---|---|---|")
for name, key, size, lh, ls, wt in TEXT:
    util = f"`text-{key}`" + (" `font-medium`" if wt == 500 else "")
    w(f"| ✏️ {name} | {util} | {size}px | {lh:g} ({round(size * lh)}px) | {ls * 100:g}% | {wt} |")
w("| ✏️ Button Text Underline/* | Button Text utility + `underline` | — | — | — | 400 |")
w("")
w("Usage: Jumbo for marketing/hero numbers · Page Title for the main page heading · Subtitle for card and section "
  "titles · Body for running text · Button/Field/Form Label/Menu text inside those components.")
w("")

w("## Spacing")
w("")
w("Spacing tokens control gap and padding. In Figma they're scoped to **Gap**; in code use the matching Tailwind step.")
w("")
w("| Token | Value | Tailwind | Usage |")
w("|---|---|---|---|")
for name, px, use in SPACING:
    tw = f"`{px / 4:g}`" if px else "`0`"
    w(f"| {name} | {px}px | {tw} (e.g. `gap-{px / 4:g}`) | {use} |")
w("")

w("## Border radius")
w("")
w("| Token | Value | Utility | Usage |")
w("|---|---|---|---|")
for name, key, px, use in RADIUS:
    w(f"| {name} | {px}px{' (full)' if px == 1000 else ''} | `rounded-{key}` | {use} |")
w("")

w("## Alias colours (semantic tokens)")
w("")
w("49 tokens in the ⚙️ Alias Color collection. Each points at a base step, so its light/dark value follows the base "
  "colour's mode. Contrast is measured against Background/Secondary (light #fcfcfc / dark #161616).")
w("")
groups = {}
for a in alias:
    groups.setdefault(a[0].split("/")[0], []).append(a)
bg = BASE["gray/100"]
for g, items in groups.items():
    w(f"### {g}")
    w("")
    w("| Token | CSS variable | Base | Light | Dark | Contrast L / D | Usage |")
    w("|---|---|---|---|---|---|---|")
    for n, r, c, d in items:
        l, dk = BASE[r]
        on_surface = not (n.startswith(("Background/", "Text/Inverse")))
        cr = f"{contrast(l, bg[0]):.1f} / {contrast(dk, bg[1]):.1f}" if on_surface else "—"
        w(f"| {n} | `{c}` | `{r}` | `{l}` | `{dk}` | {cr} | {d} |")
    w("")
w("> Note: in Figma, Brand/Lightest, Brand/Light and Brand/Primary Light all carry the code syntax "
  "`var(--color-primary)`. In code only Brand/Primary uses `--color-primary`; the others are "
  "`--color-brand-lightest`, `--color-brand-light` and `--color-brand-primary-light`. Fix the code syntax in Figma to match.")
w("")

w("## Base colours")
w("")
w("16 twelve-step scales (100–1200) with Light and Dark modes. **brand** is the KoreFi orange anchored on "
  "`#F76808` (brand-900) and is identical to **orange**. CSS variables are `--<scale>-<step>`, e.g. `--brand-900`.")
w("")
w("Step guide (Radix-style): 100–200 app backgrounds · 300–500 component backgrounds (normal/hover/pressed) · "
  "600–800 borders · 900–1000 solid fills · 1100–1200 text.")
w("")
for mode, idx in (("Light", 0), ("Dark", 1)):
    w(f"### {mode} mode")
    w("")
    w("| Scale | " + " | ".join(str(s) for s in range(100, 1300, 100)) + " |")
    w("|---|" + "---|" * 12)
    for sc in SCALES:
        w(f"| {sc} | " + " | ".join(f"`{BASE[f'{sc}/{n}'][idx]}`" for n in range(100, 1300, 100)) + " |")
    w("")

w("## Grid")
w("")
w("The Foundation's 🪟 Grid page is in **Beta** and currently has only its description (\"The grid is the foundation "
  "for positioning content on a screen\") and no layout grids defined yet. Until it does, product layouts use the "
  "app shell's fixed regions (top bar 48px, icon rail 64px, sidebar 256px) with Space24 page padding.")
w("")

w("## Changelog")
w("")
w("From the Figma 📝 Changelog page (v1.0):")
w("")
w("| Date | Area | Change |")
w("|---|---|---|")
for date, area, text in [
    ("2026-10-01", "❖ Base Color", "BREAKING: rebuilt as 16 twelve-step scales (100–1200) with Light and Dark modes. Brand scale moved from green to orange, anchored on #F76808 (brand-900)."),
    ("2026-10-01", "❖ Alias Color", "New collection of semantic tokens: Brand, Text, Background, Border, Focus, Success, Info, Warning, Danger, Neutral. All pairs tested for WCAG 2.1 AA; added Primary Solid and Border/Input; remapped Text/Tertiary and Focus to pass contrast."),
    ("2026-10-01", "❖ Design Token", "Design Token page documents every alias token with CSS name, usage, contrast and Light/Dark previews; code syntax `var(--color-…)` added for Dev Mode."),
    ("2026-10-01", "❖ Typography", "Body Bold styles set to Medium (500); Light/Dark previews; headings in unavailable Atlassian Sans replaced with Body Bold/Small."),
    ("2026-10-01", "❖ Spacing & Border Radius", "New pages with usage guidance, bound to the Spacing and Border Radius variables."),
    ("2026-10-01", "❖ Library cleanup", "Local text styles and variables everywhere; external library styles removed; frame header in Google Sans Flex (46px title)."),
    ("2025-06-30", "❖ Logo", "Fixed Confluence variant losing proportions."),
]:
    w(f"| {date} | {area} | {text} |")
w("")
DOC.write_text("\n".join(md))
print(f"wrote {APP.relative_to(ROOT.parent)} ({len(base)} base, {len(alias)} alias) and {DOC.relative_to(ROOT.parent)}")
