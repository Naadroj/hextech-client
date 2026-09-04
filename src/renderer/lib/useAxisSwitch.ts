import { useCallback, useEffect, useState } from 'react'
import type { BuildAxis } from '@shared/build-types'
import type { CoachAdvice } from '@shared/coach-types'
import { getCoach } from './coachBridge'

/**
 * État du segmenté d'axe. La vérité vit dans le main (`coach.axisOverride`,
 * remis à zéro à chaque partie) ; on garde ici une valeur optimiste le temps de
 * l'aller-retour IPC pour que le clic soit ressenti comme instantané.
 */
export function useAxisSwitch(advice: CoachAdvice): {
  axis: BuildAxis | null
  available: boolean
  setAxis: (axis: BuildAxis | null) => void
} {
  const server = advice.axisOverride
  const [optimistic, setOptimistic] = useState<BuildAxis | null | undefined>(undefined)

  // Le conseil poussé a rattrapé le clic : on rend la main à la valeur du main.
  useEffect(() => setOptimistic(undefined), [server])

  const setAxis = useCallback((axis: BuildAxis | null): void => {
    setOptimistic(axis)
    try {
      void getCoach()
        .setAxis(axis)
        .catch(() => setOptimistic(undefined))
    } catch {
      setOptimistic(undefined) // hors Electron
    }
  }, [])

  return {
    axis: optimistic === undefined ? server : optimistic,
    available: advice.axisSwitchAvailable,
    setAxis,
  }
}
