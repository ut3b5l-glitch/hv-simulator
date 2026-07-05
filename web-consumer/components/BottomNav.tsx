"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlagIcon, DieIcon, TrophyIcon, ChartIcon, SparkIcon } from "./Icons";

// Five tabs, five jobs, in the order of a race night: what we forecast, ask
// the analyst, play the race, what actually happened tonight, and the
// long-run proof we're honest. (Profiles stays routable at /profiles — it's
// an enthusiast page, not a tab.)
const ITEMS = [
  { href: "/", label: "Picks", Icon: FlagIcon },
  { href: "/ask", label: "Ask", Icon: SparkIcon },
  { href: "/simulator", label: "Simulator", Icon: DieIcon },
  { href: "/results", label: "Results", Icon: TrophyIcon },
  { href: "/performance", label: "Record", Icon: ChartIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  // The onboarding flow owns the whole screen — no nav until you're in.
  if (pathname.startsWith("/onboarding")) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto mb-3 w-full max-w-screen-sm px-4">
        <div className="glass-strong flex items-center justify-around rounded-pill p-1.5 shadow-glass-3">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`tap relative flex flex-1 flex-col items-center justify-center gap-1 rounded-pill px-2 py-2 transition-colors duration-300 ${
                  active ? "text-navy" : "text-ink-70"
                }`}
              >
                {active && (
                  <span className="butter-panel absolute inset-0 rounded-pill" />
                )}
                <Icon
                  className={`relative h-5 w-5 ${active ? "text-navy" : ""}`}
                />
                <span className="relative text-micro2 font-semibold tracking-wide">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
