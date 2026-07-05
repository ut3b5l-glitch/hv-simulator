"use client";

/**
 * Race-night profile — set once during onboarding, read everywhere the app
 * personalizes (AI briefings, Ask Zokki, greeting copy). localStorage only:
 * Zokki has no accounts, and nothing here is sensitive.
 */
export type PunterStyle = "banker" | "value" | "story";
export type FocusArea = "picks" | "value" | "narrative" | "record";

export type ZokkiPrefs = {
  style: PunterStyle;
  focus: FocusArea[];
  name?: string;
  onboardedAt: string; // ISO date
};

const KEY = "zokki:prefs";

export const STYLE_META: Record<
  PunterStyle,
  { title: string; titleZh: string; line: string; tint: string }
> = {
  banker: {
    title: "The Banker",
    titleZh: "穩陣派",
    line: "Steady reads first. You want the most reliable pick and an honest note on what could go wrong.",
    tint: "#6BC34B",
  },
  value: {
    title: "The Value Hunter",
    titleZh: "價值獵人",
    line: "You care about the gap between our numbers and the market's. Edges first, always.",
    tint: "#D3B358",
  },
  story: {
    title: "The Storyteller",
    titleZh: "講故佬",
    line: "You want the shape of the race — pace, draw, form yards, the danger. The numbers serve the story.",
    tint: "#F9EF98",
  },
};

export function loadPrefs(): ZokkiPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ZokkiPrefs;
    if (!p || !p.style) return null;
    return p;
  } catch {
    return null;
  }
}

export function savePrefs(p: ZokkiPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode — the app still works, just unpersonalized */
  }
}

export function clearPrefs(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
