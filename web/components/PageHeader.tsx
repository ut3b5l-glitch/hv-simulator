import { ReactNode } from "react";
import Wordmark from "./Wordmark";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  hero = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  hero?: boolean;
}) {
  if (hero) {
    return (
      <header className="hero-grad animate-fade-in overflow-hidden rounded-squircle p-5">
        <div className="flex items-center justify-between gap-3">
          <Wordmark tone="light" />
          {right}
        </div>
        <div className="mt-6">
          <div className="text-micro font-semibold uppercase tracking-eyebrow text-mint/70">
            {eyebrow}
          </div>
          <h1 className="mt-1.5 text-display font-bold leading-none tracking-tight text-mint">
            {title}
          </h1>
          {subtitle && <div className="mt-2 text-caption text-mint/65">{subtitle}</div>}
        </div>
      </header>
    );
  }

  return (
    <header className="animate-fade-in flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-1 text-display font-bold leading-none tracking-tight">{title}</h1>
        {subtitle && <div className="mt-2 text-caption text-ink-70">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        {right}
        <Wordmark tone="dark" />
      </div>
    </header>
  );
}
