"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MeetingSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ChevronIcon } from "./Icons";

export default function MeetingPicker({
  current,
  meetings,
}: {
  current: string;
  meetings: MeetingSummary[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // The menu is portalled to <body> (a sibling of <main>) rather than rendered
  // inline. Inline, it loses the z-order fight to the glass R-tabs below: the
  // tabs' `backdrop-filter` promotes them to composited layers that paint over
  // any higher-z-index ancestor inside <main> (a Chromium/WebKit bug). Lifting
  // it to body level — the same trick BottomNav uses — puts it cleanly on top.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const measure = () => {
      const r = btnRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="glass tap flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-callout font-medium text-ink-50"
      >
        {formatDate(current)}
        <ChevronIcon
          className={`h-3.5 w-3.5 text-ink-80 transition-transform duration-300 ease-out-expo ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[90]"
              onClick={() => setOpen(false)}
            />
            <div
              style={{ top: pos.top, right: pos.right }}
              className="glass-strong animate-expand-down fixed z-[100] w-60 overflow-hidden rounded-card shadow-glass-3"
            >
              {meetings.map((m) => (
                <Link
                  key={m.date}
                  href={`/?date=${m.date}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 text-callout transition-colors ${
                    m.date === current
                      ? "bg-white/10 text-white"
                      : "text-ink-60 hover:bg-white/5"
                  }`}
                >
                  <span>{formatDate(m.date)}</span>
                  <span className="num text-micro text-ink-80">{m.race_count} races</span>
                </Link>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
