import { useEffect, useState } from 'react'
import type { GameflowPhase } from '@shared/lcu-types'
import { getLcu } from './lcuBridge'
import { useLcuEvent } from './useLcuEvent'

/** Phase `gameflow` courante, initialisée par lecture puis suivie via events. */
export function useGameflow(connected: boolean): GameflowPhase {
  const [phase, setPhase] = useState<GameflowPhase>('None')

  useEffect(() => {
    if (!connected) {
      setPhase('None')
      return
    }
    let active = true
    getLcu()
      .read<GameflowPhase>('/lol-gameflow/v1/gameflow-phase')
      .then((res) => {
        if (active && res.ok && typeof res.data === 'string') setPhase(res.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [connected])

  useLcuEvent('/lol-gameflow/v1/gameflow-phase', (event) => {
    if (event.eventType === 'Delete') setPhase('None')
    else if (typeof event.data === 'string') setPhase(event.data as GameflowPhase)
  })

  return phase
}
