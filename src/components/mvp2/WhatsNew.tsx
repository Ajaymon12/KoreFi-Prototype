"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { asset } from "@/lib/asset";
import { ANNOUNCEMENTS, markSeen, resetSeen, useSeen, type Announcement } from "@/lib/announcements";
import { isDemoRestaurant, useActiveRestaurant } from "@/lib/org/scope";

// The one-time "New" popup for a feature launch (lib/announcements), for owners who already use KoreFi.
// Laid out as an in-product feature intro: on top, a short looping tour of the real page (made with
// Tesseract from screenshots, design/whats-new-pnl); below, a New tag, the headline, one line and one
// way in. The clip shows the feature, so the text stays short; reduced motion gets its still.
//   - shows once per launch, a beat after the page settles, newest unseen first
//   - not for a restaurant still waiting for its first reports: that page already shows its launch state
//   - not on the launched page itself: opening it counts as seen
// Closing it any way (✕, Later, Esc, a click outside) counts as seen; the sidebar keeps its New tag
// until the page is opened. Add ?whatsnew to any /mvp2 URL to see every launch again (QA).
// Demo restaurant (isDemoRestaurant, Nonna's Slice): the newest launch shows on every page load, on any
// page, so it can be shown to the team again and again; closing it only hides it until the next refresh.

export function WhatsNew() {
  const path = usePathname();
  const seen = useSeen();
  const { ready, awaiting, brand } = useActiveRestaurant();
  const [settled, setSettled] = useState(false);
  const [demoClosed, setDemoClosed] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("whatsnew")) resetSeen();
  }, []);
  // Opening a launched page counts as seen, popup and all.
  useEffect(() => {
    const a = ANNOUNCEMENTS.find((x) => path.startsWith(x.href));
    if (a) {
      markSeen(`visit:${a.id}`);
      markSeen(`popup:${a.id}`);
    }
  }, [path]);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, []);

  if (!seen || !ready || awaiting || !settled) return null;
  if (brand && isDemoRestaurant(brand.name)) return demoClosed ? null : <Popup a={ANNOUNCEMENTS[0]} onClose={() => setDemoClosed(true)} />;
  const next = ANNOUNCEMENTS.find((a) => !seen.has(`popup:${a.id}`) && !path.startsWith(a.href));
  return next ? <Popup key={next.id} a={next} onClose={() => markSeen(`popup:${next.id}`)} /> : null;
}

function Popup({ a, onClose }: { a: Announcement; onClose: () => void }) {
  const router = useRouter();
  const primary = useRef<HTMLButtonElement>(null);
  const close = onClose;
  const go = () => {
    close();
    router.push(a.href);
  };

  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div aria-hidden onClick={close} className="absolute inset-0 kf-fade bg-black/30 backdrop-blur-[2px]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${a.id}-title`}
        className="relative flex w-full max-w-[600px] kf-pop flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_24px_64px_rgb(0_0_0/0.22)]"
      >
        {/* The feature in the product: a short looping tour of the real page */}
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-(--color-border-default) bg-(--brand-200)">
          <Clip media={a.media} label={a.title} />
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid size-8 place-items-center rounded-circle bg-(--color-background-secondary)/90 text-(--color-text-secondary) shadow-[0_1px_4px_rgb(0_0_0/0.12)] outline-none backdrop-blur-sm hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-5">
          <span className="inline-flex items-center gap-1.5 rounded-circle border border-(--color-border-default) py-0.5 pr-2.5 pl-1 text-body-sm text-(--color-text-secondary)">
            <span className="rounded-circle bg-(--color-primary) px-1.5 text-[11px] leading-[18px] font-medium text-white">New</span>
            {a.eyebrow}
          </span>
          <h2 id={`${a.id}-title`} className="mt-3 text-[22px] leading-[1.2] font-semibold tracking-[-0.01em] text-(--color-text-primary)">
            {a.title}
          </h2>
          <p className="mt-1.5 text-body-md leading-[1.5] text-(--color-text-secondary)">{a.body}</p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="text" size="small" onClick={close}>
              Later
            </Button>
            <Button ref={primary} type="primary" size="small" onClick={go}>
              Take a look
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/** The launch clip, looping and silent; a still for reduced motion (and until the clip can play). */
function Clip({ media, label }: { media: Announcement["media"]; label: string }) {
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const cls = "absolute inset-0 size-full object-cover";
  // eslint-disable-next-line @next/next/no-img-element
  if (still) return <img src={asset(media.poster)} alt={label} className={cls} />;
  return <video src={asset(media.video)} poster={asset(media.poster)} autoPlay muted loop playsInline aria-label={label} className={cls} />;
}
