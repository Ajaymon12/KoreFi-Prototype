import { TopBar } from "@/components/shell/TopBar";
import { Mvp2MobileNav, Mvp2Sidebar } from "@/components/shell/Mvp2Sidebar";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { DockArea } from "@/components/ui/Dock";
import { WhatsNew } from "@/components/mvp2/WhatsNew";

// MVP 2 shell (Figma 1514:18163): /mvp's frame (global bar, one bordered panel) with the
// coworker-sectioned sidebar. Pages reuse /mvp's views where the design hasn't changed them.
export default function Mvp2Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeShell className="flex h-screen flex-col overflow-clip bg-(--color-background-secondary) text-(--color-text-primary)">
      <TopBar menu={<Mvp2MobileNav />} assistant={false} />
      <div data-module="mvp" className="flex min-h-0 flex-1 px-0 pt-0 pb-0 sm:px-2 sm:pb-2 lg:pt-1">
        <div className="flex min-w-0 flex-1 overflow-hidden border-t border-(--color-border-default) bg-(--color-background-secondary) sm:rounded-medium sm:border">
          <Mvp2Sidebar />
          <DockArea>{children}</DockArea>
        </div>
      </div>
      <WhatsNew />
    </ThemeShell>
  );
}
