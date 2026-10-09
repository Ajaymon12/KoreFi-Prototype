import Image from "next/image";
import { cn } from "@/lib/utils";
import { PERIOD } from "@/lib/period";
import { Legend } from "./parts";
import { StatusBadge } from "./primitives";

export type ChannelRow = {
  name: string;
  logo: string;
  /** Undefined when the marketplace is not syncing, so the row shows a status instead of dashes. */
  figures?: { sales: string; fees: string; net: string; rate: string };
  problem?: string;
  total?: boolean;
};

const COLS = [
  { key: "sales", label: "Sales" },
  { key: "fees", label: "Commission & fees" },
  { key: "net", label: "Net payout" },
  { key: "rate", label: "Commission %" },
] as const;

// Commission by marketplace channel. Marketplace channels only: dine-in and direct orders are in
// Net sales, not here. Figures come from the payouts each marketplace reports.
export function CommissionCard({ rows, keepShare, legend }: { rows: ChannelRow[]; keepShare: number; legend: { keep: string; fees: string } }) {
  return (
    <section className="flex flex-col rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-4 pt-6 pb-5">
      <div className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-subtitle-md text-(--color-text-primary)">Commission by marketplace</h2>
        <span className="text-body-sm text-(--color-text-secondary)">{PERIOD.range} · marketplace channels only</span>
      </div>

      <div className="flex h-7 overflow-hidden rounded-small bg-(--color-brand-light)">
        <div className="bg-(--brand-1000)" style={{ width: `${keepShare * 100}%` }} />
      </div>
      <div className="pt-4">
        <Legend
          items={[
            { label: `You keep (${legend.keep})`, tone: "strong" },
            { label: `Commission & fees (${legend.fees})`, tone: "soft" },
          ]}
        />
      </div>

      <table className="mt-6 w-full">
        <thead>
          <tr className="text-body-sm text-(--color-text-secondary)">
            <th className="p-1 pl-4 text-left font-normal">3PD</th>
            {COLS.map((c) => (
              <th key={c.key} className="p-1 text-right font-normal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-body-md text-(--color-text-primary) tabular-nums">
          {rows.map((row) => (
            <tr key={row.name} className={cn("h-11", row.total && "border-t border-(--color-border-default)")}>
              <td className="p-1">
                <span className="flex items-center gap-2.5 pl-1">
                  {!row.total && (
                    <span className="relative size-[18px] shrink-0 overflow-hidden rounded-[2px]">
                      <Image src={row.logo} alt="" fill sizes="18px" className="object-cover" />
                    </span>
                  )}
                  <span className="whitespace-nowrap">{row.name}</span>
                </span>
              </td>
              {row.figures ? (
                COLS.map((c) => (
                  <td key={c.key} className="p-1 text-right">
                    {row.figures![c.key]}
                  </td>
                ))
              ) : (
                <td colSpan={COLS.length} className="p-1 text-right">
                  <StatusBadge tone="danger">{row.problem ?? "Not syncing"}</StatusBadge>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
