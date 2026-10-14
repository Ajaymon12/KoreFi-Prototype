import { TopBar } from "@/components/shell/TopBar";
import { IconRail } from "@/components/shell/IconRail";
import { Sidebar } from "@/components/shell/Sidebar";
import { ModuleScope } from "@/components/module/ModuleScope";
import { ThemeShell } from "@/components/shell/ThemeShell";
import { AssistantProvider } from "@/components/assistant/AssistantProvider";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";

// App shell (Figma "Dashboard" 337:22218): global bar, slim dark rail, then a bordered panel
// holding the Workspace sidebar and the page.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeShell className="flex h-screen flex-col overflow-clip bg-(--color-background-secondary) text-(--color-text-primary)">
      <AssistantProvider>
        <TopBar />
        <ModuleScope className="flex min-h-0 flex-1 gap-2 px-0 pt-0 pb-0 sm:px-2 sm:pb-2 lg:pt-1">
          <IconRail />
          <div className="flex min-w-0 flex-1 overflow-hidden border-t border-(--color-border-default) bg-(--color-background-secondary) sm:rounded-medium sm:border">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col">{children}</main>
            <AssistantPanel />
          </div>
        </ModuleScope>
      </AssistantProvider>
    </ThemeShell>
  );
}
