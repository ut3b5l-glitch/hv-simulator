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

/** Results — a winner's trophy on its plinth. */
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4.3v1.8A2.7 2.7 0 0 0 7 9.5" />
      <path d="M17 5h2.7v1.8A2.7 2.7 0 0 1 17 9.5" />
      <path d="M12 13v3.2" />
      <path d="M9 20h6l-1-3.8h-4z" />
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

/** Check — marks a finisher our model also tipped. */
export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5 12.5 10 17.5 19 6.5" />
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

/** Share — iOS-style box with an up arrow. */
export function ShareIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3v11" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 10H5.5v10h13V10H17" />
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

/** Zokki AI — a four-point spark. */
export function SparkIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3.5c.7 3.9 2.3 5.5 6.2 6.2-3.9.7-5.5 2.3-6.2 6.2-.7-3.9-2.3-5.5-6.2-6.2 3.9-.7 5.5-2.3 6.2-6.2Z" />
      <path d="M18.6 15.4c.35 1.95 1.15 2.75 3.1 3.1-1.95.35-2.75 1.15-3.1 3.1-.35-1.95-1.15-2.75-3.1-3.1 1.95-.35 2.75-1.15 3.1-3.1Z" />
    </svg>
  );
}

/** Send — a paper plane. */
export function SendIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4.5 11.2 19.5 4.6c.5-.22 1 .28.8.78l-6.1 15.2c-.22.55-1.02.5-1.17-.07l-1.75-6.5-6.72-1.63c-.58-.14-.64-.94-.06-1.18Z" />
      <path d="m11.3 13.9 4.6-4.6" />
    </svg>
  );
}
