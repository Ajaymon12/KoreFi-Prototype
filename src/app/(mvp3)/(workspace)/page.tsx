import { Suspense } from "react";
import { AgentWorkspace } from "@/components/mvp3/AgentChat";

// Home (new chat) and every chat live on this one route; which chat is open is client state
// (AgentsProvider), so the reports opened in the canvas keep their own ?tab= behaviour.
export default function Page() {
  return (
    <Suspense>
      <AgentWorkspace />
    </Suspense>
  );
}
