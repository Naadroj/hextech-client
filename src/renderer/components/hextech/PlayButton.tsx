import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface PlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Passe en mode « annuler la recherche » avec anneau de minuterie. */
  searching?: boolean
  /** Secondes écoulées en file (affiché comme minuterie). */
  elapsedLabel?: string
}

/** Grand bouton central façon client officiel : PLAY ↔ annulation en file. */
export function PlayButton({
  searching = false,
  elapsedLabel,
  className,
  children,
  type = 'button',
  ...rest
}: PlayButtonProps) {
  return (
    <button
      type={type}
      className={cn('hx-play', searching && 'hx-play--cancel', className)}
      {...rest}
    >
      <span className="hx-play__sheen" aria-hidden="true" />
      <span className="relative z-10 flex items-center gap-3">
        {searching && elapsedLabel && (
          <span className="font-body text-sm tabular-nums text-gold-200">{elapsedLabel}</span>
        )}
        {children ?? (searching ? 'Annuler' : 'Jouer')}
      </span>
    </button>
  )
}
