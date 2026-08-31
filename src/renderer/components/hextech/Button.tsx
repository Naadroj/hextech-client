import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'default' | 'accept' | 'ban'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  accept: 'hx-btn--accept',
  ban: 'hx-btn--ban',
}

export function Button({ variant = 'default', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn('hx-btn', VARIANT_CLASS[variant], className)} {...rest} />
}
