import type { ConnectionStatus } from '@shared/lcu-types'
import { cn } from '../../lib/cn'

const LABEL: Record<ConnectionStatus, { text: string; dot: string; fg: string }> = {
  connected: { text: 'Client connecté', dot: 'bg-ok', fg: 'text-ok' },
  connecting: { text: 'Connexion…', dot: 'bg-gold-400 animate-pulse', fg: 'text-gold-400' },
  idle: { text: 'Client non détecté', dot: 'bg-gold-700', fg: 'text-gold-700' },
}

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  const s = LABEL[status]
  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap border border-gold-800 bg-hextech-black/60 px-3 py-1 font-display text-[10px] uppercase tracking-hexwide"
      role="status"
      aria-live="polite"
    >
      <span className={cn('h-2 w-2 rotate-45', s.dot)} />
      <span className={s.fg}>{s.text}</span>
    </div>
  )
}
