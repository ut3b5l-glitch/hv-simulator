/**
 * Tiny renderer for the AI's streamed Markdown prose — paragraphs + **bold**
 * only (that's all the prompts allow). No dependency, safe by construction:
 * everything renders as text nodes.
 */
export default function AiProse({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <div className="space-y-2.5">
      {paras.map((p, i) => (
        <p key={i} className="text-body leading-relaxed text-ink-50">
          {p.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} className="font-semibold text-accent-yellow">
                {seg.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{seg.replace(/\n/g, " ")}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
