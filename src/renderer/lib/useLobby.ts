import { useCallback, useEffect, useState } from 'react'
import type { GameQueue, Lobby, MatchmakingSearch } from '@shared/lcu-types'
import { getLcu } from './lcuBridge'
import { useLcuEvent } from './useLcuEvent'

export interface LobbyController {
  lobby: Lobby | null
  search: MatchmakingSearch | null
  queues: GameQueue[]
  inQueue: boolean
  busy: boolean
  error: string | null
  createLobby: (queueId: number) => Promise<void>
  leaveLobby: () => Promise<void>
  startSearch: () => Promise<void>
  stopSearch: () => Promise<void>
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Action impossible'
}

/**
 * État du lobby + recherche de partie, synchronisé par lecture initiale puis
 * par les événements `/lol-lobby/` et `/lol-matchmaking/search`.
 */
export function useLobby(connected: boolean): LobbyController {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [search, setSearch] = useState<MatchmakingSearch | null>(null)
  const [queues, setQueues] = useState<GameQueue[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) {
      setLobby(null)
      setSearch(null)
      setQueues([])
      return
    }
    let active = true
    const lcu = getLcu()

    lcu
      .read<Lobby>('/lol-lobby/v2/lobby')
      .then((res) => {
        if (active) setLobby(res.ok ? res.data : null)
      })
      .catch(() => {})
    lcu
      .read<MatchmakingSearch>('/lol-matchmaking/v1/search')
      .then((res) => {
        if (active) setSearch(res.ok ? res.data : null)
      })
      .catch(() => {})
    lcu
      .read<GameQueue[]>('/lol-game-queues/v1/queues')
      .then((res) => {
        if (active && res.ok && Array.isArray(res.data)) setQueues(res.data)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [connected])

  useLcuEvent('/lol-lobby/v2/lobby', (event) => {
    if (event.eventType === 'Delete') setLobby(null)
    else setLobby((event.data as Lobby) ?? null)
  })

  useLcuEvent('/lol-matchmaking/v1/search', (event) => {
    if (event.eventType === 'Delete') setSearch(null)
    else setSearch((event.data as MatchmakingSearch) ?? null)
  })

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }, [])

  const controller: LobbyController = {
    lobby,
    search,
    queues,
    inQueue: search?.searchState === 'Searching',
    busy,
    error,
    createLobby: (queueId) => run(() => getLcu().createLobby(queueId)),
    leaveLobby: () => run(() => getLcu().leaveLobby()),
    startSearch: () => run(() => getLcu().startMatchmaking()),
    stopSearch: () => run(() => getLcu().stopMatchmaking()),
  }
  return controller
}
