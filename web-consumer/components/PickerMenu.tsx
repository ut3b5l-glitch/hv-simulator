"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "./Icons";

/**
 * PickerMenu — the app's one dropdown control: a glass pill button that opens a
 * portalled glass menu. Shared by the Races-tab date picker (MeetingPicker) and
 * the Simulator's meeting selector so every dropdown in the app reads the same.
 *
 * The menu is portalled to <body> rather than rendered inline: inline, it loses
 * the z-order fight to the glass tiles below, whose `backdrop-filter` promotes
 * them to composited layers that paint over any higher-z-index ancestor inside
 * <main> (a Chromium/WebKit bug). Body-level lifting puts it cleanly on top.
 *
 * `children` is a render-prop given `close` so menu items can dismiss the menu
 * after a selection (Link click or onChange callback).
 */
export default function PickerMenu({
  label,
  children,
  widthClass = "w-60",
  menuLabel,
}: {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  widthClass?: string;
  menuLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

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

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        className="glass tap flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-callout font-medium text-ink-50"
      >
        {label}
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
            <div className="fixed inset-0 z-[90]" onClick={close} />
            <div
              role="menu"
              style={{ top: pos.top, right: pos.right }}
              className={`glass-strong animate-expand-down fixed z-[100] ${widthClass} overflow-hidden rounded-card shadow-glass-3`}
            >
              {children(close)}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
