"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Hairline reading-progress bar pinned to the top of the viewport — fills
 * left→right as you move down the page, in the Zokki accent sweep
 * (green → gold → butter). Spring-smoothed so it trails the scroll a touch.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left"
      style={{
        scaleX,
        background: "linear-gradient(90deg, #6BC34B 0%, #D3B358 55%, #F9EF98 100%)",
      }}
    />
  );
}
