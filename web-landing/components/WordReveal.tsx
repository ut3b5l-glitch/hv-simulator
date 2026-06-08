import { Fragment } from "react";

/**
 * Splits a headline into words that each clip upward in sequence on load (the
 * pure-CSS `word-up` keyframe in globals.css). The stagger is set per word via
 * an inline animation-delay. A normal space between words preserves wrapping;
 * the per-word spans are aria-hidden and the whole is labelled for a11y/SEO.
 */
export default function WordReveal({
  text,
  className = "",
  stagger = 55,
}: {
  text: string;
  className?: string;
  stagger?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={`word-reveal ${className}`} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span aria-hidden style={{ animationDelay: `${i * stagger}ms` }}>
            {word}
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
