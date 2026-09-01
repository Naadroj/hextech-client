import { useEffect, useState } from 'react'
import type { CoachAdvice } from '@shared/coach-types'
import { IDLE_ADVICE } from '@shared/coach-types'
import { getCoach } from './coachBridge'

/** Dernier conseil du moteur de coaching, tenu à jour via `coach:advice`. */
export function useCoach(): CoachAdvice {
  const [advice, setAdvice] = useState<CoachAdvice>(IDLE_ADVICE)

  useEffect(() => {
    let active = true
    let unsubscribe = (): void => {}
    try {
      const coach = getCoach()
      coach
        .getAdvice()
        .then((a) => {
          if (active) setAdvice(a)
        })
        .catch(() => {})
      unsubscribe = coach.onAdvice((a) => {
        if (active) setAdvice(a)
      })
    } catch {
      /* preload indisponible */
    }
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return advice
}
