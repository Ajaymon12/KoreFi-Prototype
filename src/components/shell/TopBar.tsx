import Image from "next/image";
import { asset } from "@/lib/asset";
import { LocationSwitcher } from "./LocationSwitcher";
import { MobileNav } from "./MobileNav";
import { ProfileMenu } from "./ProfileMenu";
import { AskSousButton } from "@/components/assistant/AskSousButton";

type Props = {
  /** The drawer button shown under lg; the module app's by default. */
  menu?: React.ReactNode;
  /** Sous needs <AssistantProvider>; the MVP shell has neither. */
  assistant?: boolean;
};

// CuGlobalActionsBar (Figma 337:22219): wordmark, location switcher, account.
export function TopBar({ menu = <MobileNav />, assistant = true }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-2 pt-1 lg:h-[42px] lg:px-3 lg:pt-1.5 lg:pb-1">
      <div className="flex min-w-0 items-center gap-1">
        {menu}
        <Image src={asset("/dashboard/korefi-logo.svg")} alt="KoreFi" width={83.88} height={20} priority unoptimized className="ml-1 shrink-0 lg:ml-2 [.dark_&]:invert" />
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {assistant && <AskSousButton />}
        <LocationSwitcher />
        <ProfileMenu />
      </div>
    </header>
  );
}
