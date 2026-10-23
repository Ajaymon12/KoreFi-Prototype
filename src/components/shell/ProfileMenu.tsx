"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, LifeBuoy, LogOut, Monitor, Moon, Pencil, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_URL, user } from "@/lib/mockData";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { AVATARS, Avatar, useAvatar } from "./Avatar";
import { useTheme, type Theme } from "./useTheme";

const THEMES: { key: Theme; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
];

const item =
  "flex h-9 w-full items-center gap-2.5 rounded-medium px-2.5 text-left text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest) [&>svg]:size-4 [&>svg]:text-(--color-text-secondary)";

// Account menu on the avatar: who's signed in, theme, help, and log out (Linear / Mercury
// pattern). Arrow keys move between items; Escape closes and returns focus to the avatar.
// The avatar is an illustrated crew member (Avatar.tsx) that lifts slightly on hover. The menu opens on
// a profile card in the avatar's own tint, with "Change avatar" opening a grid of the crew to pick from
// (OKX's avatar picker), remembered per browser.
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  const { theme, setTheme } = useTheme();
  const name = `${user.firstName} ${user.lastName}`;
  const [avatar, setAvatar] = useAvatar(name);
  const [picking, setPicking] = useState(false);

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
        onClick={() => {
          setOpen((o) => !o);
          setPicking(false);
        }}
        className="grid size-8 place-items-center rounded-circle outline-none transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_3.5px_var(--color-border-darker)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary) aria-expanded:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_3.5px_var(--brand-800)]"
      >
        <Avatar def={avatar} className="size-8" />
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Account"
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:animate-page-in"
        >
          {/* Profile card: a wash in the avatar's tint, the avatar overlapping its edge, then who's signed in. */}
          <div className="-mx-1.5 -mt-1.5 h-14 transition-colors" style={{ background: `linear-gradient(135deg, ${avatar.bg}, color-mix(in srgb, ${avatar.bg} 40%, var(--color-background-secondary)))` }} />
          <div className="px-2.5 pb-3">
            <div className="flex items-end justify-between gap-2">
              <span className="-mt-7 block rounded-circle bg-(--color-background-secondary) p-[3px]">
                <Avatar def={avatar} className="size-14" />
              </span>
              <button
                type="button"
                role="menuitem"
                aria-expanded={picking}
                onClick={() => setPicking((v) => !v)}
                className="flex h-7 items-center gap-1 rounded-medium px-2 text-body-sm text-(--color-text-clickable) outline-none hover:bg-(--color-primary)/10 focus-visible:bg-(--color-primary)/10"
              >
                <Pencil aria-hidden className="size-3" />
                {picking ? "Done" : "Change avatar"}
              </button>
            </div>
            <p className="mt-2 truncate text-subtitle-sm text-(--color-text-primary)">{name}</p>
            <p className="truncate text-body-sm text-(--color-text-secondary)">{user.email}</p>
            {picking && (
              <div role="group" aria-label="Avatar" className="mt-3 grid grid-cols-6 gap-1.5 motion-safe:animate-page-in">
                {AVATARS.map((a) => {
                  const on = a.id === avatar.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={on}
                      aria-label={a.label}
                      title={a.label}
                      onClick={() => setAvatar(a.id)}
                      className={cn(
                        "relative rounded-circle outline-none transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-primary)",
                        on && "shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--brand-900)]",
                      )}
                    >
                      <Avatar def={a} className="size-full" />
                      {on && (
                        <span aria-hidden className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-circle bg-(--brand-900) text-white ring-2 ring-(--color-background-secondary)">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
