import { TopBar } from "@/components/shell/TopBar";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { DockArea } from "@/components/ui/Dock";
import { AgentsProvider } from "@/components/mvp3/AgentsProvider";
import { OnboardingProvider } from "@/components/mvp3/Onboarding";
import { Mvp3MobileNav, Mvp3Sidebar } from "@/components/mvp3/Mvp3Sidebar";
import { AccountProvider, AccountSwitcher } from "@/components/mvp3/AccountSwitcher";

// MVP 3: KoreFi as always-on agents (after ChatGPT Dots), in MVP 2's frame (app/(mvp2)/mvp2/layout.tsx):
// the global bar, then one bordered panel holding the sidebar (Workspace, Agents, Chats; Integrations and
// Settings at the bottom) and the page. Phones get the sidebar as a drawer from the top bar's menu button.
export default function Mvp3Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeShell className="flex h-screen flex-col overflow-clip bg-(--color-background-secondary) text-(--color-text-primary)">
      <AccountProvider>
      <AgentsProvider>
        <OnboardingProvider>
          <TopBar menu={<Mvp3MobileNav />} assistant={false} switcher={<AccountSwitcher />} />
          <div data-module="mvp" className="flex min-h-0 flex-1 px-0 pt-0 pb-0 sm:px-2 sm:pb-2 lg:pt-1">
            <div className="flex min-w-0 flex-1 overflow-hidden border-t border-(--color-border-default) bg-(--color-background-secondary) sm:rounded-medium sm:border">
              <Mvp3Sidebar />
              <DockArea>{children}</DockArea>
            </div>
          </div>
        </OnboardingProvider>
      </AgentsProvider>
      </AccountProvider>
    </ThemeShell>
  );
}
