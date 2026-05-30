import { CSSProperties, ReactNode } from "react";

type Level = 1 | 2 | 3;

const LEVEL_CLASS: Record<Level, string> = {
  1: "glass-tile",
  2: "glass shadow-glass-2",
  3: "glass-strong shadow-glass-3",
};

/**
 * Surface primitive. `level` controls depth (1 nested tile → 3 raised),
 * `accent` swaps in the gold-tinted treatment for value/highlight surfaces.
 * `strong` is kept as a back-compat alias for level 3.
 */
export default function GlassCard({
  children,
  className = "",
  level = 2,
  accent = false,
  strong = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  level?: Level;
  accent?: boolean;
  strong?: boolean;
  style?: CSSProperties;
}) {
  const base = accent
    ? "glass-gold shadow-glass-2"
    : LEVEL_CLASS[strong ? 3 : level];
  return (
    <div className={`${base} rounded-card ${className}`} style={style}>
      {children}
    </div>
  );
}
