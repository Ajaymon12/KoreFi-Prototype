"use client";
import Link from "next/link";
import { ChartNoAxesColumnIncreasing, Check, CircleDashed, MapPin, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { Timeline, type TimelineStep } from "@/components/ui/DetailDrawer";
import { useOnboarding } from "@/lib/org/store";
import { orgName } from "@/lib/org/name";
import { HELP_URL } from "@/lib/mockData";
import { OWNER_HOME } from "@/lib/nav";

// Mercury's "You're nearly there": what happens next on the left, an application-style timeline
// on the right. Nothing here asks the owner to do anything — skipped steps are listed as neutral
// "not connected yet" rows that link to Integrations.

const POS_NAME = { square: "Square", toast: "Toast", clover: "Clover" };

export default function Ready() {
  const { state } = useOnboarding();
  const live = state.locations.filter((l) => l.included);
  const onApps = live.filter((l) => l.deliveryApps.length).length;
  const books = state.connected.some((id) => ["quickbooks", "xero", "zoho", "mercury"].includes(id));
  const pos = state.imported.map((p) => POS_NAME[p]).join(" and ");

  const timeline: TimelineStep[] = [
    { label: "Account created", date: "Today", state: "done" },
    { label: pos ? `Syncing ${pos}` : "Setting up your locations", date: "About 1 hour", state: "current" },
    { label: "Delivery app data uploaded by KoreFi", date: state.skipped.includes("delivery") ? "We’ll reach out to set these up" : "1–2 business days", state: "upcoming" },
    { label: "First full report", date: "Within 2 business days", state: "upcoming" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-10 px-6 pt-14 pb-16 md:flex-row md:items-start md:gap-14">
      <div className="min-w-0 flex-1">
        <span className="grid size-12 place-items-center rounded-circle bg-(--color-primary-solid) text-white shadow-[0_0_0_6px_var(--brand-200)]">
          <Check className="size-6" strokeWidth={2.5} aria-hidden />
        </span>
        <p className="mt-6 text-subtitle-xs tracking-wide text-(--color-text-secondary) uppercase">{orgName(state)}</p>
        <h1 className="mt-2 text-jumbo-sm text-(--color-text-primary)">You’re all set, {state.account.firstName}</h1>
        <p className="mt-3 text-body-lg text-(--color-text-secondary)">KoreFi is pulling in your numbers now. Here’s what you’ll see as it fills in.</p>

        <ul className="mt-8 divide-y divide-(--color-border-default) border-y border-(--color-border-default)">
          <Item Icon={MapPin} title={`${live.length} locations across ${state.brands.length} ${state.brands.length === 1 ? "brand" : "brands"}`} body="Switch between them, or see one brand at a time, from the menu at the top." />
          <Item Icon={ChartNoAxesColumnIncreasing} title="Sales and payouts" body={pos ? `In-store sales from ${pos} show up first, usually within the hour.` : "Sales show up once a POS is connected for your locations."} />
          <Item Icon={Truck} title="Delivery orders and chargebacks" body={onApps ? `Our team will connect the delivery apps at ${onApps} ${onApps === 1 ? "location" : "locations"} and email you when they’re live.` : "Our team will reach out to connect your delivery apps."} />
          {!books && (
            <Item Icon={CircleDashed} muted title="Accounting and bank: not connected yet" body={<>“What you keep” and payout checks fill in once one is connected. <Link href="/integrations" className="text-(--color-text-clickable) hover:underline">See integrations</Link></>} />
          )}
        </ul>

        <Link href={OWNER_HOME} className={buttonVariants({ type: "primary", size: "large", className: "mt-8" })}>
          Go to dashboard
        </Link>
      </div>

      <aside className="w-full shrink-0 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-5 md:w-[280px]">
        <h2 className="text-subtitle-md text-(--color-text-primary)">Setup timeline</h2>
        <div className="mt-4 -mx-4">
          <Timeline steps={timeline} />
        </div>
        <div className="mt-5 border-t border-(--color-border-default) pt-4">
          <p className="text-subtitle-sm text-(--color-text-primary)">Questions?</p>
          <p className="mt-1 text-body-sm text-(--color-text-secondary)">
            Our team can help:{" "}
            <a href={HELP_URL} className="text-(--color-text-clickable) hover:underline">
              support@korefi.com
            </a>
          </p>
        </div>
      </aside>
    </div>
  );
}

function Item({ Icon, title, body, muted }: { Icon: typeof MapPin; title: string; body: React.ReactNode; muted?: boolean }) {
  return (
    <li className="flex gap-3.5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-(--color-neutral-lightest)">
        <Icon className={muted ? "size-4 text-(--color-text-tertiary)" : "size-4 text-(--color-primary-solid)"} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className={muted ? "text-subtitle-sm text-(--color-text-secondary)" : "text-subtitle-sm text-(--color-text-primary)"}>{title}</p>
        <p className="mt-0.5 text-body-md text-(--color-text-secondary)">{body}</p>
      </div>
    </li>
  );
}
