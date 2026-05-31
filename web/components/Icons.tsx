type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Races — a pennant flag on a pole. */
export function FlagIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M6 3v18" />
      <path d="M6 4h11l-2.6 3.2L17 10.4H6" />
    </svg>
  );
}

/** Simulator — a die showing the diagonal three. */
export function DieIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="8.5" cy="8.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Performance — an upward line over an axis. */
export function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 4v16h16" />
      <path d="M7.5 14.5 11 11l2.6 2.4L19 7.5" />
    </svg>
  );
}

/** Profiles — a person. */
export function UserIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5.5 19.5c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6" />
    </svg>
  );
}

/** Filled star — value pick marker. */
export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.6l2.74 5.86 6.26.78-4.6 4.36 1.2 6.34L12 17.9l-5.6 3.04 1.2-6.34-4.6-4.36 6.26-.78z" />
    </svg>
  );
}

/** Chevron used for disclosure / pickers. */
export function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Search glass. */
export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

/** Moon — shown in dark mode (tap to go light). */
export function MoonIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

/** Sun — shown in light mode (tap to go dark). */
export function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
    </svg>
  );
}
