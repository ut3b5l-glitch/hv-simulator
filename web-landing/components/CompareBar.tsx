"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Receipts comparison bar. When it scrolls into view the fill grows from 0 to
 * its target width and the percentage counts up (cubic ease-out). The visual
 * styling is identical to the original static bar — only the entrance animates.
 */
export default function CompareBar({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, value]);

  return (
    <div ref={ref}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-callout ${strong ? "font-semibold text-ink-50" : "text-ink-60"}`}>{label}</span>
        <span className={`num text-headline ${strong ? "font-bold text-accent-green" : "font-semibold text-ink-60"}`}>
          {display}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-pill bg-[rgba(22,49,68,0.07)]">
        <div
          className={`h-full rounded-pill ${strong ? "bg-gradient-to-r from-accent-green to-accent-cyan" : "bg-[rgba(22,49,68,0.28)]"}`}
          style={{
            width: visible ? `${value}%` : "0%",
            transition: "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}
