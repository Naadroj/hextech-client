import { useCallback, useEffect, useState } from 'react'
import type { HistoryGame, HistoryGameSummary } from '@shared/history-types'
import { getHistory } from './historyBridge'

/**
 * Liste des parties enregistrées. `reloadKey` sert à rafraîchir quand la partie
 * courante avance (une nouvelle partie apparaît dès sa première proposition).
 */
export function useHistoryList(reloadKey?: unknown): {
  games: HistoryGameSummary[]
  reload: () => void
} {
  const [games, setGames] = useState<HistoryGameSummary[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let active = true
    try {
      void getHistory()
        .list()
        .then((g) => {
          if (active) setGames(g)
        })
        .catch(() => {})
    } catch {
      /* hors Electron */
    }
    return () => {
      active = false
    }
  }, [tick, reloadKey])

  return { games, reload }
}

/** Détail d'une partie (`null` tant qu'aucune n'est sélectionnée). */
export function useHistoryGame(id: string | null): HistoryGame | null {
  const [game, setGame] = useState<HistoryGame | null>(null)

  useEffect(() => {
    if (!id) {
      setGame(null)
      return
    }
    let active = true
    try {
      void getHistory()
        .get(id)
        .then((g) => {
          if (active) setGame(g)
        })
        .catch(() => {})
    } catch {
      /* hors Electron */
    }
    return () => {
      active = false
    }
  }, [id])

  return game
}
