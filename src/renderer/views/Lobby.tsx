import { useEffect, useMemo, useState } from 'react'
import type { ConnectionInfo, GameQueue } from '@shared/lcu-types'
import { Button, Frame, PlayButton, Tag } from '../components/hextech'
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
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function Lobby({ connection }: { connection: ConnectionInfo }) {
  const connected = connection.status === 'connected'
  const phase = useGameflow(connected)
  const { lobby, search, queues, inQueue, busy, error, createLobby, leaveLobby, startSearch, stopSearch } =
    useLobby(connected)

  const sortedQueues = useMemo(() => sortQueues(queues), [queues])

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
      <Frame title="Lobby" className="mx-auto max-w-2xl">
        <p className="text-parchment">
          En attente du client League of Legends. Lance le client officiel pour créer un lobby.
        </p>
      </Frame>
    )
  }

  if (!lobby) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl">Choisir un mode</h1>
          <p className="mt-1 text-sm text-parchment">Crée un lobby pour la file sélectionnée.</p>
        </div>
        {error && (
          <Frame className="border-decline text-decline" brackets={false} ornaments={false}>
            {error}
          </Frame>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {sortedQueues.length === 0 && (
            <p className="col-span-full text-parchment">Aucune file disponible pour le moment.</p>
          )}
          {sortedQueues.map((queue) => (
            <button
              key={queue.id}
              type="button"
              disabled={busy}
              onClick={() => void createLobby(queue.id)}
              className={cn('hx-mode-card')}
            >
              <span className="font-display uppercase tracking-hex text-gold-200">{queue.name}</span>
              {queue.isRanked && (
                <Tag tone="cyan" className="mt-1 self-start">
                  Classé
                </Tag>
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
    <div className="mx-auto max-w-3xl space-y-6">
      <Frame
        title={currentQueue?.name ?? `File ${lobby.gameConfig.queueId}`}
        headerRight={`Phase : ${phase}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-parchment">
            {lobby.members.length} / {lobby.gameConfig.maxLobbySize} invocateur(s)
          </p>
          <Button variant="ban" size="sm" disabled={busy || inQueue} onClick={() => void leaveLobby()}>
            Quitter
          </Button>
        </div>
      </Frame>

      {error && (
        <Frame className="border-decline text-decline" brackets={false} ornaments={false}>
          {error}
        </Frame>
      )}

      <div className="flex flex-col items-center gap-3 py-4">
        {inQueue ? (
          <>
            <p className="font-display text-lg uppercase tracking-hex text-gold-300">
              Recherche en cours
            </p>
            <PlayButton
              searching
              elapsedLabel={formatDuration(elapsed)}
              disabled={busy}
              onClick={() => void stopSearch()}
            >
              Annuler
            </PlayButton>
            {search?.estimatedQueueTime ? (
              <p className="text-xs text-parchment">
                Estimé ~{formatDuration(search.estimatedQueueTime)}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <PlayButton disabled={!canSearch} onClick={() => void startSearch()}>
              Rechercher une partie
            </PlayButton>
            <p className="text-xs text-parchment">
              {lobby.canStartActivity
                ? 'Prêt à lancer la recherche.'
                : 'En attente : lobby incomplet ou rôles non attribués.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
