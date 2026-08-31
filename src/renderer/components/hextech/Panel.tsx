import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SectionHeader } from './SectionHeader'

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  headerRight?: ReactNode
}

/** Panneau simple (gunmetal, fine bordure). Pour l'ornement complet : `Frame`. */
export function Panel({ title, headerRight, children, className, ...rest }: PanelProps) {
  return (
    <div className={cn('hx-panel', className)} {...rest}>
      {title != null && <SectionHeader right={headerRight}>{title}</SectionHeader>}
      {children}
    </div>
  )
}
