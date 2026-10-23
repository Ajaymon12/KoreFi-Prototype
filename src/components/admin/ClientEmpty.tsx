"use client";
import Link from "next/link";
import { Building2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";
import { PageHeader } from "@/components/shell/PageHeader";
import { STATUS_META, STEPS, stepLabel, type Account } from "@/lib/admin/accounts";

// Overview and Chargebacks for a client with no data yet (invited, onboarding or stalled): where their
// setup is and the two things ops can do about it. The dev ops app showed $0.00 and "N/A" everywhere.

export function ClientEmpty({ client: a, title }: { client: Account; title: string }) {
  const done = STEPS.findIndex((s) => s.id === a.step);
  const total = STEPS.length - 1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={title} />
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-12">
        <section className="w-full max-w-[480px] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6">
          <h2 className="text-subtitle-lg text-(--color-text-primary)">No data for {a.company} yet</h2>
          <p className="mt-1 text-body-md text-(--color-text-secondary)">
            {a.status === "invited"
              ? `${a.name} hasn't accepted the invite. Reports fill in once their first POS or delivery report is uploaded.`
              : `${a.name} is ${STATUS_META[a.status].label.toLowerCase()} at ${stepLabel(a.step)}. Reports fill in once their first POS or delivery report is uploaded.`}
          </p>
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-body-sm text-(--color-text-secondary)">
              <span>Onboarding</span>
              <span className="tabular-nums">
                {done} of {total} steps
              </span>
            </div>
            <ol className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
              {STEPS.slice(0, total).map((s, i) => (
                <li key={s.id} title={s.label} className={cn("h-1.5 rounded-circle", i < done ? "bg-(--color-primary)" : i === done ? "bg-(--color-primary)/40" : "bg-(--color-neutral-lightest)")} />
              ))}
            </ol>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/admin/uploads" className={buttonVariants({ type: "primary", size: "small" })}>
              <UploadCloud aria-hidden />
              Upload first report
            </Link>
            <Link href="/admin/client" className={buttonVariants({ size: "small" })}>
              <Building2 aria-hidden />
              Account
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
