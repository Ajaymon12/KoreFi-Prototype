// Viewport breakpoints, mirrored from the @theme block in src/app/globals.css. Mobile-first:
// each value is the width a Tailwind prefix (sm:, md:, …) starts applying.

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  "3xl": 1920,
} as const;

export type Breakpoint = "base" | keyof typeof BREAKPOINTS;

/** What each range is for, how the app shell behaves there, and the sizes it's checked at. */
export const BREAKPOINT_GUIDE: { key: Breakpoint; range: string; devices: string; shell: string; tested: [number, number][] }[] = [
  { key: "base", range: "0–639", devices: "Phones", shell: "Top bar with menu button; navigation in a slide-in drawer; one column", tested: [[360, 740], [390, 844]] },
  { key: "sm", range: "640–767", devices: "Large phones, small tablets", shell: "Same as phones; two-column card grids where they fit", tested: [[640, 960]] },
  { key: "md", range: "768–1023", devices: "Tablets (portrait)", shell: "Drawer navigation; content uses the full width", tested: [[768, 1024]] },
  { key: "lg", range: "1024–1279", devices: "Tablet landscape, small laptops", shell: "Full shell: icon rail + section sidebar", tested: [[1024, 768]] },
  { key: "xl", range: "1280–1535", devices: "Laptops (13–14\")", shell: "Full shell; onboarding shows the workspace preview", tested: [[1280, 800], [1366, 768], [1440, 900]] },
  { key: "2xl", range: "1536–1919", devices: "Desktops", shell: "Full shell; content centred at its max width", tested: [[1536, 864]] },
  { key: "3xl", range: "1920+", devices: "Large desktops (1080p, 1440p, 4K)", shell: "Full shell; wider content cap so the page doesn't float", tested: [[1920, 1080], [2560, 1440]] },
];

/** The breakpoint a given viewport width falls in. */
export function breakpointFor(width: number): Breakpoint {
  let current: Breakpoint = "base";
  for (const [k, v] of Object.entries(BREAKPOINTS)) if (width >= v) current = k as Breakpoint;
  return current;
}
