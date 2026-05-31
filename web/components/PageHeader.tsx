import { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="animate-fade-in flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-1 text-display font-semibold leading-none">{title}</h1>
        {subtitle && <div className="mt-2 text-caption text-ink-70">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
