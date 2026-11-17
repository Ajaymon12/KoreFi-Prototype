import { Suspense } from "react";
import { AgentEditorRoute } from "@/components/mvp3/AgentEditorRoute";

// /mvp3/agent?id=payouts: the workflow editor. A query param, not a dynamic segment, so the static GitHub Pages export still works.
export default function Page() {
  return (
    <Suspense>
      <AgentEditorRoute />
    </Suspense>
  );
}
