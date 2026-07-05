"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Global smooth-scroll controller (Lenis) — inertia/momentum scrolling, the
 * single biggest "premium" upgrade to the scroll feel. Renders nothing; owns
 * a Lenis instance + rAF loop and rewires in-page anchor jumps through Lenis
 * so they glide (with an offset that clears the sticky header).
 *
 * Lenis drives the real window scroll, so `window.scrollY`, native `scroll`
 * events (the frosted header) and Framer Motion's `useScroll` keep working.
 * Reduced-motion users get plain native scrolling — Lenis is never started.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      // expo-out — long, soft settle.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -76 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
