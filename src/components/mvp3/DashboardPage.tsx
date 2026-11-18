"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PinOff } from "lucide-react";
import { useAgents } from "./AgentsProvider";
import { AgentDashboard, ScheduleControl } from "./AgentDashboard";
import { ReportView } from "./reportViews";
import { AgentChatButton } from "./AgentChatButton";
import { PointLayer } from "./PointLayer";

// A pinned dashboard, full page. "Customise in chat" goes back to the chat it was built in.
export function DashboardPage() {
  const id = useSearchParams().get("id");
  const { dashboards, open, setCanvas, runAgent, getWorkflow, pinReport, setPointed } = useAgents();
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
            <AgentChatButton
              agent={d.agent}
              onClick={() => {
                open(d.thread!);
                setCanvas(report);
                router.push("/mvp3");
              }}
            />
          )}
        </div>
        {/* Pointing at a card here opens the chat it came from, report beside it, card in the composer. */}
        <PointLayer
          report={report}
          className="flex min-h-0 flex-1 flex-col [&>div:first-child]:pr-[460px]"
          onPoint={
            d.thread
              ? (r) => {
                  open(d.thread!);
                  setCanvas(report);
                  setPointed(r);
                  router.push("/mvp3");
                }
              : undefined
          }
        >
          <ReportView report={report} />
        </PointLayer>
      </div>
    );
  }
  return (
    <AgentDashboard
      d={d}
      // On the full page, pointing at a card opens its chat with the dashboard beside it and the card in the composer.
      onPoint={
        d.thread
          ? (r) => {
              open(d.thread!);
              setCanvas(`dash:${d.id}`);
              setPointed(r);
              router.push("/mvp3");
            }
          : undefined
      }
      actions={
        <AgentChatButton
          agent={d.agent}
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
        />
      }
    />
  );
}
