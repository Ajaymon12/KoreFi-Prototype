"use client";
import { Building2, Landmark, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceLogo } from "@/components/integrations/SourceLogo";
import { orgName } from "@/lib/org/name";
import type { OnboardingState } from "@/lib/org/types";
import type { SourceId } from "@/lib/sources/types";
import { BrandMark } from "./marks";

// Right-hand "Your workspace" card that fills in as the owner answers (Vanta's running
// "Automation summary" on Mobbin). It shows the shape KoreFi is building — group → brands →
// locations, plus what's connected — so multi-brand owners can see their structure take form.

const NAMES: Partial<Record<SourceId, string>> = { square: "Square", toast: "Toast", clover: "Clover", quickbooks: "QuickBooks", xero: "Xero", zoho: "Zoho Books", mercury: "Mercury" };
const SIZE = { "1": "1 location", "2-5": "2–5 locations", "6-15": "6–15 locations", "16+": "16+ locations", "": "" };

export function WorkspacePreview({ state }: { state: OnboardingState }) {
  const { org, brands } = state;
  const name = orgName(state);
  const live = state.locations.filter((l) => l.included);
  const pos = state.connected.filter((id) => ["square", "toast", "clover"].includes(id));
  const books = state.connected.filter((id) => ["quickbooks", "xero", "zoho", "mercury"].includes(id));
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <aside aria-label="Your workspace so far" className="rounded-xlarge border border-(--color-border-default) bg-(--color-background-primary) p-5">
      <p className="text-subtitle-xs tracking-wide text-(--color-text-tertiary) uppercase">Your workspace</p>

      <div className="mt-4 flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-large text-subtitle-sm", initials ? "bg-(--gray-1200) text-(--color-text-inverse-primary)" : "border border-dashed border-(--color-border-darker) text-(--color-text-tertiary)")}>
          {initials || <Building2 className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className={cn("truncate text-subtitle-md", name ? "text-(--color-text-primary)" : "text-(--color-text-tertiary)")}>{name || "Your business"}</p>
          <p className="text-body-sm text-(--color-text-secondary)">{live.length ? `${live.length} locations · ${brands.length} ${brands.length === 1 ? "brand" : "brands"}` : SIZE[org.sizeBand] || "Restaurant group"}</p>
        </div>
      </div>

      <Section title="Brands & locations">
        {brands.length && live.length ? (
          <ul className="space-y-2.5">
            {brands.map((b) => {
              const rows = live.filter((l) => l.brandId === b.id);
              if (!rows.length) return null;
              return (
                <li key={b.id}>
                  <p className="flex items-center gap-2 text-body-md text-(--color-text-primary)">
                    <BrandMark brand={b} brands={brands} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{b.name || "Untitled brand"}</span>
                    <span className="text-body-sm text-(--color-text-secondary) tabular-nums">{rows.length}</span>
                  </p>
                  <ul className="mt-1 ml-3 space-y-0.5 border-l border-(--color-border-default) pl-[18px]">
                    {rows.slice(0, 4).map((l) => (
                      <li key={l.id} className="truncate text-body-sm text-(--color-text-secondary)">
                        {l.name}
                      </li>
                    ))}
                    {rows.length > 4 && <li className="text-body-sm text-(--color-text-tertiary)">+{rows.length - 4} more</li>}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <Placeholder>Appears when you connect your POS</Placeholder>
        )}
      </Section>

      <Section title="Connected">
        {pos.length || books.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {[...pos, ...books].map((id) => (
              <li key={id} className="flex items-center gap-1.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) py-0.5 pr-2.5 pl-0.5 text-body-sm text-(--color-text-primary)">
                <SourceLogo id={id} name={NAMES[id] ?? id} size="sm" />
                {NAMES[id]}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex gap-2">
            <Ghost Icon={MonitorSmartphone} label="POS" />
            <Ghost Icon={Landmark} label="Bank" />
          </div>
        )}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-(--color-border-default) pt-4">
      <h3 className="mb-2.5 text-body-sm text-(--color-text-secondary)">{title}</h3>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {[70, 52, 60].map((w) => (
        <span key={w} className="block h-2.5 rounded-circle bg-(--color-neutral-light)" style={{ width: `${w}%` }} />
      ))}
      <p className="pt-1 text-body-sm text-(--color-text-tertiary)">{children}</p>
    </div>
  );
}

function Ghost({ Icon, label }: { Icon: typeof Landmark; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-circle border border-dashed border-(--color-border-darker) px-2.5 py-1 text-body-sm text-(--color-text-tertiary)">
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
