"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, PinOff } from "lucide-react";
import { useAgents } from "./AgentsProvider";
import { AgentDashboard, ScheduleControl } from "./AgentDashboard";
import { REPORT_VIEW } from "./reportViews";

// A pinned dashboard, full page. "Customise in chat" goes back to the chat it was built in.
export function DashboardPage() {
  const id = useSearchParams().get("id");
  const { dashboards, open, setCanvas, runAgent, getWorkflow, pinReport } = useAgents();
  const router = useRouter();
  const d = dashboards.find((x) => x.id === id);
  if (!d)
    return (
      <div className="grid flex-1 place-items-center p-6 text-center text-body-md text-(--color-text-secondary)">
        <p>
          This dashboard isn’t here any more. Run an agent to build one, from{" "}
          <Link href="/mvp3/agents" className="text-(--color-text-clickable) hover:underline">
            Agents
          </Link>
          .
        </p>
      </div>
    );
  const btnCls = "inline-flex h-8 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5";
  // A pinned report (P&L Summary…): the real report full page, with its schedule, Unpin and the chat it came from on top.
  if (d.report) {
    const report = d.report;
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute top-1.5 right-3 z-10 flex items-center gap-1.5 bg-(--color-background-secondary)">
          <ScheduleControl d={d} />
          <button type="button" className={btnCls} onClick={() => pinReport(report, false)}>
            <PinOff aria-hidden />
            Unpin
          </button>
          {d.thread && (
            <button
              type="button"
              className={btnCls}
              onClick={() => {
                open(d.thread!);
                setCanvas(report);
                router.push("/mvp3");
              }}
            >
              <MessageSquare aria-hidden />
              Open chat
            </button>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col [&>div:first-child]:pr-[460px]">{REPORT_VIEW[report]()}</div>
      </div>
    );
  }
  const btn = "inline-flex h-8 items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) px-2.5 text-body-sm font-medium text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) [&_svg]:size-3.5";
  return (
    <AgentDashboard
      d={d}
      actions={
        <button
          type="button"
          className={btn}
          onClick={() => {
            if (d.thread) {
              open(d.thread);
              setCanvas(`dash:${d.id}`);
            } else {
              const w = getWorkflow(d.workflow);
              if (w) runAgent(w);
            }
            router.push("/mvp3");
          }}
        >
          <MessageSquare aria-hidden />
          Customise in chat
        </button>
      }
    />
  );
}
