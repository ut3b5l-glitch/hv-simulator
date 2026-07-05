"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import MagneticButton from "./MagneticButton";
import WordReveal from "./WordReveal";

// The 3D track is heavy (three.js) and client-only — load it lazily so it
// never blocks first paint or SSR. The CSS gradient shows instantly.
const TrackScene = dynamic(() => import("./TrackScene"), { ssr: false, loading: () => null });

export type HeroCopy = {
  eyebrow: string;
  h1: string;
  tagline: string;
  sub: string;
  proofs: string[];
  ctaPrimary: string;
  ctaSecondary: string;
  note: string;
  scrollCue: string;
  social: string | null;
};

/** Static fallback for reduced-motion / no-WebGL: frozen data streams, right of the copy. */
function StaticTrack() {
  const cols = [70, 74, 78, 82, 86, 90];
  return (
    <svg className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {cols.map((x, c) =>
        Array.from({ length: 7 }, (_, r) => (
          <circle
            key={`${c}-${r}`}
            cx={x + ((c * 7 + r * 3) % 3) * 0.6}
            cy={18 + r * 9 + ((c * 5 + r * 2) % 4) * 1.2}
            r={0.45}
            fill={c % 3 === 0 ? "#D3B358" : c % 3 === 1 ? "#F9EF98" : "#6BC34B"}
            opacity={0.3 + ((c + r) % 4) * 0.15}
          />
        )),
      )}
    </svg>
  );
}

/**
 * Full-viewport hero: the 3D floodlit oval behind the headline, wedge-proof
 * chips, and a magnetic butter CTA. The sky parallaxes gently as you scroll
 * out; a scroll cue fades as soon as you move.
 */
export default function Hero({ copy }: { copy: HeroCopy }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const cueOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const skyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 110]);

  return (
    <section ref={ref} id="top" className="relative isolate flex min-h-[92svh] w-full items-center overflow-hidden">
      {/* deepen the top of the page gradient behind the 3D field */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1000px 620px at 70% 30%, rgba(249,239,152,0.06), transparent 62%), linear-gradient(180deg, rgba(10,10,9,0.55) 0%, rgba(10,10,9,0.15) 55%, transparent 100%)",
        }}
      />

      {/* the floodlit oval (or static fallback) */}
      <motion.div aria-hidden className="absolute inset-0 -z-10" style={{ y: skyY }}>
        {reduce ? <StaticTrack /> : <TrackScene />}
      </motion.div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-32 sm:pt-36">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/5 px-3.5 py-1.5 backdrop-blur">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-green" />
            <span className="text-caption font-semibold tracking-tight text-ink-50">{copy.eyebrow}</span>
          </div>

          <h1 className="mt-5 text-[2.5rem] font-medium leading-[1.04] tracking-tight text-ink-50 sm:text-[3.4rem] lg:text-[4rem]">
            <WordReveal text={copy.h1} />
          </h1>
          <p className="mt-3 text-headline font-medium text-accent-yellow/90">{copy.tagline}</p>
          <p className="mt-5 max-w-xl text-body leading-relaxed text-ink-60">{copy.sub}</p>

          {/* wedge proof chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            {copy.proofs.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-white/5 px-3 py-1.5 text-caption font-semibold text-ink-50 backdrop-blur"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-accent-green" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {p}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MagneticButton
              href="#join"
              className="butter-panel btn-sheen tap rounded-pill px-8 py-4 text-callout font-bold tracking-wide"
            >
              {copy.ctaPrimary}
            </MagneticButton>
            <MagneticButton
              href="#showcase"
              strength={0.22}
              className="tap rounded-pill border border-white/20 bg-white/5 px-7 py-4 text-callout font-semibold tracking-wide text-ink-50 backdrop-blur transition-colors hover:bg-white/10"
            >
              {copy.ctaSecondary}
            </MagneticButton>
          </div>

          <p className="mt-5 text-caption text-ink-70">{copy.note}</p>
          {copy.social && (
            <p className="num mt-2 text-caption font-medium text-ink-60">{copy.social}</p>
          )}
        </div>
      </div>

      {/* scroll cue */}
      <motion.div
        style={{ opacity: cueOpacity }}
        className="pointer-events-none absolute inset-x-0 bottom-6 hidden flex-col items-center gap-1.5 lg:flex"
      >
        <span className="text-micro font-semibold uppercase tracking-eyebrow text-ink-70">
          {copy.scrollCue}
        </span>
        <motion.span
          aria-hidden
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="text-ink-70"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </motion.span>
      </motion.div>
    </section>
  );
}
