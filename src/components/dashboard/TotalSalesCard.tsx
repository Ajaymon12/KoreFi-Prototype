"use client";
import { useState } from "react";
import { ChartPie, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD } from "@/lib/period";
import { DEFINITIONS } from "@/lib/metrics";
import { DefinitionTip, DeltaChip } from "./primitives";

// Label centres along the x-axis, from the Figma axis group (337:22267).
const AXIS_X = [11.99, 31.18, 50.37, 69.56, 88.74];

// Total sales (Figma CuCard 337:22236): headline stats + area chart, or a weekly list.
export type TotalSalesProps = {
  netSales: string;
  delta: number;
  keep: string;
  keepCaption: string;
  weeks: { label: string; netSales: string }[];
};

export function TotalSalesCard({ netSales, delta, keep, keepCaption, weeks }: TotalSalesProps) {
  const [view, setView] = useState<"chart" | "list">("chart");

  return (
    <section className="flex flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
      <div className="flex items-start justify-between px-6 pt-3 pb-2">
        <div className="space-y-2 pt-1">
          <h2 className="text-body-md text-(--color-text-primary)">Total sales</h2>
          <p className="text-body-sm text-(--color-text-secondary)">{PERIOD.range} · all channels</p>
        </div>
        <div role="tablist" aria-label="View" className="flex gap-1 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) p-1">
          {([
            ["chart", "Chart", ChartPie],
            ["list", "List", ListTree],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-label={label}
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "grid h-[26px] w-10 place-items-center rounded-medium text-(--color-text-secondary) transition-colors",
                view === key ? "bg-(--color-background-secondary) text-(--color-text-primary) shadow-[0_1px_1px_rgb(0_0_0/0.1)]" : "hover:text-(--color-text-primary)",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[235px_1fr] px-4 py-3">
        {[
          { label: "Net sales", value: netSales, caption: "All channels, before taxes and tips", def: DEFINITIONS.netSales, delta },
          { label: "What you keep", value: keep, caption: keepCaption, def: DEFINITIONS.whatYouKeep, delta: undefined },
        ].map((s) => (
          <div key={s.label} className="space-y-1 px-3 py-2">
            <p className="flex items-center gap-1 text-body-sm text-(--color-text-secondary)">
              {s.label}
              <DefinitionTip definition={s.def} />
            </p>
            <p className="flex items-center gap-2 text-body-lg font-medium text-(--color-text-primary) tabular-nums">
              {s.value}
              {s.delta !== undefined && <DeltaChip value={s.delta} />}
            </p>
            <p className="text-[10px] leading-4 text-(--color-text-secondary)">{s.caption}</p>
          </div>
        ))}
      </div>

      {view === "chart" ? (
        <div className="relative mt-auto mb-3 h-[135px]" role="img" aria-label={`Net sales trending up, ${PERIOD.axis[0]} to ${PERIOD.axis[PERIOD.axis.length - 1]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- exact Figma vector, stretched to the card */}
          <img src="/dashboard/sales-area.svg" alt="" className="absolute inset-x-0 top-0 h-[116px] w-full" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dashboard/sales-line.svg" alt="" className="absolute inset-x-0 top-0 h-[58px] w-full" />
          {PERIOD.axis.map((label, i) => (
            <span key={label} className="absolute top-[124px] -translate-x-1/2 text-body-sm leading-none text-(--color-text-secondary)" style={{ left: `${AXIS_X[i]}%` }}>
              {label}
            </span>
          ))}
        </div>
      ) : (
        <table className="mt-auto mb-3 w-full text-body-md">
          <thead className="text-body-sm text-(--color-text-secondary)">
            <tr>
              <th className="px-7 py-1 text-left font-normal">Week</th>
              <th className="px-7 py-1 text-right font-normal">Net sales</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {weeks.map((w) => (
              <tr key={w.label} className="border-t border-(--color-border-default)">
                <td className="px-7 py-2.5">{w.label}</td>
                <td className="px-7 py-2.5 text-right">{w.netSales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
