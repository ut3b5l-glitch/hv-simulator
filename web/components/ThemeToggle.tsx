"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./Icons";

type Theme = "dark" | "light";

/**
 * Light/dark toggle. The pre-paint script in the layout sets `data-theme` from
 * localStorage before React mounts; this just reads it, flips it, and persists.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("hv-theme", next);
    } catch {
      /* private mode / storage disabled — runtime toggle still works */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="glass tap grid h-9 w-9 shrink-0 place-items-center rounded-pill text-ink-60"
    >
      {theme === "dark" ? (
        <MoonIcon className="h-[1.05rem] w-[1.05rem]" />
      ) : (
        <SunIcon className="h-[1.1rem] w-[1.1rem] text-accent-gold" />
      )}
    </button>
  );
}
