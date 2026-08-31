import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant =
  | 'default'
  | 'gold'
  | 'primary'
  | 'ghost'
  | 'accept'
  | 'ban'
  | 'decline'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  gold: 'hx-btn--gold',
  primary: 'hx-btn--primary',
  ghost: 'hx-btn--ghost',
  accept: 'hx-btn--accept',
  ban: 'hx-btn--ban',
  decline: 'hx-btn--decline',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'hx-btn--sm',
  md: '',
  lg: 'hx-btn--lg',
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('hx-btn', VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      <span className="hx-btn__sheen" aria-hidden="true" />
      <span>{children}</span>
    </button>
  )
}
