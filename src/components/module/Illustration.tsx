"use client";
import { useId } from "react";
import type { Persona } from "@/lib/nav";

// One object illustration per cowork — soft, layered 2D objects on a shared neutral stage with a
// single brand-orange accent (the Airwallex / Wise / Family empty-state school), no characters.
//   coins — Finance: a stack of coins in front of a ledger card
//   bell  — Operations: a service bell inside a running-timer ring
//   steps — Growth: climbing columns with a rising arrow
// Everything is a Foundation token, so the scene follows light/dark.
const INK = "var(--gray-1200)";

function Stage() {
  return (
    <>
      <rect x="18" y="38" width="104" height="22" rx="11" fill="var(--gray-400)" />
      <rect x="82" y="102" width="100" height="22" rx="11" fill="var(--gray-400)" />
      <path d="M170 40v10M165 45h10" stroke="var(--gray-800)" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 112v6M23 115h6" stroke="var(--gray-800)" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

const Shadow = ({ cx = 100, rx = 52 }: { cx?: number; rx?: number }) => <ellipse cx={cx} cy="139" rx={rx} ry="6" fill="#000" opacity="0.09" />;

function Coins({ id }: { id: string }) {
  const coin = (cy: number) => (
    <g key={cy}>
      <path d={`M70 ${cy}v12a34 10 0 0 0 68 0v-12z`} fill={`url(#${id}-side)`} />
      <ellipse cx="104" cy={cy} rx="34" ry="10" fill={`url(#${id}-orange)`} />
    </g>
  );
  return (
    <g>
      <Shadow cx={104} rx={56} />
      <g transform="rotate(-8 62 90)">
        <rect x="34" y="42" width="58" height="76" rx="9" fill="var(--gray-100)" stroke="var(--gray-700)" strokeWidth="2" />
        <rect x="44" y="54" width="22" height="5" rx="2.5" fill="var(--brand-900)" />
        <rect x="44" y="68" width="38" height="4" rx="2" fill="var(--gray-500)" />
        <rect x="44" y="78" width="30" height="4" rx="2" fill="var(--gray-500)" />
        <rect x="44" y="88" width="38" height="4" rx="2" fill="var(--gray-500)" />
        <rect x="44" y="102" width="38" height="6" rx="3" fill="var(--gray-800)" />
      </g>
      {coin(120)}
      {coin(108)}
      {coin(96)}
      <ellipse cx="104" cy="96" rx="24" ry="6.5" fill="none" stroke="var(--brand-1000)" strokeWidth="2" />
      <path d="M86 94c4-3 10-4 16-4" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
      <g transform="translate(152 112)">
        <circle r="17" fill={`url(#${id}-orange)`} stroke="var(--brand-1000)" strokeWidth="2" />
        <circle r="10.5" fill="none" stroke="var(--brand-1000)" strokeWidth="2" />
        <path d="M-8 -9a13 13 0 0 1 9-4" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

function Bell({ id }: { id: string }) {
  return (
    <g>
      <Shadow />
      <circle cx="100" cy="92" r="58" fill="none" stroke="var(--gray-500)" strokeWidth="5" />
      <path d="M100 34A58 58 0 1 1 49.8 121" fill="none" stroke="var(--brand-900)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="49.8" cy="121" r="3.5" fill="var(--brand-900)" />
      <rect x="46" y="122" width="108" height="11" rx="5.5" fill="var(--gray-300)" stroke="var(--gray-700)" strokeWidth="2" />
      <path d="M56 122c0-44 88-44 88 0z" fill={`url(#${id}-body)`} stroke="var(--gray-700)" strokeWidth="2" />
      <path d="M68 112c1-16 12-24 26-26" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
      <rect x="95" y="73" width="10" height="7" rx="3" fill="var(--gray-700)" />
      <circle cx="100" cy="72" r="6.5" fill={`url(#${id}-orange)`} stroke="var(--brand-1000)" strokeWidth="2" />
    </g>
  );
}

function Steps({ id }: { id: string }) {
  const bar = (x: number, h: number, accent = false) => {
    const y = 132 - h;
    return (
      <g key={x}>
        <rect x={x} y={y} width="34" height={h} rx="8" fill={accent ? `url(#${id}-orange)` : `url(#${id}-body)`} stroke={accent ? "var(--brand-1000)" : "var(--gray-700)"} strokeWidth="2" />
        <rect x={x + 6} y={y + 6} width="22" height="4" rx="2" fill="#fff" opacity={accent ? 0.55 : 0.8} />
      </g>
    );
  };
  return (
    <g>
      <Shadow />
      {bar(40, 34)}
      {bar(83, 58)}
      {bar(126, 86, true)}
      <path d="M44 86C70 78 92 58 116 40" fill="none" stroke="var(--brand-900)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M108 36l13-3-2 13" fill="none" stroke="var(--brand-900)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M160 30v9M155.5 34.5h9" stroke={INK} strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

export function Illustration({ kind, className, title }: { kind: Persona["illustration"]; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gray-100)" />
          <stop offset="1" stopColor="var(--gray-400)" />
        </linearGradient>
        <linearGradient id={`${id}-orange`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-700)" />
          <stop offset="1" stopColor="var(--brand-900)" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-900)" />
          <stop offset="1" stopColor="var(--brand-1000)" />
        </linearGradient>
      </defs>
      <Stage />
      {kind === "coins" ? <Coins id={id} /> : kind === "bell" ? <Bell id={id} /> : <Steps id={id} />}
    </svg>
  );
}
