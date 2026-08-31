import { cn } from '../../lib/cn'

export interface IconFrameProps {
  src?: string | null
  alt?: string
  /** Diamètre en pixels. */
  size?: number
  /** Badge de niveau affiché dans un bandeau sous l'icône. */
  level?: number
  className?: string
}

/** Icône d'invocateur cerclée d'or, avec bandeau de niveau optionnel. */
export function IconFrame({ src, alt = '', size = 96, level, className }: IconFrameProps) {
  return (
    <div
      className={cn('hx-icon-frame', className)}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt={alt} /> : <span className="block h-full w-full rounded-full" />}
      {level != null && <span className="hx-level-banner">{level}</span>}
    </div>
  )
}
