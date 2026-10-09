import { CardTitle, DashCard, ViewLink } from "./parts";
import type { Definition } from "@/lib/metrics";
import { DefinitionTip, DeltaChip } from "./primitives";

/** Headline number with its change vs the previous period. */
export function KpiCard({ title, value, delta, caption, definition }: { title: string; value: string; delta?: number; caption: string; definition?: Definition }) {
  return (
    <DashCard className="gap-3">
      <div className="flex items-center gap-1.5">
        <CardTitle title={title} />
        {definition && <DefinitionTip definition={definition} />}
      </div>
      <p className="text-page-title text-(--color-text-primary) tabular-nums">{value}</p>
      <div className="mt-auto flex items-center gap-2 text-body-sm text-(--color-text-secondary)">
        {delta !== undefined && <DeltaChip value={delta} />}
        {caption}
      </div>
    </DashCard>
  );
}

/** A leak: money lost or at risk, with a link into the page that fixes it. */
export function LeakCard({ title, value, caption, href, tone }: { title: string; value: string; caption: string; href: string; tone?: "danger" | "warning" | "neutral" }) {
  const accent = tone === "danger" ? "text-(--color-text-danger)" : tone === "warning" ? "text-(--color-text-warning)" : "text-(--color-text-primary)";
  return (
    <DashCard className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <CardTitle title={title} />
        <ViewLink href={href} />
      </div>
      <p className={`text-page-title tabular-nums ${accent}`}>{value}</p>
      <p className="mt-auto text-body-sm text-(--color-text-secondary)">{caption}</p>
    </DashCard>
  );
}
