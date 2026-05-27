import { ReactNode } from "react";

export default function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`${strong ? "glass-strong" : "glass"} rounded-squircle shadow-glass ${className}`}
    >
      {children}
    </div>
  );
}
