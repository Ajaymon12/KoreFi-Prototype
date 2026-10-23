"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Place } from "@/lib/org/places";

// A tile-free map for the add-restaurant flow: a dotted canvas with one pin per store Google Maps
// returned. Pins pop in as each results page lands and glide when the view refits to the new
// spread. Selected = brand colour, left out = hollow, already in KoreFi = grey. Decorative only
// (aria-hidden): the list beside it is the real control, and hovering a row lights its pin.

const W = 320;
const H = 260;
const PAD = 26;

type Props = { places: Place[]; selected: Set<string>; already: Set<string>; hovered: string | null; searching: boolean; onHover: (id: string | null) => void; onToggle: (id: string) => void };

export function PinMap({ places, selected, already, hovered, searching, onHover, onToggle }: Props) {
  const project = useMemo(() => {
    if (!places.length) return null;
    // Fit the middle 90% of stores, not all of them: one suburban outpost shouldn't shrink a dense
    // city cluster to a smudge. Stores outside the fit are pinned to the nearest edge.
    const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.round((xs.length - 1) * f)];
    const trim = places.length >= 10 ? 0.05 : 0;
    const lats = places.map((p) => p.lat);
    const lngs = places.map((p) => p.lng);
    const [lat0, lat1, lng0, lng1] = [q(lats, trim), q(lats, 1 - trim), q(lngs, trim), q(lngs, 1 - trim)];
    const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
    // A floor on the span keeps one or two nearby stores from filling the whole canvas.
    const spanX = Math.max((lng1 - lng0) * k, 0.02);
    const spanY = Math.max(lat1 - lat0, 0.02);
    const s = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const [cLat, cLng] = [(lat0 + lat1) / 2, (lng0 + lng1) / 2];
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 8), max - 8);
    return (p: Place) => ({ x: clamp(W / 2 + (p.lng - cLng) * k * s, W), y: clamp(H / 2 - (p.lat - cLat) * s, H) });
  }, [places]);

  const hot = places.find((p) => p.placeId === hovered);

  return (
    <div className="relative overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary)">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden onMouseLeave={() => onHover(null)}>
        <defs>
          <pattern id="kf-map-dots" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill="var(--color-border-default)" />
          </pattern>
          <radialGradient id="kf-map-glow">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#kf-map-dots)" />
        {!project && (
          <g className={cn(searching && "animate-pulse")}>
            <circle cx={W / 2} cy={H / 2} r="70" fill="url(#kf-map-glow)" />
            <circle cx={W / 2} cy={H / 2} r="5" fill="var(--color-text-tertiary)" opacity="0.5" />
            {searching && <circle cx={W / 2} cy={H / 2} r="5" fill="var(--color-primary)" className="kf-ping" />}
          </g>
        )}
        {project &&
          places.map((p, i) => {
            const { x, y } = project(p);
            const isOld = already.has(p.placeId);
            const on = selected.has(p.placeId);
            const isHot = p.placeId === hovered;
            return (
              <g key={p.placeId} style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 600ms cubic-bezier(0.2, 0.8, 0.3, 1)" }}>
                {isHot && <circle r="11" fill="var(--color-primary)" opacity="0.18" />}
                <circle
                  r={isHot ? 6 : 4.5}
                  className="kf-pin-in cursor-pointer transition-[r] duration-150"
                  style={{ animationDelay: `${(i % 20) * 35}ms` }}
                  fill={isOld ? "var(--color-text-tertiary)" : on ? "var(--color-primary)" : "var(--color-background-secondary)"}
                  stroke={isOld ? "var(--color-background-secondary)" : on ? "var(--color-background-secondary)" : "var(--color-text-tertiary)"}
                  strokeWidth="1.5"
                  onMouseEnter={() => onHover(p.placeId)}
                  onClick={() => !isOld && onToggle(p.placeId)}
                />
              </g>
            );
          })}
      </svg>
      {hot && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 truncate rounded-medium bg-(--gray-1200) px-2.5 py-1.5 text-body-sm text-(--color-text-inverse-primary) shadow-[0_6px_16px_rgb(0_0_0/0.18)]">
          {hot.neighborhood} · {hot.address.street}, {hot.address.city}
        </div>
      )}
    </div>
  );
}
