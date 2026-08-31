import type { ConnectionStatus } from '@shared/lcu-types'
import { cn } from '../../lib/cn'

const LABEL: Record<ConnectionStatus, { text: string; dot: string; fg: string }> = {
  connected: { text: 'Client connecté', dot: 'bg-ok', fg: 'text-ok' },
  connecting: { text: 'Connexion…', dot: 'bg-gold-400 animate-pulse', fg: 'text-gold-400' },
  idle: { text: 'Client non détecté', dot: 'bg-gold-600', fg: 'text-gold-600' },
}

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  const s = LABEL[status]
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 font-body text-[11px] uppercase tracking-widest"
      role="status"
      aria-live="polite"
    >
      <span className={cn('h-2 w-2 rounded-full', s.dot)} />
      <span className={s.fg}>{s.text}</span>
    </div>
  )
}
