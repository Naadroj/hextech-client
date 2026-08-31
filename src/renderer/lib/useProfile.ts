import { useCallback, useEffect, useState } from 'react'
import type { CurrentSummoner, RankedStats } from '@shared/lcu-types'
import { getLcu } from './lcuBridge'
import { useLcuEvent } from './useLcuEvent'

const EMPTY_RANKED: RankedStats = { soloDuo: null, flex: null }

export interface ProfileData {
  ranked: RankedStats
  iconDataUrl: string | null
  loading: boolean
}

/**
 * Agrège les données de profil (classement + icône) pour la vue Accueil.
 * Se rafraîchit à la connexion et sur les événements `/lol-ranked/`.
 */
export function useProfile(
  connected: boolean,
  summoner: CurrentSummoner | null,
): ProfileData {
  const [ranked, setRanked] = useState<RankedStats>(EMPTY_RANKED)
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshRanked = useCallback(async () => {
    if (!connected) {
      setRanked(EMPTY_RANKED)
      return
    }
    setLoading(true)
    try {
      setRanked(await getLcu().getRankedStats())
    } catch {
      setRanked(EMPTY_RANKED)
    } finally {
      setLoading(false)
    }
  }, [connected])

  useEffect(() => {
    void refreshRanked()
  }, [refreshRanked])

  const iconId = summoner?.profileIconId ?? null
  useEffect(() => {
    let active = true
    if (!connected || iconId == null) {
      setIconDataUrl(null)
      return
    }
    getLcu()
      .getProfileIcon(iconId)
      .then((url) => {
        if (active) setIconDataUrl(url)
      })
      .catch(() => {
        if (active) setIconDataUrl(null)
      })
    return () => {
      active = false
    }
  }, [connected, iconId])

  useLcuEvent('/lol-ranked/', () => {
    void refreshRanked()
  })

  return { ranked, iconDataUrl, loading }
}
