"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Send } from "lucide-react";
import { Tray } from "@/components/mvp2/parts";
import { ORDER_DRAFT } from "@/lib/mvp3/flows";
import { buttonVariants } from "@/components/ui/Button";

// Saffron Grill's Auto ordering result (leadership flow 3): this week's order for Devon, drafted from 4 weeks of Toast
// sales and Sunday's stock count. Order = usual weekly use − on hand. The agent drafts it; Devon's manager places it.

const TITLE = "Order draft · Devon · week of Nov 16";

export function OrderDraft({ tools, headerTo }: { tools?: React.ReactNode; headerTo?: HTMLElement | null }) {
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const bar = (
    <>
      <h2 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">{TITLE}</h2>
      <div className="ml-auto flex shrink-0 items-center gap-1">{tools}</div>
    </>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {headerTo !== undefined ? headerTo && createPortal(bar, headerTo) : <header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-(--color-border-default) py-1 pr-2 pl-4">{bar}</header>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] space-y-4 px-6 py-6">
          <p className="text-body-sm text-(--color-text-secondary)">From 4 weeks of Toast sales and the stock count of Sun, Nov 15 · covers Devon only</p>
          <Tray title="This week's order" sub="Check it before you place it">
            <div className="-mx-5 -mb-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-body-md">
                <thead className="bg-(--color-neutral-lightest) text-body-sm text-(--color-text-secondary)">
                  <tr>
                    {["Item", "On hand", "Usual weekly use", "Order", "Supplier"].map((h, i) => (
                      <th key={h} scope="col" className={i > 0 && i < 4 ? "px-5 py-2 text-right font-medium" : "px-5 py-2 font-medium"}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border-default)">
                  {ORDER_DRAFT.map((x) => (
                    <tr key={x.item}>
                      <td className="px-5 py-2.5 text-(--color-text-primary)">{x.item}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{`${x.onHand} ${x.unit}`}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{`${x.use} ${x.unit}`}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{`${x.use - x.onHand} ${x.unit}`}</td>
                      <td className="px-5 py-2.5 text-(--color-text-secondary)">{x.supplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tray>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSaved(true)} className={buttonVariants({ type: "secondary", size: "medium" })}>
              {saved ? <Check className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {saved ? "Downloaded" : "Download order sheet"}
            </button>
            <button type="button" onClick={() => setSent(true)} className={buttonVariants({ type: "primary", size: "medium" })}>
              {sent ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {sent ? "Sent to Devon's manager" : "Send to Devon's manager"}
            </button>
          </div>
          <p className="text-body-sm text-(--color-text-secondary)">The agent drafts the order. Devon&apos;s manager places it.</p>
        </div>
      </div>
    </div>
  );
}
