import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/nav";

// Avatar marks for the three coworks: one bold object per cowork on a warm disc, drawn on a
// 48-unit grid so it stays crisp from 20px up. Same family as the larger scene illustrations
// (Illustration.tsx) — objects, not faces; one brand-orange hero, neutral supporting shapes —
// but simplified for small sizes. Use this anywhere a cowork appears at avatar size.
//   coins — Finance: a slightly offset stack of three coins
//   bell  — Operations: a service bell on its plate
//   steps — Growth: three rising bars, the tallest in brand orange

function Coins({ id }: { id: string }) {
  // Bottom to top, each coin nudged sideways so the stack reads as hand-placed.
  const coins = [
    { x: 24, y: 29 },
    { x: 22.5, y: 24.5 },
    { x: 25, y: 20 },
  ];
  return (
    <>
      <ellipse cx="24" cy="36.5" rx="12" ry="2" fill="#000" opacity="0.08" />
      {coins.map(({ x, y }, i) => (
        <g key={i}>
          <path d={`M${x - 11} ${y}v4a11 4 0 0 0 22 0v-4z`} fill={`url(#${id}-side)`} />
          <ellipse cx={x} cy={y} rx="11" ry="4" fill={`url(#${id}-face)`} />
        </g>
      ))}
      <ellipse cx="25" cy="20" rx="7" ry="2.3" fill="none" stroke="var(--brand-1000)" strokeWidth="1.2" opacity="0.55" />
      <path d="M18.5 19.2c1.6-1 3.6-1.5 5.6-1.6" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function Bell({ id }: { id: string }) {
  return (
    <>
      <ellipse cx="24" cy="37" rx="12.5" ry="2" fill="#000" opacity="0.08" />
      <rect x="11.5" y="31" width="25" height="4" rx="2" fill="var(--gray-800)" />
      <path d="M14 31a10 10 0 0 1 20 0z" fill={`url(#${id}-face)`} />
      <path d="M14 31a10 10 0 0 1 20 0" fill="none" stroke="var(--brand-1000)" strokeWidth="1" opacity="0.5" />
      <path d="M17.6 27.6a7 7 0 0 1 4.8-5.3" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="23" y="18.5" width="2" height="3" rx="0.6" fill="var(--gray-800)" />
      <circle cx="24" cy="17.2" r="2.4" fill={`url(#${id}-face)`} stroke="var(--brand-1000)" strokeWidth="0.8" />
    </>
  );
}

function Steps({ id }: { id: string }) {
  return (
    <>
      <ellipse cx="24" cy="36.5" rx="12.5" ry="2" fill="#000" opacity="0.08" />
      <rect x="12" y="28" width="6.5" height="7" rx="1.8" fill="var(--brand-900)" opacity="0.35" />
      <rect x="20.75" y="23.5" width="6.5" height="11.5" rx="1.8" fill="var(--brand-900)" opacity="0.6" />
      <rect x="29.5" y="18" width="6.5" height="17" rx="1.8" fill={`url(#${id}-face)`} />
      <rect x="31" y="20" width="3.5" height="1.4" rx="0.7" fill="#fff" opacity="0.7" />
      {/* Rising path above the bars, ending in an arrowhead */}
      <path d="M12.5 22.5l8-5 4.5 1.5 7.8-7.6" fill="none" stroke="var(--brand-1100)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M29.2 11.2h3.8v3.8" fill="none" stroke="var(--brand-1100)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const MARKS = { coins: Coins, bell: Bell, steps: Steps };

export function CoworkAvatar({ kind, className, title }: { kind: Persona["illustration"]; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const Mark = MARKS[kind];
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8 shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${id}-disc`} cx="0.35" cy="0.25" r="0.9">
          <stop offset="0" stopColor="var(--brand-200)" />
          <stop offset="1" stopColor="var(--brand-400)" />
        </radialGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-700)" />
          <stop offset="1" stopColor="var(--brand-900)" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-900)" />
          <stop offset="1" stopColor="var(--brand-1100)" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23.5" fill={`url(#${id}-disc)`} />
      <circle cx="24" cy="24" r="23" fill="none" stroke="var(--brand-600)" strokeOpacity="0.6" />
      <Mark id={id} />
    </svg>
  );
}
