"use client";

import Link from "next/link";
import { ReactNode, useRef } from "react";

/**
 * A button/link that leans toward the cursor while hovered — the small
 * magnetic pull of a polished landing CTA. In-page anchors render a plain
 * <a> (SmoothScroll routes them through Lenis); other hrefs get a <Link>.
 * Magnetism is skipped on coarse pointers / reduced-motion.
 */
export default function MagneticButton({
  href,
  children,
  className = "",
  strength = 0.35,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const raf = useRef(0);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    if (
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * strength;
    const dy = (e.clientY - (r.top + r.height / 2)) * strength;
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0,0)";
  };

  const cls = `inline-block transition-transform duration-300 ease-out-back ${className}`;

  if (href.startsWith("#")) {
    return (
      <a ref={ref} href={href} onPointerMove={onMove} onPointerLeave={onLeave} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link ref={ref} href={href} onPointerMove={onMove} onPointerLeave={onLeave} className={cls}>
      {children}
    </Link>
  );
}
