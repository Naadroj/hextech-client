import { useEffect, useMemo, useState } from 'react'
import type { ConnectionInfo } from '@shared/lcu-types'
import { Button, Frame, PlayButton } from '../components/hextech'
import { ModeSelect } from '../components/ModeSelect'
import { groupQueues, type ModeItem } from '../lib/gameModes'
import { useGameflow } from '../lib/useGameflow'
import { useLobby } from '../lib/useLobby'

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function Lobby({ connection }: { connection: ConnectionInfo }) {
  const connected = connection.status === 'connected'
  const phase = useGameflow(connected)
  const {
    lobby,
    search,
    queues,
    inQueue,
    busy,
    error,
    createLobby,
    createPracticeTool,
    createCustom,
    leaveLobby,
    startSearch,
    stopSearch,
  } = useLobby(connected)

  const categories = useMemo(() => groupQueues(queues), [queues])

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

  if (!lobby || !lobby.gameConfig) {
    const onConfirm = (item: ModeItem) => {
      if (item.kind === 'practice') void createPracticeTool()
      else if (item.kind === 'custom') void createCustom()
      else if (item.queueId != null) void createLobby(item.queueId)
    }
    return <ModeSelect categories={categories} busy={busy} error={error} onConfirm={onConfirm} />
  }

  const currentQueue = queues.find((q) => q.id === lobby.gameConfig?.queueId)
  const canSearch = lobby.canStartActivity && !busy && phase !== 'Matchmaking'
  const memberCount = lobby.members?.length ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Frame
        title={currentQueue?.name ?? `File ${lobby.gameConfig.queueId}`}
        headerRight={`Phase : ${phase}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-parchment">
            {memberCount} / {lobby.gameConfig.maxLobbySize} invocateur(s)
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
