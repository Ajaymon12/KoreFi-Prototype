"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// A docked detail panel, after Mercury Books (Invoices): opening a row splits the page instead of
// sliding a drawer over it. The list keeps its place on the left and stays usable (click another
// row to swap the detail), the panel sits beside it, and "expand" gives the panel the full width.
//
// The page area provides a slot; any DetailDrawer rendered inside it portals into the slot and
// docks. Outside a DockArea (the older module app) DetailDrawer keeps its overlay behaviour.
// Only one panel owns the dock at a time: opening a second one closes the first.

type Dock = {
  slot: HTMLElement | null;
  owner: string | null;
  /** Take the dock for panel `id`. */
  claim: (id: string) => void;
  /** Give it back, only if `id` still holds it (a panel closing because another opened must not evict it). */
  release: (id: string) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
};

const DockContext = createContext<Dock | null>(null);
export const useDock = () => useContext(DockContext);

/** The page area: the page on the left, the dock on the right. Replaces a bare <main>. */
export function DockArea({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const claim = useCallback((id: string) => setOwner(id), []);
  const release = useCallback((id: string) => {
    setOwner((o) => {
      if (o !== id) return o;
      setExpanded(false);
      return null;
    });
  }, []);
  const value = useMemo(() => ({ slot, owner, claim, release, expanded, setExpanded }), [slot, owner, claim, release, expanded]);
  return (
    <DockContext.Provider value={value}>
      {/* While the panel is expanded the page is hidden, not unmounted, so its scroll and state survive. */}
      <main className={cn("min-w-0 flex-1 flex-col", expanded && owner ? "hidden" : "flex")}>{children}</main>
      <div ref={setSlot} className={cn("contents", expanded && owner && "[&>aside]:flex-1 [&>aside]:max-w-none [&>aside]:border-l-0")} />
    </DockContext.Provider>
  );
}
