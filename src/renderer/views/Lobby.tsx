import { useEffect, useMemo, useState } from 'react'
import type { ConnectionInfo, GameQueue } from '@shared/lcu-types'
import { Button, Panel } from '../components/hextech'
import { cn } from '../lib/cn'
import { useGameflow } from '../lib/useGameflow'
import { useLobby } from '../lib/useLobby'

/** Ordre de priorité d'affichage des files courantes. */
const QUEUE_PRIORITY = [420, 440, 400, 430, 490, 450, 900, 1700, 830, 840, 850]

function sortQueues(queues: GameQueue[]): GameQueue[] {
  return [...queues].sort((a, b) => {
    const pa = QUEUE_PRIORITY.indexOf(a.id)
    const pb = QUEUE_PRIORITY.indexOf(b.id)
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
    return a.name.localeCompare(b.name)
  })
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

export function Lobby({ connection }: { connection: ConnectionInfo }) {
  const connected = connection.status === 'connected'
  const phase = useGameflow(connected)
  const { lobby, search, queues, inQueue, busy, error, createLobby, leaveLobby, startSearch, stopSearch } =
    useLobby(connected)

  const sortedQueues = useMemo(() => sortQueues(queues), [queues])

  // Chrono local pendant la recherche, amorcé sur timeInQueue.
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!inQueue) {
      setElapsed(0)
      return
    }
    setElapsed(Math.round(search?.timeInQueue ?? 0))
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(id)
  }, [inQueue, search?.timeInQueue])

  if (!connected) {
    return (
      <Panel title="Lobby">
        <p className="text-gold-600">
          En attente du client League of Legends. Lance le client officiel pour créer un lobby.
        </p>
      </Panel>
    )
  }

  if (!lobby) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl">Choisir un mode</h1>
          <p className="mt-1 text-sm text-gold-600">Crée un lobby pour la file sélectionnée.</p>
        </div>
        {error && <Panel className="border-danger text-danger">{error}</Panel>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {sortedQueues.length === 0 && (
            <p className="col-span-full text-gold-600">Aucune file disponible pour le moment.</p>
          )}
          {sortedQueues.map((queue) => (
            <button
              key={queue.id}
              type="button"
              disabled={busy}
              onClick={() => void createLobby(queue.id)}
              className={cn(
                'hx-panel text-left transition-colors hover:border-gold-300 disabled:opacity-50',
              )}
            >
              <span className="block font-display uppercase tracking-wide text-gold-300">
                {queue.name}
              </span>
              {queue.isRanked && (
                <span className="mt-1 block text-[11px] uppercase tracking-widest text-rune-cyan">
                  Classé
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const currentQueue = queues.find((q) => q.id === lobby.gameConfig.queueId)
  const canSearch = lobby.canStartActivity && !busy && phase !== 'Matchmaking'

  return (
    <div className="space-y-6">
      <Panel title={currentQueue?.name ?? `File ${lobby.gameConfig.queueId}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gold-100/80">
              {lobby.members.length} / {lobby.gameConfig.maxLobbySize} invocateur(s)
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-gold-600">Phase : {phase}</p>
          </div>
          <Button variant="ban" disabled={busy || inQueue} onClick={() => void leaveLobby()}>
            Quitter
          </Button>
        </div>
      </Panel>

      {error && <Panel className="border-danger text-danger">{error}</Panel>}

      <Panel>
        {inQueue ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg text-gold-300">Recherche en cours</p>
              <p className="mt-1 text-sm text-gold-600">
                {formatDuration(elapsed)}
                {search?.estimatedQueueTime
                  ? ` · estimé ~${formatDuration(search.estimatedQueueTime)}`
                  : ''}
              </p>
            </div>
            <Button variant="ban" disabled={busy} onClick={() => void stopSearch()}>
              Annuler
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gold-100/80">
              {lobby.canStartActivity
                ? 'Prêt à lancer la recherche de partie.'
                : 'En attente : lobby incomplet ou rôles non attribués.'}
            </p>
            <Button variant="primary" disabled={!canSearch} onClick={() => void startSearch()}>
              Rechercher une partie
            </Button>
          </div>
        )}
      </Panel>
    </div>
  )
}
