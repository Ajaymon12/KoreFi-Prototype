import type { LucideIcon } from "lucide-react";

// Right-hand panel on the auth screens: frosted-glass shapes floating over soft orange light
// (Origin / Apollo on Mobbin). Fixed dark in both themes, so the glass always has colour to
// refract and the text contrast never depends on the app theme. Sample figures, decoration only — no CTAs.
// Sign-up and log-in share the scene and swap the content.

export type GlassTone = { tone: string; text: string };
export const BLUE: GlassTone = { tone: "#4a90ff", text: "#a9cbff" };
export const GREEN: GlassTone = { tone: "#2fd07f", text: "#8ff0bd" };
export const RED: GlassTone = { tone: "#ff5d5d", text: "#ffb0b0" };
export const AMBER: GlassTone = { tone: "#ffb02e", text: "#ffd78a" };

export type GlassShowcaseProps = {
  windowTitle: string;
  ariaLabel: string;
  stats: ({ label: string; value: string } & GlassTone)[];
  flow: ({ label: string } & GlassTone)[];
  /** Four feature pills, placed top-right, left, bottom-right and bottom-left of the window. */
  pills: { icon: LucideIcon; label: string }[];
  heading: string;
  body: string;
};

const ORANGE = "#ff7f3f";
const GLASS = "border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_24px_48px_-16px_rgba(0,0,0,0.55)] backdrop-blur-xl";

const PILL_SPOTS = [
  { className: "top-0 right-8", delay: "-2s" },
  { className: "top-[74px] -left-5", delay: "-4s" },
  { className: "top-[258px] -right-5", delay: "-1s" },
  { className: "bottom-0 left-3", delay: "-3s" },
];

function Pill({ icon: Icon, label, className, delay }: { icon: LucideIcon; label: string; className: string; delay: string }) {
  return (
    <div className={`kf-float absolute flex items-center gap-2 rounded-circle py-1.5 pr-4 pl-1.5 ${GLASS} bg-white/15 ${className}`} style={{ animationDelay: delay }}>
      <span className="grid size-7 place-items-center rounded-circle" style={{ background: ORANGE }}>
        <Icon className="size-3.5 text-[#1a0f08]" aria-hidden />
      </span>
      <span className="text-body-sm whitespace-nowrap text-white">{label}</span>
    </div>
  );
}

export function GlassShowcase({ windowTitle, ariaLabel, stats, flow, pills, heading, body }: GlassShowcaseProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-10 text-center">
      {/* Light sources behind the glass. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-20 size-[300px] rounded-circle opacity-80 blur-[70px]" style={{ background: ORANGE }} />
        <div className="absolute right-[-90px] bottom-24 size-[260px] rounded-circle opacity-50 blur-[80px]" style={{ background: "#ffb381" }} />
        <div className="absolute bottom-[-80px] left-10 size-[200px] rounded-circle opacity-40 blur-[70px]" style={{ background: "#bd4b00" }} />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 75%)" }}
        />
      </div>

      {/* Glass scene: a product window with four feature pills floating around it. */}
      <div role="img" aria-label={ariaLabel} className="relative h-[310px] w-[372px]">
        <div className={`kf-float absolute inset-x-0 top-8 h-[240px] rounded-[20px] ${GLASS}`}>
          <div className="flex items-center gap-1.5 border-b border-white/15 px-5 py-3.5">
            {["#ff6b5e", "#ffbd44", "#3ddc84"].map((c) => (
              <span key={c} className="size-2 rounded-circle" style={{ background: c, opacity: 0.85 }} />
            ))}
            <span className="ml-2 text-body-sm text-white/55">{windowTitle}</span>
          </div>
          <div className="mt-[44px] grid grid-cols-3 gap-3 px-5">
            {stats.map((t) => (
              <div key={t.label} className="rounded-medium border px-3 py-3 text-left" style={{ background: `${t.tone}1f`, borderColor: `${t.tone}59` }}>
                <p className="text-body-sm text-white/60">{t.label}</p>
                <p className="text-subtitle-md tabular-nums" style={{ color: t.text }}>{t.value}</p>
              </div>
            ))}
          </div>
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-medium border border-dashed border-white/20 px-3 py-3">
            {flow.map((f, i) => (
              <span key={f.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="w-3 border-t border-dashed border-white/30" />}
                <span className="rounded-circle border px-2.5 py-0.5 text-body-sm" style={{ background: `${f.tone}22`, borderColor: `${f.tone}66`, color: f.text }}>{f.label}</span>
              </span>
            ))}
          </div>
        </div>

        {pills.map((p, i) => (
          <Pill key={p.label} icon={p.icon} label={p.label} className={PILL_SPOTS[i].className} delay={PILL_SPOTS[i].delay} />
        ))}
      </div>

      <div className="relative mt-12">
        <p className="text-subtitle-lg text-white">{heading}</p>
        <p className="mx-auto mt-3 max-w-[270px] text-body-md text-white/65">{body}</p>
      </div>
    </div>
  );
}
