import { useCallback, useEffect, useState } from 'react'
import type { StaticDataSummary } from '@shared/staticdata-types'
import { getStaticData } from './staticDataBridge'

export interface UseStaticData {
  summary: StaticDataSummary | null
  /** Force une vérification de patch. */
  refresh: () => Promise<void>
}

/** Résumé du pipeline de données statiques, tenu à jour via `staticdata:updated`. */
export function useStaticData(): UseStaticData {
  const [summary, setSummary] = useState<StaticDataSummary | null>(null)

  useEffect(() => {
    let active = true
    let unsubscribe = (): void => {}
    try {
      const sd = getStaticData()
      sd.getSummary()
        .then((s) => {
          if (active) setSummary(s)
        })
        .catch(() => {})
      unsubscribe = sd.onUpdated((s) => {
        if (active) setSummary(s)
      })
    } catch {
      /* preload indisponible */
    }
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      await getStaticData().refresh()
      setSummary(await getStaticData().getSummary())
    } catch {
      /* ignoré */
    }
  }, [])

  return { summary, refresh }
}
