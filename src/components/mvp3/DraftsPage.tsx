"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { DRAFTS } from "@/lib/mvp3/agents";
import { DraftCard } from "./DraftCards";

// MVP 3 / Drafts: every agent the team is still writing. Full-page view of the grid shown on the home.
export function DraftsPage() {
  const [q, setQ] = useState("");
  const list = DRAFTS.filter((d) => d.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <PageHeader
        title="Drafts"
        actions={
          <label className="flex h-9 w-56 items-center gap-2 rounded-medium border border-(--color-border-default) px-2.5 text-(--color-text-secondary) focus-within:outline-2 focus-within:outline-(--color-focus-primary)">
            <Search className="size-4" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)" />
          </label>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
          {list.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {list.map((d) => (
                <li key={d.id}>
                  <DraftCard d={d} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-16 text-center text-body-md text-(--color-text-secondary)">No drafts match “{q}”.</p>
          )}
        </div>
      </div>
    </>
  );
}
