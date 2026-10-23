import { TopBar } from "@/components/shell/TopBar";
import { MvpMobileNav, MvpSidebar } from "@/components/shell/MvpSidebar";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { DockArea } from "@/components/ui/Dock";

// MVP shell: the global bar, then one bordered panel holding the single sidebar and the page.
// No icon rail, no module sub sidebar and no Sous: the MVP is six flat reports.
// `data-module="mvp"` resolves the --module-* tokens (module-themes.css) to the brand palette.
export default function MvpLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeShell className="flex h-screen flex-col overflow-clip bg-(--color-background-secondary) text-(--color-text-primary)">
      <TopBar menu={<MvpMobileNav />} assistant={false} />
      <div data-module="mvp" className="flex min-h-0 flex-1 px-0 pt-0 pb-0 sm:px-2 sm:pb-2 lg:pt-1">
        <div className="flex min-w-0 flex-1 overflow-hidden border-t border-(--color-border-default) bg-(--color-background-secondary) sm:rounded-medium sm:border">
          <MvpSidebar />
          {/* The page, plus the slot detail panels dock into (Mercury Books' split view). */}
          <DockArea>{children}</DockArea>
        </div>
      </div>
    </ThemeShell>
  );
}
