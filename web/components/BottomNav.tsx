"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Races", icon: "🏇" },
  { href: "/performance", label: "Performance", icon: "📈" },
  { href: "/profiles", label: "Profiles", icon: "👤" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto mb-3 w-full max-w-screen-sm px-4">
        <div className="glass-strong flex items-center justify-around rounded-[28px] px-2 py-2 shadow-glass">
          {ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 transition-all ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:text-white/85"
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-[11px] font-medium tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
