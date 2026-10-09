import { ChevronRight, EllipsisVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegendItem } from "@/lib/mockData";

// Shared pieces of the dashboard cards (Figma 337:23413 / 337:23506 / 339:23692).

export function DashCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6", className)}>
      {children}
    </section>
  );
}

export function CardTitle({ title, value }: { title: string; value?: string }) {
  return (
    <div>
      <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>
      {value && <p className="mt-1.5 text-subtitle-lg text-(--color-text-primary) tabular-nums">{value}</p>}
    </div>
  );
}

export function IconButton({ label, children, filled }: { label: string; children: React.ReactNode; filled?: boolean }) {
  return (
    <button
      aria-label={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-circle text-(--color-text-primary) transition-colors [&_svg]:size-4",
        filled ? "bg-(--color-neutral-light) hover:bg-(--gray-500)" : "hover:bg-(--color-neutral-light)",
      )}
    >
      {children}
    </button>
  );
}

export function CardActions({ add }: { add?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {add && (
        <IconButton label="Add" filled>
          <Plus />
        </IconButton>
      )}
      <IconButton label="More options">
        <EllipsisVertical />
      </IconButton>
    </div>
  );
}

/** Two-segment bar: strong (brand-1000) share over a soft (brand-700) track. */
export function SplitBar({ fill, className }: { fill: number; className?: string }) {
  return (
    <div className={cn("relative h-2 overflow-hidden rounded-small bg-(--color-brand-light)", className)}>
      <div className="absolute inset-y-0 left-0 rounded-l-small bg-(--brand-1000)" style={{ width: `${fill * 100}%` }} />
    </div>
  );
}

export function Legend({ items, trailing }: { items: LegendItem[]; trailing?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-body-sm text-(--color-text-secondary)">
      <div className="flex flex-wrap items-center gap-3">
        {items.map((i) => (
          <span key={i.label} className="flex items-center gap-1.5">
            {i.label}
            <span className={cn("size-1.5 rounded-circle", i.tone === "strong" ? "bg-(--brand-1000)" : "bg-(--color-brand-primary-light)")} />
          </span>
        ))}
      </div>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </div>
  );
}

export function ViewLink({ href = "#" }: { href?: string }) {
  return (
    <a href={href} className="group flex shrink-0 items-center gap-1.5 text-body-lg text-(--color-text-clickable) hover:underline">
      View
      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-menu-sm text-(--color-text-secondary)">{children}</div>;
}

export function Divider() {
  return <div className="h-px bg-(--color-border-default)" />;
}

/** "12 · $136K" style value with a dimmed separator. */
export function CompoundValue({ value, extra }: { value: string; extra?: string }) {
  return (
    <span className="text-body-lg text-(--color-text-primary) tabular-nums">
      {value}
      {extra && (
        <>
          <span className="mx-1 text-(--color-text-secondary)">·</span>
          {extra}
        </>
      )}
    </span>
  );
}

export function Stat({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="whitespace-nowrap text-menu-sm text-(--color-text-primary)">{label}</p>
      <CompoundValue value={value} extra={extra} />
    </div>
  );
}
