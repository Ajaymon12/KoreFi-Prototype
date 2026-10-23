"use client";
import { PageHeader } from "@/components/shell/PageHeader";
import { useClient } from "@/lib/admin/client";

// User's view for someone with no data yet: their dashboard would be empty, so say that instead of
// showing the demo figures.
export function UserViewGate({ title, children }: { title: string; children: React.ReactNode }) {
  const { client } = useClient();
  if (!client) return null;
  if (client.data !== "none") return <>{children}</>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={title} />
      <div className="flex flex-1 items-start justify-center px-4 py-16 text-center">
        <div className="max-w-[420px]">
          <p className="text-subtitle-md text-(--color-text-primary)">Nothing here for {client.name} yet</p>
          <p className="mt-1 text-body-md text-(--color-text-secondary)">Their dashboard fills in once their first POS or delivery report is uploaded. Until then this is what they see too.</p>
        </div>
      </div>
    </div>
  );
}
