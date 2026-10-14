import { PageHeader } from "@/components/shell/PageHeader";
import { SousChat } from "@/components/assistant/AssistantChat";

// Sous at full size: the same chat as the right-hand panel, with room to breathe.
export default function Page() {
  return (
    <>
      <PageHeader title="Sous" />
      <SousChat variant="page" autoFocus />
    </>
  );
}
