import { PageHeader } from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";

// Route-level loading state for every page in the shell. Next wraps each page in a Suspense
// boundary with this as the fallback, so the top bar, rail and sidebar stay put while the page
// area shows a skeleton shaped like the dashboard pages (KPI row, then two wide cards).
function Bone({ className }: { className?: string }) {
  return <span className={cn("block rounded-small bg-(--color-neutral-lightest) motion-safe:animate-pulse", className)} />;
}

function CardSkeleton({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-3 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6", className)}>{children}</div>;
}

export default function Loading() {
  return (
    <>
      <PageHeader title={<Bone className="inline-block h-3 w-28 align-middle" />} />
      <div role="status" aria-busy="true" aria-label="Loading page" className="min-h-0 flex-1 overflow-hidden">
        <div className="space-y-2 p-4">
          <Bone className="h-6 w-48" />
          <Bone className="h-3 w-72" />
        </div>
        <div className="space-y-4 px-4 pt-3 pb-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <CardSkeleton key={i}>
                <Bone className="h-3 w-24" />
                <Bone className="h-7 w-32" />
                <Bone className="h-3 w-40" />
              </CardSkeleton>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <CardSkeleton key={i} className="h-72">
                <Bone className="h-4 w-36" />
                <Bone className="mt-auto h-40 w-full" />
              </CardSkeleton>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
