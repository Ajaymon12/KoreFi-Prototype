"use client";
import { ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./AssistantProvider";

/** Top-bar entry point (ClickUp's "Ask AI"). ⌘K toggles the same panel. */
export function AskSousButton() {
  const { open, setOpen } = useAssistant();
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-keyshortcuts="Meta+K Control+K"
      onClick={() => setOpen(!open)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-circle border border-(--color-border-default) px-3 text-button-sm font-medium text-(--color-text-primary) outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
        open && "bg-(--color-brand-lightest)",
      )}
    >
      <ChefHat className="size-4 text-(--color-primary)" aria-hidden />
      <span className="hidden sm:inline">Ask Sous</span>
      <kbd className="hidden rounded-small border border-(--color-border-default) px-1 text-[10px] leading-4 text-(--color-text-secondary) lg:inline">⌘K</kbd>
    </button>
  );
}
