"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/**
 * Eng | 中 switch (the standard HK pattern). Writes the locale cookie and calls
 * router.refresh() so the server components re-render in the new language.
 */
export default function LangToggle({ locale }: { locale: Locale }) {
  const router = useRouter();

  function set(l: Locale) {
    if (l === locale) return;
    document.cookie = `zokki_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  const base = "rounded-pill px-2.5 py-1 transition";
  const on = "bg-[rgba(255,255,255,0.92)] text-navy";
  const off = "text-ink-60";

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-pill border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] p-0.5 text-caption font-semibold shadow-glass-1 backdrop-blur-md"
    >
      <button type="button" onClick={() => set("en")} className={`${base} ${locale === "en" ? on : off}`}>
        EN
      </button>
      <button type="button" onClick={() => set("zh")} className={`${base} ${locale === "zh" ? on : off}`}>
        中
      </button>
    </div>
  );
}
