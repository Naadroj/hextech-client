import { useCallback, useEffect, useState } from 'react'
import type { OverlayState } from '@shared/overlay-types'
import { IDLE_OVERLAY_STATE } from '@shared/overlay-types'
import { getOverlay } from './overlayBridge'

export interface UseOverlay {
  state: OverlayState
  setEnabled: (enabled: boolean) => Promise<void>
}

/** État de l'overlay in-game, tenu à jour via `overlay:state`. */
export function useOverlay(): UseOverlay {
  const [state, setState] = useState<OverlayState>(IDLE_OVERLAY_STATE)

  useEffect(() => {
    let active = true
    let unsubscribe = (): void => {}
    try {
      const o = getOverlay()
      o.getState()
        .then((s) => {
          if (active) setState(s)
        })
        .catch(() => {})
      unsubscribe = o.onState((s) => {
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
      setState(await getOverlay().setEnabled(enabled))
    } catch {
      /* ignoré */
    }
  }, [])

  return { state, setEnabled }
}
