import { useEffect, useRef } from 'react'
import type { LcuEvent } from '@shared/lcu-types'
import { getLcu } from './lcuBridge'

/**
 * S'abonne aux événements LCU relayés par le main et n'appelle `handler` que
 * pour les URIs commençant par l'un des préfixes fournis.
 */
export function useLcuEvent(
  uriPrefix: string | string[],
  handler: (event: LcuEvent) => void,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const key = Array.isArray(uriPrefix) ? uriPrefix.join('|') : uriPrefix

  useEffect(() => {
    const prefixes = key.split('|')
    try {
      return getLcu().onEvent((event) => {
        if (prefixes.some((p) => event.uri.startsWith(p))) handlerRef.current(event)
      })
    } catch {
      return undefined
    }
  }, [key])
}
