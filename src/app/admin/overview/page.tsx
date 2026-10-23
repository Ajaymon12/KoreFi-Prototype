"use client";
import { UserOverview } from "@/components/admin/UserOverview";
import { useClient } from "@/lib/admin/client";

// User workspace → Ops view → Overview: what ops need to do for this user, who they are and what has
// happened. Their revenue reports are in User's view. The layout only renders this once a user is open.
export default function Page() {
  const { client } = useClient();
  if (!client) return null;
  return <UserOverview a={client} key={client.id} />;
}
