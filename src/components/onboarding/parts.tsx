import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { SourceLogo } from "@/components/integrations/SourceLogo";
import { CATALOG } from "@/lib/sources/catalog";
import type { SourceId } from "@/lib/sources/types";

/** Inline form error with the same icon as field errors. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 flex items-center gap-1.5 text-body-sm text-(--color-text-danger)">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** One connectable source as a card (Dropbox Dash / Obvious connectors on Mobbin): logo and name,
 * what KoreFi reads, then Connect — or a green "Connected" line with what it brought in. */
export function SourceCard({ id, name, connectedNote, onConnect, tag }: { id: SourceId; name: string; connectedNote?: string; onConnect: () => void; tag?: string }) {
  const on = Boolean(connectedNote);
  return (
    <li className={cn("flex flex-col rounded-large border p-4 transition-colors", on ? "border-(--color-success-light) bg-(--color-success-lightest)" : "border-(--color-border-default) bg-(--color-background-secondary)")}>
      <div className="flex items-center gap-3">
        <SourceLogo id={id} name={name} />
        <div className="min-w-0 flex-1">
          <p className="text-subtitle-sm text-(--color-text-primary)">{name}</p>
          {tag && <p className="text-body-sm text-(--color-text-tertiary)">{tag}</p>}
        </div>
        {on && (
          <span className="grid size-6 place-items-center rounded-circle bg-(--color-success-default) text-white">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            <span className="sr-only">Connected</span>
          </span>
        )}
      </div>
      <p className="mt-3 flex-1 text-body-sm text-(--color-text-secondary)">{CATALOG[id]?.blurb}</p>
      <div className="mt-4">
        {on ? (
          <p className="text-body-md text-(--color-text-success)">{connectedNote}</p>
        ) : (
          <Button type="default" size="small" block onClick={onConnect} aria-label={`Connect ${name}`}>
            Connect
          </Button>
        )}
      </div>
    </li>
  );
}

export const cardGrid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
