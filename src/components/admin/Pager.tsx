"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Table footer from the Ops design (Figma 1431:28221): "Showing 1–12 of 25 users" on the left, page buttons on the right. */
export function Pager({ page, pageSize, total, noun, onPage }: { page: number; pageSize: number; total: number; noun: string; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const arrow = "grid h-5 w-[22px] place-items-center rounded-small text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--color-border-default) px-4 py-3">
      <p className="text-body-md text-(--color-text-primary)">
        Showing {from}–{to} of {total} {noun}
      </p>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)} className={arrow}>
            <ChevronLeft className="size-3.5" aria-hidden />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn("h-5 min-w-[22px] rounded-small px-2 text-body-md text-(--color-text-primary) outline-none focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)", p === page ? "bg-(--color-primary)/12" : "bg-(--color-neutral-lightest)/70 hover:bg-(--color-neutral-lightest)")}
            >
              {p}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)} className={arrow}>
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}
