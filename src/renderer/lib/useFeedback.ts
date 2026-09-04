import { useCallback, useEffect, useState } from 'react'
import type { FeedbackState } from '@shared/feedback-types'
import { IDLE_FEEDBACK_STATE } from '@shared/feedback-types'
import { getFeedback } from './feedbackBridge'

export interface UseFeedback {
  state: FeedbackState
  setEnabled: (enabled: boolean) => Promise<void>
}

/** État des signalements, tenu à jour via `feedback:state`. */
export function useFeedback(): UseFeedback {
  const [state, setState] = useState<FeedbackState>(IDLE_FEEDBACK_STATE)

  useEffect(() => {
    let active = true
    let unsubscribe = (): void => {}
    try {
      const f = getFeedback()
      f.getState()
        .then((s) => {
          if (active) setState(s)
        })
        .catch(() => {})
      unsubscribe = f.onState((s) => {
        if (active) setState(s)
      })
    } catch {
      /* preload indisponible */
    }
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      setState(await getFeedback().setEnabled(enabled))
    } catch {
      /* ignoré */
    }
  }, [])

  return { state, setEnabled }
}
