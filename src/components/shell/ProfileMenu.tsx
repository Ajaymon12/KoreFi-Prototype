"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LifeBuoy, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_URL, user } from "@/lib/mockData";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { useTheme, type Theme } from "./useTheme";

const THEMES: { key: Theme; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
];

const initials = `${user.firstName[0]}${user.lastName[0]}`;
const item =
  "flex h-9 w-full items-center gap-2.5 rounded-medium px-2.5 text-left text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest) [&>svg]:size-4 [&>svg]:text-(--color-text-secondary)";

// Account menu on the avatar: who's signed in, theme, help, and log out (Linear / Mercury
// pattern). Arrow keys move between items; Escape closes and returns focus to the avatar.
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...menu.current!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`Account: ${user.firstName} ${user.lastName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-circle bg-(--color-primary) text-subtitle-xs text-(--color-text-inverse-primary) outline-none transition-shadow hover:shadow-[0_0_0_3px_var(--color-neutral-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary) aria-expanded:shadow-[0_0_0_3px_var(--color-neutral-light)]"
      >
        {initials}
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Account"
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-50 mt-2 w-72 rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
        >
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-circle bg-(--color-primary) text-subtitle-sm text-(--color-text-inverse-primary)">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-subtitle-sm text-(--color-text-primary)">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-body-sm text-(--color-text-secondary)">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-(--color-border-default) px-2.5 pt-2.5 pb-2">
            <p id="theme-label" className="text-body-sm text-(--color-text-secondary)">
              Theme
            </p>
            <div role="group" aria-labelledby="theme-label" className="mt-2 grid grid-cols-3 gap-1 rounded-medium bg-(--color-neutral-lightest) p-1">
              {THEMES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === key}
                  onClick={() => setTheme(key)}
                  className={cn(
                    "flex h-8 items-center justify-center gap-1.5 rounded-small text-menu-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                    theme === key ? "bg-(--color-background-secondary) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-(--color-border-default) py-1">
            <a role="menuitem" href={HELP_URL} onClick={close} className={item}>
              <LifeBuoy />
              Help & support
            </a>
          </div>

          <div className="border-t border-(--color-border-default) pt-1">
            <Link role="menuitem" href="/login" onClick={close} className={item}>
              <LogOut />
              Log out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
