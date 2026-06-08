"use client";

import { useCallback, useRef } from "react";

/**
 * Wraps the app-preview mockup in a gentle float (inner element) plus a
 * cursor-driven 3D tilt (outer element). The two transforms live on separate
 * elements so they never fight; the float pauses while you're actively tilting
 * the card, then springs back to centre on mouse-leave.
 */
export default function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    el.classList.add("tilting");
    el.style.transition = "transform 80ms linear";
    el.style.transform = `perspective(900px) rotateY(${dx * 6}deg) rotateX(${-dy * 4.5}deg) scale(1.015)`;
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)";
    el.style.transform = "";
    el.classList.remove("tilting");
  }, []);

  return (
    <div
      ref={ref}
      className={`tilt-float ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="tilt-inner">{children}</div>
    </div>
  );
}
