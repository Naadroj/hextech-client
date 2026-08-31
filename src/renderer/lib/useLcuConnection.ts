import { useEffect, useState } from 'react'
import type { ConnectionInfo } from '@shared/lcu-types'
import { getLcu } from './lcuBridge'

const INITIAL: ConnectionInfo = { status: 'idle', summoner: null }

/** État de connexion à la LCU, tenu à jour via l'événement `connection-changed`. */
export function useLcuConnection(): ConnectionInfo {
  const [info, setInfo] = useState<ConnectionInfo>(INITIAL)

  useEffect(() => {
    let active = true
    let unsubscribe = (): void => {}

    try {
      const lcu = getLcu()
      lcu
        .getConnection()
        .then((current) => {
          if (active) setInfo(current)
        })
        .catch(() => {})
      unsubscribe = lcu.onConnectionChanged((next) => {
        if (active) setInfo(next)
      })
    } catch {
      /* preload indisponible : on reste sur INITIAL */
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return info
}
