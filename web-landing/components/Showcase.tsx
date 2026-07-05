"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";
import PhoneShell, { PicksScreen, DeepDiveScreen, AskScreen, RecordScreen } from "./PhoneShell";

export type ShowcaseStage = { eyebrow: string; title: string; desc: string };
export type ShowcaseCopy = {
  eyebrow: string;
  titleA: string;
  titleB: string;
  subtitle: string;
  stages: ShowcaseStage[]; // expected length 4 — one per phone screen
};

/**
 * The signature scroll moment (ported from the Aurellar landing): a phone
 * pins to the centre of the viewport while its screen — and the copy beside
 * it — cross-fade through four product stages (picks → AI deep dive → Ask
 * Zokki → track record) as you scroll. A tall track gives the pin its room;
 * `useScroll` drives every opacity/offset off the track's progress.
 * Reduced-motion → static layout.
 */
export default function Showcase({
  copy,
  proof,
}: {
  copy: ShowcaseCopy;
  proof: { ours: number; fav: number; rand: number };
}) {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });

  const screens = [
    <PicksScreen key="picks" />,
    <DeepDiveScreen key="dive" />,
    <AskScreen key="ask" />,
    <RecordScreen key="record" ours={proof.ours} fav={proof.fav} rand={proof.rand} />,
  ];

  // Four cross-fading stages. Each curve spans [0,1] with pinned flat tails.
  const op0 = useTransform(scrollYProgress, [0, 0.2, 0.27, 1], [1, 1, 0, 0]);
  const op1 = useTransform(scrollYProgress, [0, 0.2, 0.27, 0.45, 0.52, 1], [0, 0, 1, 1, 0, 0]);
  const op2 = useTransform(scrollYProgress, [0, 0.45, 0.52, 0.7, 0.77, 1], [0, 0, 1, 1, 0, 0]);
  const op3 = useTransform(scrollYProgress, [0, 0.7, 0.77, 1], [0, 0, 1, 1]);
  const ops = [op0, op1, op2, op3];

  const y0 = useTransform(scrollYProgress, [0, 0.2, 0.27, 1], [0, 0, -26, -26]);
  const y1 = useTransform(scrollYProgress, [0, 0.2, 0.3, 0.45, 0.55, 1], [26, 26, 0, 0, -26, -26]);
  const y2 = useTransform(scrollYProgress, [0, 0.45, 0.55, 0.7, 0.8, 1], [26, 26, 0, 0, -26, -26]);
  const y3 = useTransform(scrollYProgress, [0, 0.7, 0.8, 1], [26, 26, 0, 0]);
  const screenY = [y0, y1, y2, y3];

  const Header = (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-micro font-semibold uppercase tracking-eyebrow text-accent-gold">
        {copy.eyebrow}
      </div>
      <h2 className="mt-3 text-[1.9rem] font-medium leading-[1.1] tracking-tight text-ink-50 sm:text-[2.5rem]">
        {copy.titleA} <span className="text-accent-yellow">{copy.titleB}</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-body leading-relaxed text-ink-60">{copy.subtitle}</p>
    </div>
  );

  if (reduce) {
    return (
      <section id="showcase" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-16 sm:py-20">
        {Header}
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <ul className="space-y-6">
            {copy.stages.map((s) => (
              <li key={s.title}>
                <span className="text-micro font-semibold uppercase tracking-eyebrow text-accent-gold">
                  {s.eyebrow}
                </span>
                <h3 className="mt-1 text-headline font-bold text-ink-50">{s.title}</h3>
                <p className="mt-1 max-w-md text-callout leading-relaxed text-ink-60">{s.desc}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-center">
            <PhoneShell>
              <PicksScreen />
            </PhoneShell>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="showcase" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16 sm:pt-20">{Header}</div>

      {/* Tall track → gives the sticky stage room to scrub through 4 stages. */}
      <div ref={track} className="relative h-[380vh]">
        <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-6 lg:grid-cols-2 lg:gap-12">
            {/* Copy — cross-fading stack */}
            <div className="relative order-2 min-h-[10rem] lg:order-1 lg:min-h-[15rem]">
              {copy.stages.map((s, i) => (
                <motion.div
                  key={s.title}
                  style={{ opacity: ops[i] }}
                  className="absolute inset-0 flex flex-col justify-center text-center lg:text-left"
                >
                  <span className="text-micro font-semibold uppercase tracking-eyebrow text-accent-gold">
                    {s.eyebrow}
                  </span>
                  <h3 className="mt-2 text-[1.6rem] font-medium leading-tight tracking-tight text-ink-50 sm:text-[2.1rem]">
                    {s.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-body leading-relaxed text-ink-60 lg:mx-0">
                    {s.desc}
                  </p>
                </motion.div>
              ))}

              {/* stage dots */}
              <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-2 lg:left-0 lg:translate-x-0">
                {copy.stages.map((s, i) => (
                  <Dot key={s.title} active={ops[i]} />
                ))}
              </div>
            </div>

            {/* Phone — pinned, screens cross-fade inside it */}
            <div className="order-1 flex justify-center lg:order-2">
              <PhoneShell>
                {screens.map((screen, i) => (
                  <motion.div
                    key={copy.stages[i].title}
                    style={{ opacity: ops[i], y: screenY[i] }}
                    className="absolute inset-0"
                  >
                    {screen}
                  </motion.div>
                ))}
              </PhoneShell>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A progress dot whose width/colour tracks its stage's opacity. */
function Dot({ active }: { active: MotionValue<number> }) {
  const width = useTransform(active, [0, 1], [8, 26]);
  const bg = useTransform(active, [0, 1], ["rgba(255,255,255,0.18)", "rgba(249,239,152,0.9)"]);
  return <motion.span style={{ width, background: bg }} className="h-2 rounded-pill" />;
}
