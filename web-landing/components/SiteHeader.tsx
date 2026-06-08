"use client";

import { useEffect, useState } from "react";
import Wordmark from "./Wordmark";
import LangToggle from "./LangToggle";
import type { Locale } from "@/lib/i18n";

/**
 * Sticky top bar — transparent over the mint page top, frosting into glass once
 * the page is scrolled. Contents are unchanged from the original header (the
 * wordmark, language toggle, and reserve CTA); only the sticky position and the
 * scroll-driven glass state are new.
 */
export default function SiteHeader({
  locale,
  reserveLabel,
}: {
  locale: Locale;
  reserveLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header sticky top-0 z-50 ${scrolled ? "scrolled" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Wordmark tone="dark" />
        <div className="flex items-center gap-2.5">
          <LangToggle locale={locale} />
          <a
            href="#join"
            className="btn-sheen tap rounded-pill bg-navy px-4 py-2 text-callout font-semibold text-mint shadow-glow-indigo"
          >
            {reserveLabel}
          </a>
        </div>
      </div>
    </header>
  );
}
