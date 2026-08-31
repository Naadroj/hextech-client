import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Divider } from './Divider'

export interface ModalProps {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children: ReactNode
  /** Désactive la fermeture au clic sur le fond / touche Échap. */
  dismissable?: boolean
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissable = true,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissable, onClose])

  if (!open) return null

  return (
    <div
      className="hx-modal-backdrop"
      role="presentation"
      onClick={() => dismissable && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn('hx-panel animate-pulse-gold w-full max-w-lg', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title != null && (
          <>
            <h2>{title}</h2>
            <Divider />
          </>
        )}
        {children}
      </div>
    </div>
  )
}
