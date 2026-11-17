"use client";
import { useSearchParams } from "next/navigation";
import { hasRuns } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { AgentOverview } from "./AgentOverview";
import { WorkflowEditor } from "./WorkflowEditor";

// /mvp3/agent?id=…: a live agent opens on its overview (summary and run history); &edit=1, drafts and
// learning agents open the workflow editor.
export function AgentEditorRoute() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { getWorkflow } = useAgents();
  const w = getWorkflow(id);
  if (w && w.state === "live" && hasRuns(id) && !params.get("edit")) return <AgentOverview key={id} w={w} />;
  return <WorkflowEditor id={id} />;
}
