import type { NextConfig } from "next";

// Two modes:
//  - normal (`npm run dev`, `npm run build`): a regular Next app.
//  - GitHub Pages (GITHUB_PAGES=true, set by .github/workflows/pages.yml): a static export of plain
//    files, served from https://<owner>.github.io/<repo>/. The sub-path comes from GITHUB_REPOSITORY.
const pages = process.env.GITHUB_PAGES === "true";
const basePath = pages ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "KoreFi-Prototype"}` : "";

const nextConfig: NextConfig = {
  // Read by src/lib/asset.ts so files in /public get the same prefix.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(pages
    ? {
        output: "export",
        basePath,
        trailingSlash: true, // /login/ -> login/index.html, which GitHub Pages serves without rewrites
        images: { unoptimized: true },
        distDir: ".next-pages", // keeps the export build away from a running `next dev`
      }
    : {
        async redirects() {
          return [
            // The email-code step was removed from signup; old links and open tabs go to the dashboard.
            // (The static site has no redirects; there the not-found page does the same job.)
            { source: "/get-started/verify", destination: "/home/overview", permanent: false },
          ];
        },
      }),
};

export default nextConfig;
