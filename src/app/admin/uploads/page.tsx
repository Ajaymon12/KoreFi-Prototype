"use client";
import { UploadsView } from "@/components/admin/UploadsView";
import { useClient } from "@/lib/admin/client";

// Ops uploads the open client's 3PD and POS exports here instead of Google Drive. The page is their
// upload history; "Upload report" opens the upload dialog with the client already chosen. All data
// is dummy (src/lib/admin/data.ts, src/lib/admin/mock.ts).
export default function Page() {
  const { client } = useClient();
  if (!client) return null;
  return <UploadsView key={client.id} accountId={client.id} />;
}
