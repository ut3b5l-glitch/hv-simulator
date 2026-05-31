"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 64; // px of pull (after resistance) needed to trigger a refresh
const MAX = 110;
const REST = 56; // how far the content holds open while refreshing

/**
 * Pull-to-refresh for the installed PWA (which has no browser chrome of its
 * own). Dragging down from the top past a threshold runs `router.refresh()`,
 * re-fetching the current route's server components / data snapshot.
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
          setDragging(false);
        }
        return;
      }
      const dist = Math.min(dy * 0.5, MAX); // rubber-band resistance
      pullRef.current = dist;
      setPull(dist);
      setDragging(true);
    };
    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      setDragging(false);
      if (pullRef.current >= THRESHOLD && !isPending) {
        startTransition(() => router.refresh());
      }
      pullRef.current = 0;
      setPull(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [isPending, router, startTransition]);

  const offset = isPending ? REST : pull;
  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;

  return (
    <div
      style={{
        transform: offset ? `translateY(${offset}px)` : undefined,
        transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 flex justify-center"
        style={{ opacity: isPending ? 1 : progress }}
      >
        <div
          className="glass-strong grid h-9 w-9 place-items-center rounded-full text-ink-50 shadow-glass-2"
          style={{
            transform: isPending ? undefined : `rotate(${progress * 270}deg)`,
          }}
        >
          <svg
            className={`h-4 w-4 ${isPending ? "animate-spin" : ""} ${
              armed ? "text-accent-gold" : ""
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 4v5h-5" />
          </svg>
        </div>
      </div>
      {children}
    </div>
  );
}
