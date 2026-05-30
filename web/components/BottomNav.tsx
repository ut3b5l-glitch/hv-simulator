"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlagIcon, DieIcon, ChartIcon, UserIcon } from "./Icons";

const ITEMS = [
  { href: "/", label: "Races", Icon: FlagIcon },
  { href: "/simulator", label: "Simulator", Icon: DieIcon },
  { href: "/performance", label: "Performance", Icon: ChartIcon },
  { href: "/profiles", label: "Profiles", Icon: UserIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
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
                  active ? "text-white" : "text-ink-70"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 rounded-pill bg-white/10 ring-1 ring-white/10" />
                )}
                <Icon
                  className={`relative h-5 w-5 ${active ? "text-accent-gold" : ""}`}
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
