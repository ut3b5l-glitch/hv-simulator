"use client";

import { useEffect, useState } from "react";
import ZokkiMark from "./ZokkiMark";

const SEEN_KEY = "zokki_splash_seen";

/**
 * First-run brand splash — the stacked Zokki lockup on the navy gradient (per the
 * brand-kit splash). Shows once per device (gated on localStorage), fades in,
 * holds, then fades out. Returning visitors never see it.
 */
export default function SplashScreen() {
  const [stage, setStage] = useState<"hidden" | "enter" | "show" | "leave">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    setStage("enter");
    const tShow = setTimeout(() => setStage("show"), 40);
    const tLeave = setTimeout(() => setStage("leave"), 1800);
    const tDone = setTimeout(() => {
      setStage("hidden");
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 2400);

    return () => {
      clearTimeout(tShow);
      clearTimeout(tLeave);
      clearTimeout(tDone);
    };
  }, []);

  if (stage === "hidden") return null;
  const visible = stage === "show";

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{
        opacity: visible ? 1 : 0,
        background: "linear-gradient(150deg,#1B405B 0%,#173A52 55%,#163144 100%)",
      }}
    >
      {/* warm glow echoing the icon */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 62%, rgba(44,110,107,0.45), transparent 70%)",
        }}
      />
      <div
        className={`relative flex flex-col items-center transition-all duration-700 ease-out ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
      >
        <ZokkiMark className="h-20 w-20 drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]" />
        <div className="mt-5 inline-flex items-end leading-none">
          <span className="text-[2rem] font-extrabold lowercase tracking-tight text-mint">
            zokki
          </span>
          <span
            aria-hidden
            className="mb-[0.16em] ml-[0.12em] h-[0.26em] w-[0.26em] rounded-full bg-accent-gold"
          />
        </div>
        <div className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-mint/55">
          Hong Kong Racing
        </div>
      </div>
    </div>
  );
}
