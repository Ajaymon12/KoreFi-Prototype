"use client";
import { PageHeader } from "@/components/shell/PageHeader";
import { useOutletFilter } from "@/components/mvp2/OutletFilters";
import { Tray } from "@/components/mvp2/parts";
import { AppName } from "@/components/ui/ReportTable";
import { cn } from "@/lib/utils";
import { LAST } from "@/components/finance/PnlStory";
import * as FX from "@/lib/mvp3/masaFixture";
import { FilterBar } from "./masaParts";

// Masa Kitchen's pinned 3PD Payouts dashboard: the payout week as it stands mid-week, word for word from the
// agent-journey prototype (journey 5, sample week Nov 1–7 in lib/mvp3/masaFixture). Built from the /mvp2 report parts:
// the outlet filters, StatRow-style app tiles and the payout report's tray card. The app status isn't split by outlet
// in the sample, so it covers every outlet.

const SOURCE = { dd: "doordash", ue: "ubereats", gh: "grubhub" } as const;

/** One tile per app: where its week stands in a word or two, and the one date that matters next. */
type Tile = { app: FX.PayKey; status: string; tone?: "success" | "danger"; sub: string };
const TILES: Tile[] = [
  { app: "dd", status: "3 missing", tone: "danger", sub: "$95.45 claimed · pays Thu, Nov 12" },
  { app: "ue", status: "Waiting", sub: "report due Wed, Nov 11" },
  { app: "gh", status: "All matched", tone: "success", sub: "pays Wed, Nov 11" },
];
const NEXT = [
  ["Wed, Nov 11", "Uber Eats report arrives. Grubhub pays."],
  ["Thu, Nov 12", "DoorDash pays. The week is complete."],
  ["Fri, Nov 13", "Full payout check by email, 8 AM."],
];

export function MasaPayouts() {
  const scope = useOutletFilter([LAST, LAST]);
  return (
    <>
      <PageHeader title="Payout check" />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="px-6 pt-4">
          <FilterBar scope={scope} />
        </div>
        <div className="flex flex-col gap-4 px-6 py-6 [&>*]:shrink-0">
          <h2 className="text-subtitle-md font-medium text-(--color-text-primary)">No payout is late. 2 of 3 apps checked so far.</h2>
          {scope.filtered && <p className="rounded-medium bg-(--color-neutral-lightest) px-3 py-2 text-body-sm text-(--color-text-secondary)">Each app&apos;s status covers every outlet.</p>}
          {/* The same grey-tray tiles as the Chargebacks stats. */}
          <section aria-label="Each app this week" className="grid gap-1.5 rounded-large bg-(--gray-300) p-1.5 sm:grid-cols-3">
            {TILES.map((t) => (
              <div key={t.app} className="flex min-w-0 flex-col justify-between gap-3 rounded-medium bg-(--color-background-secondary) p-4">
                <span className="text-body-sm text-(--color-text-secondary)">
                  <AppName source={SOURCE[t.app]} name={FX.PAY_APP[t.app]} />
                </span>
                <div>
                  <p className={cn("text-jumbo-sm", t.tone === "success" ? "text-(--color-text-success)" : t.tone === "danger" ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{t.status}</p>
                  <p className="mt-1 text-body-sm text-(--color-text-secondary)">{t.sub}</p>
                </div>
              </div>
            ))}
          </section>
          <Tray title="What happens next">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-body-md">
              {NEXT.map(([d, t]) => (
                <div key={d} className="contents">
                  <dt className="whitespace-nowrap text-(--color-text-secondary)">{d}</dt>
                  <dd className="text-(--color-text-primary)">{t}</dd>
                </div>
              ))}
            </dl>
          </Tray>
        </div>
      </div>
    </>
  );
}
