import { useCallback, useEffect, useState } from 'react'
import type { UpdateState } from '@shared/update-types'
import { IDLE_UPDATE_STATE } from '@shared/update-types'
import { getUpdater } from './updaterBridge'

export interface UpdaterController {
  currentVersion: string
  supported: boolean
  state: UpdateState
  busy: boolean
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
}

const BUSY_PHASES = new Set(['checking', 'downloading'])

/** État de la mise à jour auto + actions (toutes explicites). */
export function useUpdater(): UpdaterController {
  const [currentVersion, setCurrentVersion] = useState('—')
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<UpdateState>({ ...IDLE_UPDATE_STATE })

  useEffect(() => {
    let active = true
    let unsub = (): void => {}
    try {
      const bridge = getUpdater()
      bridge
        .getInfo()
        .then((info) => {
          if (!active) return
          setCurrentVersion(info.currentVersion)
          setSupported(info.supported)
          setState(info.state)
        })
        .catch(() => {})
      unsub = bridge.onState((next) => {
        if (active) setState(next)
      })
    } catch {
      /* preload indisponible */
    }
    return () => {
      active = false
      unsub()
    }
  }, [])

  const check = useCallback(async () => {
    try {
      await getUpdater().check()
    } catch {
      /* l'état error est déjà poussé par le main */
    }
  }, [])
  const download = useCallback(async () => {
    try {
      await getUpdater().download()
    } catch {
      /* idem */
    }
  }, [])
  const install = useCallback(async () => {
    try {
      await getUpdater().install()
    } catch {
      /* idem */
    }
  }, [])

  return {
    currentVersion,
    supported,
    state,
    busy: BUSY_PHASES.has(state.phase),
    check,
    download,
    install,
  }
}
