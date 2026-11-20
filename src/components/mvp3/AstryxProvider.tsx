"use client";
import Link from "next/link";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { useTheme } from "@/components/shell/useTheme";

/** Astryx theme for /mvp3. Colours come from our Foundation tokens through app/(mvp3)/mvp3/astryx-bridge.css;
 *  `mode` follows the app's light/dark choice so Astryx's light-dark() values agree with `.dark`. */
export function AstryxProvider({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();
  return (
    <Theme theme={neutralTheme} mode={resolved}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
