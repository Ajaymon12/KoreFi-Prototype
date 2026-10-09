import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tip } from "./ChargebackCharts";

// Charts for Sales, Order quality and Wait & downtime. Hand-built HTML (no chart library), with a
// hover / focus tooltip on every mark and the number always printed, so colour is never the only cue.

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export type DayBar = { date: string; value: number; previous?: number };

/** One column per day. `previous` draws a tick at last period's value for the same day. */
export function DailyBars({ points, format, unit, tone = "series" }: { points: DayBar[]; format: (n: number) => string; unit: string; tone?: "series" | "lost" }) {
  const max = Math.max(...points.flatMap((p) => [p.value, p.previous ?? 0]), 1);
  const hasPrev = points.some((p) => p.previous !== undefined);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-(--color-text-secondary)">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-circle", tone === "lost" ? "bg-(--chart-lost)" : "bg-(--chart-series)")} />
          This period
        </span>
        {hasPrev && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-(--color-text-secondary)" />
            Previous period
          </span>
        )}
      </div>
      <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={`${unit} per day, ${day(points[0].date)} to ${day(points.at(-1)!.date)}`}>
        {points.map((p) => (
          <Tip
            key={p.date}
            className="relative flex h-full flex-1 items-end"
            content={
              <>
                <span className="block text-(--color-text-secondary)">{day(p.date)}</span>
                <span className="block">{format(p.value)} {unit}</span>
                {p.previous !== undefined && <span className="block text-(--color-text-secondary)">Before: {format(p.previous)}</span>}
              </>
            }
          >
            <span className={cn("block w-full rounded-t-[2px]", tone === "lost" ? "bg-(--chart-lost)" : "bg-(--chart-series)")} style={{ height: `${(p.value / max) * 100}%` }} />
            {p.previous !== undefined && <span className="absolute inset-x-0 h-0.5 bg-(--color-text-secondary)" style={{ bottom: `${(p.previous / max) * 100}%` }} />}
          </Tip>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-body-sm text-(--color-text-secondary)">
        <span>{day(points[0].date)}</span>
        <span>{day(points[Math.floor(points.length / 2)].date)}</span>
        <span>{day(points.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

/** Orders by hour of day; the busiest hour is the strong colour. Hours with no orders at either end are trimmed. */
export function HourBars({ hours }: { hours: number[] }) {
  const first = hours.findIndex((n) => n > 0);
  const last = hours.length - 1 - [...hours].reverse().findIndex((n) => n > 0);
  const shown = hours.map((n, h) => ({ n, h })).slice(first, last + 1);
  const max = Math.max(...hours, 1);
  const peak = hours.indexOf(max);
  return (
    <div>
      <div className="flex h-40 items-end gap-1" role="img" aria-label={`Orders by hour. Busiest hour is ${hourLabel(peak)} with ${max} orders.`}>
        {shown.map(({ n, h }) => (
          <Tip key={h} className="flex h-full flex-1 items-end" content={<>{hourLabel(h)} · {n} orders</>}>
            <span className={cn("block w-full rounded-t-[2px]", h === peak ? "bg-(--chart-series)" : "bg-(--chart-track)")} style={{ height: `${(n / max) * 100}%` }} />
          </Tip>
        ))}
      </div>
      <div className="mt-2 flex gap-1 text-body-sm text-(--color-text-secondary)">
        {shown.map(({ h }) => (
          <span key={h} className="flex-1 text-center tabular-nums">{h % 2 === first % 2 ? hourLabel(h) : ""}</span>
        ))}
      </div>
    </div>
  );
}

export type HRow = { key: string; label: string; value: number; display: string; detail?: string };

/** Ranked horizontal bars: label and number on top, bar below. */
export function HBars({ rows, tone = "series" }: { rows: HRow[]; tone?: "series" | "lost" }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body-md text-(--color-text-primary)">{r.label}</span>
            <span className="shrink-0 text-body-md tabular-nums text-(--color-text-primary)">
              {r.display}
              {r.detail && <span className="text-body-sm text-(--color-text-secondary)"> · {r.detail}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-circle bg-(--chart-track)">
            <div className={cn("h-full rounded-circle", tone === "lost" ? "bg-(--chart-lost)" : "bg-(--chart-series)")} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-body-md text-(--color-text-secondary)">Nothing to show for this period.</li>}
    </ul>
  );
}

/** "All channels · DoorDash · Uber Eats" pills; the choice lives in `?channel=`. */
export function ChannelFilter({ basePath, channels, active, params = {} }: { basePath: string; channels: { id: string; name: string }[]; active: string; params?: Record<string, string> }) {
  const href = (id: string) => {
    const q = new URLSearchParams(params);
    if (id !== "all") q.set("channel", id);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div role="group" aria-label="Channel" className="flex flex-wrap items-center gap-1">
      {[{ id: "all", name: "All channels" }, ...channels].map((c) => (
        <Link
          key={c.id}
          href={href(c.id)}
          aria-current={c.id === active ? "true" : undefined}
          className={cn(
            "flex h-7 items-center rounded-circle px-3 text-menu-md transition-colors",
            c.id === active ? "bg-(--brand-200) text-(--color-text-primary)" : "border border-(--color-border-default) text-(--color-text-secondary) hover:bg-(--color-neutral-light) hover:text-(--color-text-primary)",
          )}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
