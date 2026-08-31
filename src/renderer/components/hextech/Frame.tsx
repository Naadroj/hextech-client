import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CornerBrackets } from './CornerBrackets'
import { SectionHeader } from './SectionHeader'

export interface FrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  /** Contenu aligné à droite dans l'en-tête. */
  headerRight?: ReactNode
  /** Équerres d'angle SVG. */
  brackets?: boolean
  /** Barres d'ornement or haut/bas. */
  ornaments?: boolean
}

/** Panneau ornemental « Hextech » : bordure or en dégradé, hairline, équerres. */
export function Frame({
  title,
  headerRight,
  brackets = true,
  ornaments = true,
  children,
  className,
  ...rest
}: FrameProps) {
  return (
    <div className={cn('hx-frame', className)} {...rest}>
      {ornaments && (
        <>
          <span className="hx-frame__bar hx-frame__bar--top" aria-hidden="true" />
          <span className="hx-frame__bar hx-frame__bar--bottom" aria-hidden="true" />
        </>
      )}
      {brackets && <CornerBrackets />}
      {title != null && <SectionHeader right={headerRight}>{title}</SectionHeader>}
      {children}
    </div>
  )
}
