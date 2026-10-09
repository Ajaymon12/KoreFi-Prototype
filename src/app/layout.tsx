import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ScrollbarReveal } from "@/components/ScrollbarReveal";
import { RouteProgress } from "@/components/shell/RouteProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KoreFi",
  description: "Tax credits for restaurants",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* ⚙️ Typography → Font family/Base Font (not available through next/font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500&display=swap" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Top progress bar for page switches; Suspense because it reads search params. */}
        <Suspense>
          <RouteProgress />
        </Suspense>
        {children}
        <ScrollbarReveal />
      </body>
    </html>
  );
}
