/**
 * Icône de bug (trait, pas d'emoji : le rendu des emojis varie d'une machine à
 * l'autre et jure avec la charte hextech).
 */
export function BugIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      {/* corps */}
      <path d="M5 6.5a3 3 0 0 1 6 0v3a3 3 0 0 1-6 0z" />
      {/* tête et antennes */}
      <path d="M6.2 4.2A2 2 0 0 1 9.8 4.2" />
      <path d="M5.8 2.4 6.6 3.6M10.2 2.4 9.4 3.6" />
      {/* pattes */}
      <path d="M5 7H2.6M5 9.5H2.8M11 7h2.4M11 9.5h2.2M5.4 11.6 3.8 13M10.6 11.6 12.2 13" />
    </svg>
  )
}
