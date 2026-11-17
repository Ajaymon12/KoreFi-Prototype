"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hasRuns } from "@/lib/mvp3/runs";
import { useAgents } from "./AgentsProvider";
import { AgentOverview } from "./AgentOverview";
import { WorkflowEditor } from "./WorkflowEditor";

// /mvp3/agent?id=…: a live agent opens on its overview (summary and run history); &edit=1, drafts and
// learning agents open the workflow editor. Coming-soon agents can't be opened or edited: back to the list.
export function AgentEditorRoute() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { getWorkflow } = useAgents();
  const w = getWorkflow(id);
  const router = useRouter();
  const soon = w?.kind === "preset" && w.state === "soon";
  useEffect(() => {
    if (soon) router.replace("/mvp3/agents");
  }, [soon, router]);
  if (soon) return null;
  if (w && w.state === "live" && hasRuns(id) && !params.get("edit")) return <AgentOverview key={id} w={w} />;
  return <WorkflowEditor id={id} />;
}
