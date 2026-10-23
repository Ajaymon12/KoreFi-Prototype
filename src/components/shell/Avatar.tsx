"use client";
import { useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Illustrated avatars (Mobbin: Skillshare's line-art face, OKX's avatar picker), drawn as a small
// restaurant crew: owner, chef, barista, host, line cook, baker. Flat fills under one ink line on a soft
// tinted circle. Colours are fixed (an illustration, not UI chrome), so they read the same in dark mode.
// The choice is remembered per browser; until one is picked, the user's name picks one.

const INK = "#2b1d16";

type Hair = "short" | "bun" | "long" | "none";
type Hat = "toque" | "bandana" | "beanie" | null;
export type AvatarDef = { id: string; label: string; bg: string; skin: string; hair: Hair; hairColor: string; shirt: string; hat: Hat; glasses?: boolean };

export const AVATARS: AvatarDef[] = [
  { id: "owner", label: "Owner", bg: "#ffe8d7", skin: "#f2c6a5", hair: "short", hairColor: "#3b2418", shirt: "#f76808", hat: null, glasses: true },
  { id: "chef", label: "Chef", bg: "#dff3e4", skin: "#c98e68", hair: "none", hairColor: INK, shirt: "#ffffff", hat: "toque" },
  { id: "barista", label: "Barista", bg: "#e4ecfb", skin: "#f5d3bb", hair: "bun", hairColor: "#7a4a2a", shirt: "#2f6f5e", hat: null },
  { id: "host", label: "Host", bg: "#f6e1f0", skin: "#8d5a3c", hair: "long", hairColor: "#1f1410", shirt: "#7c5cd6", hat: null },
  { id: "cook", label: "Line cook", bg: "#fdf1c7", skin: "#e0ac88", hair: "short", hairColor: "#1f1410", shirt: "#3a3a3a", hat: "bandana" },
  { id: "baker", label: "Baker", bg: "#e8e3f8", skin: "#ffdcc4", hair: "long", hairColor: "#c98a3e", shirt: "#e9b949", hat: "beanie", glasses: true },
];

const line = { stroke: INK, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** One avatar as an SVG on its tinted circle. Decorative: the button or text around it names the user. */
export function Avatar({ def, className }: { def: AvatarDef; className?: string }) {
  const clip = `av-${useId()}`;
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("shrink-0 rounded-circle", className)}>
      <defs>
        <clipPath id={clip}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="48" height="48" fill={def.bg} />
        {/* Long hair falls behind the shoulders and face. */}
        {def.hair === "long" && <path d="M13.5 23c-.6-9 4.2-13.5 10.5-13.5S35.1 14 34.5 23l.5 13H13z" fill={def.hairColor} {...line} />}
        {/* Shoulders, neck, then the head. */}
        <path d="M6 49c1.2-8.5 8-12.5 18-12.5S40.8 40.5 42 49" fill={def.shirt} {...line} />
        <path d="M20.5 31v5.5c1 1.6 6 1.6 7 0V31" fill={def.skin} {...line} />
        <ellipse cx="24" cy="23" rx="9" ry="10" fill={def.skin} {...line} />
        {def.hair === "short" && <path d="M15.1 21.5C14.3 13.8 18.6 10 24 10s9.8 3.6 8.9 11.2c-2.6-2.4-6.4-3.4-9.4-5.6-2 2.8-4.9 4.6-8.4 5.9z" fill={def.hairColor} {...line} />}
        {def.hair === "bun" && (
          <>
            <circle cx="24" cy="9" r="3.6" fill={def.hairColor} {...line} />
            <path d="M15.1 21.5C14.3 14 18.6 11 24 11s9.7 3 8.9 10.5c-3-1-6.4-3.4-8.9-6-2.5 2.6-5.9 5-8.9 6z" fill={def.hairColor} {...line} />
          </>
        )}
        {def.hair === "long" && <path d="M15.1 22C14.6 14.4 18.8 11 24 11s9.4 3.4 8.9 11c-3.6-.6-7.2-2.8-8.9-6-1.7 3.2-5.3 5.4-8.9 6z" fill={def.hairColor} {...line} />}

        {/* Face */}
        <circle cx="20.6" cy="23.2" r="1" fill={INK} />
        <circle cx="27.4" cy="23.2" r="1" fill={INK} />
        <circle cx="18.6" cy="26.4" r="1.4" fill="#f08a6c" opacity=".35" />
        <circle cx="29.4" cy="26.4" r="1.4" fill="#f08a6c" opacity=".35" />
        <path d="M21.4 27.3q2.6 2.2 5.2 0" fill="none" {...line} />
        {def.glasses && (
          <g fill="none" {...line} strokeWidth={1.1}>
            <circle cx="20.6" cy="23.2" r="2.7" />
            <circle cx="27.4" cy="23.2" r="2.7" />
            <path d="M23.3 23.2h1.4" />
          </g>
        )}

        {/* Hats sit last, over the hair line. */}
        {def.hat === "toque" && (
          <>
            <path d="M15.5 17.5c-3-1-3.6-6.2.2-7.4.4-3.4 4.4-4.8 6.6-2.7 1.6-2.6 5.6-2.4 6.8.6 3.8-.4 5.6 4.4 3.1 6.6l.3 2.9z" fill="#ffffff" {...line} />
            <path d="M15.4 17.4h17.2v2.8H15.4z" fill="#ffffff" {...line} />
          </>
        )}
        {def.hat === "bandana" && (
          <>
            <path d="M15 19.6c.2-6.2 4.2-9.6 9-9.6s8.8 3.4 9 9.6c-5.8-1.8-12.2-1.8-18 0z" fill="#e5484d" {...line} />
            <path d="M32.6 18.4l3.4-1.2-1 3.2" fill="#e5484d" {...line} />
            <circle cx="21" cy="14.6" r=".7" fill="#ffffff" />
            <circle cx="26.5" cy="13.4" r=".7" fill="#ffffff" />
          </>
        )}
        {def.hat === "beanie" && (
          <>
            <path d="M14.8 18.6c0-6.4 4.2-10.1 9.2-10.1s9.2 3.7 9.2 10.1z" fill="#2f6f5e" {...line} />
            <path d="M14.3 18.4h19.4v2.6H14.3z" fill="#2f6f5e" {...line} />
            <circle cx="24" cy="7.4" r="2" fill="#ffffff" {...line} />
          </>
        )}
      </g>
    </svg>
  );
}

// ---- The chosen avatar, remembered per browser ----

const KEY = "kf-avatar";
let memory = "";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The user's avatar: their pick, or one chosen by their name until they pick. */
export function useAvatar(name: string): [AvatarDef, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, read, () => "");
  const fallback = AVATARS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length];
  const set = (next: string) => {
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    listeners.forEach((l) => l());
  };
  return [AVATARS.find((a) => a.id === id) ?? fallback, set];
}
