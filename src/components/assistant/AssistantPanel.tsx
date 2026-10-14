"use client";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Maximize2, SquarePen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SousChat, SousMark } from "./AssistantChat";
import { useAssistant } from "./AssistantProvider";

// Right-hand Sous panel, ClickUp-Brain style: it sits beside the page (pushing it on wide screens,
// covering it on small ones) and stays open while you move between pages. Not a dialog with a
// scrim, so the report you are asking about stays readable. Escape closes it when focus is inside.

const headBtn = "grid size-8 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-light) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)";

export function AssistantPanel() {
  const { open, setOpen, messages, reset } = useAssistant();
  const path = usePathname();
  const panel = useRef<HTMLElement>(null);
  // The /ai page is the full-size version of the same chat.
  const shown = open && !path.startsWith("/ai");

  return (
    <aside
      ref={panel}
      aria-label="Sous"
      aria-hidden={!shown}
      inert={!shown}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className={cn(
        "flex-col overflow-hidden border-(--color-border-default) bg-(--color-background-secondary)",
        shown
          ? "fixed inset-x-2 top-[46px] bottom-2 z-40 flex rounded-large border shadow-[0_8px_32px_rgb(0_0_0/0.10)] motion-safe:animate-page-in lg:static lg:inset-auto lg:w-[400px] lg:shrink-0 lg:rounded-none lg:border-0 lg:border-l lg:shadow-none"
          : "hidden",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-(--color-border-default) py-2 pr-2 pl-4">
        <div className="flex items-center gap-2.5">
          <SousMark />
          <span className="text-body-md font-medium text-(--color-text-primary)">Sous</span>
        </div>
        <div className="flex items-center">
          {messages.length > 0 && (
            <button type="button" aria-label="New chat" title="New chat" onClick={reset} className={headBtn}>
              <SquarePen className="size-4" />
            </button>
          )}
          <Link href="/ai" aria-label="Open Sous full screen" title="Open full screen" onClick={() => setOpen(false)} className={headBtn}>
            <Maximize2 className="size-4" />
          </Link>
          <button type="button" aria-label="Close Sous" onClick={() => setOpen(false)} className={headBtn}>
            <X className="size-4" />
          </button>
        </div>
      </header>
      <SousChat variant="panel" autoFocus={shown} />
    </aside>
  );
}
