"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/Wordmark";
import { SparkIcon, FlagIcon, ChartIcon, CheckIcon } from "@/components/Icons";
import {
  savePrefs,
  STYLE_META,
  type PunterStyle,
  type FocusArea,
} from "@/lib/prefs";

/**
 * Onboarding — four acts, Aurellar-style: promise → punter style → focus →
 * profile reveal. Everything stays on the phone (localStorage); the payoff is
 * a personalized race-night profile that tunes the AI deep dives and Ask
 * Zokki from the very first race.
 */
type Step = "promise" | "style" | "focus" | "reveal";
const STEPS: Step[] = ["promise", "style", "focus", "reveal"];

const STYLES: { id: PunterStyle; sub: string }[] = [
  { id: "banker", sub: "Give me the solid pick and tell me straight how open the race is." },
  { id: "value", sub: "Show me where the model and the market disagree — that gap is the game." },
  { id: "story", sub: "Talk me through the race — pace, draw, form, danger. Make it vivid." },
];

const FOCUS: { id: FocusArea; title: string; sub: string }[] = [
  { id: "picks", title: "Tonight’s picks", sub: "The podium, race by race" },
  { id: "value", title: "Value vs the market", sub: "Where our odds beat theirs" },
  { id: "narrative", title: "The race story", sub: "Plain-English previews" },
  { id: "record", title: "The track record", sub: "Every result, on the books" },
];

function Progress({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.slice(0, 3).map((s, i) => (
        <span
          key={s}
          className="h-1 flex-1 rounded-pill transition-colors duration-300"
          style={{
            background: i <= Math.min(idx, 2) ? "#F9EF98" : "rgb(255 255 255 / 0.14)",
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("promise");
  const [style, setStyle] = useState<PunterStyle | null>(null);
  const [focus, setFocus] = useState<FocusArea[]>([]);

  const toggleFocus = (f: FocusArea) =>
    setFocus((cur) =>
      cur.includes(f) ? cur.filter((x) => x !== f) : cur.length >= 2 ? cur : [...cur, f],
    );

  const finish = () => {
    if (!style) return;
    savePrefs({ style, focus, onboardedAt: new Date().toISOString() });
    router.replace("/");
  };

  const meta = style ? STYLE_META[style] : null;

  return (
    <div className="flex min-h-[92svh] flex-col pb-8 pt-3">
      {step !== "reveal" && (
        <div className="mb-6 flex items-center gap-4">
          <Wordmark tone="dark" />
          <div className="flex-1">
            <Progress step={step} />
          </div>
        </div>
      )}

      {/* ══ Act 1 · The promise ══════════════════════════════ */}
      {step === "promise" && (
        <div className="flex flex-1 flex-col">
          <div className="stagger" style={{ ["--i" as string]: 0 }}>
            <div className="eyebrow">Happy Valley · Sha Tin</div>
            <h1 className="mt-2 text-[2.35rem] font-medium leading-[1.05] tracking-tight text-ink-50">
              Race night,
              <br />
              <span className="text-accent-yellow">decoded.</span>
            </h1>
            <p className="mt-3 max-w-sm text-body leading-relaxed text-ink-60">
              Zokki reads the form, the draw, the odds and the jockeys — and
              keeps an honest public score of how it does.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {[
              {
                Icon: FlagIcon,
                tint: "#F9EF98",
                title: "A read for every race",
                sub: "Model-ranked picks with a plain-English preview — in ten seconds.",
              },
              {
                Icon: SparkIcon,
                tint: "#D3B358",
                title: "Your own AI analyst",
                sub: "Deep-dive briefings and a chat that only argues from our real numbers.",
              },
              {
                Icon: ChartIcon,
                tint: "#6BC34B",
                title: "An honest scorecard",
                sub: "Every pick on record — wins, misses, and the baselines beside them.",
              },
            ].map((row, i) => (
              <div
                key={row.title}
                className="glass stagger flex items-start gap-3.5 rounded-card p-4"
                style={{ ["--i" as string]: i + 1 }}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-tile"
                  style={{ background: `${row.tint}22`, color: row.tint }}
                >
                  <row.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-headline font-semibold text-ink-50">{row.title}</span>
                  <span className="mt-0.5 block text-caption leading-snug text-ink-60">{row.sub}</span>
                </span>
              </div>
            ))}
          </div>

          <div
            className="stagger mt-4 rounded-tile bg-white/5 px-4 py-3 text-caption leading-relaxed text-ink-60"
            style={{ ["--i" as string]: 4 }}
          >
            Information &amp; entertainment only · 18+ · not a betting service.
            We never tell you to bet.
          </div>

          <div className="mt-auto pt-7">
            <button
              onClick={() => setStep("style")}
              className="butter-panel tap w-full rounded-pill px-6 py-4 text-body font-bold"
            >
              Set up my race night
            </button>
            <button
              onClick={finishSkip(router)}
              className="tap mt-3 w-full text-center text-callout font-semibold text-ink-70"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ══ Act 2 · Punter style ═════════════════════════════ */}
      {step === "style" && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-display font-medium leading-tight tracking-tight text-ink-50">
            How do you play race night?
          </h1>
          <p className="mt-2 text-body leading-relaxed text-ink-60">
            This tunes how the AI analyst talks to you. You can change it any
            time.
          </p>
          <div className="mt-6 space-y-3">
            {STYLES.map((s, i) => {
              const m = STYLE_META[s.id];
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  aria-pressed={active}
                  className={`stagger tap w-full rounded-card p-4 text-left transition-colors ${
                    active ? "glass-strong" : "glass-tile"
                  }`}
                  style={{
                    ["--i" as string]: i,
                    ...(active ? { boxShadow: `0 0 0 2px ${m.tint}` } : {}),
                  }}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-headline font-semibold text-ink-50">
                      {m.title} <span className="ml-1 text-callout text-ink-70">{m.titleZh}</span>
                    </span>
                    {active && (
                      <span style={{ color: m.tint }}>
                        <CheckIcon className="h-5 w-5" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-caption leading-snug text-ink-60">{s.sub}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-7">
            <button
              onClick={() => style && setStep("focus")}
              disabled={!style}
              className="butter-panel tap w-full rounded-pill px-6 py-4 text-body font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ══ Act 3 · Focus ════════════════════════════════════ */}
      {step === "focus" && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-display font-medium leading-tight tracking-tight text-ink-50">
            What should we surface first?
          </h1>
          <p className="mt-2 text-body leading-relaxed text-ink-60">Pick up to two.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {FOCUS.map((f, i) => {
              const active = focus.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFocus(f.id)}
                  aria-pressed={active}
                  className={`stagger tap rounded-card p-4 text-left transition-colors ${
                    active ? "glass-strong" : "glass-tile"
                  }`}
                  style={{
                    ["--i" as string]: i,
                    ...(active ? { boxShadow: "0 0 0 2px #F9EF98" } : {}),
                  }}
                >
                  <span className="block text-headline font-semibold text-ink-50">{f.title}</span>
                  <span className="mt-0.5 block text-caption text-ink-60">{f.sub}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-7">
            <button
              onClick={() => setStep("reveal")}
              disabled={focus.length === 0}
              className="butter-panel tap w-full rounded-pill px-6 py-4 text-body font-bold disabled:opacity-40"
            >
              Build my profile
            </button>
          </div>
        </div>
      )}

      {/* ══ Act 4 · The reveal ═══════════════════════════════ */}
      {step === "reveal" && meta && (
        <div className="flex flex-1 flex-col pt-4">
          <div className="hero-grad stagger overflow-hidden rounded-squircle p-6" style={{ ["--i" as string]: 0 }}>
            <div className="flex items-center justify-between">
              <Wordmark tone="light" />
              <span className="rounded-pill bg-white/15 px-2.5 py-1 text-micro font-semibold uppercase tracking-eyebrow text-mint/85">
                Race-night profile
              </span>
            </div>
            <div className="mt-6 text-micro font-semibold uppercase tracking-eyebrow text-accent-yellow/80">
              You read races like
            </div>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-[2.6rem] font-medium leading-none tracking-tight text-mint">
                {meta.title}
              </span>
              <span className="text-title text-mint/70">{meta.titleZh}</span>
            </div>
            <p className="mt-3 max-w-sm text-callout leading-relaxed text-mint/80">{meta.line}</p>
          </div>

          <div className="stagger mt-5" style={{ ["--i" as string]: 1 }}>
            <h2 className="text-headline font-semibold text-ink-50">What this unlocks</h2>
          </div>
          <div className="mt-3 space-y-3">
            {[
              {
                title: "Personalized AI deep dives",
                sub: `Every race briefing now leads with what ${meta.title} cares about.`,
              },
              {
                title: "Ask Zokki, tuned to you",
                sub: "The analyst chat answers in your register — grounded in our live numbers.",
              },
              {
                title: "Tonight’s card, ready to read",
                sub: "The banker, the podium and the full field are one tap away.",
              },
            ].map((row, i) => (
              <div
                key={row.title}
                className="glass stagger flex items-start gap-3 rounded-card p-4"
                style={{ ["--i" as string]: i + 2 }}
              >
                <span
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-tile"
                  style={{ background: `${meta.tint}22`, color: meta.tint }}
                >
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-callout font-semibold text-ink-50">{row.title}</span>
                  <span className="mt-0.5 block text-caption leading-snug text-ink-60">{row.sub}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-7">
            <button
              onClick={finish}
              className="butter-panel tap w-full rounded-pill px-6 py-4 text-body font-bold"
            >
              Show me tonight’s card
            </button>
            <p className="mt-4 text-center text-micro leading-relaxed text-ink-70">
              Stored on this device only. Information &amp; entertainment · 18+ ·
              Ping Wo Fund 1834 633.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Skip = a neutral default profile, so the gate never loops back here. */
function finishSkip(router: ReturnType<typeof useRouter>) {
  return () => {
    savePrefs({ style: "banker", focus: ["picks"], onboardedAt: new Date().toISOString() });
    router.replace("/");
  };
}
