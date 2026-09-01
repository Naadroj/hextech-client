import { useEffect, useState } from 'react'
import type { LiveSnapshot, LiveStatus } from '@shared/live-types'
import { getLive } from './liveBridge'

export interface LiveGameState {
  status: LiveStatus
  /** Dernier instantané reçu ; `null` hors partie. */
  snapshot: LiveSnapshot | null
}

const INITIAL: LiveGameState = { status: 'idle', snapshot: null }

/**
 * État de la partie en cours via la Live Client Data API. Lecture initiale du
 * statut + du dernier instantané, puis suivi par les événements poussés du
 * main. Quand le statut repasse à `idle`, l'instantané est effacé.
 */
export function useLiveGame(): LiveGameState {
  const [state, setState] = useState<LiveGameState>(INITIAL)

  useEffect(() => {
    let active = true
    let unsubSnapshot = (): void => {}
    let unsubStatus = (): void => {}

    try {
      const live = getLive()

      live
        .getStatus()
        .then((status) => {
          if (active) setState((prev) => ({ ...prev, status }))
        })
        .catch(() => {})
      live
        .getSnapshot()
        .then((snapshot) => {
          if (active && snapshot) setState((prev) => ({ ...prev, snapshot }))
        })
        .catch(() => {})

      unsubSnapshot = live.onSnapshot((snapshot) => {
        if (active) setState((prev) => ({ ...prev, snapshot }))
      })
      unsubStatus = live.onStatusChanged((status) => {
        if (active) {
          setState((prev) => (status === 'idle' ? { status, snapshot: null } : { ...prev, status }))
        }
      })
    } catch {
      /* preload indisponible : on reste sur INITIAL */
    }

    return () => {
      active = false
      unsubSnapshot()
      unsubStatus()
    }
  }, [])

  return state
}
