import { cn } from "@/lib/utils";

export type Stat = { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" };

const TONE = { default: "text-(--color-text-primary)", success: "text-(--color-text-success)", warning: "text-(--color-text-warning)", danger: "text-(--color-text-danger)" };

// Row of summary cards at the top of a list page (Mercury Bill Pay: "2 · Total outstanding · $18.80").
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-5 py-4">
          <p className={cn("text-subtitle-lg", TONE[s.tone ?? "default"])}>{s.value}</p>
          <p className="mt-1.5 text-body-md text-(--color-text-primary)">{s.label}</p>
          {s.sub && <p className="mt-0.5 text-body-sm text-(--color-text-secondary)">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
