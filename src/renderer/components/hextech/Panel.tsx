import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Divider } from './Divider'

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
}

export function Panel({ title, children, className, ...rest }: PanelProps) {
  return (
    <div className={cn('hx-panel', className)} {...rest}>
      {title != null && (
        <>
          <h2>{title}</h2>
          <Divider />
        </>
      )}
      {children}
    </div>
  )
}
