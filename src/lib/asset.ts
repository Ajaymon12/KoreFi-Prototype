// Files in /public (logos, icons) are plain URLs, and Next only adds a sub-path prefix to its own
// <Link>s. When the prototype is published on GitHub Pages it lives under /KoreFi-Prototype, so
// every public file goes through asset(). Locally the prefix is empty and nothing changes.
// NEXT_PUBLIC_BASE_PATH is set from next.config.ts.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
