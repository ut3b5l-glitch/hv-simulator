"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient teal glow that trails the cursor with a soft spring, lending a faint
 * sense of depth behind the (translucent) glass content. Sits at z-0 and is
 * hidden on touch devices via CSS. Pure decoration — aria-hidden.
 */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Start centred so it reads as an ambient bloom before the first move.
    const place = (x: number, y: number) => {
      el.style.transform = `translate(${x - 300}px, ${y - 300}px)`;
    };
    place(window.innerWidth / 2, window.innerHeight / 2);
    const onMove = (e: MouseEvent) => place(e.clientX, e.clientY);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return <div ref={ref} aria-hidden className="cursor-glow" />;
}
