"use client";
import { useState } from "react";
import { ChevronRight, ListTree } from "lucide-react";
import { AppName } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import { APPS, type AppKey, type Chargeback } from "@/lib/finance/chargebacks";
import { pct0, pctOf } from "@/components/finance/PnlStory";
import { InfoTip } from "@/components/finance/PnlTable";
import { usd } from "@/components/finance/parts";

// Chargebacks by app, laid out like the P&L by channel (PnlTable): the same dense grid, grey header with
// each app's icon, line names pinned on the left, ⓘ behind a line's name, and lines that open into
// indented parts on a tree guide. One column per chosen app, then All.
//   Money     Charged back (opens into its reasons), then where it went: Won back, Being disputed, Kept
//             by the apps. Each figure has its share of that column's charged back beside it.
//   Rates     Error rate (charged back as a share of the app's sales) and Win rate (of decided disputes).
// "Not filed yet" counts with Being disputed, as on the cards above. Kept by the apps is bold, and in
// All it sits in a red-tinted cell.

type Col = { rows: Chargeback[]; sales: number };
const open = (c: Chargeback) => c.status === "disputing" || c.status === "new";
const sum = (
  rows: Chargeback[],
  get: (c: Chargeback) => number = (c) => c.amount,
) => rows.reduce((n, c) => n + get(c), 0);
const charged = (v: Col) => sum(v.rows);
const won = (v: Col) =>
  sum(
    v.rows.filter((c) => c.status === "won"),
    (c) => c.wonBack,
  );
const disputing = (v: Col) => sum(v.rows.filter(open));
// Lost, plus what a partly-won charge didn't get back.
const kept = (v: Col) => charged(v) - won(v) - disputing(v);
const winRate = (v: Col) => {
  const decided = v.rows.filter((c) => !open(c));
  return decided.length
    ? decided.filter((c) => c.status === "won").length / decided.length
    : null;
};

const Dash = () => <span className="text-(--gray-600)">—</span>;

/** A figure with its share of the column's charged back before it, small and grey. */
function Amount({
  n,
  of,
  back,
  strong,
  tone,
}: {
  n: number;
  of: number;
  back?: boolean;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <span className="inline-flex items-baseline justify-end gap-2 whitespace-nowrap tabular-nums">
      <span className="text-label-sm text-(--color-text-tertiary)">
        {pct0(pctOf(n, of))}
      </span>
      <span
        className={cn(
          strong && "font-medium",
          tone ??
            (back && n > 0
              ? "text-(--color-text-success)"
              : "text-(--color-text-primary)"),
        )}
      >
        {back && n > 0 ? `+${usd(n)}` : usd(n)}
      </span>
    </span>
  );
}

export function ChargebackTable({
  rows,
  apps,
  sales,
}: {
  rows: Chargeback[];
  apps: AppKey[];
  sales: Record<AppKey, number>;
}) {
  const [opened, setOpened] = useState(false);
  const cols = APPS.filter((a) => apps.includes(a.key)).map((a) => ({
    ...a,
    v: { rows: rows.filter((c) => c.app === a.key), sales: sales[a.key] },
  }));
  const all: Col = { rows, sales: apps.reduce((n, k) => n + sales[k], 0) };
  const figures = [...cols.map((c) => c.v), all];
  const reasons = [...new Set(rows.map((c) => c.reason))].sort(
    (x, y) =>
      sum(rows.filter((c) => c.reason === y)) -
      sum(rows.filter((c) => c.reason === x)),
  );

  // The same grid as the P&L: a line on every cell's right and bottom; the table draws the top and left.
  const grid = "border-r border-b border-(--gray-400)";
  const pin =
    "sticky left-0 z-[1] bg-(--color-background-secondary) group-hover/row:bg-(--gray-200)";
  const nameCell = cn(
    grid,
    pin,
    "h-9 px-3 text-left align-middle font-normal text-(--color-text-primary)",
  );
  const num = cn(grid, "h-9 w-[168px] px-3 text-right align-middle");
  const rowCls = "group/row transition-colors hover:bg-(--gray-200)";
  const bad = "bg-(--red-200) group-hover/row:bg-(--red-300)";

  const name = (
    label: string,
    opts: {
      info?: string;
      formula?: string;
      strong?: boolean;
      toggle?: boolean;
    } = {},
  ) => (
    <div className="flex items-center gap-1">
      {opts.toggle ? (
        <button
          type="button"
          aria-expanded={opened}
          aria-label={`${opened ? "Hide" : "Show"} reasons for ${label}`}
          onClick={() => setOpened((o) => !o)}
          className="-ml-1 grid size-5 shrink-0 place-items-center rounded-small text-(--color-text-tertiary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-150",
              opened && "rotate-90",
            )}
          />
        </button>
      ) : (
        <span aria-hidden className="-ml-1 w-5 shrink-0" />
      )}
      <span
        className={cn("min-w-0 flex-1 truncate", opts.strong && "font-medium")}
      >
        {label}
        {opts.info && (
          <InfoTip name={label} text={opts.info} formula={opts.formula} />
        )}
      </span>
    </div>
  );

  const section = (key: string, title: string, end?: string) => (
    <tr key={key}>
      <td
        colSpan={figures.length + 1}
        className={cn(grid, "h-8 bg-(--gray-100) px-3")}
      >
        <div className="sticky left-3 flex w-fit max-w-[calc(100vw-48px)] items-center gap-3 text-body-sm text-(--color-text-secondary)">
          <span className="font-medium text-(--color-text-primary)">
            {title}
          </span>
          {end && <span className="text-(--color-text-tertiary)">{end}</span>}
        </div>
      </td>
    </tr>
  );

  const row = (
    key: string,
    label: React.ReactNode,
    figure: (v: Col) => React.ReactNode,
    tint?: string,
  ) => (
    <tr key={key} className={rowCls}>
      <th scope="row" className={nameCell}>
        {label}
      </th>
      {figures.map((v, i) => (
        <td key={i} className={cn(num, i === figures.length - 1 && tint)}>
          {figure(v)}
        </td>
      ))}
    </tr>
  );
  const rate = (r: string | null) =>
    r === null ? (
      <Dash />
    ) : (
      <span className="text-(--color-text-primary) tabular-nums">{r}</span>
    );

  return (
    <table className="w-full min-w-[720px] border-separate border-spacing-0 border-t border-l border-(--gray-400) text-body-md">
      <thead>
        <tr className="text-body-sm text-(--color-text-secondary) [&>th]:h-10 [&>th]:bg-(--gray-200)">
          <th
            scope="col"
            className={cn(
              grid,
              "sticky left-0 z-[3] px-3 text-left font-normal",
            )}
          >
            <span className="flex items-center gap-1.5">
              <ListTree aria-hidden className="size-3.5" />
              Line
            </span>
          </th>
          {cols.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(grid, "w-[168px] px-3 text-right font-normal")}
            >
              <span className="flex items-center justify-end whitespace-nowrap">
                <AppName source={c.source} name={c.label} />
              </span>
            </th>
          ))}
          <th
            scope="col"
            className={cn(grid, "w-[168px] px-3 text-right font-normal")}
          >
            <span className="font-medium text-(--color-text-primary)">All</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {section(
          "money",
          "Money",
          "From the apps' payout reports · % of each column's charged back",
        )}
        {row("orders", name("Orders charged back"), (v) => (
          <span className="text-(--color-text-secondary) tabular-nums">
            {v.rows.length.toLocaleString("en-US")}
          </span>
        ))}
        {row(
          "charged",
          name("Charged back", {
            strong: true,
            toggle: reasons.length > 0,
            info: "What the app took back from your payouts for order errors.",
          }),
          (v) => (
            <span className="font-medium whitespace-nowrap tabular-nums">
              {usd(charged(v))}
            </span>
          ),
        )}
        {opened &&
          reasons.map((r, k) => (
            <tr key={r} className={cn(rowCls, "text-body-sm")}>
              <th scope="row" className={cn(nameCell, "h-8 pl-[30px]")}>
                <span
                  aria-hidden
                  className={cn(
                    "absolute -top-px left-[17px] w-px bg-(--gray-600)",
                    k === reasons.length - 1
                      ? "h-[calc(50%+1px)]"
                      : "-bottom-px",
                  )}
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 left-[17px] h-px w-2 bg-(--gray-600)"
                />
                <span className="text-(--color-text-secondary)">{r}</span>
              </th>
              {figures.map((v, i) => {
                const mine = v.rows.filter((c) => c.reason === r);
                return (
                  <td key={i} className={cn(num, "h-8")}>
                    {mine.length ? (
                      <Amount n={sum(mine)} of={charged(v)} />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        {row(
          "won",
          name("Won back", {
            info: "Paid back by the app after KoreFi's dispute.",
          }),
          (v) => (
            <Amount n={won(v)} of={charged(v)} back />
          ),
        )}
        {row(
          "disputing",
          name("Being disputed", {
            info: "Filed by KoreFi and waiting on the app, or about to be filed.",
          }),
          (v) => (
            <Amount n={disputing(v)} of={charged(v)} />
          ),
        )}
        {row(
          "kept",
          name("Kept by the apps", {
            strong: true,
            info: "What the apps kept after siding with the customer, including what a partly-won dispute didn't get back.",
            formula:
              "Kept by the apps = Charged back − Won back − Being disputed",
          }),
          (v) => (
            <Amount
              n={kept(v)}
              of={charged(v)}
              strong
              tone={kept(v) > 0 ? "text-(--color-text-danger)" : undefined}
            />
          ),
          kept(all) > 0 ? bad : undefined,
        )}

        {section("rates", "Rates")}
        {row(
          "errorRate",
          name("Error rate", {
            info: "Charged back as a share of the app's sales. Lower is better.",
            formula: "Error rate = Charged back ÷ App sales",
          }),
          (v) =>
            rate(
              v.sales
                ? `${(pctOf(charged(v), v.sales) * 100).toFixed(1)}%`
                : null,
            ),
        )}
        {row(
          "winRate",
          name("Win rate", {
            info: "Of the disputes the apps have decided, the share KoreFi won.",
          }),
          (v) => {
            const w = winRate(v);
            return rate(w === null ? null : pct0(w));
          },
        )}
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={figures.length + 1}
              className={cn(
                grid,
                "px-4 py-10 text-center text-body-md text-(--color-text-secondary)",
              )}
            >
              No chargebacks in this period.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
