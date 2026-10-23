"use client";
import { useEffect, useRef } from "react";

// Calm dot field for the empty canvas behind auth cards (after Mercury's Books page). Dots gather
// in two soft clouds (top-right, bottom-left), drift on a slow wave current and fade in and out.
// The cursor gently parts them; they ease back once it moves on. Colour follows --color-primary;
// reduced-motion gets one still frame.

type Dot = { x: number; y: number; ox: number; oy: number; age: number; life: number; r: number };

const PUSH = 110; // cursor influence radius
const DRIFT = 0.18; // px per frame

export function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let color = "";
    let raf = 0;
    const mouse = { x: -1e4, y: -1e4 };

    const readColor = () => {
      color = getComputedStyle(canvas).getPropertyValue("--color-primary").trim() || "#f76808";
    };

    // 0..1 density: two gaussian clouds so the field frames the card instead of sitting behind it.
    const density = (x: number, y: number) => {
      const g = (cx: number, cy: number, s: number) => Math.exp(-(((x - cx) / s) ** 2 + ((y - cy) / s) ** 2));
      const s = Math.max(w, h);
      return Math.min(1, g(w * 0.82, h * 0.08, s * 0.4) + 0.85 * g(w * 0.08, h * 0.98, s * 0.34));
    };

    const spawn = (d: Dot) => {
      for (let i = 0; i < 20; i++) {
        d.x = Math.random() * w;
        d.y = Math.random() * h;
        if (Math.random() < density(d.x, d.y)) break;
      }
      d.ox = 0;
      d.oy = 0;
      d.age = 0;
      d.life = 600 + Math.random() * 900;
      d.r = 0.9 + Math.random() * 0.7;
      return d;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 900);
      dots = Array.from({ length: n }, () => {
        const d = spawn({ x: 0, y: 0, ox: 0, oy: 0, age: 0, life: 0, r: 0 });
        d.age = Math.random() * d.life;
        return d;
      });
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      const tt = t * 0.00006;
      for (const d of dots) {
        if (!still) {
          // Smooth flow field plus a long travelling wave — reads as a slow swell, not noise.
          const a = (Math.sin(d.x * 0.0018 + tt) + Math.cos(d.y * 0.0022 - tt * 1.2)) * Math.PI * 0.5;
          d.x += Math.cos(a) * DRIFT;
          d.y += Math.sin(a) * DRIFT + Math.sin(d.x * 0.004 + t * 0.0005) * 0.08;

          // Cursor parts the field; the offset springs back when it leaves.
          const px = d.x + d.ox - mouse.x;
          const py = d.y + d.oy - mouse.y;
          const dist = Math.hypot(px, py);
          if (dist < PUSH && dist > 0) {
            const k = (1 - dist / PUSH) ** 2 * 2.4;
            d.ox += (px / dist) * k;
            d.oy += (py / dist) * k;
          }
          d.ox *= 0.94;
          d.oy *= 0.94;

          if (++d.age > d.life || d.x < -4 || d.x > w + 4 || d.y < -4 || d.y > h + 4) spawn(d);
        }
        const x = d.x + d.ox;
        const y = d.y + d.oy;
        const alpha = Math.sin((d.age / d.life) * Math.PI) * density(d.x, d.y) * 0.7;
        if (alpha < 0.03) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };

    readColor();
    resize();
    raf = requestAnimationFrame(draw);

    // Canvas sits under the card with pointer-events off, so track the pointer on the window.
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -1e4;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw(0);
    });
    ro.observe(canvas);
    // ThemeShell flips light/dark as a class on its own div; re-read the colour when it does.
    const mo = new MutationObserver(() => {
      readColor();
      if (still) draw(0);
    });
    mo.observe(canvas.closest("[data-product]") ?? document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
