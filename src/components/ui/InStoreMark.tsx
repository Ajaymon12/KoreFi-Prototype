"use client";
import { useId } from "react";

// The "In store & website" channel's mark, made to sit with the app logos the way they look: a
// filled tile in KoreFi orange (like Grubhub's red one) with a white shopfront on it: a flared,
// striped awning over the shop, its door and window cut out, standing on a kerb line.

const N = 4;
const AWNING = { top: [4.5, 19.5], bottom: [3.5, 20.5] };

export function InStoreMark({ size = 16, className }: { size?: number; className?: string }) {
  const id = useId();
  const tw = (AWNING.top[1] - AWNING.top[0]) / N;
  const bw = (AWNING.bottom[1] - AWNING.bottom[0]) / N;
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className ?? "shrink-0"}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-800)" />
          <stop offset="1" stopColor="var(--brand-1000)" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5" fill={`url(#${id})`} />
      {/* awning: flares out from the shop, one scalloped stripe per panel, white and peach in turn */}
      {Array.from({ length: N }, (_, i) => {
        const t = AWNING.top[0] + i * tw;
        const b = AWNING.bottom[0] + i * bw;
        return <path key={i} d={`M${t} 4H${t + tw}L${b + bw} 7.5V8A${bw / 2} ${bw / 2} 0 0 1 ${b} 8V7.5Z`} fill={i % 2 ? "#ffc49c" : "#fff"} />;
      })}
      {/* shop, with the door and window cut out, on the kerb */}
      <path fillRule="evenodd" d="M5 11H19V19H5ZM6.75 13.25H10.75V19H6.75ZM12.5 13.25H17.25V16.75H12.5Z" fill="#fff" />
      <rect x="3.5" y="19" width="17" height="1.5" rx="0.75" fill="#fff" />
    </svg>
  );
}
