import { cn } from '../../lib/cn'

export function Divider({ className }: { className?: string }) {
  return <div role="separator" className={cn('hx-divider', className)} />
}
