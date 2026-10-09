"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "./useTheme";

// Compact Light / Dark / System switch for screens without the profile menu (signup and
// onboarding). Same saved choice as the profile menu, so it carries into the app.

const OPTIONS: { key: Theme; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex items-center gap-0.5 rounded-circle border border-(--color-border-default) bg-(--color-background-secondary) p-0.5", className)}>
      {OPTIONS.map(({ key, label, Icon }) => {
        const on = theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => setTheme(key)}
            className={cn(
              "grid size-7 place-items-center rounded-circle outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
              on ? "bg-(--color-neutral-light) text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
