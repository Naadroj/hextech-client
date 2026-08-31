/**
 * Équerres d'angle « hextech » recréées en SVG (aucun asset Riot).
 * Se positionne en absolu dans un conteneur `relative`.
 */
export function CornerBrackets({ className = 'text-gold-300' }: { className?: string }) {
  const bracket = (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <path
        d="M1 9 V1 H9 M1 1 L7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  )
  return (
    <span aria-hidden="true" className={className}>
      <span className="hx-corner hx-corner--tl">{bracket}</span>
      <span className="hx-corner hx-corner--tr">{bracket}</span>
      <span className="hx-corner hx-corner--br">{bracket}</span>
      <span className="hx-corner hx-corner--bl">{bracket}</span>
    </span>
  )
}
