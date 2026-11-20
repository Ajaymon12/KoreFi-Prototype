"use client";
import { useMemo } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { LAST, WEEKS } from "@/components/finance/PnlStory";
import { chargebacks } from "@/lib/finance/chargebacks";
import { shortStore } from "@/lib/finance/outlets";
import { usd } from "@/lib/mvp3/runs";
import { useAccount } from "./AccountSwitcher";
import { Modal } from "./Modal";

// MVP 3: what the detailed version attached to the weekly email looks like (agent editor → Setup → Detailed
// version → preview). PDF: a one-page report by outlet. Excel: the same totals by outlet, one outlet a row. Same figures
// as the email, from this week's chargebacks. Neither lists single orders: the order list (the dashboard's Transactions
// tab) stays in the app and is never emailed. Prototype: a picture of the file, nothing downloads.

type Format = "pdf" | "excel";

export function ReportModal({ format, title, onClose }: { format: Format; title: string; onClose: () => void }) {
  const { account } = useAccount();
  const rows = useMemo(() => chargebacks(WEEKS, LAST, LAST, account.stores), [account.stores]);
  const outlets = useMemo(() => {
    const by = new Map<string, { outlet: string; orders: number; charged: number; won: number }>();
    for (const c of rows) {
      const o = by.get(c.store) ?? { outlet: shortStore(c.store), orders: 0, charged: 0, won: 0 };
      o.orders += 1;
      o.charged += c.amount;
      o.won += c.wonBack;
      by.set(c.store, o);
    }
    return [...by.values()].sort((a, b) => b.charged - a.charged);
  }, [rows]);
  const charged = rows.reduce((n, c) => n + c.amount, 0);
  const won = rows.reduce((n, c) => n + c.wonBack, 0);
  const week = WEEKS[LAST].start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const file = `${title.replace(/\s+/g, "-").toLowerCase()}-week-of-${week.replace(/\s+/g, "-").toLowerCase()}.${format === "pdf" ? "pdf" : "xlsx"}`;

  return (
    <Modal label={format === "pdf" ? "PDF preview" : "Excel preview"} onClose={onClose} width={format === "pdf" ? 640 : 860}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-(--color-neutral-lightest) p-3 pt-12 sm:p-6 sm:pt-12">
        <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-body-sm text-(--color-text-secondary)">
          {format === "pdf" ? <FileText className="size-4" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
          {file}, attached to each weekly email
        </p>

        {format === "pdf" ? (
          <article className="mx-auto aspect-[1/1.3] max-w-[520px] overflow-hidden rounded-small border border-(--color-border-default) bg-white px-8 py-8 text-(--color-text-primary) shadow-sm">
            <p className="text-body-sm text-(--color-text-secondary)">{account.name} · Week of {week}</p>
            <h2 className="mt-1 text-subtitle-md font-medium">{title}</h2>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-(--color-border-default) py-3">
              {[
                ["Charged back", usd(charged)],
                ["Won back", usd(won)],
                ["Orders", String(rows.length)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dd className="text-subtitle-sm font-medium tabular-nums">{v}</dd>
                  <dt className="text-body-sm text-(--color-text-secondary)">{k}</dt>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 mb-2 text-body-md font-medium">By outlet</h3>
            <table className="w-full text-left text-body-sm tabular-nums">
              <thead className="text-(--color-text-secondary)">
                <tr className="border-b border-(--color-border-default)">
                  <th className="py-1.5 font-normal">Outlet</th>
                  <th className="py-1.5 text-right font-normal">Orders</th>
                  <th className="py-1.5 text-right font-normal">Charged</th>
                  <th className="py-1.5 text-right font-normal">Won back</th>
                </tr>
              </thead>
              <tbody>
                {outlets.slice(0, 12).map((o) => (
                  <tr key={o.outlet} className="border-b border-(--color-border-default) last:border-0">
                    <td className="py-1.5 pr-2">{o.outlet}</td>
                    <td className="py-1.5 text-right">{o.orders}</td>
                    <td className="py-1.5 text-right">{usd(o.charged)}</td>
                    <td className="py-1.5 text-right">{usd(o.won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {outlets.length > 12 && <p className="mt-2 text-body-sm text-(--color-text-secondary)">+ {outlets.length - 12} more outlets on page 2</p>}
          </article>
        ) : (
          <div className="overflow-hidden rounded-small border border-(--color-border-default) bg-white text-(--color-text-primary) shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-body-sm tabular-nums">
                <thead>
                  <tr className="bg-(--color-neutral-lightest) text-(--color-text-secondary)">
                    <th className="w-10 border border-(--color-border-default) px-2 py-1 font-normal" />
                    {["A", "B", "C", "D"].map((c) => (
                      <th key={c} className="border border-(--color-border-default) px-2 py-1 text-center font-normal">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-medium">
                    <td className="border border-(--color-border-default) bg-(--color-neutral-lightest) px-2 py-1 text-center font-normal text-(--color-text-secondary)">1</td>
                    {["Outlet", "Orders", "Charged", "Won back"].map((h) => (
                      <td key={h} className="border border-(--color-border-default) px-2 py-1 whitespace-nowrap">{h}</td>
                    ))}
                  </tr>
                  {outlets.slice(0, 14).map((o, i) => (
                    <tr key={o.outlet}>
                      <td className="border border-(--color-border-default) bg-(--color-neutral-lightest) px-2 py-1 text-center text-(--color-text-secondary)">{i + 2}</td>
                      <td className="max-w-[240px] truncate border border-(--color-border-default) px-2 py-1">{o.outlet}</td>
                      <td className="border border-(--color-border-default) px-2 py-1 text-right">{o.orders}</td>
                      <td className="border border-(--color-border-default) px-2 py-1 text-right">{usd(o.charged)}</td>
                      <td className="border border-(--color-border-default) px-2 py-1 text-right">{usd(o.won)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-1 border-t border-(--color-border-default) bg-(--color-neutral-lightest) px-2 py-1 text-body-sm">
              <span className="rounded-small border border-(--color-border-default) bg-white px-2 py-0.5 font-medium">By outlet</span>
              <span className="ml-auto text-(--color-text-secondary)">{outlets.length} outlets</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
