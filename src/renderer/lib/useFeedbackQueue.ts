import { useCallback, useEffect, useState } from 'react'
import type { FeedbackPushResult, FeedbackReport } from '@shared/feedback-types'
import { getFeedback } from './feedbackBridge'

/**
 * File des signalements en attente. Rien ne part tant que `push()` n'est pas
 * appelé : c'est le seul moment où un rapport quitte la machine.
 */
export function useFeedbackQueue(reloadKey?: unknown): {
  reports: FeedbackReport[]
  loading: boolean
  pushing: boolean
  result: FeedbackPushResult | null
  annotate: (id: string, comment: string) => Promise<void>
  discard: (id: string) => Promise<void>
  push: () => Promise<void>
  reload: () => void
} {
  const [reports, setReports] = useState<FeedbackReport[]>([])
  const [loading, setLoading] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [result, setResult] = useState<FeedbackPushResult | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let active = true
    try {
      void getFeedback()
        .list()
        .then((r) => {
          if (!active) return
          setReports(r)
          setLoading(false)
        })
        .catch(() => active && setLoading(false))
    } catch {
      setLoading(false) // hors Electron
    }
    return () => {
      active = false
    }
  }, [tick, reloadKey])

  const annotate = useCallback(
    async (id: string, comment: string) => {
      try {
        await getFeedback().annotate(id, comment)
      } catch {
        /* ignoré */
      }
      reload()
    },
    [reload],
  )

  const discard = useCallback(
    async (id: string) => {
      try {
        await getFeedback().discard(id)
      } catch {
        /* ignoré */
      }
      reload()
    },
    [reload],
  )

  const push = useCallback(async () => {
    setPushing(true)
    try {
      setResult(await getFeedback().push())
    } catch {
      setResult({ sent: 0, remaining: reports.length, error: 'network' })
    } finally {
      setPushing(false)
      reload()
    }
  }, [reload, reports.length])

  return { reports, loading, pushing, result, annotate, discard, push, reload }
}
