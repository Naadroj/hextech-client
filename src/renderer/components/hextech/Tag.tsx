import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'gold' | 'cyan'
}

export function Tag({ tone = 'gold', className, children, ...rest }: TagProps) {
  return (
    <span className={cn('hx-tag', tone === 'cyan' && 'hx-tag--cyan', className)} {...rest}>
      {children}
    </span>
  )
}
