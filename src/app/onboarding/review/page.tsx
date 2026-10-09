"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/onboarding/marks";
import { STEP_HREF, update, useOnboarding } from "@/lib/org/store";
import { orgName } from "@/lib/org/name";
import type { StepKey } from "@/lib/org/types";

// Mercury's "Review your application": every answer in one place, each section with an Edit link
// back to its step (which then returns here). Finishing sends the owner to the "ready" page.

const APP_LABEL = { doordash: "DoorDash", ubereats: "Uber Eats", grubhub: "Grubhub", other: "Other" } as const;
const NAMES: Record<string, string> = { square: "Square", toast: "Toast", clover: "Clover", quickbooks: "QuickBooks", xero: "Xero", zoho: "Zoho Books", mercury: "Mercury" };
const SIZE_LABEL = { "1": "1 location", "2-5": "2–5 locations", "6-15": "6–15 locations", "16+": "16 or more locations", "": "—" };

export default function Review() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const { account, org, brands, imported, connected, skipped } = state;
  const live = state.locations.filter((l) => l.included);
  const leftOut = state.locations.length - live.length;
  const books = connected.filter((id) => ["quickbooks", "xero", "zoho", "mercury"].includes(id));

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 pt-10 pb-16">
      <Link href={STEP_HREF.accounting} className="-ml-2 inline-flex h-8 items-center gap-1 rounded-medium px-2 text-body-md text-(--color-text-secondary) hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary)">
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </Link>
      <h1 className="mt-4 text-page-title text-(--color-text-primary)">Review your setup</h1>
      <p className="mt-2 text-body-md text-(--color-text-secondary)">Check everything looks right. You can change any of this later in Settings.</p>

      <div className="mt-8 space-y-4">
        <Card title="You">
          <Rows rows={[["Name", `${account.firstName} ${account.lastName}`], ["Email", account.email], ["Mobile", account.phone], ["Role", account.title]]} />
        </Card>

        <Card title="Your business" edit="business">
          <Rows rows={[["Name", orgName(state)], ["Size", SIZE_LABEL[org.sizeBand]], ["Kinds of places", org.types.join(", ")]]} />
        </Card>

        <Card title="Point of sale" edit="pos">
          <p className="text-body-md text-(--color-text-primary)">{imported.length ? imported.map((p) => NAMES[p]).join(", ") : "Not connected. Locations were added by hand."}</p>
        </Card>

        <Card title={`${brands.length} ${brands.length === 1 ? "brand" : "brands"} · ${live.length} ${live.length === 1 ? "location" : "locations"}`} edit="locations">
          <ul className="space-y-4">
            {brands.map((b) => {
              const rows = live.filter((l) => l.brandId === b.id);
              if (!rows.length) return null;
              return (
                <li key={b.id}>
                  <p className="flex items-center gap-2 text-subtitle-sm text-(--color-text-primary)">
                    <BrandMark brand={b} brands={brands} size="sm" />
                    {b.name}
                  </p>
                  <ul className="mt-1.5 ml-3 space-y-1 border-l border-(--color-border-default) pl-[18px]">
                    {rows.map((l) => (
                      <li key={l.id} className="text-body-md text-(--color-text-primary)">
                        {l.name} <span className="text-(--color-text-secondary)">· {l.address.street}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {leftOut > 0 && <p className="mt-3 text-body-sm text-(--color-text-secondary)">{leftOut} left out (closed or test stores).</p>}
        </Card>

        <Card title="Brand logos" edit="logos">
          {skipped.includes("logos") && !brands.some((b) => b.logo) ? (
            <p className="text-body-md text-(--color-text-secondary)">Skipped. Brands show their initials until you add a logo.</p>
          ) : (
            <ul className="space-y-2.5">
              {brands
                .filter((b) => live.some((l) => l.brandId === b.id))
                .map((b) => (
                  <li key={b.id} className="flex items-center gap-2.5 text-body-md text-(--color-text-primary)">
                    <BrandMark brand={b} brands={brands} />
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <span className={b.logo ? "text-body-sm text-(--color-text-success)" : "text-body-sm text-(--color-text-secondary)"}>{b.logo ? "Added" : "Not added"}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Delivery apps" edit="delivery">
          {skipped.includes("delivery") ? (
            <p className="text-body-md text-(--color-text-secondary)">Skipped. Our team will ask which apps you use when they reach out.</p>
          ) : (
            <Rows
              rows={(Object.keys(APP_LABEL) as (keyof typeof APP_LABEL)[])
                .map((a) => [APP_LABEL[a], live.filter((l) => l.deliveryApps.includes(a)).length] as const)
                .filter(([, n]) => n > 0)
                .map(([label, n]) => [label, `${n} of ${live.length} locations`])}
              empty="None ticked."
            />
          )}
          <p className="mt-3 text-body-sm text-(--color-text-secondary)">KoreFi connects these for you.</p>
        </Card>

        <Card title="Accounting & bank" edit="accounting">
          <p className="text-body-md text-(--color-text-primary)">{books.length ? books.map((id) => NAMES[id]).join(", ") : <span className="text-(--color-text-secondary)">Not connected yet. You can add these from Integrations.</span>}</p>
        </Card>
      </div>

      <Button
        type="primary"
        size="large"
        block
        className="mt-8"
        loading={busy}
        onClick={() => {
          setBusy(true);
          setTimeout(() => {
            update({ completed: true, step: "ready" });
            router.push(STEP_HREF.ready);
          }, 600);
        }}
      >
        Finish setup
      </Button>
    </div>
  );
}

function Card({ title, edit, children }: { title: string; edit?: StepKey; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) px-5 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-subtitle-md text-(--color-text-primary)">{title}</h2>
        {edit && (
          <Link href={STEP_HREF[edit]} className="rounded-small text-body-md text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            Edit
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Rows({ rows, empty }: { rows: (readonly [string, string])[]; empty?: string }) {
  if (!rows.length) return <p className="text-body-md text-(--color-text-secondary)">{empty}</p>;
  return (
    <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-body-md text-(--color-text-secondary)">{k}</dt>
          <dd className="text-body-md text-(--color-text-primary)">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
