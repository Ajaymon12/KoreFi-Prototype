import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Foundation text styles (src/app/foundation.css → --text-*) are font sizes, not colours;
// without this, tailwind-merge drops e.g. `text-menu-md` when a `text-(--color-…)` follows.
const FOUNDATION_TEXT = [
  "jumbo-lg", "jumbo-md", "jumbo-sm", "page-title",
  "subtitle-lg", "subtitle-md", "subtitle-sm", "subtitle-xs",
  "body-lg", "body-md", "body-sm",
  "button-md", "button-sm", "button-xs",
  "field-md", "field-sm", "label-md", "label-sm", "menu-md", "menu-sm",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: { "font-size": [{ text: FOUNDATION_TEXT }] },
    theme: { radius: ["small", "medium", "large", "xlarge", "circle"] },
  },
});

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
